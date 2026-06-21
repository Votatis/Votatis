import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/** JSON 컬럼에 들어가는 출처 한 건. url(웹사이트) 또는 text(직접 입력) 중 하나 이상. */
export interface SourceRecord {
  url?: string;
  text?: string;
  type?: string; // news | official | social | submitter | crawler
  captured_at?: string;
  archive_url?: string;
}

/** JSON 컬럼에 들어가는 첨부 한 건. sha256 정본은 서버가 finalize 에서 계산한다. */
export interface AttachmentRecord {
  filename: string;
  r2_key: string;
  sha256: string;
  mime: string;
  size: number;
}

/** finalize 전까지만 유지되는 staging 정보(업로드 대상 key 매핑). */
export interface StagingItem {
  staging_key: string;
  final_key: string;
  filename: string;
  mime: string;
  size: number;
}

export interface RebuttalRecord {
  text: string;
  source_url?: string;
}

/**
 * 제보 레코드 — PRD §7 스키마를 최대한 flatten 한 단일 테이블.
 * 단일값 필드(region·verification)는 컬럼으로 펼치고, 진짜 배열만 JSON(TEXT) 컬럼.
 * status='pending' 은 2단계 업로드의 내부 중간상태로, 조회 API 에 노출하지 않는다.
 */
export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(), // = submission_id
    status: text("status").notNull(), // pending | unverified | reviewing | confirmed | suspected | disputed | debunked | corrected
    election: text("election").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body"),

    // region 펼침
    sido: text("sido"),
    sigungu: text("sigungu"),
    eupMyeonDong: text("eup_myeon_dong"),

    occurredAt: text("occurred_at"),
    collectedAt: text("collected_at").notNull(),

    // 배열 → JSON
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    sources: text("sources", { mode: "json" }).$type<SourceRecord[]>().notNull(),
    attachments: text("attachments", { mode: "json" }).$type<AttachmentRecord[]>().notNull(),
    exif: text("exif", { mode: "json" }).$type<unknown[]>(),
    rebuttals: text("rebuttals", { mode: "json" }).$type<RebuttalRecord[]>(),
    related: text("related", { mode: "json" }).$type<string[]>(),

    consent: integer("consent", { mode: "boolean" }),
    submitter: text("submitter").notNull(), // 익명 해시. 조회 응답에서 제외
    license: text("license").notNull(),

    // verification 펼침 — 본 스펙은 null 로 생성, 검수 스펙(0007)이 채운다
    verificationReviewer: text("verification_reviewer"),
    verificationMethod: text("verification_method"),
    verificationReviewedAt: text("verification_reviewed_at"),
    verificationNotes: text("verification_notes"),
    verificationEvidenceLinks: text("verification_evidence_links", { mode: "json" }).$type<string[]>(),

    // 검토 피드백 스키마 (spec 0016, Votatis#2) — 주장/사실/판단 분리·확인범위·공개요약·위험도.
    // reviewerNote 만 내부용(공개 응답 비포함), 나머지는 공개 아카이브에 노출 가능.
    verificationStatusScope: text("verification_status_scope"), // 확인됨의 확인 범위(부정선거 단정 금지)
    verificationClaim: text("verification_claim"), // 제보자 주장(중립 요약)
    verificationVerifiedFacts: text("verification_verified_facts", { mode: "json" }).$type<string[]>(),
    verificationAssessment: text("verification_assessment", { mode: "json" }).$type<string[]>(),
    verificationConfirmedScope: text("verification_confirmed_scope", { mode: "json" }).$type<string[]>(),
    verificationNotConfirmed: text("verification_not_confirmed", { mode: "json" }).$type<string[]>(), // 과잉해석 차단
    verificationPossibleExplanations: text("verification_possible_explanations", { mode: "json" }).$type<string[]>(),
    verificationMissingEvidence: text("verification_missing_evidence", { mode: "json" }).$type<string[]>(),
    verificationReviewerNote: text("verification_reviewer_note"), // 내부용(공개 비포함)
    verificationPublicSummary: text("verification_public_summary"), // 외부 공개용 요약
    verificationRiskLevel: text("verification_risk_level"), // 낮음~높음

    // pending 동안만 — finalize 후 null
    finalizeToken: text("finalize_token"),
    staging: text("staging", { mode: "json" }).$type<StagingItem[]>(),

    // 증분 export 플래그 (spec 0018) — 1=export 필요(변경됨). export ack 시 0. 신규/변경 시 1.
    exportDirty: integer("export_dirty").notNull().default(1),

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    statusIdx: index("idx_reports_status").on(t.status),
    electionIdx: index("idx_reports_election").on(t.election),
    regionIdx: index("idx_reports_region").on(t.sido, t.sigungu),
    occurredIdx: index("idx_reports_occurred_at").on(t.occurredAt),
    collectedIdx: index("idx_reports_collected_at").on(t.collectedAt),
    exportDirtyIdx: index("idx_reports_export_dirty").on(t.exportDirty),
  }),
);

/** IP 기준 고정 윈도우 rate limit (KV 제거에 따라 D1 로 이전). expires_at 은 epoch 초. */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export type ReportRow = typeof reports.$inferSelect;
export type ReportInsert = typeof reports.$inferInsert;

// ── 관리자 인증 (spec 0015) ──────────────────────────────────────────────────

/**
 * 관리자/검증자 계정. role=root 는 회원관리 가능, member 는 검증만.
 * passwordHash 는 회원이 재설정 링크로 비밀번호를 정하기 전까지 null.
 */
export const adminUsers = sqliteTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"), // null = 아직 비밀번호 미설정(재설정 링크 대기)
    role: text("role").notNull(), // root | member
    status: text("status").notNull().default("active"), // active | disabled
    lastLoginAt: text("last_login_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    usernameIdx: uniqueIndex("uniq_admin_users_username").on(t.username),
  }),
);

/**
 * 리프레시 토큰. 원문이 아니라 sha256 해시만 저장. 사용 시마다 회전(기존 폐기+신규).
 * expiresAt 은 epoch 초, 슬라이딩(마지막 사용 +7일). 7일 미사용이면 만료.
 */
export const adminRefreshTokens = sqliteTable(
  "admin_refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    userIdx: index("idx_admin_refresh_user").on(t.userId),
    tokenHashIdx: index("idx_admin_refresh_token_hash").on(t.tokenHash),
  }),
);

/** 비밀번호 재설정 토큰. 해시 저장, 24h·1회용. usedAt 채워지면 재사용 불가. */
export const adminPasswordResetTokens = sqliteTable(
  "admin_password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    tokenHashIdx: index("idx_admin_reset_token_hash").on(t.tokenHash),
    userIdx: index("idx_admin_reset_user").on(t.userId),
  }),
);

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type AdminUserInsert = typeof adminUsers.$inferInsert;
export type AdminRefreshTokenRow = typeof adminRefreshTokens.$inferSelect;
export type AdminPasswordResetTokenRow = typeof adminPasswordResetTokens.$inferSelect;
