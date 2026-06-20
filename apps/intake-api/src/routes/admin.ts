import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../router";
import { safeEqual } from "../middleware/admin-auth";
import { isOriginAllowed } from "../middleware/cors";
import {
  adminListReports,
  adminGetReport,
  adminPatchReport,
  adminCreateReport,
  adminGetAttachment,
  adminExport,
} from "../services/admin";
import { analyzeReport } from "../services/analysis";
import {
  AdminSessionInputSchema,
  AdminSessionResultSchema,
  AdminListQuerySchema,
  AdminReportListSchema,
  AdminReportDetailSchema,
  AdminReportCreateSchema,
  AdminPatchSchema,
  AdminExportSchema,
  AnalysisSchema,
  ReportIdParamSchema,
  ErrorSchema,
} from "../schemas";

export const adminRoutes = createRouter();

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

adminRoutes.openapi(adminSessionRoute, async (c) => {
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

adminRoutes.openapi(adminListRoute, async (c) => {
  const q = c.req.valid("query");
  const result = await adminListReports(c.env, q);
  return c.json(result, 200);
});

// ── POST /admin/reports (관리자 직접 제보 등록) ───────────────────────────────
const adminCreateRoute = createRoute({
  method: "post",
  path: "/admin/reports",
  request: { body: { content: { "application/json": { schema: AdminReportCreateSchema } } } },
  responses: {
    201: { content: { "application/json": { schema: AdminReportDetailSchema } }, description: "생성된 제보 상세" },
    400: { content: { "application/json": { schema: ErrorSchema } }, description: "유효하지 않은 입력" },
    401: { content: { "application/json": { schema: ErrorSchema } }, description: "인증 필요" },
  },
});

adminRoutes.openapi(adminCreateRoute, async (c) => {
  const input = c.req.valid("json");
  const reviewer = c.get("adminUser")?.username ?? null;
  const report = await adminCreateReport(c.env, input, reviewer);
  return c.json(report, 201);
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

adminRoutes.openapi(adminGetRoute, async (c) => {
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

adminRoutes.openapi(adminPatchRoute, async (c) => {
  const { id } = c.req.valid("param");
  const patch = c.req.valid("json");
  const r = await adminPatchReport(c.env, id, patch);
  if (!r.ok) return c.json({ error: r.error }, r.status);
  return c.json(r.report, 200);
});

// ── GET /admin/reports/{id}/attachments/{idx} (증거 바이트 스트리밍) ──────────
// 비공개 R2 객체를 인증 게이트로 직접 스트리밍. <img>가 헤더를 못 보내는 한계는
// 프론트가 Bearer fetch→blob→objectURL 로 우회. (auth 미들웨어가 /admin/* 게이트)
adminRoutes.get("/admin/reports/:id/attachments/:idx", async (c) => {
  const id = c.req.param("id");
  const idx = Number(c.req.param("idx"));
  if (!Number.isInteger(idx) || idx < 0) return c.json({ error: "잘못된 첨부 index 입니다." }, 400);
  const found = await adminGetAttachment(c.env, id, idx);
  if (!found) return c.json({ error: "첨부를 찾을 수 없습니다." }, 404);
  // new Response 는 c.header()(corsMiddleware)로 건 ACAO 를 계승하지 못하므로 직접 부여한다.
  const headers: Record<string, string> = {
    "content-type": found.mime,
    "cache-control": "private, max-age=60",
    vary: "Origin",
  };
  const origin = c.req.header("Origin") ?? null;
  if (isOriginAllowed(c.env, origin)) headers["access-control-allow-origin"] = origin as string;
  return new Response(found.obj.body, { status: 200, headers });
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

adminRoutes.openapi(adminAnalyzeRoute, async (c) => {
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

adminRoutes.openapi(adminExportRoute, async (c) => {
  const result = await adminExport(c.env);
  return c.json(result, 200);
});
