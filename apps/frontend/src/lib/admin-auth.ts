// 관리자 토큰 보관 — MVP 공유 토큰(spec 0008). 브라우저 localStorage 에만 보관하고
// 요청 시 Authorization: Bearer 로 보낸다. (멤버별 계정·세션 쿠키는 향후 — HUMAN.md)

const KEY = "votatis_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, token);
}

export function clearAdminToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
