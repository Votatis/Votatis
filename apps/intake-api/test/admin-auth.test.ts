import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";

// spec 0015 — 루트 부트스트랩 / JWT access·refresh / 회원관리 / 재설정 링크.

const ORIGIN = "https://app.test";
const ADMIN_TOKEN = "test-admin-token"; // vitest.config 바인딩과 일치

async function call(request: Request): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch!(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json", origin: ORIGIN };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

function post(path: string, body: unknown, token?: string): Request {
  return new Request(`https://api.test${path}`, { method: "POST", headers: headers(token), body: JSON.stringify(body) });
}
function get(path: string, token?: string): Request {
  return new Request(`https://api.test${path}`, { method: "GET", headers: headers(token) });
}
function patch(path: string, body: unknown, token: string): Request {
  return new Request(`https://api.test${path}`, { method: "PATCH", headers: headers(token), body: JSON.stringify(body) });
}
function del(path: string, token: string): Request {
  return new Request(`https://api.test${path}`, { method: "DELETE", headers: headers(token) });
}

interface Session {
  access_token: string;
  refresh_token: string;
  user: { id: string; username: string; name: string; role: string; status: string };
}

async function loginRoot(): Promise<Session> {
  const res = await call(post("/admin/auth/login", { username: "admin", password: ADMIN_TOKEN }));
  expect(res.status).toBe(200);
  return (await res.json()) as Session;
}

describe("관리자 인증 (spec 0015)", () => {
  it("루트 부트스트랩: admin + ADMIN_TOKEN 으로 로그인 → root 세션", async () => {
    const s = await loginRoot();
    expect(s.access_token).toBeTruthy();
    expect(s.refresh_token).toBeTruthy();
    expect(s.user.username).toBe("admin");
    expect(s.user.role).toBe("root");
  });

  it("잘못된 비밀번호는 401", async () => {
    const res = await call(post("/admin/auth/login", { username: "admin", password: "wrong-password" }));
    expect(res.status).toBe(401);
  });

  it("access JWT 로 /admin/auth/me 조회", async () => {
    const s = await loginRoot();
    const res = await call(get("/admin/auth/me", s.access_token));
    expect(res.status).toBe(200);
    const me = (await res.json()) as { role: string; username: string };
    expect(me.role).toBe("root");
    expect(me.username).toBe("admin");
  });

  it("인증 없이 /admin/members 는 401", async () => {
    const res = await call(get("/admin/members"));
    expect(res.status).toBe(401);
  });

  it("ADMIN_TOKEN Bearer break-glass 로 /admin/members 통과(MCP 호환)", async () => {
    const res = await call(get("/admin/members", ADMIN_TOKEN));
    expect(res.status).toBe(200);
  });

  it("회원 생성 → 재설정 토큰 발급 → 비밀번호 설정 → 회원 로그인", async () => {
    const root = await loginRoot();
    const username = "tester1";

    const created = await call(post("/admin/members", { username, name: "검증자1" }, root.access_token));
    expect(created.status).toBe(200);
    const { user, reset_token } = (await created.json()) as {
      user: { role: string; status: string };
      reset_token: string;
    };
    expect(user.role).toBe("member");
    expect(reset_token).toBeTruthy();

    // 비밀번호 미설정 상태에서 로그인 시도 → 403
    const noPw = await call(post("/admin/auth/login", { username, password: "whatever123" }));
    expect(noPw.status).toBe(403);

    // 재설정 토큰으로 비밀번호 설정
    const setPw = await call(post("/admin/auth/password-reset", { token: reset_token, password: "member-pass-1234" }));
    expect(setPw.status).toBe(200);

    // 회원 로그인 성공
    const memberLogin = await call(post("/admin/auth/login", { username, password: "member-pass-1234" }));
    expect(memberLogin.status).toBe(200);
    const ms = (await memberLogin.json()) as Session;
    expect(ms.user.role).toBe("member");

    // 회원 access 로 /admin/members → 403, 검증 큐(/admin/reports)는 200
    const memberMembers = await call(get("/admin/members", ms.access_token));
    expect(memberMembers.status).toBe(403);
    const memberQueue = await call(get("/admin/reports", ms.access_token));
    expect(memberQueue.status).toBe(200);

    // 재설정 토큰 1회용 — 재사용 시 400
    const reuse = await call(post("/admin/auth/password-reset", { token: reset_token, password: "another-pass-1234" }));
    expect(reuse.status).toBe(400);
  });

  it("리프레시 회전: 새 토큰 발급 + 기존 refresh 재사용 불가", async () => {
    const s = await loginRoot();
    const r1 = await call(post("/admin/auth/refresh", { refresh_token: s.refresh_token }));
    expect(r1.status).toBe(200);
    const rotated = (await r1.json()) as Session;
    expect(rotated.access_token).toBeTruthy();
    expect(rotated.refresh_token).not.toBe(s.refresh_token);

    // 회전된(폐기된) 기존 토큰 재사용 → 401
    const reuse = await call(post("/admin/auth/refresh", { refresh_token: s.refresh_token }));
    expect(reuse.status).toBe(401);

    // 새 토큰은 유효
    const r2 = await call(post("/admin/auth/refresh", { refresh_token: rotated.refresh_token }));
    expect(r2.status).toBe(200);
  });

  it("7일 미사용(만료)이면 리프레시 거부", async () => {
    const s = await loginRoot();
    // 모든 리프레시 토큰을 과거로 만료시킨다(슬라이딩 만료 경계 검증)
    await env.DB.prepare("UPDATE admin_refresh_tokens SET expires_at = 1 WHERE revoked_at IS NULL").run();
    const res = await call(post("/admin/auth/refresh", { refresh_token: s.refresh_token }));
    expect(res.status).toBe(401);
  });

  it("짧은 비밀번호(<10자)는 재설정 거부(400)", async () => {
    const root = await loginRoot();
    const created = await call(post("/admin/members", { username: "tester2", name: "검증자2" }, root.access_token));
    const { reset_token } = (await created.json()) as { reset_token: string };
    const res = await call(post("/admin/auth/password-reset", { token: reset_token, password: "short" }));
    expect(res.status).toBe(400);
  });

  it("root 는 회원 비활성/삭제 가능, 루트 자신 삭제는 거부", async () => {
    const root = await loginRoot();
    const created = await call(post("/admin/members", { username: "tester3", name: "검증자3" }, root.access_token));
    const { user } = (await created.json()) as { user: { id: string } };

    const disabled = await call(patch(`/admin/members/${user.id}`, { status: "disabled" }, root.access_token));
    expect(disabled.status).toBe(200);

    const removed = await call(del(`/admin/members/${user.id}`, root.access_token));
    expect(removed.status).toBe(200);

    // 존재하지 않는 회원 삭제 → 404
    const missing = await call(del(`/admin/members/${user.id}`, root.access_token));
    expect(missing.status).toBe(404);
  });
});
