import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../router";
import { getAdminUser } from "../middleware/admin-auth";
import { login, refresh, logout, setPasswordByResetToken, getCurrentUser } from "../services/admin-auth";
import { HttpError } from "../lib/http-error";
import {
  LoginInputSchema,
  SessionResultSchema,
  RefreshInputSchema,
  LogoutInputSchema,
  PasswordResetInputSchema,
  OkResultSchema,
  AdminUserPublicSchema,
  ErrorSchema,
} from "../schemas";

export const adminAuthRoutes = createRouter();

// HttpError 가 던질 수 있는 모든 상태를 선언(핸들러의 c.json(e.status) 타입 충족).
const errResponses = {
  400: { content: { "application/json": { schema: ErrorSchema } }, description: "잘못된 요청" },
  401: { content: { "application/json": { schema: ErrorSchema } }, description: "인증 실패" },
  403: { content: { "application/json": { schema: ErrorSchema } }, description: "권한 없음/비활성" },
  404: { content: { "application/json": { schema: ErrorSchema } }, description: "없음" },
  409: { content: { "application/json": { schema: ErrorSchema } }, description: "중복" },
  503: { content: { "application/json": { schema: ErrorSchema } }, description: "인증 미구성" },
};

// ── POST /admin/auth/login ────────────────────────────────────────────────────
const loginRoute = createRoute({
  method: "post",
  path: "/admin/auth/login",
  request: { body: { content: { "application/json": { schema: LoginInputSchema } } } },
  responses: {
    200: { content: { "application/json": { schema: SessionResultSchema } }, description: "토큰쌍 + 사용자" },
    ...errResponses,
  },
});
adminAuthRoutes.openapi(loginRoute, async (c) => {
  const { username, password } = c.req.valid("json");
  try {
    return c.json(await login(c.env, username, password), 200);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});

// ── POST /admin/auth/refresh ──────────────────────────────────────────────────
const refreshRoute = createRoute({
  method: "post",
  path: "/admin/auth/refresh",
  request: { body: { content: { "application/json": { schema: RefreshInputSchema } } } },
  responses: {
    200: { content: { "application/json": { schema: SessionResultSchema } }, description: "회전된 토큰쌍" },
    ...errResponses,
  },
});
adminAuthRoutes.openapi(refreshRoute, async (c) => {
  const { refresh_token } = c.req.valid("json");
  try {
    return c.json(await refresh(c.env, refresh_token), 200);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});

// ── POST /admin/auth/logout ───────────────────────────────────────────────────
const logoutRoute = createRoute({
  method: "post",
  path: "/admin/auth/logout",
  request: { body: { content: { "application/json": { schema: LogoutInputSchema } } } },
  responses: {
    200: { content: { "application/json": { schema: OkResultSchema } }, description: "폐기 완료" },
  },
});
adminAuthRoutes.openapi(logoutRoute, async (c) => {
  const { refresh_token } = c.req.valid("json");
  await logout(c.env, refresh_token);
  return c.json({ ok: true as const }, 200);
});

// ── POST /admin/auth/password-reset (공개 — 링크 토큰으로 비밀번호 설정) ───────
const passwordResetRoute = createRoute({
  method: "post",
  path: "/admin/auth/password-reset",
  request: { body: { content: { "application/json": { schema: PasswordResetInputSchema } } } },
  responses: {
    200: { content: { "application/json": { schema: OkResultSchema } }, description: "설정 완료" },
    ...errResponses,
  },
});
adminAuthRoutes.openapi(passwordResetRoute, async (c) => {
  const { token, password } = c.req.valid("json");
  try {
    await setPasswordByResetToken(c.env, token, password);
    return c.json({ ok: true as const }, 200);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});

// ── GET /admin/auth/me ────────────────────────────────────────────────────────
const meRoute = createRoute({
  method: "get",
  path: "/admin/auth/me",
  responses: {
    200: { content: { "application/json": { schema: AdminUserPublicSchema } }, description: "현재 사용자" },
    ...errResponses,
  },
});
adminAuthRoutes.openapi(meRoute, async (c) => {
  try {
    return c.json(await getCurrentUser(c.env, getAdminUser(c)), 200);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});
