// 비밀번호 해시 — Workers Web Crypto(PBKDF2-HMAC-SHA256). 외부 의존성 없음.
// 저장 형식: pbkdf2$<iters>$<saltB64>$<hashB64>. 비교는 timing-safe.

import { bytesToBase64, base64ToBytes, safeEqual } from "./crypto";

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVE_BYTES = 32;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number, lenBytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    lenBytes * 8,
  );
  return new Uint8Array(bits);
}

/** 평문 → `pbkdf2$<iters>$<saltB64>$<hashB64>`. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await pbkdf2(plain, salt, ITERATIONS, DERIVE_BYTES);
  return `pbkdf2$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
}

/** 평문이 저장 해시와 일치하는지. 형식 불량/미설정이면 false. */
export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  let salt: Uint8Array;
  try {
    salt = base64ToBytes(parts[2]);
  } catch {
    return false;
  }
  const expected = parts[3];
  const derived = await pbkdf2(plain, salt, iterations, DERIVE_BYTES);
  return safeEqual(bytesToBase64(derived), expected);
}
