---
id: "0015"
title: 관리자 인증 — 루트 계정 + 회원관리 + JWT(access/refresh)
status: completed
created: 2026-06-14
updated: 2026-06-15
related:
  - "specs/completed/0008-admin-verification-api.md (현 ADMIN_TOKEN Bearer 인증 대체)"
  - "specs/completed/0009-admin-console-wiring.md (프론트 로그인/세션)"
  - "specs/completed/0014-admin-mcp-server.md (ADMIN_TOKEN Bearer 호환 유지 필요)"
  - "docs/PERSONA.md 페르소나 5(내부 검증 관리자)"
  - "docs/MVP-PRD.md §6 검증 워크플로우 / §11 관리자 페이지"
  - "승인된 플랜: ~/.claude/plans/sharded-hatching-cookie.md"
  - "OWASP ASVS v4 §2(Authentication) / §3(Session Management): access 토큰 단명 + refresh 회전 + 비활성 만료"
---

# 관리자 인증 — 루트 계정 + 회원관리 + JWT(access/refresh)

## 1. 배경 / 문제

현재 관리자 로그인은 **공유 `ADMIN_TOKEN`을 직접 붙여넣는** 방식이다(`apps/intake-api/src/middleware/admin-auth.ts`의 Bearer 비교, 프론트는 토큰을 `localStorage`에 저장). 계정 개념·권한 분리·세션 만료가 없어 여러 검증자가 안전하게 협업하거나 권한을 관리할 수 없고, 토큰이 유출되면 회수 수단이 없다.

페르소나 5(내부 검증 관리자)는 "엄격하고 일관된 판정"을 위해 **누가 무엇을 했는지 추적 가능한 계정**과 **권한 경계**가 필요하다.

## 2. 목표 (Goals)

1. **루트 관리자 1계정(`admin`)**: 기존 `ADMIN_TOKEN`을 부트스트랩 비밀번호로 재사용해 시드한다.
2. 루트가 **회원(검증자) 계정 생성/비활성/삭제**, **비밀번호 재설정 링크 발급**.
3. 회원은 **재설정 링크로 직접 비밀번호 설정** 후 로그인(이메일 인프라 없이, 링크는 루트가 수동 전달).
4. 계정 모델: `username · 이름(name) · password(해시)` + 역할(root/member).
5. 인증: **JWT 액세스 토큰(단명) + 회전형 리프레시 토큰**, **7일 이상 미접속 시 리프레시 불가**.
6. 멤버는 검증(큐·증거·판정) 전체 수행 가능, **회원관리는 root 전용**.

## 3. 비목표 (Non-Goals)

- 이메일 자동 발송(재설정 링크 메일링) — 범위 외, 루트가 링크 수동 전달.
- httpOnly 쿠키 세션 — pages.dev↔workers.dev 교차 오리진(서드파티 쿠키) 문제로 제외, `localStorage` 유지.
- 소셜 로그인/2FA/SSO.
- 세분화된 RBAC(역할은 root/member 2종만).

## 4. 요구사항

### 기능
1. `POST /admin/auth/login {username, password}` → `{access_token, refresh_token, user}`.
2. `POST /admin/auth/refresh {refresh_token}` → 새 토큰쌍(회전). 만료/폐기/비활성 시 401.
3. `POST /admin/auth/logout {refresh_token}` → 해당 refresh 폐기.
4. `POST /admin/auth/password-reset {token, password}`(공개) → 재설정 토큰으로 비밀번호 설정.
5. `GET /admin/auth/me` → 현재 사용자(JWT 기반).
6. root 전용: `GET /admin/members`, `POST /admin/members {username,name,role?}`→`{user, reset_token}`, `POST /admin/members/{id}/reset-link`→`{reset_token}`, `PATCH /admin/members/{id} {name?,status?}`, `DELETE /admin/members/{id}`.
7. 루트 부트스트랩: `admin` 행이 없고 로그인 자격이 `admin` + `ADMIN_TOKEN`이면 root 계정을 멱등 생성.

### 비기능 / 보안 (best practice)
8. **Access JWT**: `hono/jwt`(HS256, `JWT_SECRET`), payload `{sub, username, role, type:"access"}`, **만료 15분**.
9. **Refresh**: 불투명 랜덤(32B base64url), DB엔 **sha256 해시만** 저장, **사용 시마다 회전**(기존 폐기), **슬라이딩 만료 = 마지막 사용 +7일**.
10. **Reset 토큰**: 불투명 랜덤, 해시 저장, **24시간·1회용**.
11. **비밀번호 해시**: **PBKDF2(Web Crypto, SHA-256, ~100k iters, 16B salt, 32B derive)**, 저장 형식 `pbkdf2$<iters>$<saltB64>$<hashB64>`, 비교는 timing-safe `safeEqual`. 최소 길이 10자.
12. **`ADMIN_TOKEN` Bearer break-glass 유지**: 유효 JWT가 없어도 `ADMIN_TOKEN` 원문 Bearer면 root로 통과 → `apps/admin-mcp` 호환 + 루트 잠김 방지.
13. `JWT_SECRET` 미설정 시 로그인 비활성(안전한 기본값).

## 5. 설계 개요

### 데이터 모델 (D1, Drizzle 0.36 — 인덱스는 객체형 `(t)=>({...})`)
- `admin_users`: `id`(pk), `username`(unique), `name`, `passwordHash`(nullable), `role`(root|member), `status`(active|disabled, default active), `lastLoginAt`(null), `createdAt`/`updatedAt`(ISO). unique idx(username).
- `admin_refresh_tokens`: `id`, `userId`, `tokenHash`, `expiresAt`(epoch, 슬라이딩), `lastUsedAt`, `revokedAt`(null), `createdAt`. idx(userId), idx(tokenHash).
- `admin_password_reset_tokens`: `id`, `userId`, `tokenHash`, `expiresAt`(epoch), `usedAt`(null), `createdAt`. idx(tokenHash), idx(userId).

