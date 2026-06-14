// 공개 아카이브 데이터 소스 (spec 0016) — 런타임 API 연동.
// 지금: intake-api 공개 조회(GET /reports, GET /reports/{id})에서 "승인(검증완료)" 레코드를 런타임에 읽는다.
//   → 검증을 통과한 데이터가 정적 재빌드 없이 즉시 아카이브에 반영된다.
// 나중(준비만): 빌드타임 정적 인덱스(archive.generated.json, spec 0011)는 그대로 두어
//   static build(SSG) 전환 시 fallback/소스로 재사용한다. API 실패 시에도 이 정적본으로 폴백한다.

import staticGenerated from "@/data/archive.generated.json";
import { API_BASE_URL } from "./api/client";
import type { components } from "./api/schema";
import { CATEGORY_FULL, type Category } from "./types";

export type ArchiveRecord = components["schemas"]["Report"]; // 상세
export type ArchiveSummary = components["schemas"]["ReportSummary"]; // 목록

/** 공개 아카이브에 노출하는 "승인(검증완료)" 상태 — PRD: 검증 통과 데이터만 공개. */
export const PUBLISHABLE = new Set<string>(["confirmed", "disputed", "debunked", "corrected"]);

/** 정적 fallback(빌드타임 인덱스) — static build 준비물. */
const STATIC: ArchiveRecord[] = (staticGenerated as ArchiveRecord[]) ?? [];

function toSummary(r: ArchiveRecord): ArchiveSummary {
  return {
    id: r.id,
    status: r.status,
    election: r.election,
    title: r.title,
    summary: r.summary ?? null,
    region: r.region,
    occurred_at: r.occurred_at ?? null,
    collected_at: r.collected_at,
    tags: r.tags ?? [],
    attachment_count: r.attachments?.length ?? 0,
  };
}

/** tags[0](제보 시 CATEGORY_FULL 라벨로 저장)에서 카테고리를 역추출. 매칭 없으면 null. */
export function recordCategory(r: { tags?: string[] | null }): Category | null {
  const first = r.tags?.[0];
  if (!first) return null;
  for (const key of Object.keys(CATEGORY_FULL) as Category[]) {
    if (CATEGORY_FULL[key] === first) return key;
  }
  return null;
}

/** 승인 레코드 목록 — API 우선, 실패 시 정적 인덱스로 폴백. publishable 만. */
export async function loadArchiveSummaries(): Promise<ArchiveSummary[]> {
  try {
    const all: ArchiveSummary[] = [];
    let offset = 0;
    // 페이지네이션(최대 100/페이지). 안전장치로 50페이지(5천건)에서 중단.
    for (let page = 0; page < 50; page++) {
      const res = await fetch(`${API_BASE_URL}/reports?limit=100&offset=${offset}`);
      if (!res.ok) throw new Error(`reports ${res.status}`);
      const data = (await res.json()) as { items: ArchiveSummary[]; total: number };
      all.push(...data.items);
      offset += data.items.length;
      if (data.items.length === 0 || offset >= data.total) break;
    }
    return all.filter((r) => PUBLISHABLE.has(r.status));
  } catch {
    return STATIC.filter((r) => PUBLISHABLE.has(r.status)).map(toSummary);
  }
}

/** 승인 레코드 상세 — API 우선, 실패 시 정적 인덱스로 폴백. 비공개/미존재면 null. */
export async function loadArchiveRecord(id: string): Promise<ArchiveRecord | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/reports/${encodeURIComponent(id)}`);
    if (res.status === 404) return STATIC.find((r) => r.id === id) ?? null;
    if (!res.ok) throw new Error(`report ${res.status}`);
    const r = (await res.json()) as ArchiveRecord;
    // 승인 상태가 아니면 공개 아카이브에선 미노출 취급.
    return PUBLISHABLE.has(r.status) ? r : null;
  } catch {
    return STATIC.find((r) => r.id === id && PUBLISHABLE.has(r.status)) ?? null;
  }
}
