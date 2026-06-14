// 예시 시드 생성기 (spec 0016, Goal 003 항목 9) — 출력: D1 INSERT SQL(stdout).
// 출처: GitHub 3dulev/votatis-data 공개 제보 9건을 우리 데이터 모델로 옮기고, 검토 피드백 스키마
// (Votatis#2)에 따라 일부를 판정(confirmed/disputed/debunked)한다. 대부분은 "부정선거"가 아니라
// 관리 미흡/표출 오류로 판정하며 not_confirmed 로 과잉해석을 차단한다(페르소나 5).
//
// 사용: node scripts/seed-examples.mjs > scripts/seed-examples.sql
//   적용(로컬): wrangler d1 execute votatis-reports --local --file=scripts/seed-examples.sql
// 운영(--remote) 적용은 사람 승인 필요(loops/HUMAN.md). 실명·실제 제보의 공개 게시이기 때문.

const ELECTION = "제9회 전국동시지방선거";
const CAT = { A: "투표·개표 과정", B: "사전투표·우편투표", C: "전산·통계 이상" };

/** 판정에 필요한 공통 피드백(미확인/위험도/공개요약)을 갖춘 검증 객체 빌더. */
function verdict(v) {
  return {
    reviewer: "검증자(예시)",
    method: v.method,
    reviewed_at: "2026-06-10T02:00:00.000Z",
    notes: v.notes ?? null,
    evidence_links: v.evidence_links ?? [],
    status_scope: v.status_scope ?? null,
    claim: v.claim ?? null,
    verified_facts: v.verified_facts ?? null,
    assessment: v.assessment ?? null,
    confirmed_scope: v.confirmed_scope ?? null,
    not_confirmed: v.not_confirmed ?? null,
    possible_explanations: v.possible_explanations ?? null,
    missing_evidence: v.missing_evidence ?? null,
    reviewer_note: v.reviewer_note ?? null,
    public_summary: v.public_summary ?? null,
    risk_level: v.risk_level ?? null,
  };
}

