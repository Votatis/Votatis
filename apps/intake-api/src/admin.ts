import { and, count, desc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import type { z } from "@hono/zod-openapi";
import type { Env } from "./types";
import { getDb } from "./db/client";
import { reports } from "./db/schema";
import type { ReportRow } from "./db/schema";
import type { AdminListQuerySchema, AdminPatchSchema } from "./schemas";
import { toPublicReport } from "./reports-map";

/** 공개 배포(export) 대상 — 검증 완료 상태만(PRD: 검증 통과 데이터만 공개). */
export const PUBLISHABLE_STATUSES = ["confirmed", "disputed", "debunked", "corrected"] as const;

type AdminListQuery = z.infer<typeof AdminListQuerySchema>;
type AdminPatch = z.infer<typeof AdminPatchSchema>;

/** 검증 판정 상태(근거 필수). reviewing/unverified 로의 되돌림은 근거 불요구. */
const JUDGED_STATUSES = new Set(["confirmed", "disputed", "debunked", "corrected"]);

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

function region(r: ReportRow) {
  return {
    sido: r.sido ?? undefined,
    sigungu: r.sigungu ?? undefined,
    eup_myeon_dong: r.eupMyeonDong ?? undefined,
  };
}

/** 관리자 목록 요약(검수 큐). 공개 요약 + 제보자 익명ID·첨부수. */
function toAdminSummary(r: ReportRow) {
  return {
    id: r.id,
    status: r.status,
    election: r.election,
    title: r.title,
    summary: r.summary ?? null,
    region: region(r),
    occurred_at: r.occurredAt ?? null,
    collected_at: r.collectedAt,
    tags: r.tags ?? [],
    attachment_count: (r.attachments ?? []).length,
    submitter: r.submitter, // 익명 해시(그룹핑용). 실명 아님
    updated_at: r.updatedAt,
  };
}

/** 관리자 상세 — 내부 필드(submitter·exif) 포함. staging/finalize_token 은 finalize 후 없음. */
function toAdminDetail(r: ReportRow) {
  return {
    id: r.id,
    status: r.status,
    election: r.election,
    title: r.title,
    summary: r.summary ?? null,
    body: r.body ?? null,
    region: region(r),
    occurred_at: r.occurredAt ?? null,
    collected_at: r.collectedAt,
    tags: r.tags ?? [],
    sources: r.sources ?? [],
    attachments: r.attachments ?? [],
    exif: r.exif ?? null,
    rebuttals: r.rebuttals ?? null,
    related: r.related ?? null,
    consent: r.consent ?? null,
    submitter: r.submitter,
    license: r.license,
    verification: {
      reviewer: r.verificationReviewer ?? null,
      method: r.verificationMethod ?? null,
      reviewed_at: r.verificationReviewedAt ?? null,
      notes: r.verificationNotes ?? null,
      evidence_links: r.verificationEvidenceLinks ?? null,
    },
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

function buildAdminWhere(q: Partial<AdminListQuery>): SQL | undefined {
  const conds: SQL[] = [ne(reports.status, "pending")];
  if (q.status) conds.push(eq(reports.status, q.status));
  if (q.election) conds.push(eq(reports.election, q.election));
  if (q.sido) conds.push(eq(reports.sido, q.sido));
  if (q.sigungu) conds.push(eq(reports.sigungu, q.sigungu));
  if (q.tag) {
    const needle = `%"${q.tag.replace(/"/g, "")}"%`;
    conds.push(sql`${reports.tags} LIKE ${needle}`);
  }
  if (q.q) {
    const kw = `%${q.q.replace(/[%_]/g, (m) => "\\" + m)}%`;
    const m = or(
      like(reports.title, kw),
      like(reports.summary, kw),
      like(reports.body, kw),
    );
    if (m) conds.push(m);
  }
  return and(...conds);
}

export async function adminListReports(env: Env, q: AdminListQuery) {
  const db = getDb(env);
  const where = buildAdminWhere(q);

  const totalRows = await db.select({ c: count() }).from(reports).where(where);
  const total = totalRows[0]?.c ?? 0;

  const rows = await db
    .select()
    .from(reports)
    .where(where)
    .orderBy(desc(reports.collectedAt))
    .limit(q.limit)
    .offset(q.offset);

  // 상태별 카운트(필터 q/지역만 적용, status 필터는 무시 → 탭 배지용 전체 집계)
  const countWhere = buildAdminWhere({ ...q, status: undefined });
  const byStatusRows = await db
    .select({ status: reports.status, c: count() })
    .from(reports)
    .where(countWhere)
    .groupBy(reports.status);
  const counts: Record<string, number> = {};
  for (const r of byStatusRows) counts[r.status] = r.c;

  return { items: rows.map(toAdminSummary), total, counts, limit: q.limit, offset: q.offset };
}

export async function adminGetReport(env: Env, id: string) {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, id), ne(reports.status, "pending")))
    .limit(1);
  const row = rows[0];
  return row ? toAdminDetail(row) : null;
}

