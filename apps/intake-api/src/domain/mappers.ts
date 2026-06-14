// 제보 레코드(DB row) → DTO 매퍼. 공개/관리자 응답 형태를 한곳에서 관리한다.
// (구 reports-map.ts + admin.ts 의 toAdminSummary/toAdminDetail 통합)
import type { ReportRow } from "../db/schema";

function region(r: ReportRow) {
  return {
    sido: r.sido ?? undefined,
    sigungu: r.sigungu ?? undefined,
    eup_myeon_dong: r.eupMyeonDong ?? undefined,
  };
}

function verification(r: ReportRow) {
  return {
    reviewer: r.verificationReviewer ?? null,
    method: r.verificationMethod ?? null,
    reviewed_at: r.verificationReviewedAt ?? null,
    notes: r.verificationNotes ?? null,
    evidence_links: r.verificationEvidenceLinks ?? null,
  };
}

/** 공개 조회 상세 — submitter·finalize_token·staging·exif 등 내부 필드는 제외한다. */
export function toPublicReport(r: ReportRow) {
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
    rebuttals: r.rebuttals ?? null,
    related: r.related ?? null,
    consent: r.consent ?? null,
    license: r.license,
    verification: verification(r),
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

/** 공개 목록 요약 — 본문(body)·출처 등 큰 필드 제외. */
export function toSummary(r: ReportRow) {
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
  };
}

/** 관리자 목록 요약(검수 큐). 공개 요약 + 제보자 익명ID·첨부수·갱신시각. */
export function toAdminSummary(r: ReportRow) {
  return {
    ...toSummary(r),
    submitter: r.submitter, // 익명 해시(그룹핑용). 실명 아님
    updated_at: r.updatedAt,
  };
}

/** 관리자 상세 — 내부 필드(submitter·exif) 포함. staging/finalize_token 은 finalize 후 없음. */
export function toAdminDetail(r: ReportRow) {
  return {
    ...toPublicReport(r),
    submitter: r.submitter,
    exif: r.exif ?? null,
  };
}
