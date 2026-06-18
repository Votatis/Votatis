---
id: "0008"
title: 관리자 검증 API + 인증 (검증 큐 / 상태 판정 / 증거 열람)
status: completed   # not-started | in-progress | in-review | completed
created: 2026-06-14
updated: 2026-06-19
related:
  - "docs/MVP-PRD.md §6 검증 워크플로우(관리자 페이지) / §5 수집 흐름 3 / §11 관리자 페이지"
  - "docs/PERSONA.md 페르소나 5(내부 검증 관리자) — 빠른 통과가 아니라 엄격한 판정을 쉽게"
  - "specs/completed/0006-d1-report-store-api.md (verification_* 컬럼·status 전이를 본 스펙이 채운다)"
  - "docs/goals/001.md"
---

# 관리자 검증 API + 인증

## 1. 배경 / 문제

0006이 D1 `reports` 저장 + 공개 조회까지 만들고, `verification_*` 컬럼과 status 전이는 "검수 스펙"으로 넘겼다. 현재 관리자 페이지(`apps/frontend/src/app/free/admin/*`)는 **UI만** 있고 API가 없다. 검증 큐 조회·상태 판정(confirmed/disputed/debunked/corrected)·증거 열람을 담당하는 **관리자 전용 백엔드**가 없어 MVP-PRD §6 검증 워크플로우가 동작하지 않는다.

본 스펙은 intake-api에 **관리자 전용 엔드포인트 + 인증**을 추가한다.

## 2. 목표 (Goals)

1. **관리자 인증**: 공유 시크릿(`ADMIN_TOKEN`) 기반 Bearer 인증. `/admin/*`는 토큰 없으면 401.
2. **검증 큐 조회** `GET /admin/reports`: status/지역/태그/검색어 필터 + 상태별 카운트(대시보드용).
3. **상세(내부 필드 포함)** `GET /admin/reports/{id}`: 공개 응답에서 가리는 `submitter`·`exif`까지 포함. 검수용.
4. **증거 열람** `GET /admin/reports/{id}/attachments/{idx}`: 비공개 R2 객체를 인증 게이트로 스트리밍(로컬·원격 모두 동작; `<img src>` 헤더 한계를 우회).
5. **상태 판정** `PATCH /admin/reports/{id}`: status 전이 + verification(reviewer/method/evidence_links/notes) + tags·rebuttals·summary/title/body 교정. `verification_reviewed_at` 자동 기록.
6. **공개 통계** `GET /stats`: 공개 상태 레코드의 상태별/선거별/일자별 집계(공개 통계 페이지용, 인증 불필요).
7. vitest로 인증·큐·판정·비노출 회귀 커버.

## 3. 비목표 (Non-Goals)

- 멤버별 계정/권한 레벨(누가 실제 토큰을 받는지) — 운영 정책은 사람 몫(`loops/HUMAN.md`). 본 스펙은 단일 공유 토큰 메커니즘만.
- AI 분석/자동 태깅 — 별도 스펙.
- D1 → GitHub 마크다운 배포 — 별도 스펙.
- 관리자 프론트엔드 연동 — 별도 스펙(0009).
- 자동 마스킹(얼굴/번호판) — 향후.

## 4. 설계

### 인증
- `Env.ADMIN_TOKEN` 추가(dev는 `wrangler.jsonc` vars 기본값, 운영은 `wrangler secret`).
- 미들웨어: `/admin/*` 요청의 `Authorization: Bearer <token>`이 `ADMIN_TOKEN`과 일치해야 통과. 불일치 401. 타이밍 안전 비교.
- `POST /admin/session`: 로그인 UX용. body `{ token }` 검증 → `{ ok: true }` 또는 401. (별도 세션 쿠키 없음 — 프론트가 토큰 보관 후 Bearer로 전송.)
- CORS: `/admin/*`는 쓰기(POST/PATCH)뿐 아니라 GET도 허용 오리진에서만(공개 API와 달리 `*` 금지). `Authorization` 헤더 허용.

