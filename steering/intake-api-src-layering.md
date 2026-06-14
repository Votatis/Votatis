---
tldr: intake-api/src 는 레이어 구조 — routes/(HTTP)·services/(로직)·domain/(순수변환)·schemas/·middleware/·lib/(인프라)·db/ + 루트(app·index·env·constants·router). 새 엔드포인트는 routes+service로 추가하고 src 루트에 평면 파일 만들지 말 것. 라우트/스키마 리팩터링이 HTTP 계약을 안 깼는지는 `openapi:emit` 후 `diff <(jq -S . old.json) <(jq -S . new.json)` 가 0인지로 증명(키 순서만 바뀌고 내용 동일).
tags: [convention, architecture, intake-api, refactor, openapi]
last_retrieved: 2026-06-14
retrieval_count: 0
---

## 규칙 / 교훈

### 1. src 레이어 구조 (spec 0013)
`apps/intake-api/src` 는 책임별 레이어로 둔다. src 루트에 평면적으로 파일을 쌓지 않는다.
- `routes/` — OpenAPIHono sub-app(도메인별). createRoute 정의 + thin 핸들러(검증된 입력을 service에 위임).
- `services/` — 비즈니스 로직(D1 접근 포함).
- `domain/` — 순수 변환(매퍼·휴리스틱·직렬화). 런타임/바인딩 비의존.
- `schemas/` — 도메인별 Zod 스키마 + `index.ts` 배럴.
- `middleware/` — cors·admin-auth.
- `lib/` — 인프라 유틸(crypto·media·http·turnstile·ratelimit·r2-presign).
- `db/` — drizzle client·schema.
- 루트: `app.ts`(조립만), `index.ts`(entry), `env.ts`(Env 타입), `constants.ts`(상태·미디어 상수 단일 출처), `router.ts`(공용 `createRouter()` = defaultHook 단 OpenAPIHono).

**새 엔드포인트**: `routes/<domain>.ts` 에 라우트 + `services/<domain>.ts` 에 로직. 라우트는 `app.route("/", xxxRoutes)` 로 마운트(루트 미들웨어 자동 적용, OpenAPI 정의 자동 병합).

### 2. 라우트/스키마 리팩터링 계약 불변 증명
라우트를 옮기거나 스키마 파일을 쪼개면 생성 `openapi.json` 의 **키 순서**가 바뀌어 byte diff 는 거의 항상 난다. 계약이 진짜 그대로인지는 **정렬 비교**로 판정한다:
```
cp openapi.json /tmp/base.json        # 리팩터링 전 스냅샷
# ...리팩터링...
pnpm --filter votatis-intake-api openapi:emit
diff <(jq -S . /tmp/base.json) <(jq -S . openapi.json)   # 0 이면 계약 불변
```
0 이면 프론트 타입(`openapi:gen`)도 재생성해 동기화하고 커밋(생성물 키 순서만 바뀜).

## 왜
- 평면 20파일은 app.ts(369줄)·admin.ts(319줄)에 라우트·로직·매퍼·인증·상수가 뒤섞여 변경 영향 파악이 어려웠다. 레이어 분리로 한 파일 = 한 책임.
- 순수 리팩터링의 안전 증명은 "테스트 통과"만으론 부족하고, 외부 HTTP 계약(OpenAPI)이 동일함을 정렬 비교로 못 박으면 회귀 위험이 거의 0이 된다.

## 적용
- intake-api에 코드 추가 시 위 레이어에 맞춰 배치. src 루트 평면 파일 금지.
- 라우트/스키마 구조 변경 PR은 `jq -S` openapi diff = 0 을 근거로 첨부.
- 상태값·MIME·크기 상수는 `constants.ts` 한 곳에서만 정의(중복 금지). [[monorepo-apps-layout]] 는 앱 배치, 이건 앱 내부 구조.
