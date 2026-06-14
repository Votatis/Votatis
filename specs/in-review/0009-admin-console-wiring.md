---
id: "0009"
title: 관리자 콘솔 API 연동 (로그인 / 검토 큐 / 증거 검수 / 대시보드)
status: in-review
created: 2026-06-14
updated: 2026-06-14
related:
  - "docs/MVP-PRD.md §6 검증 워크플로우 / §11 관리자 페이지"
  - "docs/PERSONA.md 페르소나 5(내부 검증 관리자) — 빠른 통과가 아니라 엄격한 판정을 쉽게"
  - "specs/in-review/0008-admin-verification-api.md (소비하는 API)"
  - "docs/goals/001.md"
---

# 관리자 콘솔 API 연동

## 1. 배경
관리자 페이지(`/free/admin/*`)가 UI만 있고 API가 없다. 0008이 만든 관리자 API(`/admin/session`, `/admin/reports`, PATCH, 증거 스트리밍)에 연결해 실제 검토 워크플로우를 돌린다. 데이터 레이어는 `src/lib/api/admin.ts`, 토큰 보관은 `src/lib/admin-auth.ts`.

## 2. 목표
1. **로그인**: 공유 토큰 입력 → `verifyAdminToken` → `setAdminToken` → 대시보드. 실패 시 에러.
2. **검토 큐**: `listAdminReports`로 상태 탭(미검증/검토중/완료군)+검색, 항목 선택 → 상세.
3. **증거 검수 + 판정**: 상세에서 원본 첨부 인라인(`fetchAttachmentObjectUrl`), EXIF/제보메타 표시, 판정(confirmed/disputed/debunked/corrected)+검증 method·evidence_links·notes·tags·rebuttals 입력 → `patchAdminReport`. **근거 없는 판정은 API가 막음** → UI도 근거 필수 안내(페르소나 5).
4. **대시보드**: 상태별 카운트(큐 counts) 요약.
5. **인증 가드**: 토큰 없으면 로그인으로.

## 3. 비목표
- 멤버별 계정/권한(공유 토큰 MVP). 감사 로그 영속화. 자동 마스킹. AI 분석(별도).

## 4. 설계/제약
- **output:export 대응**: 증거 상세는 런타임 id라 path-param 정적생성 불가 → **쿼리파라미터 페이지 `/free/admin/evidence?id=`**로 전환(기존 `[id]` 라우트 폐기). 큐에서 `?id=`로 링크.
- **UI 재사용**: AdminShell·기존 클래스(.panel/.ph/.tiles/.tile/.act/.kv/.seg/.inp/.lbtn/.empty/.tbl) 사용. 새 토큰 금지.
- 모든 admin 페이지는 `"use client"`(토큰·fetch 런타임).

## 5. 완료 조건
- [x] 로그인이 토큰을 검증·보관하고 대시보드로 이동, 틀리면 에러.
- [x] 검토 큐가 실제 목록/카운트를 부르고 탭·검색이 동작, 항목→증거 상세 이동.
- [x] 증거 상세가 첨부를 인증 하에 표시하고, 판정+근거 입력으로 `PATCH`가 성공/실패(근거 누락 400) 처리.
- [x] 대시보드가 상태별 카운트를 보여준다.
- [x] 증거 라우트가 `?id=` 쿼리 기반으로 빌드(static export) 성공.
- [x] `pnpm --filter votatis-frontend typecheck`·`build` 성공.

## Changelog
- 2026-06-14: 최초 작성 (Goal 001 자율 수행)
- 2026-06-14: 관리자 콘솔 4개 영역 API 연동 구현 — 로그인(공유 토큰), 검토 큐(탭·검색·counts·행 링크), 증거 검수를 `[id]` path-param → `?id=` 쿼리 라우트로 전환(useSearchParams+Suspense, 첨부 인라인·판정 폼·근거 필수 안내), 대시보드(상태별 counts). AdminShell evidence nav href 갱신.
- 2026-06-14: 구현·검증 완료(typecheck+static build 성공). in-review 이동.
