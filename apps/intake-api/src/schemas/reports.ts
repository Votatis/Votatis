import { z } from "@hono/zod-openapi";
import { PUBLIC_STATUSES } from "../constants";
import { SourceSchema, RegionSchema, AttachmentRecordSchema, VerificationSchema } from "./common";

/** 공개 조회 응답 — submitter·finalize_token·staging 등 내부 필드는 포함하지 않는다. */
export const ReportPublicSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    election: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    body: z.string().nullable(),
    region: RegionSchema,
    occurred_at: z.string().nullable(),
    collected_at: z.string(),
    tags: z.array(z.string()),
    sources: z.array(SourceSchema),
    attachments: z.array(AttachmentRecordSchema),
    rebuttals: z.array(z.object({ text: z.string(), source_url: z.string().optional() })).nullable(),
    related: z.array(z.string()).nullable(),
    consent: z.boolean().nullable(),
    license: z.string(),
    verification: VerificationSchema,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .openapi("Report");

export const ReportSummarySchema = z
  .object({
    id: z.string(),
    status: z.string(),
    election: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    region: RegionSchema,
    occurred_at: z.string().nullable(),
    collected_at: z.string(),
    tags: z.array(z.string()),
    attachment_count: z.number().int(),
  })
  .openapi("ReportSummary");

export const ReportListSchema = z
  .object({
    items: z.array(ReportSummarySchema),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .openapi("ReportList");

// 쿼리: 문자열로 들어오므로 limit/offset 은 coerce. status 는 공개 상태만.
export const ReportListQuerySchema = z.object({
  election: z.string().optional(),
  status: z.enum(PUBLIC_STATUSES as [string, ...string[]]).optional(),
  sido: z.string().optional(),
  sigungu: z.string().optional(),
  tag: z.string().optional(),
  from: z.string().optional(), // occurred_at >= from (ISO)
  to: z.string().optional(), // occurred_at <= to (ISO)
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
