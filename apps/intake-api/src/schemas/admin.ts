import { z } from "@hono/zod-openapi";
import { ADMIN_STATUSES, RISK_LEVELS } from "../constants";
import { ReportPublicSchema, ReportSummarySchema } from "./reports";
import { AdminVerificationSchema } from "./common";

export const AdminSessionInputSchema = z
  .object({ token: z.string().min(1) })
  .openapi("AdminSessionInput");

export const AdminSessionResultSchema = z
  .object({ ok: z.literal(true) })
  .openapi("AdminSessionResult");

export const AdminListQuerySchema = z.object({
  status: z.enum(ADMIN_STATUSES).optional(),
  election: z.string().optional(),
  sido: z.string().optional(),
  sigungu: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().optional(), // 제목/요약/본문 키워드
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const AdminReportSummarySchema = ReportSummarySchema.extend({
  submitter: z.string(),
  updated_at: z.string(),
}).openapi("AdminReportSummary");

export const AdminReportListSchema = z
  .object({
    items: z.array(AdminReportSummarySchema),
    total: z.number().int(),
    counts: z.record(z.string(), z.number().int()),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .openapi("AdminReportList");

export const AdminReportDetailSchema = ReportPublicSchema.extend({
  submitter: z.string(),
  exif: z.array(z.unknown()).nullable(),
  verification: AdminVerificationSchema, // 내부용 reviewer_note 포함
}).openapi("AdminReportDetail");

export const AdminPatchSchema = z
  .object({
    status: z.enum(ADMIN_STATUSES).optional(),
    reviewer: z.string().optional(),
    verification: z
      .object({
        reviewer: z.string().nullable().optional(),
        method: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        evidence_links: z.array(z.string().url()).optional(),
        // 검토 피드백 스키마(Votatis#2) 쓰기 필드.
        status_scope: z.string().nullable().optional(),
        claim: z.string().nullable().optional(),
        verified_facts: z.array(z.string()).nullable().optional(),
        assessment: z.array(z.string()).nullable().optional(),
        confirmed_scope: z.array(z.string()).nullable().optional(),
        not_confirmed: z.array(z.string()).nullable().optional(),
        possible_explanations: z.array(z.string()).nullable().optional(),
        missing_evidence: z.array(z.string()).nullable().optional(),
        reviewer_note: z.string().nullable().optional(),
        public_summary: z.string().nullable().optional(),
        risk_level: z.enum(RISK_LEVELS).nullable().optional(),
      })
      .optional(),
    tags: z.array(z.string()).max(50).optional(),
    rebuttals: z
      .array(z.object({ text: z.string().min(1), source_url: z.string().url().optional() }))
      .optional(),
    related: z.array(z.string()).optional(),
    title: z.string().min(1).optional(),
    summary: z.string().optional(),
    body: z.string().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "수정할 필드가 없습니다." })
  .openapi("AdminPatch");

export const AnalysisSchema = z
  .object({
    suggested_tags: z.array(z.string()),
    credibility: z.object({ score: z.number(), signals: z.array(z.string()) }),
    synthetic_risk: z.object({
      level: z.enum(["low", "review", "unknown"]),
      signals: z.array(z.string()),
    }),
    summary_hint: z.string(),
    source: z.enum(["heuristic", "heuristic+ai"]),
  })
  .openapi("Analysis");

export const AdminExportSchema = z
  .object({ records: z.array(ReportPublicSchema) })
  .openapi("AdminExport");

export const StatsSchema = z
  .object({
    total: z.number().int(),
    by_status: z.record(z.string(), z.number().int()),
    by_election: z.array(z.object({ election: z.string(), count: z.number().int() })),
    daily: z.array(z.object({ date: z.string(), count: z.number().int() })),
  })
  .openapi("Stats");
