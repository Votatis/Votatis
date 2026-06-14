// 공개 레코드 → PRD §7 형태의 마크다운(YAML frontmatter + 본문) 변환. 순수 함수(런타임 비의존).
// submitter·exif·consent 등 비공개/내부 필드는 포함하지 않는다(개인정보 보호 — PRD 원칙6, PERSONA).

/** toPublicReport(reports-map) 출력과 동일한 공개 레코드 형태. */
export interface PublicRecord {
  id: string;
  status: string;
  election: string;
  title: string;
  summary: string | null;
  body: string | null;
  region: { sido?: string; sigungu?: string; eup_myeon_dong?: string };
  occurred_at: string | null;
  collected_at: string;
  tags: string[];
  sources: { url?: string; text?: string; type?: string; captured_at?: string; archive_url?: string }[];
  attachments: { filename: string; r2_key: string; sha256: string; mime: string; size: number }[];
  rebuttals: { text: string; source_url?: string }[] | null;
  related: string[] | null;
  license: string;
  verification: {
    reviewer: string | null;
    method: string | null;
    reviewed_at: string | null;
    notes: string | null;
    evidence_links: string[] | null;
  };
  created_at: string;
  updated_at: string;
}

/** YAML 더블쿼트 스칼라 — JSON 문자열 이스케이프는 YAML double-quoted 의 안전한 부분집합. */
function y(s: string): string {
  return JSON.stringify(s);
}

/** 파일/디렉터리에 안전한 슬러그. 한글은 보존하되 경로 위험문자만 치환. */
export function slug(s: string): string {
  return (
    s
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-") // 경로·파일 금지문자
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "untitled"
  );
}

/** 공개 레코드의 상대 경로: data/{election-slug}/{id}.md */
export function recordRelPath(r: PublicRecord, baseDir = "data"): string {
  return `${baseDir}/${slug(r.election)}/${r.id}.md`;
}

function emitSources(sources: PublicRecord["sources"]): string[] {
  if (!sources.length) return ["sources: []"];
  const lines = ["sources:"];
  for (const s of sources) {
    const head = s.url ? `  - url: ${y(s.url)}` : `  - text: ${y(s.text ?? "")}`;
    lines.push(head);
    if (s.url && s.text) lines.push(`    text: ${y(s.text)}`);
    if (s.type) lines.push(`    type: ${y(s.type)}`);
    if (s.captured_at) lines.push(`    captured_at: ${y(s.captured_at)}`);
    if (s.archive_url) lines.push(`    archive_url: ${y(s.archive_url)}`);
  }
  return lines;
}

function emitAttachments(atts: PublicRecord["attachments"]): string[] {
  if (!atts.length) return ["attachments: []"];
  const lines = ["attachments:"];
  for (const a of atts) {
    lines.push(`  - filename: ${y(a.filename)}`);
    lines.push(`    r2_key: ${y(a.r2_key)}`);
    lines.push(`    sha256: ${y(a.sha256)}`);
    lines.push(`    mime: ${y(a.mime)}`);
    lines.push(`    size: ${a.size}`);
  }
  return lines;
}

function emitRebuttals(rebuttals: PublicRecord["rebuttals"]): string[] {
  if (!rebuttals || !rebuttals.length) return ["rebuttals: []"];
  const lines = ["rebuttals:"];
  for (const rb of rebuttals) {
    lines.push(`  - text: ${y(rb.text)}`);
    if (rb.source_url) lines.push(`    source_url: ${y(rb.source_url)}`);
  }
  return lines;
}

function emitStringArray(key: string, arr: string[] | null | undefined): string[] {
  if (!arr || !arr.length) return [`${key}: []`];
  return [`${key}:`, ...arr.map((v) => `  - ${y(v)}`)];
}

/** 공개 레코드를 마크다운 문자열(frontmatter + 본문)로 변환. */
export function recordToMarkdown(r: PublicRecord): string {
  const fm: string[] = ["---"];
  fm.push(`id: ${y(r.id)}`);
  fm.push(`election: ${y(r.election)}`);
  fm.push(`title: ${y(r.title)}`);
  if (r.summary != null) fm.push(`summary: ${y(r.summary)}`);
  fm.push(`status: ${y(r.status)}`);
  fm.push(...emitStringArray("tags", r.tags));

  // region 3단
  fm.push("region:");
  fm.push(`  sido: ${r.region.sido ? y(r.region.sido) : "null"}`);
  fm.push(`  sigungu: ${r.region.sigungu ? y(r.region.sigungu) : "null"}`);
  fm.push(`  eup_myeon_dong: ${r.region.eup_myeon_dong ? y(r.region.eup_myeon_dong) : "null"}`);

  fm.push(`occurred_at: ${r.occurred_at ? y(r.occurred_at) : "null"}`);
  fm.push(`collected_at: ${y(r.collected_at)}`);

  fm.push(...emitSources(r.sources));
  fm.push(...emitAttachments(r.attachments));

  // verification
  const v = r.verification;
  fm.push("verification:");
  fm.push(`  reviewer: ${v.reviewer ? y(v.reviewer) : "null"}`);
  fm.push(`  method: ${v.method ? y(v.method) : "null"}`);
  fm.push(`  reviewed_at: ${v.reviewed_at ? y(v.reviewed_at) : "null"}`);
  fm.push(`  notes: ${v.notes ? y(v.notes) : "null"}`);
  if (v.evidence_links && v.evidence_links.length) {
    fm.push("  evidence_links:");
    for (const l of v.evidence_links) fm.push(`    - ${y(l)}`);
  } else {
    fm.push("  evidence_links: []");
  }

  fm.push(...emitRebuttals(r.rebuttals));
  fm.push(...emitStringArray("related", r.related));
  fm.push(`license: ${y(r.license)}`);
  fm.push("---");

  // 본문: summary 한 줄 + body
  const body: string[] = ["", `# ${r.title}`, ""];
  if (r.summary) body.push(r.summary, "");
  if (r.body) body.push(r.body, "");

  return fm.join("\n") + "\n" + body.join("\n").replace(/\n+$/, "\n");
}
