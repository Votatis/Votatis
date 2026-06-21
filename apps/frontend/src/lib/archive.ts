// 공개 아카이브 데이터 레이어 — 빌드타임 생성 인덱스(archive.generated.json, spec 0011)를 읽어
// 정적 아카이브/검색/통계(spec 0010)에 필터·검색·집계를 제공한다. 런타임 API 호출 없음(정적·캐시 가능).
// 인덱스는 슬림 요약(목록·탐색·통계용)만 담는다 — 상세 풀데이터는 각 .md 가 보유(archive-md.ts).
// 데이터 원천은 검증 완료 레코드만(PRD 원칙1) — 미검증/검토중은 공개 인덱스에 들어오지 않는다.

import generated from "@/data/archive.generated.json";
import type { components } from "./api/schema";
import { CATEGORY_FULL, type Category, type VerifyStatus } from "./types";

/** 슬림 요약(목록/검색/통계). 상세 풀 레코드는 ArchiveRecord(archive-source) + archive-md 참조. */
export type ArchiveSummary = components["schemas"]["ReportSummary"];

const SUMMARIES = (generated as ArchiveSummary[]) ?? [];

/** tags[0](제보 시 CATEGORY_FULL 라벨로 저장)에서 카테고리를 역추출. 매칭 없으면 null. */
export function recordCategory(r: { tags?: string[] | null }): Category | null {
  const first = r.tags?.[0];
  if (!first) return null;
  for (const key of Object.keys(CATEGORY_FULL) as Category[]) {
    if (CATEGORY_FULL[key] === first) return key;
  }
  return null;
}

export function allSummaries(): ArchiveSummary[] {
  return SUMMARIES;
}

export function getSummary(id: string): ArchiveSummary | null {
  return SUMMARIES.find((r) => r.id === id) ?? null;
}

export interface ArchiveFilter {
  category?: Category | null;
  status?: VerifyStatus | null;
  q?: string;
  sort?: "all" | "recent";
}

/** 필터·검색·정렬 적용. q 는 제목/요약/태그/지역 대상 부분일치(대소문자 무시). 본문은 인덱스에 없음(상세 md). */
export function filterRecords(f: ArchiveFilter): ArchiveSummary[] {
  const q = f.q?.trim().toLowerCase();
  let out = SUMMARIES.filter((r) => {
    if (f.category && recordCategory(r) !== f.category) return false;
    if (f.status && r.status !== f.status) return false;
    if (q) {
      const region = [r.region?.sido, r.region?.sigungu, r.region?.eup_myeon_dong].filter(Boolean).join(" ");
      const hay = [r.title, r.summary ?? "", region, ...(r.tags ?? [])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (f.sort === "recent") {
    out = [...out].sort((a, b) => (b.collected_at ?? "").localeCompare(a.collected_at ?? ""));
  }
  return out;
}

/** 카테고리별 건수. */
export function categoryCounts(): Record<Category, number> {
  const counts: Record<Category, number> = { A: 0, B: 0, C: 0 };
  for (const r of SUMMARIES) {
    const c = recordCategory(r);
    if (c) counts[c]++;
  }
  return counts;
}

export interface ArchiveStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<Category, number>;
  daily: { date: string; count: number }[];
}

/** 공개(검증완료) 레코드 집계 — 통계 페이지용. */
export function archiveStats(): ArchiveStats {
  const byStatus: Record<string, number> = {};
  const dailyMap = new Map<string, number>();
  for (const r of SUMMARIES) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const day = (r.collected_at ?? "").slice(0, 10);
    if (day) dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  }
  const daily = [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
  return { total: SUMMARIES.length, byStatus, byCategory: categoryCounts(), daily };
}
