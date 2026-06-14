// 검증 보조 신호 분석기 — 순수·결정적 휴리스틱(외부 의존 없음). 단위 테스트 대상.
// PERSONA 5 원칙: AI/휴리스틱은 "보조 신호"일 뿐, 판정 근거가 아니다. 최종 판정은 사람이 한다.

export interface AnalyzeInput {
  title: string;
  summary: string | null;
  body: string | null;
  tags: string[];
  sources: { url?: string; text?: string; type?: string; archive_url?: string }[];
  attachments: { sha256: string; mime: string }[];
  exif?: unknown[] | null;
}

export interface Analysis {
  suggested_tags: string[];
  credibility: { score: number; signals: string[] };
  synthetic_risk: { level: "low" | "review" | "unknown"; signals: string[] };
  summary_hint: string;
  source: "heuristic" | "heuristic+ai";
}

/** 한국어 선거 관련 키워드 → 추천 태그. 본문/제목/요약에 등장하면 추천(기존 태그 제외). */
const TAG_KEYWORDS: Record<string, string[]> = {
  투표지: ["투표지", "표지"],
  개표: ["개표", "개표소"],
  사전투표: ["사전투표", "사전 투표"],
  봉인: ["봉인", "봉함", "스티커"],
  참관: ["참관", "참관인"],
  CCTV: ["cctv", "씨씨티비", "폐쇄회로"],
  전산: ["전산", "서버", "시스템", "해킹"],
  통계이상: ["통계", "출구조사", "득표율"],
  투표함: ["투표함", "기표소"],
  관외투표: ["관외", "우편투표"],
};

function haystack(i: AnalyzeInput): string {
  return [i.title, i.summary ?? "", i.body ?? "", ...i.tags].join(" ").toLowerCase();
}

function suggestTags(i: AnalyzeInput): string[] {
  const hay = haystack(i);
  const existing = new Set(i.tags.map((t) => t.toLowerCase()));
  const out: string[] = [];
  for (const [tag, kws] of Object.entries(TAG_KEYWORDS)) {
    if (existing.has(tag.toLowerCase())) continue;
    if (kws.some((k) => hay.includes(k))) out.push(tag);
  }
  return out;
}

function credibility(i: AnalyzeInput): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0.3; // 기본(미검증)

  const urlSources = i.sources.filter((s) => s.url);
  const officialOrNews = i.sources.filter((s) => s.type === "official" || s.type === "news");
  const archived = i.sources.filter((s) => s.archive_url);
  const hashedAtt = i.attachments.filter((a) => a.sha256);

  if (officialOrNews.length > 0) {
    score += 0.25;
    signals.push(`공식/언론 출처 ${officialOrNews.length}건`);
  }
  if (urlSources.length >= 2) {
    score += 0.15;
    signals.push(`독립 URL 출처 ${urlSources.length}건(복수)`);
  } else if (urlSources.length === 1) {
    signals.push("URL 출처 1건");
  }
  if (archived.length > 0) {
    score += 0.15;
    signals.push(`아카이브 스냅샷 ${archived.length}건(원본 보존)`);
  } else if (urlSources.length > 0) {
    signals.push("아카이브 스냅샷 없음 — 원본 소실 위험");
  }
  if (hashedAtt.length > 0) {
    score += 0.1;
    signals.push(`무결성 해시 첨부 ${hashedAtt.length}건`);
  }
  if (urlSources.length === 0) {
    score -= 0.15;
    signals.push("URL 출처 없음(텍스트 진술 위주) — 교차검증 필요");
  }

  score = Math.max(0, Math.min(1, score));
  return { score: Math.round(score * 100) / 100, signals };
}

function syntheticRisk(i: AnalyzeInput): Analysis["synthetic_risk"] {
  const signals: string[] = [];
  if (i.attachments.length === 0) {
    return { level: "unknown", signals: ["첨부 없음 — 이미지 합성 평가 대상 아님"] };
  }
  const hasExif = Array.isArray(i.exif) && i.exif.length > 0;
  if (hasExif) {
    signals.push("EXIF 메타데이터 존재(촬영 기기 정보 가능) — 스크린샷보다 원본일 가능성");
    return { level: "low", signals };
  }
  signals.push("EXIF 없음 — 스크린샷·재인코딩·메타 제거 가능성, 원본 대조 권장");
  return { level: "review", signals };
}

function summaryHint(i: AnalyzeInput): string {
  const text = (i.summary ?? i.body ?? i.title ?? "").trim();
  if (!text) return "";
  const firstSentence = text.split(/(?<=[.!?。])\s|\n/)[0] ?? text;
  return firstSentence.slice(0, 140);
}

/** 결정적 휴리스틱 분석. */
export function analyzeRecord(i: AnalyzeInput): Analysis {
  return {
    suggested_tags: suggestTags(i),
    credibility: credibility(i),
    synthetic_risk: syntheticRisk(i),
    summary_hint: summaryHint(i),
    source: "heuristic",
  };
}