### 상태 전이 규칙
- 허용 target status: `unverified | reviewing | confirmed | suspected | disputed | debunked | corrected` (pending 금지).
- `confirmed/suspected/disputed/debunked/corrected`로 전이하려면 `verification.method`와 `evidence_links≥1`을 요구(페르소나 5: 근거 없는 판정 방지). `reviewing/unverified`로의 되돌림은 근거 불요구.
- `suspected`(의심): 통상적 설명으로 해소되지 않는 미해명 정황 — 조작 단정이 아니라 해명이 필요한 상태. judged 공통 필수(method·evidence_links·public_summary·risk_level·not_confirmed)에 더해 `missing_evidence≥1`(필요 해명 사항)을 추가로 요구.
- 전이 시 `verification_reviewed_at = now`, `updated_at = now` 자동 기록.

### 증거 스트리밍
- `GET /admin/reports/{id}/attachments/{idx}` → 레코드의 `attachments[idx].r2_key`를 `EVIDENCE_BUCKET.get`으로 읽어 바이트 스트리밍(Content-Type=mime). 프론트는 Bearer로 fetch→blob→objectURL.

### /stats (공개)
- `status != 'pending'` 레코드 기준 `{ total, by_status: {..}, by_election: [{election,count}], daily: [{date,count}] }`. daily는 `collected_at` 날짜(YYYY-MM-DD) 버킷.

## 5. 완료 조건 (Acceptance Criteria)

- [x] `/admin/*`가 토큰 없거나 틀리면 401, 맞으면 통과. `POST /admin/session`이 토큰 검증 결과를 반환.
- [x] `GET /admin/reports`가 status/지역/태그/q 필터와 상태별 카운트를 반환하고, pending도 관리자에겐 보인다(고아 정리 추적용은 제외 — pending도 포함할지 §아래). → pending 제외, 검증 대상 상태만.
- [x] `GET /admin/reports/{id}`가 `submitter`·`exif` 포함 상세를 반환.
- [x] `PATCH /admin/reports/{id}`로 status·verification·tags·rebuttals·교정 필드가 갱신되고 `verification_reviewed_at`이 채워진다. 근거 없는 confirmed류 전이는 400.
- [x] `GET /admin/reports/{id}/attachments/{idx}`가 인증 하에 R2 객체 바이트를 반환(미인증 401).
- [x] `GET /stats`가 공개 레코드 집계를 반환(인증 불필요).
- [x] 공개 API(`GET /reports*`)에는 여전히 `submitter` 등 내부필드가 노출되지 않는다(회귀 없음).
- [x] `pnpm --filter votatis-intake-api test`·`pnpm -r typecheck` 통과.

## 6. 미해결 질문 / 리스크
- 공유 토큰은 MVP 수준 보안. 멤버별 계정·감사 로그는 향후(HUMAN.md/후속 스펙).
- 운영 `ADMIN_TOKEN` 발급은 사람 몫 → HUMAN.md.

## Changelog
- 2026-06-14: 최초 작성 (Goal 001 자율 수행)
- 2026-06-14: 구현 완료 — 인증 미들웨어(Bearer ADMIN_TOKEN)+CORS(/admin 오리진 제한), GET/PATCH /admin/reports, 증거 스트리밍, POST /admin/session, 공개 GET /stats. 테스트 9건 추가(총 32) 통과, OpenAPI 재방출+프론트 타입 재생성. in-review 이동.
- 2026-06-14: spec-review 통과(adversarial review + 회귀 테스트, typecheck/test/static build). completed 이동.
- 2026-06-19: 판정 상태에 `suspected`(의심) 추가 — judged 공통 근거에 더해 `missing_evidence≥1` 가드레일을 intake-api 서비스·admin-mcp `validateVerdict` 양쪽에 강제(조작 단정 비약 차단). MCP 도구 설명·프론트 라벨("의심", c-sus 칩)·통계/필터 목록 반영. typecheck 전체·테스트(admin-mcp 15) 통과. (요청: 채팅)
