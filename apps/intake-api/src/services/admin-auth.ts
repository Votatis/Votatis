// 관리자 인증 서비스 — 로그인/리프레시/로그아웃/비밀번호 재설정 + 루트 부트스트랩.
// 토큰 정책: access 단명 JWT, refresh 회전·슬라이딩 7일 만료. 원문 토큰은 해시만 저장.

import { and, eq, isNull } from "drizzle-orm";
import type { Env } from "../env";
import { getDb } from "../db/client";
import { adminUsers, adminRefreshTokens, adminPasswordResetTokens } from "../db/schema";
import type { AdminUserRow } from "../db/schema";
import { sha256Hex, randomId, safeEqual } from "../lib/crypto";
import { hashPassword, verifyPassword } from "../lib/password";
import { generateOpaqueToken, signAccessToken, nowSec } from "../lib/tokens";
import type { AdminTokenUser } from "../lib/tokens";
import { HttpError } from "../lib/http-error";
import {
  REFRESH_TOKEN_TTL_SEC,
  MIN_PASSWORD_LENGTH,
  ROOT_ADMIN_USERNAME,
  type AdminRole,
  type AdminUserStatus,
} from "../constants";

export interface PublicAdminUser {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  status: AdminUserStatus;
  last_login_at: string | null;
  created_at: string;
}

export interface SessionResult {
  access_token: string;
  refresh_token: string;
  user: PublicAdminUser;
}

const nowIso = (): string => new Date().toISOString();
const hashToken = (raw: string): Promise<string> => sha256Hex(new TextEncoder().encode(raw));

export function toPublicAdminUser(row: AdminUserRow): PublicAdminUser {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role as AdminRole,
    status: row.status as AdminUserStatus,
    last_login_at: row.lastLoginAt ?? null,
    created_at: row.createdAt,
  };
}

/** 현재 사용자(/admin/auth/me). break-glass 토큰은 합성 루트 사용자로. */
export async function getCurrentUser(
  env: Env,
  ctx: { id: string; username: string; role: AdminRole },
): Promise<PublicAdminUser> {
  if (ctx.id === "__token__") {
    return {
      id: "__token__",
      username: "admin",
      name: "루트 관리자(토큰)",
      role: "root",
      status: "active" as AdminUserStatus,
      last_login_at: null,
      created_at: "",
    };
  }
  const db = getDb(env);
  const row = (await db.select().from(adminUsers).where(eq(adminUsers.id, ctx.id)).limit(1))[0];
  if (!row) throw new HttpError(401, "세션이 만료되었습니다. 다시 로그인하세요.");
  return toPublicAdminUser(row);
}

function requireSecret(env: Env): string {
  if (!env.JWT_SECRET) throw new HttpError(503, "인증이 구성되지 않았습니다(JWT_SECRET 미설정).");
  return env.JWT_SECRET;
}

function tokenUser(row: AdminUserRow): AdminTokenUser {
  return { id: row.id, username: row.username, role: row.role as AdminRole };
}

/** 회전형 리프레시 토큰 발급 — 원문 반환, 해시만 저장. 슬라이딩 7일. */
async function issueRefreshToken(env: Env, userId: string): Promise<string> {
  const db = getDb(env);
  const raw = generateOpaqueToken();
  await db.insert(adminRefreshTokens).values({
    id: randomId(),
    userId,
    tokenHash: await hashToken(raw),
    expiresAt: nowSec() + REFRESH_TOKEN_TTL_SEC,
    lastUsedAt: nowIso(),
    createdAt: nowIso(),
  });
  return raw;
}

/**
 * 로그인. 루트 부트스트랩: `admin` 행이 없고 자격이 admin + ADMIN_TOKEN 이면 root 생성.
 */
