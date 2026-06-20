import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../router";
import { publicStats } from "../services/stats";
import { StatsSchema } from "../schemas";

export const statsRoutes = createRouter();

// ── GET /stats (공개 집계) ────────────────────────────────────────────────────
const statsRoute = createRoute({
  method: "get",
  path: "/stats",
  responses: {
    200: { content: { "application/json": { schema: StatsSchema } }, description: "공개 레코드 집계" },
  },
});

statsRoutes.openapi(statsRoute, async (c) => {
  const result = await publicStats(c.env);
  return c.json(result, 200);
});
