import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../router";
import { isLocalUpload } from "../env";
import { verifyTurnstile } from "../lib/turnstile";
import { checkRateLimit } from "../lib/ratelimit";
import { clientIp } from "../lib/http";
import { getDb } from "../db/client";
import { createSubmission } from "../services/submissions";
import { finalizeSubmission } from "../services/finalize";
import {
  SubmissionInputSchema,
  SubmissionCreatedSchema,
  FinalizeInputSchema,
  FinalizeResultSchema,
  SubmissionIdParamSchema,
  ErrorSchema,
} from "../schemas";

export const submissionsRoutes = createRouter();

// ── POST /submissions ──────────────────────────────────────────────────────
const submissionsRoute = createRoute({
  method: "post",
  path: "/submissions",
  request: {
    body: { content: { "application/json": { schema: SubmissionInputSchema } } },
  },
  responses: {
    200: { content: { "application/json": { schema: SubmissionCreatedSchema } }, description: "제출 개시 — presigned 업로드 URL 발급" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "유효하지 않은 요청" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "Turnstile/오리진 거부" },
    429: { content: { "application/json": { schema: ErrorSchema } }, description: "rate limit" },
  },
});

submissionsRoutes.openapi(submissionsRoute, async (c) => {
  const input = c.req.valid("json");
  const ip = clientIp(c.req.raw);

  const human = await verifyTurnstile(c.env.TURNSTILE_SECRET, input.turnstile_token, ip);
  if (!human) return c.json({ error: "Turnstile 검증 실패." }, 403);

  const allowed = await checkRateLimit(getDb(c.env), ip);
  if (!allowed) return c.json({ error: "요청이 너무 많습니다." }, 429);

  const baseUrl = new URL(c.req.url).origin;
  const result = await createSubmission(c.env, input, ip, c.req.header("User-Agent") ?? null, baseUrl);
  return c.json(result, 200);
});

// ── PUT /_dev/upload/* (로컬 업로드 shim, LOCAL_UPLOAD 시에만) ─────────────────
// presigned R2 대신 워커가 직접 로컬 R2(miniflare)에 staging 바이트를 받는다.
// 운영(플래그 off)에선 404 → 노출되지 않는다.
submissionsRoutes.put("/_dev/upload/*", async (c) => {
  if (!isLocalUpload(c.env)) return c.text("Not Found", 404);
  const key = c.req.path.slice("/_dev/upload/".length);
  if (!key) return c.json({ error: "업로드 key 가 없습니다." }, 400);
  await c.env.EVIDENCE_BUCKET.put(key, await c.req.arrayBuffer());
  return c.body(null, 200);
});

// ── POST /submissions/{id}/finalize ─────────────────────────────────────────
const finalizeRoute = createRoute({
  method: "post",
  path: "/submissions/{id}/finalize",
  request: {
    params: SubmissionIdParamSchema,
    body: { content: { "application/json": { schema: FinalizeInputSchema } } },
  },
  responses: {
    200: { content: { "application/json": { schema: FinalizeResultSchema } }, description: "확정 — D1 레코드 적재" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "검증 실패(업로드 누락/타입/크기)" },
    403: { content: { "application/json": { schema: ErrorSchema } }, description: "토큰 불일치" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "제출 없음/만료" },
  },
});

submissionsRoutes.openapi(finalizeRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { finalize_token } = c.req.valid("json");
  const r = await finalizeSubmission(c.env, id, finalize_token);
  if (!r.ok) return c.json({ error: r.error }, r.status);
  return c.json({ report_id: r.report_id, attachments: r.attachments }, 200);
});
