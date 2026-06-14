import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";

/** 타이밍 안전 문자열 비교(길이 노출은 허용 범위). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAdmin(env: Env, authHeader: string | null): boolean {
  const token = env.ADMIN_TOKEN;
  if (!token) return false; // 토큰 미설정 시 관리자 기능 잠금(안전한 기본값)
  if (!authHeader) return false;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!m) return false;
  return safeEqual(m[1], token);
}

/**
 * /admin/* 게이트. /admin/session(로그인) 자체는 토큰 없이 접근 가능(토큰 검증이 목적).
 * 나머지 /admin/* 는 Bearer ADMIN_TOKEN 일치해야 통과.
 */
export const adminAuthMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  if (c.req.path === "/admin/session") return next();
  if (!isAdmin(c.env, c.req.header("Authorization") ?? null)) {
    return c.json({ error: "관리자 인증이 필요합니다." }, 401);
  }
  await next();
};
