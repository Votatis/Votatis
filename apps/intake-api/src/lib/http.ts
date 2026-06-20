// HTTP 요청 유틸.

/** Cloudflare 가 채우는 클라이언트 IP 헤더에서 IP 추출(rate limit·익명화 시드용). */
export function clientIp(request: Request): string | null {
  return request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For");
}
