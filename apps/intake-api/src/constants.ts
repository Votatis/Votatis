// 도메인 상수 단일 출처 — 상태값과 미디어 제약. (이전엔 types.ts/admin.ts/schemas.ts/validation.ts 에 분산)

/** 모든 제보 상태. pending 은 업로드 미완료 내부상태. 나머지는 검수 전이 상태. */
export const REPORT_STATUSES = [
  "pending",
  "unverified",
  "reviewing",
  "confirmed",
  "disputed",
  "debunked",
  "corrected",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** 조회 API 로 노출 가능한 상태(내부 pending 제외). */
export const PUBLIC_STATUSES = REPORT_STATUSES.filter((s) => s !== "pending");

/** 관리자 검수 큐에 노출 가능한 상태(pending 제외). */
export const ADMIN_STATUSES = [
  "unverified",
  "reviewing",
  "confirmed",
  "disputed",
  "debunked",
  "corrected",
] as const;

/** 공개 배포(export) 대상 — 검증 완료 상태만(PRD: 검증 통과 데이터만 공개). */
export const PUBLISHABLE_STATUSES = ["confirmed", "disputed", "debunked", "corrected"] as const;

/** 근거(method+evidence_links) 필수 판정 상태. reviewing/unverified 되돌림은 근거 불요구. */
export const JUDGED_STATUSES = new Set<string>(["confirmed", "disputed", "debunked", "corrected"]);

// ── 첨부 미디어 제약 ─────────────────────────────────────────────────────────
export const ALLOWED_MIME_LIST = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export const ALLOWED_MIME = new Set<string>(ALLOWED_MIME_LIST);
export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_ATTACHMENTS = 10;