const REPORTS = [
  {
    id: "e48b59b2d3cc", cat: "B", status: "reviewing",
    title: "관내사전투표함 보관실 봉인지 무단 교체 의혹",
    region: { sido: "경기도", sigungu: "성남시" }, collected_at: "2026-06-09T21:00:00.000Z",
    sources: [{ url: "https://example.com/votatis-data/2", type: "submitter" }],
  },
  {
    id: "86dc02da8f0d", cat: "B", status: "reviewing",
    title: "사전투표소에서 이미 도장이 찍혀있는 투표지가 발견되었다",
    region: { sido: "경기도", sigungu: "의왕시", eup_myeon_dong: "내손2동" }, collected_at: "2026-06-09T20:17:54.345Z",
    sources: [{ url: "https://www.facebook.com/share/p/18aUTMaxNh/", type: "submitter" }],
  },
  {
    id: "cd2429c37672", cat: "A", status: "debunked",
    title: "투표함 이동을 불법으로 본 주장",
    region: { sido: "서울특별시" }, collected_at: "2026-06-09T21:01:00.000Z",
    sources: [{ url: "https://example.com/votatis-data/4", type: "submitter" }],
    verification: verdict({
      method: "공직선거법·중앙선관위 절차 대조",
      evidence_links: ["https://law.go.kr/공직선거법"],
      claim: "선거기간 중 개인이 투표함을 이동시킨 것은 불법이라는 주장",
      verified_facts: ["영상에서 투표함을 이동하는 장면이 확인된다"],
      not_confirmed: ["해당 이동이 불법이라는 주장", "부정선거 조작이 있었다는 주장"],
      possible_explanations: ["정당한 권한자(선거사무원)에 의한 규정상 이송일 가능성"],
      public_summary: "영상상 투표함 이동 정황은 확인되나, 권한 없는 자의 불법 이동이라는 핵심 전제는 절차·법령과 충돌한다. 정당한 이송일 가능성이 크다.",
      risk_level: "낮음~중간",
    }),
  },
  {
    id: "800732950781", cat: "A", status: "disputed",
    title: "봉인지에 투표관리관 서명이 없는 투표함을 개표소에 반입",
    region: { sido: "경기도" }, collected_at: "2026-06-09T21:02:00.000Z",
    sources: [{ url: "https://example.com/votatis-data/5", type: "submitter" }],
    verification: verdict({
      method: "사진 판독 + 개표 절차 확인",
      evidence_links: ["https://example.com/evidence/5"],
      claim: "봉인지에 투표관리관 서명이 없는 투표함이 개표소에 반입되었다는 주장",
      verified_facts: ["사진상 봉인지의 서명란 식별이 어렵다"],
      not_confirmed: ["서명 누락이 확정적이라는 주장", "부정선거 조작이 있었다는 주장"],
      possible_explanations: ["촬영 각도·해상도로 서명이 보이지 않았을 가능성"],
      public_summary: "사진만으로는 서명 유무를 단정하기 어렵다. 원본 고해상 자료와 개표록 확인이 필요하다.",
      risk_level: "낮음~중간",
    }),
  },
  {
    id: "59547c149c47", cat: "C", status: "confirmed",
    title: "선관위 투표진행상황 화면 누적 투표자수 감소 표출 오류",
    region: { sido: "전국" }, collected_at: "2026-06-09T21:03:00.000Z",
    sources: [{ url: "https://example.com/votatis-data/6", type: "submitter" }],
    verification: verdict({
      method: "두 시점 캡처 수치 대조",
      evidence_links: ["https://example.com/evidence/6a", "https://example.com/evidence/6b"],
      claim: "30초 사이 화면상 누적 투표자수가 110명 감소했다는 주장",
      verified_facts: ["17:05:30 표시값 25,617,541명", "17:06:00 표시값 25,617,431명", "두 값의 차이는 -110명"],
      confirmed_scope: ["화면상 누적 투표자수 110명 감소", "투표진행상황 시스템의 표출 정합성 미흡"],
      not_confirmed: ["실제 물리적 투표자수 감소", "임의조정·리밸런싱 주장", "부정선거 조작이 있었다는 주장", "개표 결과에 영향을 주었다는 주장"],
      possible_explanations: ["서로 다른 CDN/캐시 노드의 값 불일치", "캐시 무효화 미흡"],
      status_scope: "선관위 투표진행상황 화면상 누적 투표자수 감소 및 시스템 표출 정합성 미흡",
      public_summary: "화면상 누적 투표자수가 30초 사이 110명 감소한 정황이 확인된다. 이는 시스템 표출 정합성 관리 미흡 사례로 볼 수 있다. 다만 실제 투표자수 감소·임의조정·부정선거를 입증하는 것은 아니다.",
      risk_level: "중간",
    }),
  },
  {
    id: "925e96357609", cat: "A", status: "unverified",
    title: "투표함 봉인지 교체 정황 포착",
    region: { sido: "인천광역시" }, collected_at: "2026-06-09T21:04:00.000Z",
    sources: [{ url: "https://example.com/votatis-data/7", type: "submitter" }],
  },
  {
    id: "d39c7ae53251", cat: "A", status: "confirmed",
    title: "구로3동 제6투표소 투표함 봉인지 2겹 부착에 따른 봉인 관리 미흡",
    region: { sido: "서울특별시", sigungu: "구로구" }, collected_at: "2026-06-09T21:05:00.000Z",
    sources: [{ url: "https://example.com/votatis-data/8", type: "submitter" }],
    verification: verdict({
      method: "사진 판독 + 봉인 절차 확인",
      evidence_links: ["https://example.com/evidence/8"],
      claim: "구로3동 제6투표소 투표함이 봉인지 2겹이 붙은 채 반입되어 개함이 보류되었다는 주장",
      verified_facts: ["사진상 특수봉인지가 2겹으로 겹쳐 붙어 있는 것으로 보인다", "상단 라벨에서 '구로3동 제6투표소' 표기가 확인된다"],
      confirmed_scope: ["봉인지 2겹 부착 정황", "봉인 상태 외관 이상", "봉인 관리 미흡"],
      not_confirmed: ["투표함이 실제 개봉되었다는 주장", "투표지가 훼손되었다는 주장", "봉인지 불법 교체 주장", "부정선거 조작이 있었다는 주장"],
      possible_explanations: ["기존 봉인지 들뜸 방지용 덧봉인 가능성", "현장 보완 조치 후 기록·설명 미흡"],
      status_scope: "투표함 봉인지 2겹 부착에 따른 봉인 관리 미흡",
      public_summary: "봉인지가 2겹으로 부착된 정황이 확인된다. 정상적인 봉인 관리로 보기 어려워 최소한 봉인 관리·설명 책임 미흡 사례로 볼 수 있다. 다만 개봉·훼손·불법 교체·부정선거를 단정할 수는 없다.",
      risk_level: "중간~높음",
    }),
  },
  {
    id: "956088da6840", cat: "A", status: "unverified",
    title: "일련번호 붙은 투표지 무더기 발견",
    region: { sido: "경상남도" }, collected_at: "2026-06-09T21:06:00.000Z",
    sources: [{ url: "https://example.com/votatis-data/9", type: "submitter" }],
  },
  {
    id: "46a18d3321b9", cat: "C", status: "confirmed",
    title: "용인 개표소 투표지분류기 후보별 연속 분류 패턴 확인",
    region: { sido: "경기도", sigungu: "용인시" }, collected_at: "2026-06-09T21:07:15.112Z",
    sources: [{ url: "https://www.youtube.com/watch?v=TUa4LBBkzB8", type: "submitter" }],
    verification: verdict({
      method: "영상 구간 분석",
      evidence_links: ["https://www.youtube.com/watch?v=TUa4LBBkzB8"],
      claim: "3분간 1번, 1분간 2번 등 이상 패턴으로 개표가 진행됐다는 주장",
      verified_facts: ["영상상 특정 구간에서 후보별 연속 분류 패턴이 관찰된다"],
      confirmed_scope: ["영상상 연속 분류 패턴"],
      not_confirmed: ["장비 조작이 있었다는 주장", "부정선거 조작이 있었다는 주장", "개표 결과에 영향을 주었다는 주장"],
      possible_explanations: ["투표지가 충분히 섞이지 않아 묶음 단위 편중", "소분 묶음 연속 투입"],
      status_scope: "영상상 투표지분류기 후보별 연속 분류 패턴(추가 분석 필요)",
      public_summary: "영상에서 후보별 연속 분류 패턴이 관찰된다. 다만 이는 투표지 미혼합·묶음 편중 등으로도 설명 가능하며, 장비 조작이나 부정선거를 입증하지 않는다. 추가 분석이 필요하다.",
      risk_level: "중간",
    }),
  },
];

