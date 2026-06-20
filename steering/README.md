# Steering — 프로젝트 지식 저장소

작업 중 발견한 **규칙**·**반복 금지 실수**·**비자명한 결정**을 파일 하나당 한 건씩 누적하는 곳.
파일 한 개 = 교훈 한 건(`steering/<kebab-case>.md`). 이 README의 **인덱스 표**가 실제 파일 목록과 항상 일치해야 한다.

> **토큰 효율(중요)**: SessionStart에는 이 README 전체가 아니라 **인덱스 표의 `파일 — tldr`만** 주입된다
> (`.claude/hooks/steering-index.sh`). 행동 정책 전문은 CLAUDE.md(항상 주입)에 있으니 여기서 중복하지 않는다.
> 그러므로 **tldr는 한 줄로 간결하게**(매 세션 주입되는 비용) 유지하라.

## 운영 규칙 (요약 — 전문은 CLAUDE.md `## Steering` 정책)

- **캡처**: 합의된 규칙/컨벤션, 저지른 실수+회피법, 코드·git·PRD로 알 수 없는 비자명한 결정. 일회성·자명한 사실은 저장 안 함.
- **형식**: frontmatter(`tldr`, `tags`, `last_retrieved`, `retrieval_count`) + 본문(규칙/왜/적용). tldr는 frontmatter와 README 행을 일치시킨다.
- **회수 통계**: 참조·적용한 항목은 `retrieval_count +1`, `last_retrieved`=오늘 — 파일과 README 행 함께.
- **인덱스 동기화**: 파일 추가/수정/삭제 시 아래 표를 즉시 맞춘다.
- **폐기(가지치기)**: 기술 스택 교체 등으로 더는 맞지 않는 항목은 삭제한다(예: Astro→Next 전환으로 Astro 전용 힌트 제거). 단, "아직 안 쓰였을 뿐(retrieval_count 0)"인 유효 항목은 지우지 않는다.

## 인덱스

