import { and, eq, ne } from "drizzle-orm";
import type { Env } from "../env";
import { getDb } from "../db/client";
import { reports } from "../db/schema";
import { analyzeRecord, type Analysis, type AnalyzeInput } from "../domain/analyzer";

/** 검증 보조 신호 분석 — 휴리스틱 baseline + (env.AI 있으면) 안전 증강. null = 레코드 없음. */
export async function analyzeReport(env: Env, id: string): Promise<Analysis | null> {
  const db = getDb(env);
  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, id), ne(reports.status, "pending")))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const input: AnalyzeInput = {
    title: row.title,
    summary: row.summary ?? null,
    body: row.body ?? null,
    tags: row.tags ?? [],
    sources: row.sources ?? [],
    attachments: (row.attachments ?? []).map((a) => ({ sha256: a.sha256, mime: a.mime })),
    exif: row.exif ?? null,
  };

  const base = analyzeRecord(input);

  // 선택적 Workers AI 증강 — 바인딩 없거나 실패하면 휴리스틱 그대로(보조 신호 원칙).
  if (env.AI) {
    try {
      const prompt =
        "다음 제보의 핵심을 한국어 한 문장으로 중립적으로 요약하라(단정 금지, 추측 금지). " +
        `제목: ${input.title}\n요약: ${input.summary ?? ""}\n본문: ${(input.body ?? "").slice(0, 1200)}`;
      const res = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
      })) as { response?: string };
      const hint = res?.response?.trim();
      if (hint) return { ...base, summary_hint: hint.slice(0, 200), source: "heuristic+ai" };
    } catch {
      // 무시하고 휴리스틱 반환
    }
  }
  return base;
}
