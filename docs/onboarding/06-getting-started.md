# 6. 첫 작업 — 환경 세팅부터 첫 PR까지

> 목표: 이 문서를 따라 하면 **로컬에서 앱을 띄우고, 작은 변경을 만들어 PR까지** 올릴 수 있습니다.

## 0. 미리 필요한 것

- **Node.js** (LTS 권장) 와 **pnpm** (패키지 매니저)
- **git**, GitHub 접근 권한
- (배포까지 할 거면) Cloudflare 계정 자격증명 — 보통 메인테이너가 줍니다

## 1. 설치 (처음 1회)

```bash
git clone <repo-url> Votatis
cd Votatis
pnpm install        # 모든 앱의 의존성을 한 번에 설치
```

설치가 잘 됐는지 확인:

```bash
pnpm -r typecheck   # 전체 타입 검사 (모든 앱이 Done 나오면 OK)
pnpm -r test        # 전체 테스트
```

## 2. 로컬에서 띄우기

### 백엔드 (intake-api)
처음엔 로컬 DB에 스키마를 한 번 깔아야 합니다:

```bash
# 1) 로컬 D1에 마이그레이션 적용 (최초 1회 / 스키마 바뀔 때)
pnpm --filter votatis-intake-api run db:migrate:local

# 2) 로컬 개발 서버 (CF 접근 없이 동작하는 업로드 shim 포함)
pnpm --filter votatis-intake-api dev     # = dev:local, http://localhost:8787
```

- `dev`(=`dev:local`)는 `LOCAL_UPLOAD` shim으로 **R2 없이도** 첨부 흐름이 돕니다.
- 실제 R2·D1로 테스트하려면 `dev:remote`(`wrangler dev --remote`).
- ⚠️ `wrangler dev`는 `.dev.vars`나 바인딩을 바꾸면 **재시작해야** 반영됩니다
  ([steering/intake-api-local-flow-test](../../steering/intake-api-local-flow-test.md)).

### 프론트엔드 (frontend)

```bash
pnpm --filter votatis-frontend dev       # http://localhost:3000
```

- ⚠️ 프론트(3000)에서 백엔드를 부르려면 intake-api의 `ALLOWED_ORIGIN`에
  `http://localhost:3000`이 있어야 CORS가 통과합니다. 안 맞으면
  "API는 200인데 브라우저만 실패"가 납니다
  ([steering/web-dev-port-cors](../../steering/web-dev-port-cors.md)).

### AI 검증 도구 (admin-mcp)

```bash
pnpm --filter votatis-admin-mcp run build   # tsc → dist/
```

- 로컬에서 stdio로 연결해 씁니다. 운영 등록·Origin 설정 등은
  [`docs/mcp-usage.md`](../mcp-usage.md)와
  [steering/admin-mcp-origin-gate](../../steering/admin-mcp-origin-gate.md) 참고.

## 3. 변경할 때 알아둘 것

- **백엔드 API를 바꿨다면** → 프론트 타입을 다시 생성하세요:
  ```bash
  pnpm --filter votatis-intake-api run openapi:emit   # openapi.json 갱신
  pnpm --filter votatis-frontend  run openapi:gen     # schema.d.ts 갱신
  ```
- **검증 상태(status) 값을 추가/변경**한다면 손댈 곳이 여러 군데입니다 — 먼저
  [steering/report-status-enum-locations](../../steering/report-status-enum-locations.md)를 읽으세요.
- **작업 전 [steering](05-steering.md) 인덱스를 훑어** 관련 함정이 있는지 확인하세요.

## 4. 커밋 & PR (브랜치 전략)

전체 규칙은 [`docs/branch-commit-strategy.md`](../branch-commit-strategy.md). 핵심만:

```bash
# 1) 최신 main에서 토픽 브랜치 따기
git switch -c feat/0017-my-feature main

# 2) 작업하고 커밋 (1커밋 = 1논리 변경, 한글 메시지)
git commit -m "feat(frontend): 무엇을 했는지 (spec: 0017)"

# 3) push 후 PR 열기
git push -u origin feat/0017-my-feature
gh pr create --title "feat(frontend): ..." --body "무엇을/왜"
```

규칙:
- **main에 직접 push 금지.** 모든 변경은 PR로.
- 커밋 형식: `<type>(<scope>): <한글 설명> (spec: <id>)`,
  type = `feat / fix / refactor / docs / chore / ops / steering`.
- **머지는 사람만** 합니다(Merge commit). AI는 머지하지 않습니다.
- 머지되면 토픽 브랜치는 삭제합니다.

## 5. 마무리 체크리스트

작업을 끝내기 전에:

- [ ] `pnpm -r typecheck` 통과
- [ ] `pnpm -r test` 통과
- [ ] 동작/구조가 바뀌었으면 관련 **스펙 Changelog** 한 줄 + frontmatter `updated`
- [ ] 새 교훈·함정이 생겼으면 **steering** 기록 + 인덱스 동기화
- [ ] (배포까지면) intake-api/frontend 배포 — 절차는
      [steering/wrangler-deploy-env](../../steering/wrangler-deploy-env.md),
      [steering/frontend-pages-deploy](../../steering/frontend-pages-deploy.md)

## 막히면

- 전역 규칙: 루트 [`CLAUDE.md`](../../CLAUDE.md)
- 제품 배경: [`docs/MVP-PRD.md`](../MVP-PRD.md), [`docs/PERSONA.md`](../PERSONA.md)
- 과거 함정: [`steering/`](../../steering/) 폴더 (특히 인덱스 README)

환영합니다 — 이제 첫 스펙을 만들어 보세요! → [04-spec-driven-development.md](04-spec-driven-development.md)
