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
  // 검토 피드백 스키마(Votatis#2) — judged 판정 시 일부 필수.
  public_summary?: string;
  risk_level?: string;
  not_confirmed?: string[];
  status_scope?: string;
  confirmed_scope?: string[];
}

export type VerdictCheck = { ok: true } | { ok: false; error: string };

/**
 * judged 판정이면 method + evidence_links≥1 에 더해 검토 피드백(public_summary·risk_level·not_confirmed)을 요구.
 * confirmed 는 확인 범위(status_scope·confirmed_scope)도 필수. 누락 시 API 호출 없이 거부.
 */
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
    if (!input.public_summary || !input.public_summary.trim() || !input.risk_level || !input.risk_level.trim() ||
        !input.not_confirmed || input.not_confirmed.length === 0) {
      return {
        ok: false,
        error:
          "판정에는 공개 요약(public_summary)·위험도(risk_level)·미확인 항목(not_confirmed 1개 이상)이 필요합니다. (페르소나5: 과잉해석 차단)",
      };
    }
    if (input.status === "confirmed" && (!input.status_scope || !input.status_scope.trim() ||
        !input.confirmed_scope || input.confirmed_scope.length === 0)) {
      return {
        ok: false,
        error: "확인됨 판정에는 확인 범위(status_scope)와 확인된 항목(confirmed_scope 1개 이상)이 필요합니다. (부정선거 단정 금지)",
      };
    }
  }
  return { ok: true };
}
