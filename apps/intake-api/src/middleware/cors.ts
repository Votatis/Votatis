import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";

/** ALLOWED_ORIGIN 은 쉼표로 구분된 다중 오리진을 허용한다(로컬 dev + 배포 도메인 등). */
export function isOriginAllowed(env: Env, origin: string | null): boolean {
  if (origin === null) return false;
  const allowed = env.ALLOWED_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  return allowed.includes(origin);
}

/**
 * CORS. 쓰기(POST/PUT/PATCH)는 허용 오리진만(0001 동작 계승). 공개 읽기(GET)는 전체 허용.
 * 단 /admin/* 는 읽기여도 허용 오리진만(내부 도구) + Authorization 헤더 허용.
 */
export const corsMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
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
};
