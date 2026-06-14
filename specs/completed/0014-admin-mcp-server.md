---
id: "0014"
title: 검증 관리 MCP 서버 (votatis-admin-mcp) — 관리자 API 래퍼
status: completed
created: 2026-06-14
updated: 2026-06-14
related:
  - "docs/mcp-admin-plan.md (기획)"
  - "docs/PERSONA.md 페르소나 5(내부 검증 관리자)"
  - "specs/completed/0008-admin-verification-api.md (감싸는 API)"
  - "docs/goals/002.md"
  - "https://modelcontextprotocol.io / @modelcontextprotocol/sdk"
---

# 검증 관리 MCP 서버 (votatis-admin-mcp)

## 1. 배경
검증 관리자(페르소나 5)가 AI(Claude Code/Codex)로 검증 작업을 구동할 통로가 없다. intake-api 관리자 API(0008)를 **얇게 감싸는 stdio MCP 서버**를 만들어, AI가 큐 확인→증거·분석 검토→근거와 함께 판정을 도구 호출로 수행하게 한다.

## 2. 목표
1. `apps/admin-mcp/` 에 Node + `@modelcontextprotocol/sdk` stdio MCP 서버.
2. 도구 8종(기획 §4): health, list_review_queue, get_report, analyze_report, view_attachment(이미지), record_verdict, list_publishable, get_stats.
3. **페르소나 5 가드레일**: `record_verdict`가 judged 상태(confirmed/disputed/debunked/corrected)면 method+evidence_links≥1 을 MCP에서 선검증(누락 시 API 호출 없이 거부). 도구 description에 "AI 분석은 보조 신호, 판정 근거 아님" 명시.
4. 검증 로직 재구현 없음(intake-api 호출만).
5. 설정: env `VOTATIS_API_URL`, `VOTATIS_ADMIN_TOKEN`.
6. 빌드(tsc→dist, shebang bin) + 단위 테스트(가드레일·클라이언트 빌더) + typecheck.

## 3. 비목표
- 검증 로직/상태 전이 재구현. 공개 쓰기(제보 접수) 노출. 원격 호스팅(향후). 멤버 계정.

## 4. 설계
- `src/config.ts` — env 로드(API_URL, ADMIN_TOKEN).
- `src/client.ts` — intake-api HTTP 클라이언트(순수·테스트 가능): 각 admin 엔드포인트 호출 + 에러 메시지 추출.
- `src/verdict.ts` — `validateVerdict(input)` 순수 가드레일(judged면 근거 필수) — 테스트 대상.
- `src/tools.ts` — McpServer에 도구 등록(zod 입력 스키마 + description).
- `src/index.ts` — `#!/usr/bin/env node`, McpServer + StdioServerTransport 기동.
- `view_attachment` 는 첨부 바이트를 base64 image content 로 반환(AI가 열람).
- 빌드: `tsc` → `dist/index.js`(bin). `pnpm --filter votatis-admin-mcp build`.

## 5. 완료 조건
- [x] `apps/admin-mcp/` 가 빌드(tsc)·typecheck 통과, `dist/index.js` 가 stdio MCP로 기동되어 도구 8종을 노출.
- [x] `record_verdict` 가 근거 없는 judged 판정을 MCP 단계에서 거부(테스트).
- [x] 클라이언트가 올바른 URL·Authorization 헤더로 호출(테스트).
- [x] `analyze_report`/도구 description 에 "보조 신호" 라벨.
- [x] 루트 `pnpm -r typecheck`/`pnpm -r test` 통과(새 앱 포함).
- [x] `docs/mcp-usage.md` 로 Claude Code/Codex 등록·사용 가능.

## 6. 리스크
- 운영 API URL·ADMIN_TOKEN 은 사람 몫(HUMAN.md). MCP 자체는 로컬 dev(`http://localhost:8787`, `dev-admin-token`)로 검증.
- stdio 서버는 실제 AI 클라이언트 연결까지는 사람이 등록해야 확인 가능 — 서버 기동/도구목록/JSON-RPC 응답까지 자동 검증.

## Changelog
- 2026-06-14: 최초 작성 (Goal 002)
- 2026-06-14: 구현 완료 — apps/admin-mcp(stdio, @modelcontextprotocol/sdk) 도구 8종, record_verdict 근거 필수 가드레일(verdict.ts) + intake-api 얇은 래퍼(client.ts). 단위 10건·smoke(SDK 클라이언트로 도구 8종 노출 확인) 통과, 루트 typecheck/test 통과. docs/mcp-admin-plan.md 기획 + docs/mcp-usage.md 작성. completed.
