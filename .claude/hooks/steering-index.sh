#!/usr/bin/env bash
# SessionStart: steering 인덱스를 "파일 — tldr" 형태로만 주입한다(토큰 절약).
# 운영 규칙은 CLAUDE.md 의 steering 정책에 이미 있으므로 매 세션 재주입하지 않는다.
# tags/마지막회수/회수 컬럼은 회상 판단에 불필요하므로 주입에서 제외(README 파일엔 유지).
set -euo pipefail
README="${CLAUDE_PROJECT_DIR:-.}/steering/README.md"
[ -f "$README" ] || exit 0

# 인덱스 표의 데이터 행(| [..](..) | tldr | ...)에서 링크 셀과 tldr 셀만 뽑아 불릿으로.
index=$(awk -F'|' '/^\| \[/{gsub(/^ +| +$/,"",$2); gsub(/^ +| +$/,"",$3); print "- " $2 " — " $3}' "$README")
[ -n "$index" ] || exit 0

printf '%s' "$index" | jq -Rs '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ("# Steering 인덱스 (작업 전 회상)\n관련 항목이 있으면 그 steering/<file>.md 를 읽고 따른 뒤 회수통계(retrieval_count +1, last_retrieved=오늘)와 README 인덱스를 갱신하라.\n\n" + .)
  }
}'
