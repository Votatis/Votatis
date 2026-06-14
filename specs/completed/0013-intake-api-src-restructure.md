---
id: "0013"
title: intake-api src 디렉터리 재구성 + 레이어 리팩터링 (동작 불변)
status: completed
created: 2026-06-14
updated: 2026-06-14
related:
  - "docs/goals/001.md 의 UX/구조 원칙(여기선 백엔드 구조)"
  - "specs/completed/0006-d1-report-store-api.md / 0008 / 0011 / 0012 (대상 코드)"
---

# intake-api src 재구성 + 레이어 리팩터링

## 1. 배경 / 문제
`apps/intake-api/src`가 20개 파일이 한 디렉터리에 평면적으로 쌓여 있고, 책임이 섞여 있다:
- `app.ts`(369줄): 모든 라우트 정의+핸들러 인라인 + CORS/인증 미들웨어 + OpenAPI 문서.
- `admin.ts`(319줄): 인증(isAdmin/safeEqual) + 쿼리 빌더 + 서비스 로직 + DTO 매퍼 + 상태 상수 혼재.
- `schemas.ts`(271줄): 전 도메인 Zod 스키마 한 파일.
- 매퍼가 `reports-map.ts`와 `admin.ts`에 분산, 상태 상수가 `types.ts`/`admin.ts`/`schemas.ts`에 분산.

## 2. 목표 (동작 불변 — 순수 리팩터링)
8년차 백엔드 관점의 레이어드 구조로 재구성한다. **외부 동작/HTTP 계약/OpenAPI 스펙은 한 글자도 바뀌지 않는다.**

레이어:
- `routes/` — HTTP 라우트 정의(thin, 검증된 입력을 서비스에 위임)
- `services/` — 비즈니스 로직(D1 접근 포함)
- `domain/` — 순수 변환(매퍼·휴리스틱 분석·마크다운 직렬화)
- `schemas/` — 도메인별 Zod 스키마
- `middleware/` — CORS·관리자 인증
- `db/` — drizzle client·schema (유지)
- `lib/` — 인프라 유틸(turnstile·ratelimit·r2-presign·crypto·media·http)
- 루트: `index.ts`(entry), `app.ts`(조립), `env.ts`, `constants.ts`, `router.ts`(공용 OpenAPIHono 팩토리)

## 3. 비목표
- 기능 추가/변경, 새 엔드포인트, 스키마 변경. (전부 금지 — 동작 동결)
- DB 마이그레이션 변경.

## 4. 검증 (불변식)
- `pnpm --filter votatis-intake-api test` 전건 통과(테스트 코드의 import 경로만 갱신).
- `pnpm -r typecheck` 통과.
- `openapi:emit` 재생성 결과 `openapi.json`이 **리팩터링 전과 동일**(diff 없음) → HTTP/문서 계약 불변 증명.
- 프론트 `openapi:check`(스키마 동기) 통과 + 프론트 build 성공.

## 5. 완료 조건
- [x] src가 위 레이어 구조로 재배치되고, 한 파일이 한 책임을 갖는다.
- [x] 상태 상수·미디어 상수가 `constants.ts`로 단일화, 매퍼가 `domain/mappers.ts`로 통합.
- [x] app.ts는 조립만(라우트 인라인 제거), 라우트는 도메인별 sub-app.
- [x] 불변식 4종(test/typecheck/openapi diff 없음/front build) 충족.

## Changelog
- 2026-06-14: 최초 작성 (Goal: intake-api src 정리)
- 2026-06-14: 구현 완료 — src를 routes/services/domain/schemas/middleware/lib/db + env/constants/router 로 재구성. app.ts 369→34줄(라우트 sub-app 분리), admin.ts 319줄을 services/admin·stats·analysis + middleware/admin-auth + domain/mappers 로 분해, schemas 4분할, 상태·미디어 상수 constants.ts 단일화. 불변식 충족: typecheck/test(39)/openapi 계약 sorted-diff 0/openapi:check/front build. completed.
