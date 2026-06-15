---
tldr: wrangler 자격증명은 CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN(CF_* 아님) → .env 의 CF_* 는 `bash scripts/cf-env.sh <cmd>` 로 매핑. ⚠️배포는 `pnpm --filter <pkg> run deploy`(run 없으면 pnpm 내장 deploy와 충돌). ⚠️secret 이름을 wrangler.jsonc `vars` 에 두지 말 것 — deploy 가 plaintext var 로 동명 secret 을 덮어쓴다(로컬은 .dev.vars, 운영은 secret).
tags: [convention, deploy, cloudflare, wrangler, pitfall, secrets]
last_retrieved: 2026-06-15
retrieval_count: 7
---

## 규칙 / 교훈

### 1) 자격증명 매핑
- wrangler 인증 env 는 **`CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`**. 레포 `.env` 는 `CF_ACCOUNT_ID`/`CF_API_TOKEN` 이라 그대로면 wrangler 가 못 읽음.
- → **`scripts/cf-env.sh`** 래퍼로 실행(.env 로드 → `CF_*`→`CLOUDFLARE_*` export):
  - 배포: `bash scripts/cf-env.sh pnpm --filter votatis-intake-api run deploy`
  - 시크릿: `bash scripts/cf-env.sh sh -c 'printf "%s" "$ADMIN_TOKEN" | pnpm --filter votatis-intake-api exec wrangler secret put ADMIN_TOKEN'` (또는 프롬프트 입력)
  - 원격 D1: `bash scripts/cf-env.sh pnpm --filter votatis-intake-api db:migrate:remote`
- API 토큰 권한: 최소 Workers Scripts:Edit, D1:Edit (+ Pages 배포 시 Cloudflare Pages:Edit). 부족하면 403.

### 2) `run deploy` (pnpm 내장 충돌)
`pnpm --filter <pkg> deploy` 는 pnpm 내장 `deploy` 명령으로 가서 `ERR_PNPM_INVALID_DEPLOY_TARGET`. 반드시 **`run deploy`**. (test/start 는 alias 라 괜찮지만 deploy 는 충돌) — [[pnpm-filter-run-script]]

### 3) secret 이름을 vars 에 두지 말 것 (보안 함정)
wrangler.jsonc `vars` 에 secret 과 **같은 이름**(예: `ADMIN_TOKEN`)을 두면, `wrangler deploy` 가 그 plaintext var 로 동명 secret 을 **덮어쓴다**. 실제로 약한 `dev-admin-token` 이 운영에 노출됐었다(강한 토큰 secret 이 무력화). 
- 해결: vars 에서 제거 → **로컬 기본값은 `.dev.vars`(gitignore)**, **운영은 `wrangler secret put`** 만. 둘은 같은 이름이어도 vars 에만 없으면 충돌 안 남.
- 검증: `wrangler secret list` 에 이름이 보여야 secret(이 안 보이고 deploy 출력 Vars 에 보이면 plaintext 로 덮인 것). 운영 동작은 강한 토큰→200 / 약한 토큰→401 로 확인.

## 왜
CF_* 가정·`deploy` 직접호출·vars/secret 동명 충돌은 각각 "인증 실패 / pnpm 에러 / 운영 시크릿 무력화(보안)"로 이어지는데 증상이 멀어 디버깅이 길다.

## 적용
- 운영 배포/시크릿/원격 마이그레이션은 항상 `scripts/cf-env.sh` + `run deploy`.
- 새 시크릿은 vars 금지, `.dev.vars`(로컬)+`wrangler secret put`(운영). [[frontend-pages-deploy]] 와 함께.
