// 빌드타임 전용: 공개 마크다운(repo data/{election}/{id}.md)을 파싱해 상세 풀 레코드를 복원한다.
// index.json(슬림 요약)에는 상세가 없고, 상세의 단일 원천은 .md 다(spec 0011). 정적 상세 페이지가 이걸 읽는다.
// 포맷은 intake-api src/domain/markdown.ts recordToMarkdown 과 1:1 대응(frontmatter=YAML, 본문=# 제목+요약+body).

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { load as yamlLoad } from "js-yaml";
import type { ArchiveRecord } from "./archive-source";

// next build 의 cwd 는 apps/frontend → repo-root/data.
const DATA_DIR = resolve(process.cwd(), "../../data");

/** 파일/디렉터리 슬러그 — intake-api markdown.ts slug 과 동일 규칙(한글 보존, 경로 위험문자만 치환). */
function slug(s: string): string {
  return (
    s
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^\.+/, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "untitled"
  );
}

/** data/{election-slug}/{id}.md 를 읽어 풀 레코드로 복원. 없으면 null. */
export function readRecordMarkdown(election: string, id: string): ArchiveRecord | null {
  const path = resolve(DATA_DIR, slug(election), `${id}.md`);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");

  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return null;
  const fm = yamlLoad(m[1]) as Record<string, unknown>;
  if (!fm || typeof fm !== "object") return null;

  // 본문 복원: 본문 섹션에서 생성기가 붙인 `# 제목`·요약 중복을 제거하고 순수 body 만 남긴다.
  let body = m[2].replace(/^\s+/, "");
  const titleLine = `# ${(fm as { title?: string }).title ?? ""}`;
  if (body.startsWith(titleLine)) body = body.slice(titleLine.length).replace(/^\s+/, "");
  const summary = (fm as { summary?: string }).summary;
  if (summary && body.startsWith(summary)) body = body.slice(summary.length).replace(/^\s+/, "");
  body = body.trim();

  return { ...(fm as object), body: body || null } as unknown as ArchiveRecord;
}
