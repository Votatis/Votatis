// 선거 목록 단일 출처(spec 0017) — 2020년 이후 치러진 선거. 제보/어드민 양쪽에서 재사용한다.
// name 은 정식 명칭(저장값, 기존 데이터 표기와 일치). 최신순(date 내림차순). 기본값 = 최상단.

export interface Election {
  /** 정식 명칭. 제보 레코드의 election 저장값이 된다. */
  name: string;
  /** 선거일 YYYY-MM-DD. 정렬·라벨용. */
  date: string;
}

/** 최신순(date 내림차순). 출처: 중앙선관위/위키백과 검증(2026-06 기준). */
export const ELECTIONS: Election[] = [
  { name: "제9회 전국동시지방선거", date: "2026-06-03" },
  { name: "제21대 대통령선거", date: "2025-06-03" },
  { name: "제22대 국회의원선거", date: "2024-04-10" },
  { name: "제8회 전국동시지방선거", date: "2022-06-01" },
  { name: "제20대 대통령선거", date: "2022-03-09" },
  { name: "제21대 국회의원선거", date: "2020-04-15" },
];

/** 기본 선택 = 가장 최근 선거. */
export const DEFAULT_ELECTION = ELECTIONS[0].name;

/** 드롭다운 옵션 라벨: "이름 (YYYY)". 저장값은 name 만 쓴다. */
export function electionLabel(e: Election): string {
  return `${e.name} (${e.date.slice(0, 4)})`;
}
