import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../router";
import { listReports, getReport, getPublicAttachment } from "../services/reports";
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

// ── GET /reports/{id}/attachments/{idx} (공개 증거 이미지 스트리밍) ────────────
// 공개 배포(PUBLISHABLE) 레코드의 첨부 이미지를 인증 없이 직접 스트리밍한다.
// <img src> 로 바로 로드되도록 ACAO:* + 공개 캐시. (new Response 는 cors 미들웨어
// ACAO 를 계승 못 하므로 직접 부여.) plain Hono 라우트 — OpenAPI 스키마엔 비노출.
reportsRoutes.get("/reports/:id/attachments/:idx", async (c) => {
  const id = c.req.param("id");
  const idx = Number(c.req.param("idx"));
  if (!Number.isInteger(idx) || idx < 0) return c.json({ error: "잘못된 첨부 index 입니다." }, 400);
  const found = await getPublicAttachment(c.env, id, idx);
  if (!found) return c.json({ error: "첨부를 찾을 수 없습니다." }, 404);
  return new Response(found.obj.body, {
    status: 200,
    headers: {
      "content-type": found.mime,
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
});
