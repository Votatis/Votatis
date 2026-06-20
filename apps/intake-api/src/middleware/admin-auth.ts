import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { safeEqual } from "../lib/crypto";
import { verifyAccessToken } from "../lib/tokens";
import type { AdminRole } from "../constants";

// safeEqual 은 lib/crypto 로 이동했다. 기존 import 경로 호환을 위해 재노출.
export { safeEqual } from "../lib/crypto";

export interface AdminContextUser {
  id: string;
  username: string;
  role: AdminRole;
}

// Hono 컨텍스트 변수 타입 보강 — c.set/c.get("adminUser") 가 타입 안전해진다.
declare module "hono" {
  interface ContextVariableMap {
    adminUser?: AdminContextUser;
  }
}

/** 게이트를 거치지 않는 경로(로그인/리프레시/재설정/레거시 세션). */
const BYPASS = new Set([
  "/admin/session",
  "/admin/auth/login",
  "/admin/auth/refresh",
  "/admin/auth/logout",
  "/admin/auth/password-reset",
]);

/**
 * Bearer 를 관리자 사용자로 해석. 우선순위:
 *  1) ADMIN_TOKEN 원문 일치 → root break-glass(MCP·운영 호환, 루트 잠김 방지)
 *  2) 유효한 access JWT → 해당 사용자
 * 둘 다 아니면 null.
 */
export async function resolveAdminUser(env: Env, authHeader: string | null): Promise<AdminContextUser | null> {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!m) return null;
  const token = m[1];

  if (env.ADMIN_TOKEN && safeEqual(token, env.ADMIN_TOKEN)) {
    return { id: "__token__", username: "admin", role: "root" };
  }
  if (env.JWT_SECRET) {
    return verifyAccessToken(env.JWT_SECRET, token);
  }
  return null;
}

/**
 * /admin/* 게이트. bypass 경로는 통과, 나머지는 JWT/ADMIN_TOKEN 인증 필요.
 * 인증되면 adminUser 를 컨텍스트에 싣는다.
 */
export const adminAuthMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  if (BYPASS.has(c.req.path)) return next();
  const user = await resolveAdminUser(c.env, c.req.header("Authorization") ?? null);
  if (!user) return c.json({ error: "관리자 인증이 필요합니다." }, 401);
  c.set("adminUser", user);
  await next();
};

/** root 전용 게이트(/admin/members/*). adminAuthMiddleware 뒤에 적용. */
export const requireRoot: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const user = c.get("adminUser");
  if (!user || user.role !== "root") {
    return c.json({ error: "권한이 없습니다(루트 전용)." }, 403);
  }
  await next();
};

/** 라우트 핸들러에서 현재 관리자 사용자 조회(게이트 통과 후엔 항상 존재). */
export function getAdminUser(c: Context): AdminContextUser {
  const user = c.get("adminUser");
  if (!user) throw new Error("adminUser not set — auth middleware missing");
  return user;
}
