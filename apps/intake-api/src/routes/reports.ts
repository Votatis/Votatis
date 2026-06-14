import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../router";
import { listReports, getReport } from "../services/reports";
import {
  ReportListQuerySchema,
  ReportListSchema,
  ReportIdParamSchema,
  ReportPublicSchema,
  ErrorSchema,
} from "../schemas";

export const reportsRoutes = createRouter();

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

reportsRoutes.openapi(reportsListRoute, async (c) => {
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

reportsRoutes.openapi(reportGetRoute, async (c) => {
  const { id } = c.req.valid("param");
  const report = await getReport(c.env, id);
  if (!report) return c.json({ error: "제보를 찾을 수 없습니다." }, 404);
  return c.json(report, 200);
});
