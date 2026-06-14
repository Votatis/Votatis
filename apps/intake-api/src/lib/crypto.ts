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
