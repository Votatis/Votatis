// 관리자 세션 보관 (spec 0015) — access JWT(단명) + refresh(회전) + 사용자 정보.
// localStorage 에만 보관하고 요청 시 Authorization: Bearer <access> 로 보낸다.
// 401 이면 api/admin.ts 가 refresh 로 1회 갱신을 시도한다.

import type { components } from "./api/schema";

export type AdminUser = components["schemas"]["AdminUserPublic"];
export type AdminSession = components["schemas"]["AdminSessionResultV2"];

const ACCESS_KEY = "votatis_admin_access";
const REFRESH_KEY = "votatis_admin_refresh";
const USER_KEY = "votatis_admin_user";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function getUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function setSession(session: AdminSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, session.access_token);
  window.localStorage.setItem(REFRESH_KEY, session.refresh_token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

/** 토큰 회전 시 access/refresh 만 갱신(user 는 유지). */
export function updateTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
}
