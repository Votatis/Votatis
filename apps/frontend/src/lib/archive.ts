// 공개 아카이브 데이터 레이어 — 빌드타임 생성 인덱스(archive.generated.json, spec 0011)를 읽어
// 정적 아카이브/검색/통계(spec 0010)에 필터·검색·집계를 제공한다. 런타임 API 호출 없음(정적·캐시 가능).
// 데이터 원천은 검증 완료 레코드만(PRD 원칙1) — 미검증/검토중은 공개 인덱스에 들어오지 않는다.

import generated from "@/data/archive.generated.json";
import type { components } from "./api/schema";
import { CATEGORY_FULL, type Category, type VerifyStatus } from "./types";

export type ArchiveRecord = components["schemas"]["Report"];

const RECORDS = (generated as ArchiveRecord[]) ?? [];

/** tags[0](제보 시 CATEGORY_FULL 라벨로 저장)에서 카테고리를 역추출. 매칭 없으면 null. */
export function recordCategory(r: ArchiveRecord): Category | null {
  const first = r.tags?.[0];
  if (!first) return null;
  for (const key of Object.keys(CATEGORY_FULL) as Category[]) {
    if (CATEGORY_FULL[key] === first) return key;
  }
  return null;
}

export function allRecords(): ArchiveRecord[] {
  return RECORDS;
}

export function getRecord(id: string): ArchiveRecord | null {
  return RECORDS.find((r) => r.id === id) ?? null;
}

export interface ArchiveFilter {
  category?: Category | null;
  status?: VerifyStatus | null;
  q?: string;
  sort?: "all" | "recent";
}

/** 필터·검색·정렬 적용. q 는 제목/요약/본문/태그 대상 부분일치(대소문자 무시). */
export function filterRecords(f: ArchiveFilter): ArchiveRecord[] {
  const q = f.q?.trim().toLowerCase();
  let out = RECORDS.filter((r) => {
    if (f.category && recordCategory(r) !== f.category) return false;
    if (f.status && r.status !== f.status) return false;
    if (q) {
      const hay = [r.title, r.summary ?? "", r.body ?? "", ...(r.tags ?? [])].join(" ").toLowerCase();
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
  for (const r of RECORDS) {
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
  for (const r of RECORDS) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    const day = (r.collected_at ?? "").slice(0, 10);
    if (day) dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  }
  const daily = [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
  return { total: RECORDS.length, byStatus, byCategory: categoryCounts(), daily };
}
