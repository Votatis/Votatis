---
id: 0016
title: 관리자 UX 개선 + 공개 아카이브 API 연동 + 제보 검토 피드백 스키마 + 예시 시드
status: completed
created: 2026-06-15
updated: 2026-06-15
goal: docs/goals/003.md
---

# Spec 0016 — 관리자 UX / 공개 아카이브 / 검토 피드백 스키마

`docs/goals/003.md`(Goal 003)의 9개 할 일을 스펙으로 묶는다. 의사결정 원칙: 모든 설계는
`docs/PERSONA.md` 페르소나 5(내부 검증 관리자)가 **더 엄격하고 일관되게(확증편향 없이)** 판정하도록 돕는 쪽으로 정한다.

## 배경 (현황 조사 결과)

- 카테고리(투개표/사전투표/전산집계 = 내부 A/B/C)는 `frontend/src/lib/types.ts`에 정의, 제보 `tags[0]`로
  저장·조회·아카이브에 이미 반영됨(`CATEGORY_FULL` 라벨). 별도 category 컬럼 없음 — tags 기반 유지.
- 관리자 세션: access(15분)+refresh(회전·7일), localStorage 저장. 정상이나 **동시 401 → 동시 refresh →
  회전 레이스**로 한쪽이 폐기된 refresh 토큰을 써 실패 → `clearSession()` → 재로그인 강요(버그).
- `/admin/*`는 `adminAuthMiddleware`로 자동 게이트. 새 admin 라우트도 보호됨.
- `/archive`는 빌드타임 정적 `archive.generated.json`만 사용(런타임 API 호출 없음).
- 검증 판정 D1 컬럼은 verification_{reviewer,method,reviewed_at,notes,evidence_links} 5개뿐.
  Votatis#2 피드백 필드(status_scope/claim/verified_facts/not_confirmed/public_summary/risk_level 등) 저장 컬럼 없음.

## 결정 (의사결정 원칙에 따라 확정)

- **상태값 매핑**: Votatis#2의 한글 상태는 기존 영문 상태에 매핑(확인됨→confirmed, 검토중→reviewing,
  미검증→unverified, 이견있음→disputed, 반박됨→debunked, 정정됨→corrected). `반려/보류`는 별도 report
  상태로 추가하지 않는다(MVP 범위 밖; 후속). 내부값 영문 유지, UI 라벨 한글.
- **피드백 필수 강제**(페르소나 5): 판정(confirmed/disputed/debunked/corrected) 시 기존 method+evidence_links≥1에
  더해 `public_summary`, `risk_level`, `not_confirmed`(≥1)를 필수로, `확인됨`이면 `status_scope`+`confirmed_scope`(≥1)도 필수.
  주장/사실/판단 분리(claim·verified_facts·assessment)는 저장하되 필수는 아님(권장).
- **/archive 데이터 소스**: 지금은 공개 API(`GET /reports?status=...`, publishable만) 런타임 연동.
  정적 빌드(`archive.generated.json`)는 fallback/준비물로 유지 — `lib/archive-source.ts`로 소스 추상화.
- **관리자 제보 입력**: 공개 2단계 업로드(Turnstile/presign) 대신 `POST /admin/reports`로 직접 생성
  (status 기본 unverified, 첨부 없이 텍스트·출처·카테고리). 검증자가 현장 제보를 빠르게 등록.

## 할 일 (Goal 003 항목 ↔ 구현)

1. **(항목 3) 로그인 안내 문구 제거** — `LoginForm.tsx`의 "계정은 루트 관리자가…/세션은 이 브라우저에만…" 삭제.
2. **(항목 5) 화면 미리보기 링크 제거** — `admin/layout.tsx` 헤더, `AdminShell.tsx` 사이드바 "바로가기".
3. **(항목 6) 검증 패널 오버플로우 수정** — `QueueClient.tsx` 안내 `<p>`에 overflow-wrap/word-break.
4. **(항목 2) 세션 유지** — `lib/api/admin.ts`에 single-flight refresh(공유 in-flight Promise) 도입,
   동시 401에서 refresh 1회만 수행하고 나머지는 그 결과를 공유. 레이스로 인한 오로그아웃 제거.
