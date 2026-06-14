# HUMAN — 사람 개입이 필요한 일

Goal 001(`docs/goals/001.md`) 자율 수행 중, **에이전트 혼자 끝낼 수 없는 일**을 여기에 모은다.
권한·자원·법적 책임이 물리적으로 필요한 항목만 적는다(설계 판단은 에이전트가 직접 함).

해결되면 항목을 `[닫힘]`으로 바꾸고 처리 결과를 남긴다.

---

## [닫힘] 운영 ADMIN_TOKEN 시크릿 발급 + intake-api 배포 (2026-06-14)
- 처리: `.env` 의 `ADMIN_TOKEN`(강한 랜덤값)을 `scripts/cf-env.sh` 경유 `wrangler secret put ADMIN_TOKEN` 으로 운영 Worker 에 등록. intake-api 운영 배포 완료(`https://votatis-intake-api.3dulev.workers.dev`). 검증: 강한 토큰→200, dev-admin-token→401, 무토큰 admin→401, 공개 /stats→200.
- 함정: wrangler.jsonc `vars.ADMIN_TOKEN` 가 deploy 때 같은 이름 secret 을 plaintext 로 덮어써 약한 토큰이 운영에 노출됐었다 → vars 에서 제거, 로컬은 `.dev.vars`(gitignore), 운영은 secret 만. (steering [[wrangler-deploy-env]])
- 연계: MCP·프론트는 `VOTATIS_ADMIN_TOKEN`/`NEXT_PUBLIC_API_BASE_URL` 로 이 토큰·URL 사용.
- 남은 위생작업(선택): 죽은 시크릿 `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY`(0006에서 GitHub 제거) 삭제 — `wrangler secret delete`.

## [열림] D1 → 공개 데이터(/data) export 실행 + GitHub 커밋 + 정적 사이트 재빌드
- 무엇이/왜 필요한가: 검증 완료 레코드를 공개하려면 운영 D1을 대상으로 `export:data`를 돌려 `data/*.md`+`index.json`을 생성하고, GitHub에 커밋한 뒤 정적 사이트(Cloudflare Pages)를 재빌드해야 한다(spec 0011).
- 상태(2026-06-14 갱신): 원래 막던 사유(CF 자격증명·GitHub 푸시·Pages 배포 권한)는 이번 세션에 모두 확보됨(`scripts/cf-env.sh`, origin=Votatis/Votatis, Pages 운영 배포 완료) → **에이전트가 실행 가능**. 실제 블로커는 "운영 D1에 아직 검증완료 레코드가 없어 export 결과가 빈 데이터" 라는 점뿐. 검증 데이터가 쌓이면 실행한다.
- 막힌 작업: 공개 아카이브/검색/통계에 실제 데이터 노출(현재 빈 인덱스).
- 실행 액션:
  1. `API_URL=https://votatis-intake-api.3dulev.workers.dev ADMIN_TOKEN=<운영토큰> pnpm --filter votatis-intake-api export:data`
  2. 생성된 repo `data/` 를 커밋·푸시 (origin: Votatis/Votatis)
  3. Cloudflare Pages 재빌드(`bash scripts/cf-env.sh pnpm --filter votatis-frontend exec wrangler pages deploy out --branch=main`) — 프론트 build가 data/index.json을 인덱싱
- (해결되면) 이어서 진행할 것: 공개 페이지가 검증 데이터로 채워짐. 이후 정기 export 자동화(CI) 검토.

