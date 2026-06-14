---
tldr: wrangler 는 자격증명을 CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN 에서 읽는다(CF_* 아님). 이 레포 .env 는 CF_ACCOUNT_ID/CF_API_TOKEN 을 쓰므로, 배포·시크릿·원격 D1 마이그레이션은 `bash scripts/cf-env.sh <cmd>` 래퍼로 실행(.env→CLOUDFLARE_* 매핑). 예: `bash scripts/cf-env.sh pnpm --filter votatis-intake-api deploy`.
tags: [convention, deploy, cloudflare, wrangler, pitfall]
last_retrieved: 2026-06-14
retrieval_count: 0
---

## 규칙 / 교훈
- wrangler 인증 env 는 **`CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`**. 레포 `.env` 의 `CF_ACCOUNT_ID` / `CF_API_TOKEN` 을 그대로 두면 wrangler 가 못 읽는다.
- 그래서 자격증명 필요한 wrangler 작업은 **`scripts/cf-env.sh`** 로 감싼다(.env 로드 → `CF_*`→`CLOUDFLARE_*` export → 명령 실행):
  - 배포: `bash scripts/cf-env.sh pnpm --filter votatis-intake-api deploy`
  - 시크릿: `bash scripts/cf-env.sh pnpm --filter votatis-intake-api exec wrangler secret put ADMIN_TOKEN` (값은 프롬프트로 — 히스토리 안 남음)
  - 원격 D1: `bash scripts/cf-env.sh pnpm --filter votatis-intake-api db:migrate:remote`
- API 토큰 권한: 최소 Workers Scripts:Edit, D1:Edit (+ Pages 배포 시 Cloudflare Pages:Edit). 부족하면 403.
- `.env` 는 gitignore 됨(추적 금지). 토큰이 평문 노출되면 로테이션.

## 왜
CF_* 이름만 보고 wrangler 가 알아서 읽을 거라 가정하면 "인증 안 됨"으로 막힌다. 래퍼로 매핑하면 .env 한 곳에서 자격증명을 관리하면서 배포가 된다.

## 적용
- 운영 배포/시크릿/원격 마이그레이션은 항상 `scripts/cf-env.sh` 경유. [[frontend-pages-deploy]](Pages 배포 세부)와 함께.
