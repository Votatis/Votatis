import { z } from "@hono/zod-openapi";
import { ALLOWED_MIME_LIST, MAX_FILE_BYTES } from "../constants";

// 여러 도메인이 공유하는 스키마 조각.

export const SourceSchema = z
  .object({
    url: z.string().url().optional(),
    text: z.string().min(1).optional(),
    type: z.string().optional(), // news | official | social | submitter | crawler
    captured_at: z.string().optional(),
    archive_url: z.string().url().optional(),
  })
  .refine((s) => Boolean(s.url) || Boolean(s.text), {
    message: "각 source 에는 url 또는 text 가 필요합니다.",
  })
  .openapi("Source");

export const RegionSchema = z
  .object({
    sido: z.string().optional(),
    sigungu: z.string().optional(),
    eup_myeon_dong: z.string().optional(),
  })
  .openapi("Region");

export const AttachmentInputSchema = z
  .object({
    filename: z.string().min(1),
    mime: z.enum(ALLOWED_MIME_LIST),
    size: z.number().int().positive().max(MAX_FILE_BYTES),
    sha256: z.string().optional(), // 클라 추정값. 참고용, 정본은 서버 계산
  })
  .openapi("AttachmentInput");

export const AttachmentRecordSchema = z
  .object({
    filename: z.string(),
    r2_key: z.string(),
    sha256: z.string(),
    mime: z.string(),
    size: z.number().int(),
  })
  .openapi("Attachment");

export const VerificationSchema = z
  .object({
    reviewer: z.string().nullable(),
    method: z.string().nullable(),
    reviewed_at: z.string().nullable(),
    notes: z.string().nullable(),
    evidence_links: z.array(z.string()).nullable(),
  })
  .openapi("Verification");

export const ReportIdParamSchema = z.object({
  id: z.string().min(1).openapi({ param: { name: "id", in: "path" } }),
});

export const SubmissionIdParamSchema = z.object({
  id: z.string().min(1).openapi({ param: { name: "id", in: "path" } }),
});

export const ErrorSchema = z.object({ error: z.string() }).openapi("Error");
