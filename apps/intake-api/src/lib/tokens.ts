// 토큰 — 불투명 리프레시/리셋 토큰 + JWT 액세스 토큰(hono/jwt, HS256).

import { sign, verify } from "hono/jwt";
import { bytesToBase64Url } from "./crypto";
import { ACCESS_TOKEN_TTL_SEC } from "../constants";
import type { AdminRole } from "../constants";

export interface AdminTokenUser {
  id: string;
  username: string;
  role: AdminRole;
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** 32바이트 랜덤 → URL-safe base64. 리프레시/리셋 원문 토큰. DB엔 sha256 해시만 저장. */
export function generateOpaqueToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** 단명 access JWT 발급. */
export async function signAccessToken(secret: string, user: AdminTokenUser): Promise<string> {
  const iat = nowSec();
  return sign(
    { sub: user.id, username: user.username, role: user.role, type: "access", iat, exp: iat + ACCESS_TOKEN_TTL_SEC },
    secret,
    "HS256",
  );
}

/** access JWT 검증. 유효하면 사용자 식별 정보, 아니면 null(만료·위조 모두). */
export async function verifyAccessToken(secret: string, token: string): Promise<AdminTokenUser | null> {
  try {
    const payload = (await verify(token, secret, "HS256")) as {
      sub?: string;
      username?: string;
      role?: string;
      type?: string;
    };
    if (payload.type !== "access" || !payload.sub || !payload.username) return null;
    if (payload.role !== "root" && payload.role !== "member") return null;
    return { id: payload.sub, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}
