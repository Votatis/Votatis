// 공개 아카이브 데이터 소스 (spec 0011/0016).
// 목록: 빌드타임 슬림 인덱스(archive.generated.json) 기반(loadArchiveSummaries) — API 미사용.
// 상세(런타임 record?id): 새로 승인됐지만 아직 재빌드 안 된 레코드를 위해 GET /reports/{id} 런타임 조회.
//   (정적 /archive/[id] 상세는 .md 를 빌드타임 파싱 — archive-md.ts.)

import staticGenerated from "@/data/archive.generated.json";
import { API_BASE_URL } from "./api/client";
import type { components } from "./api/schema";
import { CATEGORY_FULL, type Category } from "./types";

export type ArchiveRecord = components["schemas"]["Report"]; // 상세(풀)
export type ArchiveSummary = components["schemas"]["ReportSummary"]; // 목록(슬림)

/** 공개 아카이브에 노출하는 "승인(검증완료)" 상태 — PRD: 검증 통과 데이터만 공개. */
export const PUBLISHABLE = new Set<string>(["confirmed", "suspected", "disputed", "debunked", "corrected"]);

/** 빌드타임 슬림 인덱스(요약). 목록·탐색의 단일 원천. */
const STATIC: ArchiveSummary[] = (staticGenerated as ArchiveSummary[]) ?? [];

/** tags[0](제보 시 CATEGORY_FULL 라벨로 저장)에서 카테고리를 역추출. 매칭 없으면 null. */
export function recordCategory(r: { tags?: string[] | null }): Category | null {
  const first = r.tags?.[0];
  if (!first) return null;
  for (const key of Object.keys(CATEGORY_FULL) as Category[]) {
    if (CATEGORY_FULL[key] === first) return key;
  }
  return null;
}

/**
 * 승인 레코드 목록 — 빌드타임에 구운 정적 인덱스(archive.generated.json) 기반.
 * 런타임 API(/reports)를 호출하지 않는다(공개 아카이브 목록은 export→build 산출물이 단일 원천).
 * 목록을 갱신하려면 export:data → build(=build-archive-index) 를 다시 돌린다.
 */
export async function loadArchiveSummaries(): Promise<ArchiveSummary[]> {
  return STATIC.filter((r) => PUBLISHABLE.has(r.status));
}

/**
 * 승인 레코드 상세 — 런타임 API 조회(GET /reports/{id}). 새로 승인됐지만 아직 재빌드 안 된 레코드용.
 * 슬림 인덱스에는 상세가 없으므로 API 실패/미존재 시 null(정적 상세는 /archive/[id] 가 md 로 커버).
 */
export async function loadArchiveRecord(id: string): Promise<ArchiveRecord | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/reports/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const r = (await res.json()) as ArchiveRecord;
    // 승인 상태가 아니면 공개 아카이브에선 미노출 취급.
    return PUBLISHABLE.has(r.status) ? r : null;
  } catch {
    return null;
  }
}
