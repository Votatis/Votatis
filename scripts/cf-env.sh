#!/usr/bin/env bash
# .env 의 CF_ACCOUNT_ID / CF_API_TOKEN 을 wrangler 가 읽는 CLOUDFLARE_* 로 매핑해 명령을 실행한다.
# (wrangler 는 CF_* 가 아니라 CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN 을 읽음)
#
# 사용:
#   bash scripts/cf-env.sh pnpm --filter votatis-intake-api deploy
#   bash scripts/cf-env.sh pnpm --filter votatis-intake-api exec wrangler secret put ADMIN_TOKEN
#   bash scripts/cf-env.sh pnpm --filter votatis-intake-api db:migrate:remote
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"
[ -f "$ENV_FILE" ] || { echo "cf-env: ${ENV_FILE} 없음" >&2; exit 1; }

# .env 로드(단순 KEY=VALUE). 주석/빈줄은 무시됨.
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

export CLOUDFLARE_ACCOUNT_ID="${CF_ACCOUNT_ID:?cf-env: .env 에 CF_ACCOUNT_ID 없음}"
export CLOUDFLARE_API_TOKEN="${CF_API_TOKEN:?cf-env: .env 에 CF_API_TOKEN 없음}"

[ "$#" -gt 0 ] || { echo "cf-env: 실행할 명령을 인자로 주세요" >&2; exit 1; }
exec "$@"