### 백엔드 (apps/intake-api, 레이어 규칙 준수)
- `lib/password.ts`(PBKDF2), `lib/tokens.ts`(opaque + JWT 래핑), `safeEqual`은 `lib/crypto.ts`로 이동해 공유.
- `services/admin-auth.ts`(ensureRootAdmin/login/refresh/logout/setPasswordByResetToken), `services/admin-members.ts`(list/create/issueReset/update/delete).
- `middleware/admin-auth.ts` 개편: JWT 검증 → `adminUser` 컨텍스트, 실패 시 `ADMIN_TOKEN` break-glass(root), 둘 다 아니면 401. bypass: OPTIONS, `/admin/session`(레거시), `/admin/auth/{login,refresh,password-reset}`. `requireRoot`로 `/admin/members/*` 보호. 핸들러는 `getAdminUser(c)` 헬퍼로 읽기.
- `routes/admin-auth.ts`, `routes/admin-members.ts`(app.ts 마운트), `schemas/admin-auth.ts`(zod `.openapi`), `env.ts`에 `JWT_SECRET?`.
- 재설정 링크 URL은 **프론트가** `${location.origin}/admin/reset?token=...`로 조립(API는 토큰만 반환).

### 프론트엔드 (apps/frontend, SSG)
- `lib/admin-auth.ts`: access/refresh/user 저장(`votatis_admin_access|refresh|user`).
- `lib/api/admin.ts`: `authHeaders`=access, **401 시 refresh 1회 후 재시도**, 실패하면 세션 클리어. 멤버/인증 API 추가.
- `app/admin/login/LoginForm.tsx`: username+password.
- `app/admin/members/{page,MembersClient}.tsx`: 목록·생성·재설정 링크 복사·비활성/삭제(비-root 숨김).
- 신규 `app/admin/reset/{page,ResetClient}.tsx`: `?token=` + `useSearchParams` + `<Suspense>`(evidence 동일 SSG 패턴).
- `AdminShell.tsx`: 사용자명 + 로그아웃, "회원" 메뉴 root 전용.
- OpenAPI 타입 동기화(`openapi:emit` → `openapi:gen`).

## 6. 완료 조건 (Acceptance Criteria)

- [x] 3개 테이블 마이그레이션 생성·로컬 적용(`migrations/0001_*.sql`).
- [x] `admin` + `ADMIN_TOKEN`으로 로그인 시 root 계정이 멱등 부트스트랩되고 access/refresh 발급.
- [x] root가 회원 생성 → 반환된 reset_token으로 비밀번호 설정 → 그 회원 로그인 성공.
- [x] refresh 호출 시 토큰 회전(기존 refresh 재사용 불가), 새 access 발급.
- [x] refresh의 `expiresAt`을 과거(>7일 미사용)로 두면 401(재로그인 요구).
- [x] reset 토큰은 1회용(2번째 사용 시 거부)·24h 만료.
- [x] 멤버 계정으로 `/admin/members` 호출 시 403, root는 200.
- [x] `ADMIN_TOKEN` Bearer가 여전히 `/admin/*`·`/admin/members` 통과(MCP 호환).
- [x] 비밀번호는 평문 미저장(PBKDF2 해시), `JWT_SECRET` 미설정 시 로그인 비활성.
- [x] 프론트: username/password 로그인 → 세션 저장 → 큐 진입, 401 시 자동 refresh, 회원관리 UI·재설정 페이지 동작.
- [x] `pnpm -r typecheck`, `pnpm -r test`(신규 인증 테스트 포함), intake-api `openapi:emit` 후 frontend `openapi:check` 통과.
- [x] spec 0008/0009 대비 회귀 없음(기존 검증 큐/판정 동작 유지).

## 7. 미해결 질문 / 리스크

- **운영 전환**: `JWT_SECRET` 운영 시크릿 발급·등록, 원격 D1 마이그레이션, 재배포는 사람 권한 필요 → `loops/HUMAN.md` 기록.
- `ADMIN_TOKEN` break-glass를 영구 유지할지(현재 유지) vs 추후 제거 — MCP가 계정 토큰으로 전환되면 재검토.
- localStorage XSS 노출 리스크는 access 단명(15분) + refresh 회전으로 완화하되 잔존(쿠키 전환은 커스텀 도메인 인프라 선행 시 재검토).

## Changelog
기능/기술이 크게 바뀐 변경만 한 줄씩. 단순 버그·오타·리팩터링은 제외.
- 2026-06-14: 최초 작성 (요청: 채팅 — 플랜 승인본 기반)
- 2026-06-14: 구현 완료 — D1 3테이블(마이그레이션 0001), PBKDF2 해시, hono/jwt access(15분)+회전 refresh(7일 슬라이딩), /admin/auth/* + root전용 /admin/members/*, ADMIN_TOKEN break-glass, 프론트 username/password 로그인·refresh 자동재시도·회원관리·/admin/reset. 단위/통합 49 + 로컬 e2e 스모크 통과. in-review 이동. (요청: 채팅)
- 2026-06-15: spec-review 통과 — 완료 조건 12/12 충족(테스트 49 + 로컬 e2e 스모크), QA 모드에서 MVP-PRD §11/§12 보완. completed 이동. (요청: 채팅)
- 2026-06-15: 회원 생성 UI를 회원목록에서 분리 — 목록의 "＋ 회원 생성" 버튼 → 별도 페이지 `/admin/members/new`에서 생성·재설정 링크 발급. (요청: 채팅)
