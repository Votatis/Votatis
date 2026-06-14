---
id: "0012"
title: AI 분석 백엔드 (자동 태깅 / 신뢰도 신호 / 합성 위험) — 보조 신호
status: in-review
created: 2026-06-14
updated: 2026-06-14
related:
  - "docs/MVP-PRD.md §5-3 / §6 관리자 기능(AI 분석 결과 제시) / §10 v1"
  - "docs/PERSONA.md 페르소나 5 — AI 결론을 그대로 채택하지 않게, 보조 신호로만"
  - "specs/in-review/0008-admin-verification-api.md"
  - "docs/goals/001.md"
---

# AI 분석 백엔드 (보조 신호)

## 1. 배경
PRD §6 관리자 기능에 "AI 분석 결과 제시(신뢰도·관련 키워드)·자동 태깅·합성 식별"이 있다. 검증자(페르소나 5)는 AI 결론을 **참고 신호**로만 쓰고 최종 판정은 사람이 한다. 본 스펙은 그 보조 신호를 만드는 백엔드를 추가한다.

## 2. 목표
1. **휴리스틱 분석기(순수 함수)**: 레코드(제목·요약·본문·태그·출처·첨부·exif)에서 ① 자동 태그 추천 ② 신뢰도 점수+근거 신호 ③ 합성/조작 위험 수준+신호 ④ 요약 힌트 를 계산. 외부 의존 없이 결정적 → 단위 테스트.
2. **엔드포인트** `POST /admin/reports/{id}/analyze`(인증): 해당 레코드 분석 결과 반환. 휴리스틱이 항상 baseline.
3. **선택적 Workers AI 증강**: `env.AI` 바인딩이 있으면 텍스트 모델로 태그·요약을 보강. 실패/미바인딩 시 휴리스틱으로 graceful fallback. (바인딩 프로비저닝은 사람 몫 → HUMAN.md.)
4. 프론트 관리자 증거 화면에 "AI 분석(보조)" 패널로 노출(보조임을 명시).

## 3. 비목표
- 자동 판정/자동 태그 적용 — 사람이 검토 후 채택(보조 신호 원칙). 
- 이미지 픽셀 단위 딥페이크 탐지 모델 — 향후. 본 스펙의 합성 위험은 메타데이터 기반 신호(exif 유무 등) 수준.
- 영속 저장 — 분석은 on-demand. (추후 캐시 가능)

## 4. 설계
- `src/analyze.ts`: `analyzeRecord(input): Analysis` 순수 함수. 
  - 태그: 한국어 선거 키워드 사전 매칭(투표지/개표/사전투표/봉인/참관/CCTV/전산/통계 등) → 기존 태그에 없는 것 추천.
  - 신뢰도: 공식출처(+)·archive_url(+)·sha256 첨부(+)·복수 독립 출처(+)·텍스트만(−) → 0~1 점수 + 신호 목록.
  - 합성위험: 첨부에 exif 없음/스크린샷 의심 → "review"/"unknown", exif 카메라 정보 있음 → "low". 신호 목록.
  - 요약 힌트: 본문 첫 문장 기반.
- `analyzeReport(env,id)`: D1 조회 → analyzeRecord → (env.AI 있으면) 증강. 인증은 /admin/* 미들웨어.

## 5. 완료 조건
- [x] `analyzeRecord`가 결정적 결과(태그추천/신뢰도/합성위험/요약힌트)를 내고 단위 테스트 통과.
- [x] `POST /admin/reports/{id}/analyze`가 인증 하에 분석을 반환(미인증 401, 없는 id 404).
- [x] `env.AI` 미바인딩에서도 동작(휴리스틱). 바인딩 시 try/catch로 안전 증강.
- [x] 관리자 증거 화면에 보조 신호로 표시(AI 임을 명시).
- [x] `pnpm --filter votatis-intake-api test`·`pnpm -r typecheck`·frontend build 통과.

## 6. 리스크
- Workers AI 바인딩/요금은 운영 계정 필요 → HUMAN.md. 휴리스틱은 단순 신호이며 판정 근거가 아님(UI 명시).

## Changelog
- 2026-06-14: 최초 작성 (Goal 001 자율 수행)
- 2026-06-14: 구현 완료 — analyze.ts 휴리스틱(태그추천/신뢰도/합성위험/요약힌트)+POST /admin/reports/{id}/analyze(선택 Workers AI 증강, graceful fallback), 관리자 증거 화면 'AI 분석(보조)' 패널. 테스트 37건(3건 추가) 통과. in-review 이동.
