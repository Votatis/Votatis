// 판정 가드레일(순수) — 페르소나 5: 근거 없는 confirmed/disputed/debunked/corrected 판정 금지.
// intake-api 도 동일 규칙을 강제하지만(이중 방어), MCP 단계에서 먼저 막아 AI 오용을 차단한다.

export const ADMIN_STATUSES = [
  "unverified",
  "reviewing",
  "confirmed",
  "disputed",
  "debunked",
  "corrected",
] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

/** 근거(검증 방법 + 출처 링크) 필수 판정 상태. */
export const JUDGED_STATUSES = new Set<string>(["confirmed", "disputed", "debunked", "corrected"]);

export interface VerdictInput {
  status: string;
  method?: string;
  evidence_links?: string[];
}

export type VerdictCheck = { ok: true } | { ok: false; error: string };

/** judged 판정이면 method + evidence_links≥1 을 요구. 누락 시 API 호출 없이 거부. */
export function validateVerdict(input: VerdictInput): VerdictCheck {
  if (!(ADMIN_STATUSES as readonly string[]).includes(input.status)) {
    return { ok: false, error: `status 는 ${ADMIN_STATUSES.join(" / ")} 중 하나여야 합니다.` };
  }
  if (JUDGED_STATUSES.has(input.status)) {
    if (!input.method || !input.method.trim()) {
      return {
        ok: false,
        error:
          "확정/이견/반박/정정 판정에는 검증 방법(method)이 필요합니다. (페르소나5: 근거 없는 판정 금지 — AI 분석은 보조 신호일 뿐입니다)",
      };
    }
    if (!input.evidence_links || input.evidence_links.length === 0) {
      return {
        ok: false,
        error: "확정/이견/반박/정정 판정에는 근거 링크(evidence_links) 1개 이상이 필요합니다.",
      };
    }
  }
  return { ok: true };
}
