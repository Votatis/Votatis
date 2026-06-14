import { z } from "@hono/zod-openapi";
import { MAX_ATTACHMENTS } from "../constants";
import { SourceSchema, RegionSchema, AttachmentInputSchema, AttachmentRecordSchema } from "./common";

// ── 요청 ───────────────────────────────────────────────────────────────────

export const SubmissionInputSchema = z
  .object({
    election: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().optional(),
    body: z.string().optional(),
    region: RegionSchema.optional(),
    occurred_at: z.string().optional(),
    tags: z.array(z.string()).max(50).optional(),
    sources: z.array(SourceSchema).optional(),
    attachments: z.array(AttachmentInputSchema).max(MAX_ATTACHMENTS).optional(),
    exif: z.array(z.unknown()).optional(),
    consent: z.boolean().optional(),
    turnstile_token: z.string().min(1),
  })
  .refine((v) => (v.sources?.length ?? 0) > 0 || (v.attachments?.length ?? 0) > 0, {
    message: "출처(URL·텍스트) 또는 첨부 중 최소 하나가 필요합니다.",
  })
  .openapi("SubmissionInput");

export const FinalizeInputSchema = z
  .object({ finalize_token: z.string().min(1) })
  .openapi("FinalizeInput");

// ── 응답 ───────────────────────────────────────────────────────────────────

export const SubmissionCreatedSchema = z
  .object({
    submission_id: z.string(),
    finalize_token: z.string(),
    uploads: z.array(z.object({ staging_key: z.string(), put_url: z.string() })),
  })
  .openapi("SubmissionCreated");

export const FinalizeResultSchema = z
  .object({
    report_id: z.string(),
    attachments: z.array(AttachmentRecordSchema),
  })
  .openapi("FinalizeResult");