## [닫힘] 관리자 계정 인증(spec 0015) 운영 전환 — JWT_SECRET + 원격 마이그레이션 + 재배포 (2026-06-15)
- 처리: 강한 랜덤 `JWT_SECRET`(openssl rand -hex 48) → `wrangler secret put` 등록(secret list 확인). 원격 D1 마이그레이션 0001 적용(admin_users/refresh/reset). intake-api 재배포(Version a9f9ef50). frontend 운영 빌드(username/password 로그인 UI)→Pages 배포. 검증: 운영 `admin`/`ADMIN_TOKEN` 로그인→role root 부트스트랩, /admin/auth/me 200, break-glass /admin/members 200, /admin/login·/admin/reset 200.
- 남은 것(후속): 검증자 계정 발급·운영(루트가 /admin/members 에서), 감사 로그 영속화. 이메일 자동발송은 범위 외(수동 링크).
- (참고) 운영 전환 전 원문:
- 무엇이/왜 필요한가: 코드·로컬검증 완료(typecheck/test 59, 로컬 e2e 스모크 통과). 운영 가동에 사람 권한 필요.
- 실행 액션:
  1. 강한 랜덤 `JWT_SECRET` 생성 후 `bash scripts/cf-env.sh sh -c 'printf "%s" "$JWT_SECRET" | pnpm --filter votatis-intake-api exec wrangler secret put JWT_SECRET'` (또는 프롬프트 입력). `.env`/`.dev.vars` 와 별개로 운영 secret 등록.
  2. 원격 D1 마이그레이션 0001 적용: `bash scripts/cf-env.sh pnpm --filter votatis-intake-api db:migrate:remote` (admin_users/admin_refresh_tokens/admin_password_reset_tokens 생성).
  3. intake-api 재배포(`run deploy`) + frontend 재빌드·배포(로그인 UI가 username/password 로 바뀜).
  4. 첫 로그인: `admin` + 운영 `ADMIN_TOKEN`(부트스트랩) → 루트 계정 생성됨. 이후 회원 생성/재설정 링크 발급.
- 주의: JWT_SECRET 미설정 시 계정 로그인은 503 으로 잠기지만, `ADMIN_TOKEN` Bearer break-glass(+MCP)는 계속 동작 → 루트 잠김 없음.
- (해결되면) 이어서: 검증자 계정 발급·운영. 감사 로그 영속화는 후속 과제.

## [열림] (Goal 003) 예시 검증 데이터의 운영 D1·공개 아카이브 게시 승인
- 무엇이/왜 필요한가: Goal 003 항목 9는 `3dulev/votatis-data`의 실제 제보(facebook/youtube 등 실명·실출처)를 예시 데이터로 시드하고, 검토 피드백 스키마(항목 8)로 판정해 `/archive`(항목 7)에 노출하는 end-to-end 흐름을 만든다. **로컬 D1 시드·테스트·코드 작업은 에이전트가 직접 수행**한다. 그러나 그 판정 결과를 **운영 D1과 공개 아카이브(Cloudflare Pages + 공개 GitHub data 레포)에 실제로 게시**하는 것은, 실명·실제 선거 관련 주장에 대한 검증 판정을 대외 공개하는 행위라 법적·평판 책임이 따른다 → 사람 승인 필요.
- 막힌 작업: 예시/시드 데이터의 운영 게시(공개 노출). (로컬·스테이징 검증은 막히지 않음)
- 사람이 해줘야 할 구체적 액션:
  1. 어떤 예시 제보를 공개 게시 대상으로 삼을지(또는 게시는 실제 검증완료 레코드만으로 한정하고 예시는 로컬에만 둘지) 결정·승인.
  2. 승인 시: 운영 D1 시드 + `export:data` 공개 반영([열림] D1→공개 데이터 export 항목과 연계).
- (해결되면) 이어서 진행할 것: `/archive`가 실데이터로 채워지고, 예시 시드는 로컬 전용으로 분리 유지.

## [열림] (선택) Workers AI 바인딩 — 검증 보조 분석 증강
- 무엇이/왜 필요한가: 검증 보조 분석(spec 0012)은 바인딩 없이 휴리스틱으로 동작하지만, `env.AI`(Workers AI) 바인딩이 있으면 텍스트 모델로 요약/태그를 보강한다. 필수는 아니며 품질 향상용.
- 막힌 작업: AI 증강(없어도 휴리스틱은 정상 동작).
- 사람이 해줘야 할 구체적 액션: `apps/intake-api/wrangler.jsonc`에 `"ai": { "binding": "AI" }` 추가하고 Cloudflare 계정에서 Workers AI 활성화 후 배포. (요금·한도 확인)
- (해결되면) 이어서 진행할 것: `/admin/reports/{id}/analyze` 가 `source: "heuristic+ai"` 로 응답.