export async function login(env: Env, username: string, password: string): Promise<SessionResult> {
  const secret = requireSecret(env);
  const db = getDb(env);

  let user = (await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1))[0];

  // 루트 부트스트랩(멱등)
  if (!user && username === ROOT_ADMIN_USERNAME && env.ADMIN_TOKEN && safeEqual(password, env.ADMIN_TOKEN)) {
    const id = randomId();
    await db.insert(adminUsers).values({
      id,
      username: ROOT_ADMIN_USERNAME,
      name: "루트 관리자",
      passwordHash: await hashPassword(password),
      role: "root",
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    user = (await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1))[0];
  }

  if (!user) throw new HttpError(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
  if (user.status !== "active") throw new HttpError(403, "비활성화된 계정입니다.");
  if (!user.passwordHash) throw new HttpError(403, "비밀번호가 설정되지 않았습니다. 재설정 링크로 설정하세요.");
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, "아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  await db.update(adminUsers).set({ lastLoginAt: nowIso(), updatedAt: nowIso() }).where(eq(adminUsers.id, user.id));

  return {
    access_token: await signAccessToken(secret, tokenUser(user)),
    refresh_token: await issueRefreshToken(env, user.id),
    user: toPublicAdminUser({ ...user, lastLoginAt: nowIso() }),
  };
}

/** 리프레시 — 회전(기존 폐기+신규) + 새 access. 만료/폐기/비활성 시 401. */
export async function refresh(env: Env, rawRefresh: string): Promise<SessionResult> {
  const secret = requireSecret(env);
  const db = getDb(env);
  const tokenHash = await hashToken(rawRefresh);

  const row = (
    await db.select().from(adminRefreshTokens).where(eq(adminRefreshTokens.tokenHash, tokenHash)).limit(1)
  )[0];
  if (!row || row.revokedAt || row.expiresAt <= nowSec()) {
    throw new HttpError(401, "세션이 만료되었습니다. 다시 로그인하세요.");
  }

  const user = (await db.select().from(adminUsers).where(eq(adminUsers.id, row.userId)).limit(1))[0];
  if (!user || user.status !== "active") {
    throw new HttpError(401, "세션이 만료되었습니다. 다시 로그인하세요.");
  }

  // 회전: 기존 토큰 폐기 후 신규 발급
  await db.update(adminRefreshTokens).set({ revokedAt: nowIso() }).where(eq(adminRefreshTokens.id, row.id));

  return {
    access_token: await signAccessToken(secret, tokenUser(user)),
    refresh_token: await issueRefreshToken(env, user.id),
    user: toPublicAdminUser(user),
  };
}

/** 로그아웃 — 해당 리프레시 토큰 폐기(있으면). 멱등. */
export async function logout(env: Env, rawRefresh: string): Promise<void> {
  const db = getDb(env);
  const tokenHash = await hashToken(rawRefresh);
  await db
    .update(adminRefreshTokens)
    .set({ revokedAt: nowIso() })
    .where(and(eq(adminRefreshTokens.tokenHash, tokenHash), isNull(adminRefreshTokens.revokedAt)));
}

/** 재설정 토큰으로 비밀번호 설정 — 1회용·만료 검사 + 기존 세션 전부 무효화. */
export async function setPasswordByResetToken(env: Env, rawToken: string, newPassword: string): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
  const db = getDb(env);
  const tokenHash = await hashToken(rawToken);

  const row = (
    await db
      .select()
      .from(adminPasswordResetTokens)
      .where(eq(adminPasswordResetTokens.tokenHash, tokenHash))
      .limit(1)
  )[0];
  if (!row || row.usedAt || row.expiresAt <= nowSec()) {
    throw new HttpError(400, "유효하지 않거나 만료된 링크입니다.");
  }

  const user = (await db.select().from(adminUsers).where(eq(adminUsers.id, row.userId)).limit(1))[0];
  if (!user) throw new HttpError(400, "유효하지 않은 링크입니다.");

  await db
    .update(adminUsers)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: nowIso() })
    .where(eq(adminUsers.id, user.id));
  await db
    .update(adminPasswordResetTokens)
    .set({ usedAt: nowIso() })
    .where(eq(adminPasswordResetTokens.id, row.id));
  // 비밀번호 변경 → 기존 리프레시 세션 전부 폐기(보안)
  await db
    .update(adminRefreshTokens)
    .set({ revokedAt: nowIso() })
    .where(and(eq(adminRefreshTokens.userId, user.id), isNull(adminRefreshTokens.revokedAt)));
}
