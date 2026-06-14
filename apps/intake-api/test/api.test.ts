import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  fetchMock,
} from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import worker from "../src/index";
import { detectImageType } from "../src/validation";
import { sha256Hex } from "../src/util";
import { cleanupPending } from "../src/cleanup";
import { recordToMarkdown, recordRelPath, type PublicRecord } from "../src/export-md";
import { analyzeRecord } from "../src/analyze";

const ORIGIN = "https://app.test";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

function post(path: string, body: unknown, opts: { origin?: string; ip?: string } = {}) {
  return new Request(`https://api.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: opts.origin ?? ORIGIN,
      "CF-Connecting-IP": opts.ip ?? "1.2.3.4",
      "User-Agent": "test-agent",
    },
    body: JSON.stringify(body),
  });
}

function get(path: string): Request {
  return new Request(`https://api.test${path}`, { method: "GET" });
}

function put(url: string, bytes: Uint8Array): Request {
  return new Request(url, { method: "PUT", headers: { origin: ORIGIN }, body: bytes });
}

async function call(request: Request): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch!(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

function mockTurnstile(success: boolean, times = 1) {
  fetchMock
    .get("https://challenges.cloudflare.com")
    .intercept({ path: "/turnstile/v0/siteverify", method: "POST" })
    .reply(200, { success })
    .times(times);
}

const validBody = () => ({
  election: "제8회 전국동시지방선거",
  title: "테스트 제보",
  summary: "요약",
  body: "본문",
  sources: [{ url: "https://example.com/report" }],
  attachments: [{ filename: "evidence.jpg", mime: "image/jpeg", size: JPEG.byteLength }],
  turnstile_token: "tok",
});

type Started = {
  submission_id: string;
  finalize_token: string;
  uploads: { staging_key: string; put_url: string }[];
};

async function startSubmission(ip: string, body: unknown = validBody()): Promise<Started> {
  mockTurnstile(true);
  const res = await call(post("/submissions", body, { ip }));
  expect(res.status).toBe(200);
  return (await res.json()) as Started;
}

/** id 로 DB 원본 행 1건 조회(내부 필드 확인용). */
async function dbRow(id: string): Promise<Record<string, unknown> | null> {
  return env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(id).first();
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

describe("POST /submissions", () => {
  it("허용되지 않은 오리진은 403 (CORS, ACAO 없음)", async () => {
    const res = await call(post("/submissions", validBody(), { origin: "https://evil.test" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("Turnstile 실패면 403", async () => {
    mockTurnstile(false);
    const res = await call(post("/submissions", validBody(), { ip: "10.0.0.1" }));
    expect(res.status).toBe(403);
  });

  it("출처도 첨부도 없으면 400 (근거 없으면 등록 불가)", async () => {
    const body = { ...validBody(), sources: [], attachments: [] };
    const res = await call(post("/submissions", body, { ip: "10.0.0.2" }));
    expect(res.status).toBe(400);
  });

  it("source 에 url·text 가 둘 다 없으면 400", async () => {
    const body = { ...validBody(), sources: [{ type: "submitter" }] };
    const res = await call(post("/submissions", body, { ip: "10.0.0.21" }));
    expect(res.status).toBe(400);
  });

  it("허용 외 첨부 MIME 은 400", async () => {
    const body = { ...validBody(), attachments: [{ filename: "x.svg", mime: "image/svg+xml", size: 10 }] };
    const res = await call(post("/submissions", body, { ip: "10.0.0.24" }));
    expect(res.status).toBe(400);
  });

  it("텍스트 출처만 있고 첨부가 없어도 200 (직접 입력 출처)", async () => {
    mockTurnstile(true);
    const body = { ...validBody(), sources: [{ text: "현장에서 직접 목격" }], attachments: [] };
    const res = await call(post("/submissions", body, { ip: "10.0.0.22" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { uploads: unknown[] };
    expect(data.uploads).toHaveLength(0);
  });

  it("정상 제출은 200 + presigned URL + D1 pending 레코드", async () => {
    const s = await startSubmission("10.0.0.3");
    expect(s.submission_id).toBeTruthy();
    expect(s.uploads).toHaveLength(1);
    expect(s.uploads[0].staging_key).toMatch(/^_staging\//);
    expect(s.uploads[0].put_url).toContain("X-Amz-Signature");

    const row = await dbRow(s.submission_id);
    expect(row).not.toBeNull();
    expect(row!.status).toBe("pending");
    expect(row!.finalize_token).toBe(s.finalize_token);
  });

  it("동일 IP 과다 요청은 429 (rate limit)", async () => {
    mockTurnstile(true, 12);
    const ip = "10.9.9.9";
    let last = 0;
    for (let n = 0; n < 11; n++) {
      const res = await call(post("/submissions", validBody(), { ip }));
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe("POST /submissions/:id/finalize", () => {
  it("magic bytes 불일치 파일은 400 으로 거부", async () => {
    const s = await startSubmission("10.1.0.1");
    await env.EVIDENCE_BUCKET.put(s.uploads[0].staging_key, new TextEncoder().encode("hello not image"));
    const res = await call(
      post(`/submissions/${s.submission_id}/finalize`, { finalize_token: s.finalize_token }, { ip: "10.1.0.1" }),
    );
    expect(res.status).toBe(400);
  });

  it("정상 finalize: status=unverified + 정식 key 이동 + 서버 SHA-256 + staging/토큰 비움, issue_url 없음", async () => {
    const s = await startSubmission("10.1.0.2");
    await env.EVIDENCE_BUCKET.put(s.uploads[0].staging_key, JPEG);

    const res = await call(
      post(`/submissions/${s.submission_id}/finalize`, { finalize_token: s.finalize_token }, { ip: "10.1.0.2" }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      report_id: string;
      attachments: { r2_key: string; sha256: string }[];
      issue_url?: string;
    };
    expect(data.report_id).toBe(s.submission_id);
    expect(data.issue_url).toBeUndefined();

    // 서버 계산 SHA-256 이 정본
    expect(data.attachments[0].sha256).toBe(await sha256Hex(JPEG));

    // 정식 key 로 이동
    const finalKey = data.attachments[0].r2_key;
    expect(finalKey).toMatch(/^제8회/);
    expect(await env.EVIDENCE_BUCKET.get(finalKey)).not.toBeNull();
    // staging 삭제
    expect(await env.EVIDENCE_BUCKET.get(s.uploads[0].staging_key)).toBeNull();

    // D1: status 전이 + 내부필드 비움
    const row = await dbRow(s.submission_id);
    expect(row!.status).toBe("unverified");
    expect(row!.finalize_token).toBeNull();
    expect(row!.staging).toBeNull();
  });

  it("토큰 불일치는 403", async () => {
    const s = await startSubmission("10.1.0.3");
    await env.EVIDENCE_BUCKET.put(s.uploads[0].staging_key, JPEG);
    const res = await call(
      post(`/submissions/${s.submission_id}/finalize`, { finalize_token: "wrong" }, { ip: "10.1.0.3" }),
    );
    expect(res.status).toBe(403);
  });

  it("존재하지 않는 제출은 404", async () => {
    const res = await call(
      post(`/submissions/nonexistent/finalize`, { finalize_token: "x" }, { ip: "10.1.0.4" }),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /reports (정식 조회)", () => {
  const ELECTION = "조회테스트선거-A";

  async function seedConfirmed(ip: string) {
    const body = { ...validBody(), election: ELECTION, tags: ["개표소", "투표지"] };
    const s = await startSubmission(ip, body);
    await env.EVIDENCE_BUCKET.put(s.uploads[0].staging_key, JPEG);
    const fin = await call(
      post(`/submissions/${s.submission_id}/finalize`, { finalize_token: s.finalize_token }, { ip }),
    );
    expect(fin.status).toBe(200);
    return s.submission_id;
  }

  it("finalize 된 레코드가 목록에 나오고 pending 은 제외된다", async () => {
    const confirmedId = await seedConfirmed("10.3.0.1");
    // pending(미완료) 레코드 하나 생성 — 목록에 나오면 안 됨
    const pending = await startSubmission("10.3.0.2", { ...validBody(), election: ELECTION });

    const res = await call(get(`/reports?election=${encodeURIComponent(ELECTION)}`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      items: { id: string; status: string; attachment_count: number }[];
      total: number;
    };
    const ids = data.items.map((i) => i.id);
    expect(ids).toContain(confirmedId);
    expect(ids).not.toContain(pending.submission_id);
    expect(data.items.every((i) => i.status !== "pending")).toBe(true);
  });

  it("tag 필터가 동작한다", async () => {
    await seedConfirmed("10.3.0.3");
    const res = await call(get(`/reports?election=${encodeURIComponent(ELECTION)}&tag=개표소`));
    const data = (await res.json()) as { items: unknown[]; total: number };
    expect(data.total).toBeGreaterThan(0);

    const none = await call(get(`/reports?election=${encodeURIComponent(ELECTION)}&tag=없는태그zzz`));
    const noneData = (await none.json()) as { total: number };
    expect(noneData.total).toBe(0);
  });

  it("GET /reports/{id} 상세 + submitter/내부필드 비노출", async () => {
    const id = await seedConfirmed("10.3.0.4");
    const res = await call(get(`/reports/${id}`));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("submitter");
    expect(text).not.toContain("finalize_token");
    expect(text).not.toContain("staging");
    const data = JSON.parse(text) as { id: string; status: string; verification: unknown };
    expect(data.id).toBe(id);
    expect(data.status).toBe("unverified");
    expect(data.verification).toBeTruthy();
  });

  it("pending/없는 id 는 404", async () => {
    const pending = await startSubmission("10.3.0.5", { ...validBody(), election: ELECTION });
    expect((await call(get(`/reports/${pending.submission_id}`))).status).toBe(404);
    expect((await call(get(`/reports/does-not-exist`))).status).toBe(404);
  });
});

describe("pending 정리 (cleanupPending)", () => {
  it("TTL 지난 pending 레코드를 삭제한다", async () => {
    const s = await startSubmission("10.4.0.1", { ...validBody(), election: "정리테스트" });
    expect(await dbRow(s.submission_id)).not.toBeNull();

    // 미래 시점(2시간 뒤) 기준으로 정리 → createdAt 이 TTL(1h) 보다 오래됨
    await cleanupPending(env, Date.now() + 2 * 60 * 60 * 1000);
    expect(await dbRow(s.submission_id)).toBeNull();
  });
});

describe("로컬 업로드 shim (LOCAL_UPLOAD)", () => {
  beforeAll(() => {
    env.LOCAL_UPLOAD = "true";
  });
  afterAll(() => {
    env.LOCAL_UPLOAD = undefined;
  });

  it("put_url 이 /_dev/upload 를 가리키고, PUT→finalize 전 흐름이 R2 자격증명 없이 돈다", async () => {
    const s = await startSubmission("10.5.0.1");
    expect(s.uploads[0].put_url).toContain("/_dev/upload/");

    // 워커 자체 업로드 경로로 PUT(로컬 R2 적재)
    const up = await call(put(s.uploads[0].put_url, JPEG));
    expect(up.status).toBe(200);

    const fin = await call(
      post(`/submissions/${s.submission_id}/finalize`, { finalize_token: s.finalize_token }, { ip: "10.5.0.1" }),
    );
    expect(fin.status).toBe(200);
    const data = (await fin.json()) as { attachments: { sha256: string }[] };
    expect(data.attachments[0].sha256).toBe(await sha256Hex(JPEG));
  });
});

describe("관리자 검증 API (/admin/*)", () => {
  const ADMIN = "test-admin-token";
  const ELECTION = "관리자테스트선거-A";

  function adminReq(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}) {
    const headers: Record<string, string> = { origin: ORIGIN };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.token !== null) headers["authorization"] = `Bearer ${opts.token ?? ADMIN}`;
    return new Request(`https://api.test${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  }

  async function seedUnverified(ip: string, extra: Record<string, unknown> = {}): Promise<string> {
    const body = { ...validBody(), election: ELECTION, tags: ["관리자태그"], ...extra };
    const s = await startSubmission(ip, body);
    await env.EVIDENCE_BUCKET.put(s.uploads[0].staging_key, JPEG);
    const fin = await call(
      post(`/submissions/${s.submission_id}/finalize`, { finalize_token: s.finalize_token }, { ip }),
    );
    expect(fin.status).toBe(200);
    return s.submission_id;
  }

  it("토큰 없으면 401, 틀리면 401, 맞으면 200", async () => {
    expect((await call(adminReq("/admin/reports", { token: null }))).status).toBe(401);
    expect((await call(adminReq("/admin/reports", { token: "wrong" }))).status).toBe(401);
    expect((await call(adminReq("/admin/reports"))).status).toBe(200);
  });

  it("POST /admin/session 이 토큰을 검증한다", async () => {
    expect((await call(adminReq("/admin/session", { method: "POST", body: { token: "wrong" }, token: null }))).status).toBe(401);
    const ok = await call(adminReq("/admin/session", { method: "POST", body: { token: ADMIN }, token: null }));
    expect(ok.status).toBe(200);
    expect((await ok.json() as { ok: boolean }).ok).toBe(true);
  });

  it("GET /admin/reports 가 큐 목록 + 상태별 카운트를 반환", async () => {
    const id = await seedUnverified("10.6.0.1");
    const res = await call(adminReq(`/admin/reports?election=${encodeURIComponent(ELECTION)}`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { items: { id: string; submitter: string }[]; counts: Record<string, number> };
    expect(data.items.map((i) => i.id)).toContain(id);
    expect(data.items[0].submitter).toMatch(/^anon-/);
    expect(data.counts.unverified).toBeGreaterThan(0);
  });

  it("GET /admin/reports/{id} 가 내부 필드(submitter)를 포함", async () => {
    const id = await seedUnverified("10.6.0.2");
    const res = await call(adminReq(`/admin/reports/${id}`));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { submitter: string; verification: unknown };
    expect(data.submitter).toMatch(/^anon-/);
    expect(data.verification).toBeTruthy();
  });

  it("PATCH 로 reviewing 전이는 근거 없이 가능", async () => {
    const id = await seedUnverified("10.6.0.3");
    const res = await call(adminReq(`/admin/reports/${id}`, { method: "PATCH", body: { status: "reviewing" } }));
    expect(res.status).toBe(200);
    expect((await res.json() as { status: string }).status).toBe("reviewing");
  });

  it("근거 없는 confirmed 전이는 400, 근거 있으면 200 + reviewed_at 기록", async () => {
    const id = await seedUnverified("10.6.0.4");
    const noEvidence = await call(adminReq(`/admin/reports/${id}`, { method: "PATCH", body: { status: "confirmed" } }));
    expect(noEvidence.status).toBe(400);

    const ok = await call(adminReq(`/admin/reports/${id}`, {
      method: "PATCH",
      body: {
        status: "confirmed",
        reviewer: "reviewer-a1",
        verification: { method: "선관위 공지 교차확인", evidence_links: ["https://example.com/nec"] },
        tags: ["관리자태그", "확인됨"],
        rebuttals: [{ text: "선관위는 즉시 보충했다고 발표", source_url: "https://example.com/nec2" }],
      },
    }));
    expect(ok.status).toBe(200);
    const data = (await ok.json()) as { status: string; verification: { reviewed_at: string | null; method: string | null }; rebuttals: unknown[] };
    expect(data.status).toBe("confirmed");
    expect(data.verification.reviewed_at).toBeTruthy();
    expect(data.verification.method).toBe("선관위 공지 교차확인");
    expect(data.rebuttals).toHaveLength(1);
  });

  it("판정 후 method:null 로 근거를 지우려 하면 400(판정 무결성 유지)", async () => {
    const id = await seedUnverified("10.6.0.7");
    // 먼저 근거와 함께 confirmed
    const ok = await call(adminReq(`/admin/reports/${id}`, {
      method: "PATCH",
      body: { status: "confirmed", verification: { method: "교차확인", evidence_links: ["https://example.com/e"] } },
    }));
    expect(ok.status).toBe(200);
    // status 없이 method 만 null 로 — confirmed 인 채 근거 제거 시도 → 400
    const bypass = await call(adminReq(`/admin/reports/${id}`, {
      method: "PATCH",
      body: { verification: { method: null } },
    }));
    expect(bypass.status).toBe(400);
    // DB 는 여전히 method 유지
    const after = await call(adminReq(`/admin/reports/${id}`));
    expect((await after.json() as { verification: { method: string | null } }).verification.method).toBe("교차확인");
  });

  it("GET /admin/reports/{id}/attachments/{idx} 가 인증 하에 바이트를 반환", async () => {
    const id = await seedUnverified("10.6.0.5");
    const unauth = await call(adminReq(`/admin/reports/${id}/attachments/0`, { token: null }));
    expect(unauth.status).toBe(401);

    const res = await call(adminReq(`/admin/reports/${id}/attachments/0`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes[0]).toBe(0xff);
  });

  it("GET /stats 는 인증 없이 공개 집계를 반환", async () => {
    await seedUnverified("10.6.0.6");
    const res = await call(get("/stats"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { total: number; by_status: Record<string, number>; by_election: unknown[] };
    expect(data.total).toBeGreaterThan(0);
    expect(Object.keys(data.by_status).length).toBeGreaterThan(0);
  });

  it("관리자 GET 도 허용되지 않은 오리진은 403", async () => {
    const req = new Request("https://api.test/admin/reports", {
      method: "GET",
      headers: { origin: "https://evil.test", authorization: `Bearer ${ADMIN}` },
    });
    expect((await call(req)).status).toBe(403);
  });
});

describe("공개 배포 export (마크다운 + /admin/export)", () => {
  const ADMIN = "test-admin-token";
  const ELECTION = "export테스트선거";

  function adminReq(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}) {
    const headers: Record<string, string> = { origin: ORIGIN };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.token !== null) headers["authorization"] = `Bearer ${opts.token ?? ADMIN}`;
    return new Request(`https://api.test${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  }

  it("recordToMarkdown 이 YAML frontmatter+본문을 만들고 submitter/exif 가 없다", () => {
    const rec: PublicRecord = {
      id: "x-1",
      status: "confirmed",
      election: "제9회 지방선거",
      title: "테스트 \"제목\"",
      summary: "요약",
      body: "본문 내용\n둘째 줄",
      region: { sido: "경기도", sigungu: "성남시 분당구" },
      occurred_at: "2026-06-03T16:20:00+09:00",
      collected_at: "2026-06-03T22:10:00+09:00",
      tags: ["투표지부족", "개표소"],
      sources: [{ url: "https://example.com/a", type: "news", archive_url: "https://web.archive.org/x" }],
      attachments: [{ filename: "a.jpg", r2_key: "k/a.jpg", sha256: "abc", mime: "image/jpeg", size: 100 }],
      rebuttals: [{ text: "반박", source_url: "https://example.com/r" }],
      related: ["x-2"],
      license: "CC-BY-4.0",
      verification: { reviewer: "rev-1", method: "교차확인", reviewed_at: "2026-06-04T09:00:00+09:00", notes: null, evidence_links: ["https://example.com/e"] },
      created_at: "2026-06-03T22:10:00+09:00",
      updated_at: "2026-06-04T09:00:00+09:00",
    };
    const md = recordToMarkdown(rec);
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain('id: "x-1"');
    expect(md).toContain('status: "confirmed"');
    expect(md).toContain("sha256:");
    expect(md).toContain("# 테스트");
    expect(md).not.toContain("submitter");
    expect(md).not.toContain("exif");
    expect(recordRelPath(rec)).toBe("data/제9회-지방선거/x-1.md");
  });

  it("recordRelPath 는 '.'/'..' election 경로 탈출을 막는다", () => {
    const base = (election: string): PublicRecord => ({
      id: "x-1", status: "confirmed", election, title: "t", summary: null, body: null,
      region: {}, occurred_at: null, collected_at: "2026-06-03T22:10:00+09:00",
      tags: [], sources: [], attachments: [], rebuttals: null, related: null, license: "CC-BY-4.0",
      verification: { reviewer: null, method: null, reviewed_at: null, notes: null, evidence_links: null },
      created_at: "2026-06-03T22:10:00+09:00", updated_at: "2026-06-03T22:10:00+09:00",
    });
    expect(recordRelPath(base("..")).includes("/../")).toBe(false);
    expect(recordRelPath(base("."))).toBe("data/untitled/x-1.md");
  });

  it("GET /admin/export 는 검증완료만 공개필드로 반환(미검증 제외, 미인증 401)", async () => {
    // unverified 1건 + confirmed 1건 seed
    const unv = await startSubmission("10.7.0.1", { ...validBody(), election: ELECTION });
    await env.EVIDENCE_BUCKET.put(unv.uploads[0].staging_key, JPEG);
    await call(post(`/submissions/${unv.submission_id}/finalize`, { finalize_token: unv.finalize_token }, { ip: "10.7.0.1" }));

    const conf = await startSubmission("10.7.0.2", { ...validBody(), election: ELECTION });
    await env.EVIDENCE_BUCKET.put(conf.uploads[0].staging_key, JPEG);
    await call(post(`/submissions/${conf.submission_id}/finalize`, { finalize_token: conf.finalize_token }, { ip: "10.7.0.2" }));
    const patched = await call(adminReq(`/admin/reports/${conf.submission_id}`, {
      method: "PATCH",
      body: { status: "confirmed", verification: { method: "교차확인", evidence_links: ["https://example.com/e"] } },
    }));
    expect(patched.status).toBe(200);

    expect((await call(adminReq("/admin/export", { token: null }))).status).toBe(401);

    const res = await call(adminReq("/admin/export"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { records: PublicRecord[] };
    const ids = data.records.map((r) => r.id);
    expect(ids).toContain(conf.submission_id);
    expect(ids).not.toContain(unv.submission_id);
    // 공개 필드 — submitter 없음
    const txt = JSON.stringify(data);
    expect(txt).not.toContain("submitter");
  });
});

describe("검증 보조 분석 (analyze)", () => {
  const ADMIN = "test-admin-token";

  it("analyzeRecord: 키워드 태그 추천 + 신뢰도 신호 + 합성위험(결정적)", () => {
    const a = analyzeRecord({
      title: "개표소 투표지 부족",
      summary: "사전투표지 소진 보고",
      body: "봉인 스티커가 훼손됨. CCTV 확인 필요.",
      tags: [],
      sources: [
        { url: "https://news.example/a", type: "news", archive_url: "https://web.archive.org/x" },
        { url: "https://b.example", type: "social" },
      ],
      attachments: [{ sha256: "abc", mime: "image/jpeg" }],
      exif: [{ Make: "Apple" }],
    });
    expect(a.suggested_tags).toEqual(expect.arrayContaining(["개표", "투표지", "사전투표", "봉인", "CCTV"]));
    expect(a.credibility.score).toBeGreaterThan(0.5);
    expect(a.synthetic_risk.level).toBe("low"); // exif 있음
    expect(a.source).toBe("heuristic");
  });

  it("analyzeRecord: 첨부 exif 없으면 합성위험 review, 텍스트만이면 신뢰도 신호에 교차검증", () => {
    const a = analyzeRecord({
      title: "목격",
      summary: null,
      body: "직접 봤다",
      tags: [],
      sources: [{ text: "현장 목격" }],
      attachments: [{ sha256: "x", mime: "image/png" }],
      exif: [],
    });
    expect(a.synthetic_risk.level).toBe("review");
    expect(a.credibility.signals.join(" ")).toContain("교차검증");
  });

  it("POST /admin/reports/{id}/analyze: 인증 하에 분석 반환, 미인증 401, 없는 id 404", async () => {
    const s = await startSubmission("10.8.0.1", { ...validBody(), election: "분석테스트", body: "개표 봉인 훼손" });
    await env.EVIDENCE_BUCKET.put(s.uploads[0].staging_key, JPEG);
    await call(post(`/submissions/${s.submission_id}/finalize`, { finalize_token: s.finalize_token }, { ip: "10.8.0.1" }));

    const unauth = new Request(`https://api.test/admin/reports/${s.submission_id}/analyze`, { method: "POST", headers: { origin: ORIGIN } });
    expect((await call(unauth)).status).toBe(401);

    const ok = new Request(`https://api.test/admin/reports/${s.submission_id}/analyze`, {
      method: "POST",
      headers: { origin: ORIGIN, authorization: `Bearer ${ADMIN}` },
    });
    const res = await call(ok);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { suggested_tags: string[]; source: string };
    expect(data.suggested_tags).toEqual(expect.arrayContaining(["개표", "봉인"]));
    expect(data.source).toBe("heuristic");

    const notFound = new Request(`https://api.test/admin/reports/nope/analyze`, {
      method: "POST",
      headers: { origin: ORIGIN, authorization: `Bearer ${ADMIN}` },
    });
    expect((await call(notFound)).status).toBe(404);
  });
});

describe("문서 / 유닛", () => {
  it("LOCAL_UPLOAD off(기본)면 PUT /_dev/upload 는 404", async () => {
    const res = await call(put("https://api.test/_dev/upload/_staging/x/y.jpg", JPEG));
    expect(res.status).toBe(404);
  });

  it("detectImageType 이 JPEG 매직바이트를 인식", () => {
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(new TextEncoder().encode("not image"))).toBeNull();
  });

  it("GET /openapi.json 이 라우트를 담은 OpenAPI 3.1 스펙을 반환", async () => {
    const res = await call(get("/openapi.json"));
    expect(res.status).toBe(200);
    const spec = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/submissions"]).toBeTruthy();
    expect(spec.paths["/reports"]).toBeTruthy();
  });

  it("GET /reference 가 Scalar HTML 을 반환", async () => {
    const res = await call(get("/reference"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("@scalar/api-reference");
  });

  it("GET /health → ok", async () => {
    const res = await call(get("/health"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