5. **(항목 1+4) 관리자 제보 입력 + 카테고리 정합** — `POST /admin/reports`(스키마/서비스/라우트) +
   `/admin/reports/new` 폼(카테고리 A/B/C 선택 → tags[0]=CATEGORY_FULL). 사이드바 진입점.
6. **(항목 8) 검토 피드백 스키마** — D1 마이그레이션 0002로 피드백 컬럼 추가, VerificationSchema/AdminPatch 확장,
   판정 가드 강화(위 결정), 공개 응답(ReportPublic)에 공개 피드백 필드 노출, 검증 UI(EvidenceClient)에 입력란 추가.
7. **(항목 7) /archive API 연동** — `lib/archive-source.ts` 추상화 + ArchiveClient/상세를 API 런타임 조회로,
   정적 인덱스는 fallback 유지. 공개 피드백 필드(public_summary/status_scope/not_confirmed) 표시.
8. **(항목 9) 예시 시드 + E2E** — `votatis-data` 9건을 시드 스크립트로 로컬 D1에 삽입(제보+검토 판정),
   제보입력→판정→/archive 노출 흐름을 로컬에서 확인. 운영 게시는 사람 승인(loops/HUMAN.md).

## 완료 조건 (Definition of Done)

- [x] 항목 1~9 구현. `pnpm -r typecheck`(3/3), `pnpm -r test`(intake-api 49 + admin-mcp 12), frontend `build` 통과.
- [x] 새 라우트/스키마 OpenAPI 반영, frontend schema.d.ts 재생성(openapi:gen) 일치.
- [x] 판정 가드: 판정 시 피드백 필수(public_summary/risk_level/not_confirmed, confirmed 는 status_scope/confirmed_scope) 누락 시 400 — api.test.ts + admin-mcp verdict.test.ts 로 증명.
- [x] /archive가 API(GET /reports, publishable)에서 데이터를 읽어 표시 — 로컬 dev E2E 로 9건 노출·상세 피드백 필드 확인(reviewer_note 는 공개 제외).
- [x] 시드 스크립트로 9건 로컬 D1 삽입 재현 가능(seed:examples:local). 관리자 직접 등록(POST /admin/reports)도 로컬 E2E 통과.
- [x] 동작 변경 Changelog 기록, 운영 게시 항목은 loops/HUMAN.md([열림] Goal 003).

## 구현 노트 / 결정

- 항목 1(카테고리): report 데이터 모델에 이미 `tags[0]=CATEGORY_FULL` 로 반영돼 있어 별도 컬럼 불필요. 관리자 직접 등록(항목 4)도 동일 매핑 사용 → 정합 유지.
- 항목 2(세션): 원인은 refresh 토큰 회전 + 동시 401 레이스. `lib/api/admin.ts` single-flight refresh 로 해결.
- 항목 7: 지금은 런타임 API 연동, 정적 인덱스(`archive.generated.json`)는 fallback+SSG `[id]` 라우트로 "static build 준비"만 유지. 런타임 상세는 `/archive/record?id=`.
- `반려/보류` 상태는 추가하지 않음(기존 6상태 유지) — MVP 범위 밖, 후속.

## Changelog

- 2026-06-15: 스펙 생성 (Goal 003, 요청: 채팅).
- 2026-06-15: 구현 완료 — 관리자 세션 single-flight refresh, 로그인 문구/미리보기 링크 제거, 검증패널 오버플로우 수정, 검토 피드백 스키마(D1 0002)+판정 가드 강화, 관리자 직접 제보 등록 API/UI, /archive 런타임 API 연동, 예시 9건 시드. (요청: 채팅)
