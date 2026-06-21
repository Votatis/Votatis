# 1. 개발 스택 — 무엇으로 만들어졌나

> 비유: 이 프로젝트는 **요리 식당** 같아요. 주방(백엔드), 손님이 보는 홀(웹사이트),
> 그리고 주방을 돕는 보조 로봇(AI 도구)으로 나뉩니다. 셋 다 한 건물(모노레포) 안에 있어요.

## 0. 큰 그림: 모노레포

**모노레포**는 여러 개의 앱을 **하나의 git 저장소**에 모아 두는 방식입니다.

```
Votatis/                  ← 저장소 루트 (여기엔 공통 설정·문서만)
├── apps/
│   ├── intake-api/       ← 백엔드 (주방)
│   ├── frontend/         ← 웹사이트 (홀)
│   └── admin-mcp/        ← AI 검증 도구 (보조 로봇)
├── specs/                ← 기능 설계 문서 (레시피)
├── steering/             ← 실수 노트 / 교훈
├── docs/                 ← 일반 문서 (지금 보고 있는 곳)
├── pnpm-workspace.yaml   ← "apps/* 를 한 묶음으로 관리" 선언
└── CLAUDE.md             ← 프로젝트 전역 규칙(필수 정책)
```

- 패키지 매니저는 **pnpm** (npm/yarn 같은 거).
- `pnpm-workspace.yaml`이 `apps/*`를 워크스페이스로 묶습니다.
- **전체**를 다룰 땐 `pnpm -r <명령>` (r = recursive, 모든 앱에).
- **하나**만 다룰 땐 `pnpm --filter <패키지명> <명령>`.
  - 패키지명: `votatis-intake-api`, `votatis-frontend`, `votatis-admin-mcp` (각 `package.json`의 `name`).

> ⚠️ 새 앱은 루트가 아니라 반드시 `apps/<이름>/` 아래에 추가합니다.

---

## 1. `apps/intake-api` — 백엔드 (주방)

제보를 받고, 저장하고, 검증 상태를 관리하는 **API 서버**입니다.

| 무엇 | 기술 | 한 줄 설명 |
|------|------|-----------|
| 실행 환경 | **Cloudflare Workers** | 서버를 직접 안 굴리고 엣지에서 도는 서버리스 |
| 웹 프레임워크 | **Hono** + **@hono/zod-openapi** | 가벼운 라우터. 입출력을 zod로 검증하며 OpenAPI 문서를 자동 생성 |
| DB | **Cloudflare D1** (SQLite) + **Drizzle ORM** | 제보 데이터 저장. Drizzle로 타입 안전하게 쿼리 |
| 파일 저장소 | **Cloudflare R2** | 증거 이미지(첨부) 보관. S3 호환 |
| 검증(밸리데이션) | **zod** | 들어오는 데이터 모양을 강제 |
| 테스트 | **vitest** + `@cloudflare/vitest-pool-workers` | 실제 Worker 런타임에서 테스트 |
| 배포 도구 | **wrangler** | Cloudflare에 배포·DB 마이그레이션 |

특징:
- 정기 작업(**cron**)이 30분마다 돌며 미완료 제보를 청소합니다.
- 관리자 인증은 **JWT(access/refresh)** 기반.
- `src/`는 레이어 구조: `routes / services / domain / schemas / middleware / lib / db`
  (루트에 파일 평면 배치 금지 — [steering/intake-api-src-layering](../../steering/intake-api-src-layering.md)).

---

## 2. `apps/frontend` — 웹사이트 (홀)

제보자가 제보를 넣고, 누구나 검증된 아카이브를 보는 **웹사이트**입니다.

| 무엇 | 기술 | 한 줄 설명 |
|------|------|-----------|
| 프레임워크 | **Next.js 16** (App Router, **SSG**) | 빌드 시 정적 HTML을 미리 만들어 둠(`output: export`) |
| UI 라이브러리 | **React 19** | 화면 컴포넌트 |
| 스타일 | **Tailwind CSS v4** | 유틸리티 클래스 기반 CSS |
| API 호출 | **openapi-fetch** + **openapi-typescript** | 백엔드 `openapi.json`에서 타입을 생성해 타입 안전하게 호출 |
| EXIF 추출 | **exifr** | 업로드 전 사진 메타데이터를 클라이언트에서 읽음 |
| 봇 차단 | **Cloudflare Turnstile** | 제보 폼 스팸 방지 |
| 배포 | **Cloudflare Pages** | 정적 사이트 호스팅 |

특징:
- **SSG(정적 생성)**라 빌드 시점에 페이지가 굳습니다. 그래서
  `NEXT_PUBLIC_*` 환경변수는 **빌드할 때** 값이 박힙니다([06-getting-started](06-getting-started.md) 참고).
- 백엔드 타입은 **자동 생성**됩니다: `pnpm --filter votatis-frontend run openapi:gen`
  → `src/lib/api/schema.d.ts` 갱신. (직접 수정 금지)

> ⚠️ 이 Next.js는 버전이 높아 일반적인 Next 지식과 다를 수 있습니다.
> 코드 작성 전 `apps/frontend/AGENTS.md`를 확인하세요.

---

## 3. `apps/admin-mcp` — AI 검증 도구 (보조 로봇)

관리자 API를 **AI(Claude Code 등)가 쓸 수 있는 도구**로 감싼 **MCP 서버**입니다.
사람이 검증 큐를 일일이 클릭하는 대신, AI에게 "검증 큐 보여줘 / 이 제보 판정해줘"라고
시킬 수 있게 해줍니다.

| 무엇 | 기술 | 한 줄 설명 |
|------|------|-----------|
| 런타임 | **Node.js** | 로컬에서 도는 프로그램 |
| 프로토콜 | **@modelcontextprotocol/sdk** (stdio) | AI 에이전트와 표준입출력으로 통신 |
| 검증 | **zod** | 도구 입력 스키마 |
| 빌드 | **tsc** → `dist/` | TypeScript를 JS로 컴파일 |
| 테스트 | **node:test** + tsx | 가드레일(판정 규칙) 단위 테스트 |

특징:
- intake-api의 **관리자 API를 그대로 호출**합니다(검증 로직의 단일 출처는 백엔드).
- 도구 예: `list_review_queue`(검토 큐), `get_report`(상세), `view_attachment`(증거 이미지),
  `record_verdict`(판정 기록), `analyze_report`(보조 신호).
- 원격 배포 대상이 아니라 **로컬에서 실행**합니다(`tsc`로 빌드 후 stdio 연결).

---

## 다음 → [02-architecture.md](02-architecture.md): 이 셋이 어떻게 맞물려 도는지