export type PatchResult =
  | { ok: true; report: ReturnType<typeof toAdminDetail> }
  | { ok: false; status: 400 | 404; error: string };

export async function adminPatchReport(env: Env, id: string, patch: AdminPatch): Promise<PatchResult> {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, id), ne(reports.status, "pending")))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: "제보를 찾을 수 없습니다." };

  const now = new Date().toISOString();
  const set: Partial<typeof reports.$inferInsert> = { updatedAt: now };

  // 판정 상태 전이 — 근거 필수 검사
  const targetStatus = patch.status ?? row.status;
  if (patch.status) set.status = patch.status;

  const v = patch.verification;
  if (v) {
    if (v.reviewer !== undefined) set.verificationReviewer = v.reviewer;
    if (v.method !== undefined) set.verificationMethod = v.method;
    if (v.notes !== undefined) set.verificationNotes = v.notes;
    if (v.evidence_links !== undefined) set.verificationEvidenceLinks = v.evidence_links;
  }

  if (JUDGED_STATUSES.has(targetStatus)) {
    const method = v?.method ?? row.verificationMethod;
    const links = v?.evidence_links ?? row.verificationEvidenceLinks ?? [];
    if (!method || links.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "확정/이견/반박/정정 판정에는 검증 방법(method)과 근거 링크(evidence_links) 1개 이상이 필요합니다.",
      };
    }
  }

  // 판정 시 reviewer/reviewed_at 자동 기록
  if (patch.status && patch.status !== row.status) {
    set.verificationReviewedAt = now;
    if (set.verificationReviewer === undefined && patch.reviewer) set.verificationReviewer = patch.reviewer;
  }

  if (patch.tags !== undefined) set.tags = patch.tags;
  if (patch.rebuttals !== undefined) set.rebuttals = patch.rebuttals;
  if (patch.related !== undefined) set.related = patch.related;
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.summary !== undefined) set.summary = patch.summary;
  if (patch.body !== undefined) set.body = patch.body;

  await db.update(reports).set(set).where(eq(reports.id, id));

  const updated = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return { ok: true, report: toAdminDetail(updated[0]!) };
}

/** 증거 첨부 바이트 스트리밍용 — r2_key·mime 반환. 범위 검사 포함. */
export async function adminGetAttachment(env: Env, id: string, idx: number) {
  const db = getDb(env);
  const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const att = (row.attachments ?? [])[idx];
  if (!att) return null;
  const obj = await env.EVIDENCE_BUCKET.get(att.r2_key);
  if (!obj) return null;
  return { obj, mime: att.mime, filename: att.filename };
}

/** 공개 배포용 추출 — 검증 완료 레코드를 공개 필드(toPublicReport)로. submitter/exif 비포함. */
export async function adminExport(env: Env) {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(reports)
    .where(inArray(reports.status, [...PUBLISHABLE_STATUSES]))
    .orderBy(desc(reports.collectedAt));
  return { records: rows.map(toPublicReport) };
}

/** 공개 통계 — pending 제외 집계. */
export async function publicStats(env: Env) {
  const db = getDb(env);
  const notPending = ne(reports.status, "pending");

  const totalRows = await db.select({ c: count() }).from(reports).where(notPending);
  const total = totalRows[0]?.c ?? 0;

  const byStatusRows = await db
    .select({ status: reports.status, c: count() })
    .from(reports)
    .where(notPending)
    .groupBy(reports.status);
  const by_status: Record<string, number> = {};
  for (const r of byStatusRows) by_status[r.status] = r.c;

  const byElectionRows = await db
    .select({ election: reports.election, c: count() })
    .from(reports)
    .where(notPending)
    .groupBy(reports.election)
    .orderBy(desc(count()));
  const by_election = byElectionRows.map((r) => ({ election: r.election, count: r.c }));

  // 일자별(collected_at 의 날짜 부분). SQLite substr 로 YYYY-MM-DD 추출.
  const dayExpr = sql<string>`substr(${reports.collectedAt}, 1, 10)`;
  const dailyRows = await db
    .select({ date: dayExpr, c: count() })
    .from(reports)
    .where(notPending)
    .groupBy(dayExpr)
    .orderBy(dayExpr);
  const daily = dailyRows.map((r) => ({ date: r.date, count: r.c }));

  return { total, by_status, by_election, daily };
}
