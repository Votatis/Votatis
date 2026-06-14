import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { Env } from "./types";
import { isLocalUpload } from "./types";
import { isOriginAllowed } from "./cors";
import { verifyTurnstile } from "./turnstile";
import { checkRateLimit } from "./ratelimit";
import { getDb } from "./db/client";
import { createSubmission } from "./submissions";
import { finalizeSubmission } from "./finalize";
import { listReports, getReport } from "./reports";
import {
  isAdmin,
  safeEqual,
  adminListReports,
  adminGetReport,
  adminPatchReport,
  adminGetAttachment,
  adminExport,
  analyzeReport,
  publicStats,
} from "./admin";
import { clientIp } from "./util";
import {
  SubmissionInputSchema,
  SubmissionCreatedSchema,
  FinalizeInputSchema,
  FinalizeResultSchema,
  SubmissionIdParamSchema,
  ReportListQuerySchema,
  ReportListSchema,
  ReportIdParamSchema,
  ReportPublicSchema,
  ErrorSchema,
  AdminSessionInputSchema,
  AdminSessionResultSchema,
  AdminListQuerySchema,
  AdminReportListSchema,
  AdminReportDetailSchema,
  AdminPatchSchema,
  AdminExportSchema,
  AnalysisSchema,
  StatsSchema,
} from "./schemas";

const app = new OpenAPIHono<{ Bindings: Env }>({
  // Zod 검증 실패를 통일된 { error } 400 으로 변환한다.
  defaultHook: (result, c) => {
    if (!result.success) {
      const msg = result.error.issues[0]?.message ?? "유효하지 않은 요청입니다.";
      return c.json({ error: msg }, 400);
    }
  },
});

// ── CORS ─────────────────────────────────────────────────────────────────
// 쓰기(POST/PUT/PATCH)는 허용 오리진만(0001 동작 계승). 공개 읽기(GET)는 전체 허용.
// 단 /admin/* 는 읽기여도 허용 오리진만(내부 도구) + Authorization 헤더 허용.
app.use("*", async (c, next) => {
  const origin = c.req.header("Origin") ?? null;
  const isAdminPath = c.req.path.startsWith("/admin");
  const isWriteMethod = c.req.method === "POST" || c.req.method === "PUT" || c.req.method === "PATCH";
  // 오리진 제한 대상: 모든 쓰기 + /admin 의 모든 메서드.
  const restricted = isWriteMethod || isAdminPath;

  if (c.req.method === "OPTIONS") {
    const headers: Record<string, string> = { vary: "Origin" };
    if (isOriginAllowed(c.env, origin)) {
      headers["access-control-allow-origin"] = origin as string;
      headers["access-control-allow-methods"] = "GET, POST, PUT, PATCH, OPTIONS";
      headers["access-control-allow-headers"] = "content-type, authorization";
      headers["access-control-max-age"] = "86400";
    }
    return c.body(null, 204, headers);
  }

  if (restricted && !isOriginAllowed(c.env, origin)) {
    return c.json({ error: "허용되지 않은 오리진입니다." }, 403);
  }

  c.header("vary", "Origin");
  if (restricted) {
    if (isOriginAllowed(c.env, origin)) c.header("access-control-allow-origin", origin as string);
  } else {
    c.header("access-control-allow-origin", "*");
  }
  await next();
});

// ── 관리자 인증(Bearer ADMIN_TOKEN) ─────────────────────────────────────────
// /admin/session(로그인) 자체는 토큰 없이 접근 가능(토큰 검증이 목적). 나머지 /admin/* 는 게이트.
app.use("/admin/*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  if (c.req.path === "/admin/session") return next();
  if (!isAdmin(c.env, c.req.header("Authorization") ?? null)) {
    return c.json({ error: "관리자 인증이 필요합니다." }, 401);
  }
  await next();
});

app.get("/health", (c) => c.text("ok"));

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