function q(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return String(v);
  if (typeof v === "object") return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const COLS = [
  "id", "status", "election", "title", "summary", "body",
  "sido", "sigungu", "eup_myeon_dong", "occurred_at", "collected_at",
  "tags", "sources", "attachments", "exif", "rebuttals", "related",
  "consent", "submitter", "license",
  "verification_reviewer", "verification_method", "verification_reviewed_at",
  "verification_notes", "verification_evidence_links",
  "verification_status_scope", "verification_claim", "verification_verified_facts",
  "verification_assessment", "verification_confirmed_scope", "verification_not_confirmed",
  "verification_possible_explanations", "verification_missing_evidence",
  "verification_reviewer_note", "verification_public_summary", "verification_risk_level",
  "finalize_token", "staging", "created_at", "updated_at",
];

const lines = [
  "-- 예시 시드 (spec 0016) — node scripts/seed-examples.mjs 로 생성. 재실행 안전(INSERT OR REPLACE).",
  "DELETE FROM reports WHERE id IN (" + REPORTS.map((r) => q(r.id)).join(", ") + ");",
];

for (const r of REPORTS) {
  const v = r.verification ?? null;
  const now = r.collected_at;
  const row = {
    id: r.id, status: r.status, election: ELECTION, title: r.title,
    summary: r.summary ?? null, body: r.body ?? null,
    sido: r.region?.sido ?? null, sigungu: r.region?.sigungu ?? null, eup_myeon_dong: r.region?.eup_myeon_dong ?? null,
    occurred_at: null, collected_at: now,
    tags: [CAT[r.cat]], sources: r.sources ?? [], attachments: [], exif: null, rebuttals: null, related: null,
    consent: true, submitter: "seed:votatis-data", license: "CC-BY-4.0",
    verification_reviewer: v?.reviewer ?? null, verification_method: v?.method ?? null,
    verification_reviewed_at: v?.reviewed_at ?? null, verification_notes: v?.notes ?? null,
    verification_evidence_links: v?.evidence_links ?? null,
    verification_status_scope: v?.status_scope ?? null, verification_claim: v?.claim ?? null,
    verification_verified_facts: v?.verified_facts ?? null, verification_assessment: v?.assessment ?? null,
    verification_confirmed_scope: v?.confirmed_scope ?? null, verification_not_confirmed: v?.not_confirmed ?? null,
    verification_possible_explanations: v?.possible_explanations ?? null, verification_missing_evidence: v?.missing_evidence ?? null,
    verification_reviewer_note: v?.reviewer_note ?? null, verification_public_summary: v?.public_summary ?? null,
    verification_risk_level: v?.risk_level ?? null,
    finalize_token: null, staging: null, created_at: now, updated_at: now,
  };
  const vals = COLS.map((c) => q(row[c])).join(", ");
  lines.push(`INSERT OR REPLACE INTO reports (${COLS.join(", ")}) VALUES (${vals});`);
}

process.stdout.write(lines.join("\n") + "\n");
