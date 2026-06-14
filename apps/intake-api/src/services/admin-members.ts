// 회원(검증자) 관리 서비스 — root 전용. 생성/목록/재설정 발급/수정/삭제.
// 비밀번호는 여기서 정하지 않는다 — 재설정 토큰을 발급하고 회원이 링크로 직접 설정한다.

import { and, eq, isNull, asc } from "drizzle-orm";
import type { Env } from "../env";
import { getDb } from "../db/client";
import type { DB } from "../db/client";
import { adminUsers, adminRefreshTokens, adminPasswordResetTokens } from "../db/schema";
import { sha256Hex, randomId } from "../lib/crypto";
import { generateOpaqueToken, nowSec } from "../lib/tokens";
import { HttpError } from "../lib/http-error";
import { RESET_TOKEN_TTL_SEC, ADMIN_ROLES, ADMIN_USER_STATUSES, type AdminRole } from "../constants";
import { toPublicAdminUser, type PublicAdminUser } from "./admin-auth";

const nowIso = (): string => new Date().toISOString();
const hashToken = (raw: string): Promise<string> => sha256Hex(new TextEncoder().encode(raw));
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

/** 사용자에게 재설정 토큰 발급 — 기존 미사용 토큰은 무효화하고 신규 1개 발급. 원문 반환. */
async function issueResetTokenForUser(db: DB, userId: string): Promise<string> {
  await db
    .update(adminPasswordResetTokens)
    .set({ usedAt: nowIso() })
    .where(and(eq(adminPasswordResetTokens.userId, userId), isNull(adminPasswordResetTokens.usedAt)));
  const raw = generateOpaqueToken();
  await db.insert(adminPasswordResetTokens).values({
    id: randomId(),
    userId,
    tokenHash: await hashToken(raw),
    expiresAt: nowSec() + RESET_TOKEN_TTL_SEC,
    createdAt: nowIso(),
  });
  return raw;
}

export async function listMembers(env: Env): Promise<PublicAdminUser[]> {
  const db = getDb(env);
  const rows = await db.select().from(adminUsers).orderBy(asc(adminUsers.createdAt));
  return rows.map(toPublicAdminUser);
}

export interface CreateMemberInput {
  username: string;
  name: string;
  role?: AdminRole;
}

/** 회원 생성 → 재설정 토큰 발급. 비밀번호는 회원이 링크로 설정. */
export async function createMember(
  env: Env,
  input: CreateMemberInput,
): Promise<{ user: PublicAdminUser; reset_token: string }> {
  const db = getDb(env);
  const username = input.username.trim().toLowerCase();
  const name = input.name.trim();
  const role: AdminRole = input.role ?? "member";

  if (!USERNAME_RE.test(username)) {
    throw new HttpError(400, "username 은 3~32자 영소문자/숫자/._- 만 가능합니다.");
  }
  if (!name) throw new HttpError(400, "이름을 입력하세요.");
  if (!ADMIN_ROLES.includes(role)) throw new HttpError(400, "역할이 올바르지 않습니다.");

  const existing = (await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1))[0];
  if (existing) throw new HttpError(409, "이미 존재하는 username 입니다.");

  const id = randomId();
  await db.insert(adminUsers).values({
    id,
    username,
    name,
    passwordHash: null,
    role,
    status: "active",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  const reset_token = await issueResetTokenForUser(db, id);
  const user = (await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1))[0];
  return { user: toPublicAdminUser(user), reset_token };
}

/** 회원 재설정 링크(토큰) 재발급. */
export async function issueResetToken(env: Env, userId: string): Promise<string> {
  const db = getDb(env);
  const user = (await db.select().from(adminUsers).where(eq(adminUsers.id, userId)).limit(1))[0];
  if (!user) throw new HttpError(404, "회원을 찾을 수 없습니다.");
  return issueResetTokenForUser(db, userId);
}

export interface UpdateMemberInput {
  name?: string;
  status?: string;
}

export async function updateMember(
  env: Env,
  id: string,
  patch: UpdateMemberInput,
  actorId: string,
): Promise<PublicAdminUser> {
  const db = getDb(env);
  const user = (await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1))[0];
  if (!user) throw new HttpError(404, "회원을 찾을 수 없습니다.");

  const set: Record<string, string> = { updatedAt: nowIso() };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new HttpError(400, "이름을 입력하세요.");
    set.name = name;
  }
  if (patch.status !== undefined) {
    if (!ADMIN_USER_STATUSES.includes(patch.status as (typeof ADMIN_USER_STATUSES)[number])) {
      throw new HttpError(400, "상태값이 올바르지 않습니다.");
    }
    if (patch.status === "disabled" && id === actorId) {
      throw new HttpError(400, "자기 자신을 비활성화할 수 없습니다.");
    }
    set.status = patch.status;
  }

  await db.update(adminUsers).set(set).where(eq(adminUsers.id, id));
  if (patch.status === "disabled") {
    // 비활성화 시 기존 세션 폐기
    await db
      .update(adminRefreshTokens)
      .set({ revokedAt: nowIso() })
      .where(and(eq(adminRefreshTokens.userId, id), isNull(adminRefreshTokens.revokedAt)));
  }
  const updated = (await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1))[0];
  return toPublicAdminUser(updated);
}

export async function deleteMember(env: Env, id: string, actorId: string): Promise<void> {
  const db = getDb(env);
  const user = (await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1))[0];
  if (!user) throw new HttpError(404, "회원을 찾을 수 없습니다.");
  if (id === actorId) throw new HttpError(400, "자기 자신을 삭제할 수 없습니다.");
  if (user.role === "root") throw new HttpError(400, "루트 계정은 삭제할 수 없습니다.");

  await db.delete(adminRefreshTokens).where(eq(adminRefreshTokens.userId, id));
  await db.delete(adminPasswordResetTokens).where(eq(adminPasswordResetTokens.userId, id));
  await db.delete(adminUsers).where(eq(adminUsers.id, id));
}