| 파일 | tldr | tags | 마지막 회수 | 회수 |
|------|------|------|------------|------|
| [cloudflare-vitest-pool-workers-setup.md](cloudflare-vitest-pool-workers-setup.md) | Worker 테스트 셋업 함정: nodejs_compat 플래그, isolatedStorage:false, pnpm onlyBuiltDependencies, D1은 readD1Migrations+applyD1Migrations로 스키마 주입. | pitfall, cloudflare, testing, pnpm, d1 | 2026-06-14 | 3 |
| [monorepo-apps-layout.md](monorepo-apps-layout.md) | 코드는 apps/&lt;name&gt;/ 아래 pnpm workspace로. 루트는 specs/steering/docs/공통설정만. | convention, project, monorepo, pnpm | 2026-06-14 | 6 |
| [pnpm-filter-run-script.md](pnpm-filter-run-script.md) | package.json의 deploy 같은 스크립트는 `pnpm --filter <pkg> run deploy`로. run 없이 쓰면 pnpm 내장 deploy와 충돌. | pitfall, pnpm, monorepo | 2026-06-14 | 7 |
| [intake-api-src-layering.md](intake-api-src-layering.md) | intake-api/src는 routes/services/domain/schemas/middleware/lib/db 레이어 구조(루트 평면 파일 금지). 라우트/스키마 리팩터링 계약 불변은 `diff <(jq -S openapi.old) <(jq -S openapi.new)`=0 으로 증명. | convention, architecture, intake-api, refactor, openapi | 2026-06-14 | 1 |
| [hono-zod-openapi-route-responses.md](hono-zod-openapi-route-responses.md) | @hono/zod-openapi 핸들러가 c.json 으로 낼 수 있는 모든 status(공유 HttpError 유니온 포함)를 createRoute responses 에 선언해야 타입 통과. 공유 responses 객체에 `as const` 붙이면 json content 추론 깨져 200 외 거부 → as const 빼라. 에러 매핑은 인라인 try/catch. | pitfall, hono, openapi, typescript, intake-api | 2026-06-15 | 2 |
| [mcp-server-build.md](mcp-server-build.md) | MCP 서버는 apps/&lt;name&gt;/에 Node+@modelcontextprotocol/sdk(stdio). 도구는 registerTool(name,{description,inputSchema:ZodRawShape},cb)→content[]. 빌드 tsc→dist(shebang), 단위 node:test+tsx, 실연결 smoke는 SDK Client+StdioClientTransport. | convention, mcp, nodejs, testing | 2026-06-14 | 0 |
| [korea-region-dataset.md](korea-region-dataset.md) | 전국 행정구역 데이터: 분동·생활단위는 행정동, '리'는 법정동. 행정동은 juso administrationCode.tsv로 생성. 산출물 apps/frontend/src/data/regions.*.json. | reference, data, korea-region | 2026-06-10 | 2 |
| [intake-api-local-flow-test.md](intake-api-local-flow-test.md) | intake-api 로컬: dev:local(LOCAL_UPLOAD shim, CF 없이) vs dev:remote(실 R2·D1); db:migrate:local 선적용. 함정: wrangler dev는 .dev.vars/바인딩 변경 시 재시작 필수. | pitfall, testing, cloudflare, intake-api, d1 | 2026-06-14 | 10 |
| [spec-workflow-rules-go-in-skill.md](spec-workflow-rules-go-in-skill.md) | 스펙 스킬(spec-create/implement/review)의 워크플로우 규칙은 steering이 아니라 해당 SKILL.md 본문에 둔다. | convention, workflow, spec, steering | 2026-06-10 | 2 |
| [web-dev-port-cors.md](web-dev-port-cors.md) | Next dev 포트 3000 = intake-api ALLOWED_ORIGIN 이어야 CORS 통과. 불일치면 'API 200인데 브라우저만 실패' → --var ALLOWED_ORIGIN으로 맞춤. | pitfall, cors, frontend, intake-api | 2026-06-15 | 7 |
| [cors-allow-methods-new-verb.md](cors-allow-methods-new-verb.md) | 새 HTTP 메서드(DELETE 등) 라우트 추가 시 cors.ts 의 preflight allow-methods + isWriteMethod 둘 다에 추가해야. 안 하면 브라우저 preflight 가 막는데 vitest 는 worker.fetch 직접호출(preflight 없음)이라 통과 → 테스트 초록인데 브라우저만 깨짐. | pitfall, cors, intake-api, frontend, testing | 2026-06-15 | 1 |
| [hono-raw-response-skips-cors-header.md](hono-raw-response-skips-cors-header.md) | Hono 핸들러가 new Response() 직접 반환 시 corsMiddleware 의 c.header() ACAO 가 미계승 → 스트리밍/바이너리 응답은 핸들러에서 ACAO 직접 부여. vitest 는 통과해도 브라우저만 깨짐. | pitfall, cors, hono, intake-api, streaming | 2026-06-15 | 0 |
| [react-ime-composing-enter.md](react-ime-composing-enter.md) | React 입력에서 한글 IME 조합 중 Enter는 조합 확정용 → onKeyDown 맨 앞 ev.nativeEvent.isComposing이면 return. 안 하면 자동완성 선택과 충돌해 "내손2동동"처럼 글자 겹침. | pitfall, react, korean, ime | 2026-06-10 | 1 |
| [tailwind-variant-precedence.md](tailwind-variant-precedence.md) | Tailwind에서 같은 속성 유틸(bg-white vs bg-gray-100)을 className에 같이 넣으면 문자열 순서 무관, CSS source order가 이김. 조건부 상태 배경은 disabled:/hover: 변이로 specificity↑시켜 base를 이기게. | pitfall, tailwind, css, web | 2026-06-10 | 0 |
| [gh-pr-edit-projectcards-bug.md](gh-pr-edit-projectcards-bug.md) | `gh pr edit`이 Projects classic deprecated GraphQL(projectCards) 오류로 실패하면, 본문 수정은 `gh api -X PATCH /repos/<o>/<r>/pulls/<n> --input <json>`으로 우회. | pitfall, github, gh-cli | 2026-06-15 | 3 |
| [github-issues-validation-queue-deprecated.md](github-issues-validation-queue-deprecated.md) | GitHub Issues 검증 큐 완전 폐기. 모든 검증/저장은 Cloudflare D1으로만 처리. 관리자 페이지 UI에서 검수. GitHub 레포는 공개 데이터 배포용으로만 사용. | decision, architecture, github, d1, deprecated | 2026-06-15 | 1 |
| [drizzle-d1-schema-gotchas.md](drizzle-d1-schema-gotchas.md) | drizzle-orm 0.36(D1)에서 인덱스 extraConfig는 배열이 아니라 객체형 `(t)=>({...})`(배열형은 TS2769). 마이그레이션은 drizzle-kit generate→wrangler d1 migrations apply. | pitfall, drizzle, d1, cloudflare | 2026-06-15 | 2 |
| [gitignore-lib-catches-src-lib.md](gitignore-lib-catches-src-lib.md) | 루트 .gitignore(파이썬 템플릿)의 `lib/`가 apps/*/src/lib 소스까지 무시 → 새 앱 src/lib는 미추적되니 `!apps/<app>/src/lib/` 예외 추가. 머지한 upstream frontend도 src/lib 누락 피해(빌드 실패) 가능. | pitfall, git, gitignore, monorepo, web | 2026-06-10 | 1 |
| [nextjs-static-export-dynamic-routes.md](nextjs-static-export-dynamic-routes.md) | Next 16 output:export 동적 라우트 generateStaticParams 빈 배열 불가 → sentinel 1개+dynamicParams=false. 빌드타임에 모르는 런타임 id는 `?id=` 쿼리+useSearchParams(Suspense). 에러가 라우트 번갈아 뜨면 .next 캐시 의심. | pitfall, nextjs, ssg, frontend | 2026-06-15 | 2 |
| [nextjs-route-dir-move-relative-imports.md](nextjs-route-dir-move-relative-imports.md) | app/ 라우트 디렉터리 git mv 시: 함께 안 옮긴 형제(app-shell.css)로의 상대 import는 ../ 한 단계 줄여야(같이 옮긴 mock.css는 그대로). 경로문자열은 /free/→/ 치환, import는 별개. 빌드가 옛 경로 가리키면 rm -rf .next. zsh는 for f in $files word-split 안 됨→while read. | pitfall, nextjs, frontend, refactor, build | 2026-06-14 | 1 |
| [frontend-pages-deploy.md](frontend-pages-deploy.md) | apps/frontend SSG→Pages 배포: NEXT_PUBLIC_* 4개(API_BASE_URL/TURNSTILE_SITEKEY/ELECTION/R2_PUBLIC_URL) 빌드타임 주입, `wrangler pages deploy out --branch=main`, preview origin은 CORS 막힘, Turnstile domains에 votatis-web.pages.dev 추가. | pitfall, deploy, cloudflare-pages, frontend, cors | 2026-06-20 | 9 |
| [wrangler-deploy-env.md](wrangler-deploy-env.md) | wrangler 자격증명은 CLOUDFLARE_*(CF_* 아님)→`scripts/cf-env.sh` 매핑. 배포는 `run deploy`(pnpm 내장 충돌). secret 이름을 wrangler.jsonc vars 에 두면 deploy 가 secret 을 plaintext 로 덮어씀 → 로컬 .dev.vars/운영 secret. | convention, deploy, cloudflare, wrangler, pitfall, secrets | 2026-06-19 | 9 |
| [r2-object-put-evidence-upload.md](r2-object-put-evidence-upload.md) | wrangler v3 r2 object put 은 --remote 없음(기본 원격, --local 만). r2 object list 도 없어 버킷 전수 나열 불가(get/put/delete만)→객체 열거는 D1 r2_key 원천 or CF API/S3. 증거 키는 D1 attachments.r2_key 와 정확히 일치해야 admin 스트리밍이 찾음. | pitfall, cloudflare, r2, wrangler, intake-api | 2026-06-19 | 1 |
| [admin-refresh-token-rotation-race.md](admin-refresh-token-rotation-race.md) | 회전형 refresh 토큰 + 동시 401 → 각자 refresh 하다 폐기된 토큰으로 실패 → 억울한 재로그인. 프론트 refresh 는 single-flight 로. | pitfall, auth, frontend, jwt, race-condition | 2026-06-15 | 0 |
| [admin-mcp-origin-gate.md](admin-mcp-origin-gate.md) | intake-api 는 /admin/* 모든 메서드를 ALLOWED_ORIGIN 으로 막음(cors.ts). admin-mcp 는 서버-서버라도 Origin 헤더 보내야 통과 → 운영 등록 시 VOTATIS_ORIGIN=https://votatis-web.pages.dev 필수, 안 보내면 admin 도구 전부 403. Node fetch 는 Origin 수동설정 가능. 운영 토큰은 --scope local 로(.mcp.json 커밋 금지). | pitfall, cors, admin-mcp, intake-api, mcp, origin | 2026-06-19 | 0 |
| [election-report-verdict-discipline.md](election-report-verdict-discipline.md) | 검증 큐 판정은 fact(검증가능 관측)와 claim(과잉해석)을 분리. 숫자가 실제로 변했으면 debunked(거짓) 아님→disputed. confirmed는 부정선거 단정이라 금지. 주의: 선관위 투·개표 API 검증절차(data.go.kr)와 홈페이지 실시간 표출값은 별개 계통—API로 표출값 증감 설명 금지(범주오류). 마감값이 올랐다내렸다 증감은 의심 정황. evidence_links 날조 금지. | votatis-admin, mcp, verdict, election, persona5 | 2026-06-19 | 2 |
| [evidence-image-public-serving.md](evidence-image-public-serving.md) | 공개 아카이브 증거 이미지 경로 2가지 — R2 public 직접(NEXT_PUBLIC_R2_PUBLIC_URL+r2_key) vs Worker 스트리밍(PUBLISHABLE 게이트). 갤러리는 env 있으면 R2직접, 없으면 폴백. ⚠️R2 public 켜지면 버킷 객체 상태무관 전부 공개→게이트 무의미. r2_key는 한글·공백 포함이라 세그먼트별 encodeURIComponent. | decision, r2, frontend, intake-api, privacy, archive | 2026-06-20 | 1 |
| [report-status-enum-locations.md](report-status-enum-locations.md) | 제보 검증 status 값 추가/변경 시 손댈 곳 — 단일출처는 intake-api/src/constants.ts. 단 프론트는 별도 복제본(types.ts + 컴포넌트 로컬 STATUS_CHIP_CLASS 3곳 + CSS c-<suffix> + 필터/통계 목록)이라 자동 전파 안 됨. status 컬럼은 자유 텍스트→D1 마이그레이션 불요. openapi:emit→openapi:gen 재생성 + MCP 재시작 필수. | convention, status, intake-api, frontend, admin-mcp, openapi | 2026-06-19 | 1 |
