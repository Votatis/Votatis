// 해시·식별자 생성. (구 util.ts 의 암호/ID 부분)

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", view);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 요청 특성에서 파생한 익명 제보자 ID. 실명/연락처는 절대 저장하지 않는다. */
export async function anonSubmitterId(ip: string | null, userAgent: string | null): Promise<string> {
  const seed = `${ip ?? "noip"}|${userAgent ?? "noua"}`;
  const hash = await sha256Hex(new TextEncoder().encode(seed));
  return `anon-${hash.slice(0, 8)}`;
}

export function randomId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/** 타이밍 안전 문자열 비교(길이 노출은 허용 범위). 토큰·해시 비교에 사용. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** URL-safe base64(패딩 제거) — 불투명 토큰 인코딩용. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
