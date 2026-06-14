import { and, count, desc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import type { z } from "@hono/zod-openapi";
import type { Env } from "../env";
import { getDb } from "../db/client";
import { reports } from "../db/schema";
import { JUDGED_STATUSES, PUBLISHABLE_STATUSES } from "../constants";
import { toAdminSummary, toAdminDetail, toPublicReport } from "../domain/mappers";
import type { AdminListQuerySchema, AdminPatchSchema } from "../schemas";

type AdminListQuery = z.infer<typeof AdminListQuerySchema>;
type AdminPatch = z.infer<typeof AdminPatchSchema>;

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
    const m = or(like(reports.title, kw), like(reports.summary, kw), like(reports.body, kw));
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
    // 검토 피드백 스키마(Votatis#2)
    if (v.status_scope !== undefined) set.verificationStatusScope = v.status_scope;
    if (v.claim !== undefined) set.verificationClaim = v.claim;
    if (v.verified_facts !== undefined) set.verificationVerifiedFacts = v.verified_facts;
    if (v.assessment !== undefined) set.verificationAssessment = v.assessment;
    if (v.confirmed_scope !== undefined) set.verificationConfirmedScope = v.confirmed_scope;
    if (v.not_confirmed !== undefined) set.verificationNotConfirmed = v.not_confirmed;
    if (v.possible_explanations !== undefined) set.verificationPossibleExplanations = v.possible_explanations;
    if (v.missing_evidence !== undefined) set.verificationMissingEvidence = v.missing_evidence;
    if (v.reviewer_note !== undefined) set.verificationReviewerNote = v.reviewer_note;
    if (v.public_summary !== undefined) set.verificationPublicSummary = v.public_summary;
    if (v.risk_level !== undefined) set.verificationRiskLevel = v.risk_level;
  }

  if (JUDGED_STATUSES.has(targetStatus)) {
    // 패치가 해당 키를 명시하면(설령 null 이어도) 그 값이 최종값 — null 로 근거를 지우며 판정 유지 못 하게.
    const method = v && "method" in v ? v.method : row.verificationMethod;
    const links = v && v.evidence_links !== undefined ? v.evidence_links : row.verificationEvidenceLinks ?? [];
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
