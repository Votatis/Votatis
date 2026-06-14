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

test("judged 상태 + method + evidence_links 면 통과", () => {
  assert.deepEqual(
    validateVerdict({ status: "confirmed", method: "선관위 공지 교차확인", evidence_links: ["https://e/1"] }),
    { ok: true },
  );
});

test("알 수 없는 status 는 거부", () => {
  const r = validateVerdict({ status: "pending" });
  assert.equal(r.ok, false);
});
