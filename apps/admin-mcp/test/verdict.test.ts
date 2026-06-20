import { test } from "node:test";
import assert from "node:assert/strict";
import { validateVerdict } from "../src/verdict.ts";

test("비-judged 상태는 근거 없이 통과", () => {
  assert.deepEqual(validateVerdict({ status: "reviewing" }), { ok: true });
  assert.deepEqual(validateVerdict({ status: "unverified" }), { ok: true });
});

test("judged 상태는 method 없으면 거부", () => {
  const r = validateVerdict({ status: "confirmed", evidence_links: ["https://e/1"] });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /검증 방법/);
});

test("judged 상태는 evidence_links 없으면 거부", () => {
  const r = validateVerdict({ status: "debunked", method: "교차확인" });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /근거 링크/);
});

test("judged 상태는 method+links 있어도 피드백(public_summary 등) 없으면 거부", () => {
  const r = validateVerdict({ status: "debunked", method: "교차확인", evidence_links: ["https://e/1"] });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /공개 요약|위험도|미확인/);
});

const feedback = {
  public_summary: "확인 범위 내 정황 확인.",
  risk_level: "중간",
  not_confirmed: ["부정선거 조작 주장"],
};

test("debunked 는 method+links+피드백이면 통과", () => {
  assert.deepEqual(
    validateVerdict({ status: "debunked", method: "교차확인", evidence_links: ["https://e/1"], ...feedback }),
    { ok: true },
  );
});

test("confirmed 는 확인 범위(status_scope/confirmed_scope)까지 필요", () => {
  const missing = validateVerdict({ status: "confirmed", method: "교차확인", evidence_links: ["https://e/1"], ...feedback });
  assert.equal(missing.ok, false);
  assert.match((missing as { error: string }).error, /확인 범위|확인된 항목/);

  assert.deepEqual(
    validateVerdict({
      status: "confirmed",
      method: "선관위 공지 교차확인",
      evidence_links: ["https://e/1"],
      ...feedback,
      status_scope: "봉인 관리 미흡",
      confirmed_scope: ["봉인지 2겹 부착 정황"],
    }),
    { ok: true },
  );
});

test("suspected 는 missing_evidence(필요 해명) 없으면 거부", () => {
  const missing = validateVerdict({ status: "suspected", method: "교차확인", evidence_links: ["https://e/1"], ...feedback });
  assert.equal(missing.ok, false);
  assert.match((missing as { error: string }).error, /미해명|해명/);

  assert.deepEqual(
    validateVerdict({
      status: "suspected",
      method: "홈페이지 표출값 대조",
      evidence_links: ["https://e/1"],
      ...feedback,
      missing_evidence: ["선관위의 표출·정정 로직 공식 해명"],
    }),
    { ok: true },
  );
});

test("알 수 없는 status 는 거부", () => {
  const r = validateVerdict({ status: "pending" });
  assert.equal(r.ok, false);
});
