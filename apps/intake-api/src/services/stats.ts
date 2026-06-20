import { count, desc, ne, sql } from "drizzle-orm";
import type { Env } from "../env";
import { getDb } from "../db/client";
import { reports } from "../db/schema";

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
