---
tldr: 제보 검증 status 값 추가/변경 시 손댈 곳 — 단일출처는 intake-api/src/constants.ts(REPORT/ADMIN/PUBLISHABLE/JUDGED_STATUSES). 단 프론트는 별도 복제본(types.ts + 컴포넌트 로컬 STATUS_CHIP_CLASS 3곳 + CSS c-<suffix> + 필터/통계 목록)이라 자동 전파 안 됨. status 컬럼은 자유 텍스트→D1 마이그레이션 불요. openapi:emit→openapi:gen 재생성 필수.
tags: [convention, status, intake-api, frontend, admin-mcp, openapi]
last_retrieved: 2026-06-19
retrieval_count: 1
---

## 규칙 / 교훈
제보 검증 status(unverified/reviewing/confirmed/suspected/disputed/debunked/corrected 등) 값을 추가·변경할 때 일관되게 손봐야 하는 위치. 한 곳이라도 빠지면 "타입은 통과인데 칩이 안 뜨거나, MCP가 거부"한다.

### 1. intake-api — 사실상 단일 출처
- `apps/intake-api/src/constants.ts`: `REPORT_STATUSES`(전체) / `ADMIN_STATUSES` / `PUBLIC_STATUSES`(=REPORT−pending, filter로 파생) / `PUBLISHABLE_STATUSES` / `JUDGED_STATUSES`(근거 필수 집합).
- 서버 가드레일: `apps/intake-api/src/services/admin.ts`의 `JUDGED_STATUSES.has(targetStatus)` 블록. 상태별 추가 필수필드(예: confirmed→status_scope/confirmed_scope, suspected→missing_evidence≥1)는 여기 if 분기로 강제.
- zod 스키마는 위 상수를 z.enum 으로 참조(`schemas/reports.ts`=PUBLIC, `schemas/admin.ts`=ADMIN) → **소스만 고치면 OpenAPI에 자동 반영**.
- `db/schema.ts`의 status 는 `text().notNull()` **자유 텍스트(CHECK 없음)** → 값 추가 시 **D1 마이그레이션 불필요**(주석만 갱신).

### 2. admin-mcp — 별도 복제본(자동 전파 X)
- `apps/admin-mcp/src/verdict.ts`: `ADMIN_STATUSES`·`JUDGED_STATUSES`·`validateVerdict`(상태별 가드레일을 intake-api와 이중으로). `VerdictInput`에 필요 필드 추가.
- `apps/admin-mcp/src/tools.ts`: record_verdict/list_review_queue/list_publishable **description 문자열**에 박힌 status 나열도 수정. record_verdict는 `z.enum(ADMIN_STATUSES)`로 막으므로 값 누락 시 호출 거부.
- 빌드 `tsc`. ⚠️ stdio MCP라 **재빌드해도 실행 중 세션엔 반영 안 됨 → MCP 서버 재시작(reload) 필요**.

### 3. frontend — 또 다른 복제본(자동 전파 X)
- `apps/frontend/src/lib/types.ts`: `VerifyStatus` 유니온 + `STATUS_LABEL`(한글 라벨) + `STATUS_CHIP`.
- **컴포넌트 로컬 `STATUS_CHIP_CLASS` 복제본 3곳**: `app/archive/ArchiveClient.tsx`, `app/admin/queue/QueueClient.tsx`, `components/archive/ArchiveDetail.tsx`(suffix가 types.ts와 다름: confirmed→cnf 등 → 실제 CSS `chip c-<suffix>`).
- **CSS 칩 색**: `app/app-shell.css` + `app/landing.css` 양쪽에 `.c-<suffix>`/`.c-<suffix> .pt` 추가.
- **필터/정렬/통계 목록**: `archive/ArchiveClient`(STATUSES), `admin/evidence/EvidenceClient`(STATUSES+JUDGED), `admin/dashboard/DashboardClient`(ORDER), `stats/page`(STATUSES), `lib/archive-source.ts`(PUBLISHABLE Set), `admin/queue/QueueClient`(카운트 합산 타일).
- 생성물 `lib/api/schema.d.ts`는 직접 수정 금지 → 재생성.

### 절차(순서)
1. constants.ts 등 소스 수정 → 2. `pnpm --filter votatis-intake-api run openapi:emit`(openapi.json) → 3. `pnpm --filter votatis-frontend run openapi:gen`(schema.d.ts) → 4. 프론트 복제본·CSS·목록 수정 → 5. `pnpm -r typecheck && pnpm -r test` → 6. 배포(intake-api: [[wrangler-deploy-env]], frontend: [[frontend-pages-deploy]]) → 7. MCP 재시작.

연관: [[election-report-verdict-discipline]], [[hono-zod-openapi-route-responses]], [[mcp-server-build]].