app.openapi(submissionsRoute, async (c) => {
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
app.put("/_dev/upload/*", async (c) => {
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

app.openapi(finalizeRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { finalize_token } = c.req.valid("json");
  const r = await finalizeSubmission(c.env, id, finalize_token);
  if (!r.ok) return c.json({ error: r.error }, r.status);
  return c.json({ report_id: r.report_id, attachments: r.attachments }, 200);
});

// ── GET /reports ─────────────────────────────────────────────────────────────
const reportsListRoute = createRoute({
  method: "get",
  path: "/reports",
  request: { query: ReportListQuerySchema },
  responses: {
    200: { content: { "application/json": { schema: ReportListSchema } }, description: "제보 목록(pending 제외)" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "유효하지 않은 쿼리" },
  },
});

app.openapi(reportsListRoute, async (c) => {
  const q = c.req.valid("query");
  const result = await listReports(c.env, q);
  return c.json(result, 200);
});

// ── GET /reports/{id} ────────────────────────────────────────────────────────
const reportGetRoute = createRoute({
  method: "get",
  path: "/reports/{id}",
  request: { params: ReportIdParamSchema },
  responses: {
    200: { content: { "application/json": { schema: ReportPublicSchema } }, description: "제보 상세" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "없음(또는 pending)" },
  },
});

app.openapi(reportGetRoute, async (c) => {
  const { id } = c.req.valid("param");
  const report = await getReport(c.env, id);
  if (!report) return c.json({ error: "제보를 찾을 수 없습니다." }, 404);
  return c.json(report, 200);
});

// ── GET /stats (공개 집계) ────────────────────────────────────────────────────
const statsRoute = createRoute({
  method: "get",
  path: "/stats",
  responses: {
    200: { content: { "application/json": { schema: StatsSchema } }, description: "공개 레코드 집계" },
  },
});

app.openapi(statsRoute, async (c) => {
  const result = await publicStats(c.env);
  return c.json(result, 200);
});

// ── POST /admin/session (로그인 검증) ─────────────────────────────────────────
const adminSessionRoute = createRoute({
  method: "post",
  path: "/admin/session",
  request: { body: { content: { "application/json": { schema: AdminSessionInputSchema } } } },
  responses: {
    200: { content: { "application/json": { schema: AdminSessionResultSchema } }, description: "토큰 유효" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "토큰 불일치" },
  },
});

app.openapi(adminSessionRoute, async (c) => {
  const { token } = c.req.valid("json");
  if (!c.env.ADMIN_TOKEN || !safeEqual(token, c.env.ADMIN_TOKEN)) {
    return c.json({ error: "토큰이 일치하지 않습니다." }, 401);
  }
  return c.json({ ok: true as const }, 200);
});

// ── GET /admin/reports (검수 큐) ──────────────────────────────────────────────
const adminListRoute = createRoute({
  method: "get",
  path: "/admin/reports",
  request: { query: AdminListQuerySchema },
  responses: {
    200: { content: { "application/json": { schema: AdminReportListSchema } }, description: "검수 큐 목록 + 상태별 카운트" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "인증 필요" },
  },
});

app.openapi(adminListRoute, async (c) => {
  const q = c.req.valid("query");
  const result = await adminListReports(c.env, q);
  return c.json(result, 200);
});

// ── GET /admin/reports/{id} (내부 필드 포함 상세) ─────────────────────────────
const adminGetRoute = createRoute({
  method: "get",
  path: "/admin/reports/{id}",
  request: { params: ReportIdParamSchema },
  responses: {
    200: { content: { "application/json": { schema: AdminReportDetailSchema } }, description: "상세(내부 필드 포함)" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "인증 필요" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "없음" },
  },
});

app.openapi(adminGetRoute, async (c) => {
  const { id } = c.req.valid("param");
  const report = await adminGetReport(c.env, id);
  if (!report) return c.json({ error: "제보를 찾을 수 없습니다." }, 404);
  return c.json(report, 200);
});

// ── PATCH /admin/reports/{id} (상태 판정 + 검증 기록 + 교정) ──────────────────
const adminPatchRoute = createRoute({
  method: "patch",
  path: "/admin/reports/{id}",
  request: {
    params: ReportIdParamSchema,
    body: { content: { "application/json": { schema: AdminPatchSchema } } },
  },
  responses: {
    200: { content: { "application/json": { schema: AdminReportDetailSchema } }, description: "갱신된 상세" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "근거 누락 등 검증 실패" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "인증 필요" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "없음" },
  },
});

app.openapi(adminPatchRoute, async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");
  const r = await adminPatchReport(c.env, id, patch);
  if (!r.ok) return c.json({ error: r.error }, r.status);
  return c.json(r.report, 200);
});

// ── GET /admin/reports/{id}/attachments/{idx} (증거 바이트 스트리밍) ──────────
// 비공개 R2 객체를 인증 게이트로 직접 스트리밍. <img>가 헤더를 못 보내는 한계는
// 프론트가 Bearer fetch→blob→objectURL 로 우회. (auth 미들웨어가 /admin/* 게이트)
app.get("/admin/reports/:id/attachments/:idx", async (c) => {
  const id = c.req.param("id");
  const idx = Number(c.req.param("idx"));
  if (!Number.isInteger(idx) || idx < 0) return c.json({ error: "잘못된 첨부 index 입니다." }, 400);
  const found = await adminGetAttachment(c.env, id, idx);
  if (!found) return c.json({ error: "첨부를 찾을 수 없습니다." }, 404);
  return new Response(found.obj.body, {
    status: 200,
    headers: {
      "content-type": found.mime,
      "cache-control": "private, max-age=60",
    },
  });
});

// ── POST /admin/reports/{id}/analyze (검증 보조 신호) ─────────────────────────
const adminAnalyzeRoute = createRoute({
  method: "post",
  path: "/admin/reports/{id}/analyze",
  request: { params: ReportIdParamSchema },
  responses: {
    200: { content: { "application/json": { schema: AnalysisSchema } }, description: "보조 분석 신호(휴리스틱±AI)" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "인증 필요" },
    404: { content: { "application/json": { schema: ErrorSchema } }, description: "없음" },
  },
});

app.openapi(adminAnalyzeRoute, async (c) => {
  const { id } = c.req.valid("param");
  const analysis = await analyzeReport(c.env, id);
  if (!analysis) return c.json({ error: "제보를 찾을 수 없습니다." }, 404);
  return c.json(analysis, 200);
});

// ── GET /admin/export (공개 배포 대상 추출) ───────────────────────────────────
const adminExportRoute = createRoute({
  method: "get",
  path: "/admin/export",
  responses: {
    200: { content: { "application/json": { schema: AdminExportSchema } }, description: "검증 완료 레코드(공개 필드)" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "인증 필요" },
  },
});

app.openapi(adminExportRoute, async (c) => {
  const result = await adminExport(c.env);
  return c.json(result, 200);
});

// ── OpenAPI 문서 + Scalar UI ─────────────────────────────────────────────────
app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Votatis Intake API", version: "1.0.0" },
});

const REFERENCE_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Votatis Intake API</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

app.get("/reference", (c) => c.html(REFERENCE_HTML));
app.get("/docs", (c) => c.html(REFERENCE_HTML));

export default app;
