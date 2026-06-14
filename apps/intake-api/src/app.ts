// 앱 조립 — 미들웨어 + 도메인별 라우트 sub-app 마운트 + OpenAPI 문서. (라우트 정의는 routes/* 에 있다)
import { createRouter } from "./router";
import { corsMiddleware } from "./middleware/cors";
import { adminAuthMiddleware } from "./middleware/admin-auth";
import { metaRoutes } from "./routes/meta";
import { submissionsRoutes } from "./routes/submissions";
import { reportsRoutes } from "./routes/reports";
import { adminRoutes } from "./routes/admin";
import { statsRoutes } from "./routes/stats";

const app = createRouter();

// ── 미들웨어 ─────────────────────────────────────────────────────────────────
// CORS: 공개 읽기는 전체 허용, 쓰기·/admin 은 허용 오리진만. /admin/*: Bearer ADMIN_TOKEN 게이트.
app.use("*", corsMiddleware);
app.use("/admin/*", adminAuthMiddleware);

// ── 도메인 라우트 ────────────────────────────────────────────────────────────
app.route("/", metaRoutes);
app.route("/", submissionsRoutes);
app.route("/", reportsRoutes);
app.route("/", adminRoutes);
app.route("/", statsRoutes);

// ── OpenAPI 문서 (3.1) — 마운트된 모든 라우트/스키마가 자동 반영 ─────────────────
app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Votatis Intake API", version: "1.0.0" },
});

export default app;
