import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../router";
import { getAdminUser } from "../middleware/admin-auth";
import { listMembers, createMember, issueResetToken, updateMember, deleteMember } from "../services/admin-members";
import { HttpError } from "../lib/http-error";
import {
  MemberListSchema,
  MemberCreateInputSchema,
  MemberCreateResultSchema,
  MemberPatchInputSchema,
  AdminUserPublicSchema,
  ResetTokenResultSchema,
  OkResultSchema,
  AdminUserIdParamSchema,
  ErrorSchema,
} from "../schemas";

// root 전용. /admin/members/* requireRoot 게이트는 app.ts 에서 건다.
export const adminMembersRoutes = createRouter();

// HttpError 가 던질 수 있는 모든 상태를 선언(핸들러의 c.json(e.status) 타입 충족).
const errResponses = {
  400: { content: { "application/json": { schema: ErrorSchema } }, description: "잘못된 요청" },
  401: { content: { "application/json": { schema: ErrorSchema } }, description: "인증 실패" },
  403: { content: { "application/json": { schema: ErrorSchema } }, description: "권한 없음" },
  404: { content: { "application/json": { schema: ErrorSchema } }, description: "없음" },
  409: { content: { "application/json": { schema: ErrorSchema } }, description: "중복" },
  503: { content: { "application/json": { schema: ErrorSchema } }, description: "인증 미구성" },
};

// ── GET /admin/members ────────────────────────────────────────────────────────
const listRoute = createRoute({
  method: "get",
  path: "/admin/members",
  responses: {
    200: { content: { "application/json": { schema: MemberListSchema } }, description: "회원 목록" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "권한 없음" },
  },
});
adminMembersRoutes.openapi(listRoute, async (c) => {
  return c.json({ members: await listMembers(c.env) }, 200);
});

// ── POST /admin/members (생성 + 재설정 토큰) ──────────────────────────────────
const createRoute_ = createRoute({
  method: "post",
  path: "/admin/members",
  request: { body: { content: { "application/json": { schema: MemberCreateInputSchema } } } },
  responses: {
    200: { content: { "application/json": { schema: MemberCreateResultSchema } }, description: "생성된 회원 + 재설정 토큰" },
    ...errResponses,
  },
});
adminMembersRoutes.openapi(createRoute_, async (c) => {
  const body = c.req.valid("json");
  try {
    return c.json(await createMember(c.env, body), 200);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});

// ── POST /admin/members/{id}/reset-link (재설정 토큰 재발급) ───────────────────
const resetLinkRoute = createRoute({
  method: "post",
  path: "/admin/members/{id}/reset-link",
  request: { params: AdminUserIdParamSchema },
  responses: {
    200: { content: { "application/json": { schema: ResetTokenResultSchema } }, description: "재설정 토큰" },
    ...errResponses,
  },
});
adminMembersRoutes.openapi(resetLinkRoute, async (c) => {
  const { id } = c.req.valid("param");
  try {
    return c.json({ reset_token: await issueResetToken(c.env, id) }, 200);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});

// ── PATCH /admin/members/{id} (이름/상태) ─────────────────────────────────────
const patchRoute = createRoute({
  method: "patch",
  path: "/admin/members/{id}",
  request: {
    params: AdminUserIdParamSchema,
    body: { content: { "application/json": { schema: MemberPatchInputSchema } } },
  },
  responses: {
    200: { content: { "application/json": { schema: AdminUserPublicSchema } }, description: "갱신된 회원" },
    ...errResponses,
  },
});
adminMembersRoutes.openapi(patchRoute, async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");
  try {
    return c.json(await updateMember(c.env, id, patch, getAdminUser(c).id), 200);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});

// ── DELETE /admin/members/{id} ────────────────────────────────────────────────
const deleteRoute = createRoute({
  method: "delete",
  path: "/admin/members/{id}",
  request: { params: AdminUserIdParamSchema },
  responses: {
    200: { content: { "application/json": { schema: OkResultSchema } }, description: "삭제 완료" },
    ...errResponses,
  },
});
adminMembersRoutes.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  try {
    await deleteMember(c.env, id, getAdminUser(c).id);
    return c.json({ ok: true as const }, 200);
  } catch (e) {
    if (e instanceof HttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});
