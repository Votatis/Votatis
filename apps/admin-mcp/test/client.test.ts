import { test } from "node:test";
import assert from "node:assert/strict";
import { AdminClient } from "../src/client.ts";

interface Captured {
  url: string;
  method: string;
  auth: string | null;
  origin: string | null;
  body: string | null;
}

/** 호출을 캡처하고 정해진 JSON 을 돌려주는 fake fetch. */
function fakeFetch(capture: Captured[], responder: () => Response) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    capture.push({
      url: String(input),
      method: init?.method ?? "GET",
      auth: headers["authorization"] ?? null,
      origin: headers["origin"] ?? null,
      body: (init?.body as string) ?? null,
    });
    return responder();
  }) as typeof fetch;
}

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

test("listQueue: 쿼리스트링 + Bearer 헤더로 GET /admin/reports", async () => {
  const cap: Captured[] = [];
  const client = new AdminClient("http://api.test", "tok-123", fakeFetch(cap, () => jsonResponse({ items: [], counts: {} })));
  await client.listQueue({ status: "unverified", q: "개표", limit: 10 });
  assert.equal(cap.length, 1);
  assert.match(cap[0].url, /^http:\/\/api\.test\/admin\/reports\?/);
  assert.match(cap[0].url, /status=unverified/);
  assert.match(cap[0].url, /q=%EA/); // '개표' URL 인코딩
  assert.equal(cap[0].auth, "Bearer tok-123");
});

test("recordVerdict: PATCH + Bearer + JSON 바디", async () => {
  const cap: Captured[] = [];
  const client = new AdminClient("http://api.test", "tok-123", fakeFetch(cap, () => jsonResponse({ id: "r1", status: "confirmed" })));
  await client.recordVerdict("r1", { status: "confirmed", verification: { method: "교차확인", evidence_links: ["https://e/1"] } });
  assert.equal(cap[0].method, "PATCH");
  assert.equal(cap[0].url, "http://api.test/admin/reports/r1");
  assert.equal(cap[0].auth, "Bearer tok-123");
  assert.match(cap[0].body ?? "", /confirmed/);
  assert.match(cap[0].body ?? "", /evidence_links/);
});

test("origin 주입 시 모든 요청에 Origin 헤더 부착(/admin Origin 게이트 통과)", async () => {
  const cap: Captured[] = [];
  const client = new AdminClient(
    "http://api.test",
    "tok-123",
    fakeFetch(cap, () => jsonResponse({ items: [], counts: {} })),
    "https://votatis-web.pages.dev",
  );
  await client.listQueue({ status: "unverified" });
  assert.equal(cap[0].origin, "https://votatis-web.pages.dev");
});

test("origin 미주입 시 Origin 헤더 없음(로컬 기본 동작 보존)", async () => {
  const cap: Captured[] = [];
  const client = new AdminClient("http://api.test", "tok-123", fakeFetch(cap, () => jsonResponse({ items: [], counts: {} })));
  await client.listQueue({ status: "unverified" });
  assert.equal(cap[0].origin, null);
});

test("토큰 미설정이면 인증 필요 도구는 에러", async () => {
  const client = new AdminClient("http://api.test", undefined, fakeFetch([], () => jsonResponse({})));
  await assert.rejects(() => client.getReport("r1"), /VOTATIS_ADMIN_TOKEN/);
});

test("비-2xx 는 API error 메시지를 추출해 throw", async () => {
  const client = new AdminClient("http://api.test", "tok", fakeFetch([], () => jsonResponse({ error: "근거 링크가 필요합니다." }, 400)));
  await assert.rejects(() => client.recordVerdict("r1", { status: "confirmed" }), /근거 링크가 필요합니다/);
});

test("getAttachment: base64 + mime 반환", async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
  const client = new AdminClient(
    "http://api.test",
    "tok",
    (async () => new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } })) as typeof fetch,
  );
  const r = await client.getAttachment("r1", 0);
  assert.equal(r.mime, "image/jpeg");
  assert.equal(r.base64, Buffer.from(bytes).toString("base64"));
});
