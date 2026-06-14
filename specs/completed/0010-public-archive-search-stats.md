---
id: "0010"
title: 공개 아카이브 / 검색 / 통계 정적 연동
status: completed
created: 2026-06-14
updated: 2026-06-14
related:
  - "docs/MVP-PRD.md §9 검색·인덱싱 / §11 공개 웹사이트 / §4 정적 사이트"
  - "docs/PERSONA.md 1·2(판단 유보자·회의적 비신자) — 검증 상태 라벨/출처/절제"
  - "specs/in-progress/0011-d1-markdown-export-pipeline.md (archive.generated.json 원천)"
  - "docs/goals/001.md (UI 재사용·UX 리뷰 원칙)"
---

# 공개 아카이브 / 검색 / 통계 정적 연동

## 1. 배경
공개 페이지(`/archive`, `/archive/[id]`, `/search`, `/stats`)가 전부 "데이터 소스 없음" 빈 상태다. 0011이 만든 빌드타임 인덱스(`src/data/archive.generated.json`, 데이터 레이어 `src/lib/archive.ts`)에 연결해 검증 완료 레코드를 정적으로 표시·검색·집계한다. 런타임 API 호출 없음(정적·캐시, output:export).

## 2. 목표
1. `/archive`: 레코드 목록 + 카테고리/상태 필터 + 정렬, 카드에 검증 상태 칩·지역·태그·첨부수. 빈 상태 유지(데이터 0건일 때).
2. `/archive/[id]`: 상세 — 제목/요약/본문/출처(archive 링크)/첨부 해시/검증 이력/반박. `generateStaticParams`는 인덱스 id 열거(없으면 sentinel + dynamicParams=false로 빌드 성공).
3. `/search`: 키워드+카테고리+상태로 `filterRecords` 결과 표시.
4. `/stats`: `archiveStats()`로 일자별 추이·카테고리/상태 분포 렌더(기존 hbar/track/donut 재사용).

## 3. 비목표
- 런타임 미검증 데이터 브라우징(관리자 영역, 0009).
- 지도 뷰(향후). 벡터 검색(v2).

## 4. 설계/원칙
- **UI 재사용**: 기존 클래스(.chip/.c-*, .rdoc/.rdh/.rid/.kv/.hbar/.track/.fill, .fchips, .empty, .dash)만 사용. 새 토큰 금지.
- **신뢰 신호(PERSONA)**: 상태 칩을 항상 노출, 출처/무결성 해시/반박 병기, 중립 카피.
- SSG: 모든 데이터는 빌드타임 import. 검색/필터는 클라이언트.

## 5. 완료 조건
- [x] `/archive`가 인덱스 레코드를 카드로 나열하고 카테고리/상태/정렬 필터가 동작(0건이면 빈 상태).
- [x] `/archive/[id]`가 인덱스 레코드 상세를 렌더, 빌드(`generateStaticParams`)가 데이터 유무와 무관하게 성공.
- [x] `/search`가 `filterRecords`로 결과를 보여준다.
- [x] `/stats`가 `archiveStats()` 집계를 차트로 표시.
- [x] `pnpm --filter votatis-frontend typecheck`·`build` 성공.

## Changelog
- 2026-06-14: 최초 작성 (Goal 001 자율 수행)
- 2026-06-14: 공개 페이지 4종을 빌드타임 데이터 레이어(archive.ts)에 연동 — /archive 목록·필터·정렬·카운트, /archive/[id] 실 id 열거 + 상세(출처/첨부 해시/검증/반박), /search filterRecords 결과, /stats archiveStats() 차트. typecheck 통과 (요청: 채팅)
- 2026-06-14: 구현·검증 완료(typecheck+static build 성공). in-review 이동.
- 2026-06-14: spec-review 통과(adversarial review + 회귀 테스트, typecheck/test/static build). completed 이동.
