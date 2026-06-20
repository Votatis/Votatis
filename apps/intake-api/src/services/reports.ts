import { and, count, desc, eq, gte, lte, ne, sql, type SQL } from "drizzle-orm";
import type { z } from "@hono/zod-openapi";
import type { Env } from "../env";
import type { ReportListQuerySchema } from "../schemas";
import { reports } from "../db/schema";
import { getDb } from "../db/client";
import { toPublicReport, toSummary } from "../domain/mappers";
import { PUBLISHABLE_STATUSES } from "../constants";

type ListQuery = z.infer<typeof ReportListQuerySchema>;

/** 조회 공통: pending 내부상태는 절대 노출하지 않는다 + 쿼리 필터. */
function buildWhere(q: Partial<ListQuery>): SQL | undefined {
  const conds: SQL[] = [ne(reports.status, "pending")];
  if (q.status) conds.push(eq(reports.status, q.status));
  if (q.election) conds.push(eq(reports.election, q.election));
  if (q.sido) conds.push(eq(reports.sido, q.sido));
  if (q.sigungu) conds.push(eq(reports.sigungu, q.sigungu));
  if (q.from) conds.push(gte(reports.occurredAt, q.from));
  if (q.to) conds.push(lte(reports.occurredAt, q.to));
  if (q.tag) {
    // tags 는 JSON 배열 텍스트(["a","b"]). 따옴표로 감싼 정확 토큰 매칭. 값의 따옴표는 제거(주입 방지).
    const needle = `%"${q.tag.replace(/"/g, "")}"%`;
    conds.push(sql`${reports.tags} LIKE ${needle}`);
  }
  return and(...conds);
}

export async function listReports(env: Env, q: ListQuery) {
  const db = getDb(env);
  const where = buildWhere(q);

  const totalRows = await db.select({ c: count() }).from(reports).where(where);
  const total = totalRows[0]?.c ?? 0;

  const rows = await db
    .select()
    .from(reports)
    .where(where)
    .orderBy(desc(reports.collectedAt))
    .limit(q.limit)
    .offset(q.offset);

  return { items: rows.map(toSummary), total, limit: q.limit, offset: q.offset };
}

export async function getReport(env: Env, id: string) {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, id), ne(reports.status, "pending")))
    .limit(1);
  const row = rows[0];
  return row ? toPublicReport(row) : null;
}

/**
 * 공개 첨부(증거 이미지) 바이트. 공개 배포(PUBLISHABLE) 상태 레코드의 첨부만 노출한다.
 * (미검증/검토중/pending 의 증거는 공개하지 않음 — 프라이버시·오용 방지.)
 */
export async function getPublicAttachment(env: Env, id: string, idx: number) {
  const db = getDb(env);
  const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (!(PUBLISHABLE_STATUSES as readonly string[]).includes(row.status)) return null;
  const att = (row.attachments ?? [])[idx];
  if (!att) return null;
  const obj = await env.EVIDENCE_BUCKET.get(att.r2_key);
  if (!obj) return null;
  return { obj, mime: att.mime, filename: att.filename };
}
