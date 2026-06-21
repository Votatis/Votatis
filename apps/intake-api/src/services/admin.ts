import { and, count, desc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import type { z } from "@hono/zod-openapi";
import type { Env } from "../env";
import { getDb } from "../db/client";
import { reports } from "../db/schema";
import { JUDGED_STATUSES, PUBLISHABLE_STATUSES } from "../constants";
import { toAdminSummary, toAdminDetail, toPublicReport } from "../domain/mappers";
import { randomId } from "../lib/crypto";
import type { AdminListQuerySchema, AdminPatchSchema, AdminReportCreateSchema } from "../schemas";

type AdminListQuery = z.infer<typeof AdminListQuerySchema>;
type AdminPatch = z.infer<typeof AdminPatchSchema>;
type AdminReportCreate = z.infer<typeof AdminReportCreateSchema>;

/** 관리자 직접 제보 등록 — 검수 전 상태로 즉시 생성(업로드/Turnstile 없음). */
export async function adminCreateReport(env: Env, input: AdminReportCreate, reviewer: string | null) {
  const db = getDb(env);
  const id = randomId();
  const now = new Date().toISOString();
  await db.insert(reports).values({
    id,
    status: input.status ?? "unverified",
    election: input.election,
    title: input.title,
    summary: input.summary ?? null,
    body: input.body ?? null,
    sido: input.region?.sido ?? null,
    sigungu: input.region?.sigungu ?? null,
    eupMyeonDong: input.region?.eup_myeon_dong ?? null,
    occurredAt: input.occurred_at ?? null,
    collectedAt: now,
    tags: input.tags ?? [],
    sources: input.sources ?? [],
    attachments: [],
    exif: null,
    rebuttals: null,
    related: null,
    consent: true, // 관리자 직접 입력
    submitter: `admin:${reviewer ?? "console"}`,
    license: "CC-BY-4.0",
    verificationReviewer: null,
    verificationMethod: null,
    verificationReviewedAt: null,
    verificationNotes: null,
    verificationEvidenceLinks: null,
    finalizeToken: null,
    staging: null,
    createdAt: now,
    updatedAt: now,
  });
  const row = (await db.select().from(reports).where(eq(reports.id, id)).limit(1))[0];
  return toAdminDetail(row!);
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
    // 병합값: 패치가 키를 주면 그 값, 아니면 기존 행 값.
    const mergedStr = (key: keyof NonNullable<typeof v>, col: string | null) =>
      v && key in v ? ((v[key] as string | null | undefined) ?? null) : col;
    const mergedArr = (key: keyof NonNullable<typeof v>, col: string[] | null) =>
      v && v[key] !== undefined ? ((v[key] as string[] | null) ?? []) : col ?? [];

    const method = mergedStr("method", row.verificationMethod);
    const links = mergedArr("evidence_links", row.verificationEvidenceLinks ?? null);
    if (!method || links.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "확정/이견/반박/정정 판정에는 검증 방법(method)과 근거 링크(evidence_links) 1개 이상이 필요합니다.",
      };
    }

    // 검토 피드백 필수(페르소나 5: 확증편향·과잉해석 차단). 공개요약·위험도·미확인항목.
    const publicSummary = mergedStr("public_summary", row.verificationPublicSummary);
    const riskLevel = mergedStr("risk_level", row.verificationRiskLevel);
    const notConfirmed = mergedArr("not_confirmed", row.verificationNotConfirmed ?? null);
    if (!publicSummary?.trim() || !riskLevel?.trim() || notConfirmed.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "판정에는 공개 요약(public_summary)·위험도(risk_level)·미확인 항목(not_confirmed 1개 이상)이 필요합니다.",
      };
    }

    // '확인됨'(confirmed)은 확인 범위를 반드시 제한해야 한다(부정선거 단정 금지).
    if (targetStatus === "confirmed") {
      const statusScope = mergedStr("status_scope", row.verificationStatusScope);
      const confirmedScope = mergedArr("confirmed_scope", row.verificationConfirmedScope ?? null);
      if (!statusScope?.trim() || confirmedScope.length === 0) {
        return {
          ok: false,
          status: 400,
          error: "확인됨 판정에는 확인 범위(status_scope)와 확인된 항목(confirmed_scope 1개 이상)이 필요합니다.",
        };
      }
    }

    // '의심'(suspected)은 통상적 설명으로 해소되지 않는 미해명 정황 — 조작 단정이 아님을 분명히 하기 위해
    // 필요 해명 사항(missing_evidence)을 반드시 남겨야 한다(페르소나5: 의심을 부정선거 단정으로 비약 금지).
    if (targetStatus === "suspected") {
      const missing = mergedArr("missing_evidence", row.verificationMissingEvidence ?? null);
      if (missing.length === 0) {
        return {
          ok: false,
          status: 400,
          error: "의심 판정에는 미해명·필요 해명 사항(missing_evidence 1개 이상)이 필요합니다. (조작 단정이 아니라 해명이 필요한 정황임을 명시)",
        };
      }
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

  // 변경된 레코드는 재export 대상(spec 0018). ack 가 다시 0 으로 내린다.
  set.exportDirty = 1;

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

/**
 * 공개 배포용 추출 — 검증 완료 레코드를 공개 필드(toPublicReport)로. submitter/exif 비포함.
 * mode=incremental(기본): export_dirty=1 인 변경분만. mode=full: PUBLISHABLE 전체(리셋용). (spec 0018)
 */
export async function adminExport(env: Env, mode: "incremental" | "full" = "incremental") {
  const db = getDb(env);
  const publishable = inArray(reports.status, [...PUBLISHABLE_STATUSES]);
  const where = mode === "full" ? publishable : and(publishable, eq(reports.exportDirty, 1));
  const rows = await db.select().from(reports).where(where).orderBy(desc(reports.collectedAt));
  return { mode, records: rows.map(toPublicReport) };
}

/**
 * export ack — 로컬 기록을 마친 id 들의 export_dirty 를 0 으로 내린다(spec 0018).
 * export-data 가 .md 기록 성공 후 호출. 빈 배열이면 무동작. acked = 실제로 0 이 된 건수.
 */
export async function adminAckExport(env: Env, ids: string[]): Promise<{ acked: number }> {
  if (!ids.length) return { acked: 0 };
  const db = getDb(env);
  await db.update(reports).set({ exportDirty: 0 }).where(inArray(reports.id, ids));
  return { acked: ids.length };
}
