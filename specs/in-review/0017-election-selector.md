---
id: "0017"
title: 선거(election) 선택 — 2020년 이후 선거 목록 드롭다운(제보/어드민 공용)
status: in-review   # not-started | in-progress | in-review | completed
created: 2026-06-21
updated: 2026-06-21
related:
  - "specs/completed/0004-report-flow-wizard.md"
  - "specs/completed/0016-admin-ux-archive-feedback.md"
  - "https://ko.wikipedia.org/wiki/대한민국_제21대_국회의원_선거"
---

# 선거(election) 선택 — 2020년 이후 선거 목록 드롭다운

## 1. 배경 / 문제
현재 제보의 `election` 값이 고정/자유입력으로 흩어져 있다.
- 제보하기(`ReportFlow`)는 `NEXT_PUBLIC_ELECTION` 환경변수 단일값(`제9회 전국동시지방선거`)으로 박혀 있어 다른 선거 제보가 불가능.
- 어드민 증거추가(`admin/reports/new`)는 자유 텍스트 input이라 오타·표기 불일치가 생긴다(예: "제9회 지방선거" vs "제9회 전국동시지방선거").
표기가 흔들리면 선거별 집계(`/stats` by_election)·필터가 깨진다. 정해진 목록에서 고르게 해야 한다.

## 2. 목표 (Goals)
1. 2020년 이후 치러진 모든 선거를 **단일 출처 목록**으로 정의한다(프론트 lib).
2. 제보하기·어드민 증거추가 두 화면에서 **드롭다운(select)** 으로 선거를 고르게 한다.
3. **기본값 = 가장 최근 선거**(목록 최상단).

## 3. 비목표 (Non-Goals)
- 백엔드 enum 강제 검증(`election` 은 `z.string().min(1)` 자유 문자열 유지 — 미래 선거를 백엔드 재배포 없이 추가 가능하게). 표기 일관성은 프론트 드롭다운으로 보장.
- 과거(2020년 이전) 선거.
- 선거별 지역/후보 메타데이터.
- 공개 아카이브/검색의 선거 필터 UI(별도 작업).

## 4. 요구사항
1. `apps/frontend/src/lib/elections.ts` 신설: `{ name: string; date: string }[]` 를 **최신순(date 내림차순)** 으로, `name` 은 정식 명칭(기존 데이터 `제9회 전국동시지방선거` 와 동일 표기). `DEFAULT_ELECTION = ELECTIONS[0].name` 내보낸다.
2. 목록(2020-01-01 이후, 검증된 사실):
   - 제9회 전국동시지방선거 — 2026-06-03 (기본값)
   - 제21대 대통령선거 — 2025-06-03
   - 제22대 국회의원선거 — 2024-04-10
   - 제8회 전국동시지방선거 — 2022-06-01
   - 제20대 대통령선거 — 2022-03-09
   - 제21대 국회의원선거 — 2020-04-15
3. `ReportFlow`: `NEXT_PUBLIC_ELECTION` 의존 제거(또는 무시), 선거 select 추가(기본 `DEFAULT_ELECTION`), 제출 시 선택값을 `election` 으로 전송.
4. `admin/reports/new`(`NewReportClient`): 텍스트 input → select 로 교체, 기본 `DEFAULT_ELECTION`.
5. 옵션 라벨은 `이름 (YYYY)` 형태로 연도를 함께 보여 식별성↑(저장값은 `name` 만).

## 5. 설계 개요
- 단일 출처: `lib/elections.ts`.
  ```ts
  export interface Election { name: string; date: string } // date: YYYY-MM-DD
  export const ELECTIONS: Election[] = [ /* 최신순 */ ];
  export const DEFAULT_ELECTION = ELECTIONS[0].name;
  ```
- `ReportFlow`/`NewReportClient` 모두 `ELECTIONS` 를 import 해 `<select>` 렌더, state 기본값 `DEFAULT_ELECTION`.
- 저장 계약 불변: `election` 은 문자열 그대로 전송(intake-api·D1 스키마 변경 없음).

## 6. 완료 조건 (Acceptance Criteria)
- [ ] `lib/elections.ts` 가 6개 선거를 최신순으로 담고 `DEFAULT_ELECTION === "제9회 전국동시지방선거"`.
- [ ] 제보하기 화면에 선거 드롭다운이 있고 기본 선택이 가장 최근 선거이며, 선택값이 제출 `election` 에 반영된다.
- [ ] 어드민 증거추가 화면의 선거 입력이 드롭다운(자유 텍스트 아님)이고 기본값이 가장 최근 선거.
- [ ] 두 화면이 동일한 `ELECTIONS` 단일 출처를 사용(목록 중복 정의 없음).
- [ ] `pnpm -r typecheck` 통과, 프론트 정적 빌드 성공.

## 7. 미해결 질문 / 리스크
- `NEXT_PUBLIC_ELECTION` 환경변수는 더 이상 값 소스로 쓰지 않는다(빌드 명령/steering에서 정리 필요 — frontend-pages-deploy). 제거 대신 무시로 둘지: 본 스펙은 "사용 안 함"으로 하고 steering만 갱신.
- 백엔드가 자유 문자열이라 드롭다운 밖 값도 이론상 저장 가능(어드민 콘솔 직접 PATCH 등). 표기 일관성은 UI 책임.

## Changelog
- 2026-06-21: 최초 작성
- 2026-06-21: 구현 완료 — lib/elections.ts(6개 선거 최신순+DEFAULT_ELECTION), ReportFlow·admin/reports/new 에 선거 드롭다운(기본=최신) 적용, ReportFlow의 NEXT_PUBLIC_ELECTION 의존 제거. typecheck/빌드 통과, 운영 배포 후 제보 폼 드롭다운(6개, 기본 제9회) 라이브 확인. in-review 이동.
