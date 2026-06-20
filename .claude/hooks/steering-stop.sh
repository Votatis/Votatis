#!/usr/bin/env bash
# Stop: 턴 종료 전 steering 점검을 강제한다. stop_hook_active 면 통과(무한 루프 방지).
# (reason 은 매 턴 종료 시 주입되므로 핵심 동작만 간결히 — 토큰 절약)
input=$(cat 2>/dev/null || true)
printf '%s' "$input" | jq -e '.stop_hook_active==true' >/dev/null 2>&1 && exit 0
cat <<'JSON'
{"decision":"block","reason":"턴 종료 전 steering 점검: 새 규칙/실수/비자명 결정이 나왔으면 steering/<kebab>.md 로 캡처(frontmatter: tldr,tags,last_retrieved,retrieval_count)하고 README 인덱스 갱신. 참조·적용한 항목은 retrieval_count+1·last_retrieved=오늘·인덱스 동기화. 없으면 아무 작업 말고 종료."}
JSON
