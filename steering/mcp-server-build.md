---
tldr: MCP 서버는 apps/<name>/ 에 Node + @modelcontextprotocol/sdk(stdio). 도구는 server.registerTool(name,{description,inputSchema:ZodRawShape},cb)→{content:[{type:"text"|"image",...}]}. 빌드 tsc→dist(shebang 보존), 단위는 node:test+tsx, 실연결 검증은 SDK Client+StdioClientTransport smoke. pnpm 설치 시 SDK 타입은 node_modules/.pnpm/@modelcontextprotocol+sdk@x/... 아래.
tags: [convention, mcp, nodejs, testing]
last_retrieved: 2026-06-14
retrieval_count: 0
---

## 규칙 / 교훈
이 레포에서 MCP 서버를 만들 때(예: `apps/admin-mcp`, spec 0014):

- **위치/스택**: `apps/<name>/`(모노레포 규칙), Node ESM + `@modelcontextprotocol/sdk`. 로컬 AI 클라이언트(Claude Code/Codex)는 **stdio** 전송으로 붙는다.
- **도구 등록 API**(SDK 1.x): `server.registerTool(name, { title?, description?, inputSchema?: ZodRawShape }, cb)`. `inputSchema` 는 `z.object(...)` 가 아니라 **ZodRawShape**(예: `{ id: z.string() }`). cb 반환은 `{ content: [{type:"text", text}] }` 또는 이미지 `{type:"image", data: base64, mimeType}`. (구 `server.tool(...)` 은 @deprecated)
- **부트스트랩**: `McpServer` + `StdioServerTransport`, `await server.connect(transport)`. stdout 은 프로토콜 전용 → **로그는 stderr** (`console.error`).
- **빌드/실행**: `tsc`(`moduleResolution: Bundler`, 상대 import 는 `.js` 확장자)로 `dist/index.js` 생성. 진입 파일 맨 위 `#!/usr/bin/env node` 는 tsc 가 보존. 클라 등록은 `node /abs/dist/index.js` + env.
- **테스트**: 순수 로직(가드레일·HTTP 클라이언트)은 `node --test --import tsx test/*.test.ts`(별도 vitest 불필요). fetch 주입으로 URL/헤더/바디 검증. **실제 연결 검증**은 SDK `Client` + `StdioClientTransport` 로 빌드본에 붙어 `listTools()` 확인하는 smoke 스크립트.
- **설계 원칙**: 기존 API를 **얇게 래핑**(검증 로직 재구현 금지, 단일 출처 유지). 가드레일/오용 방지는 도구 description + 선검증으로.

## 왜
SDK 타입이 pnpm 가상 스토어(`node_modules/.pnpm/...`)에 있어 시그니처 확인이 번거롭고, registerTool 의 inputSchema 가 ZodRawShape 인 점·stdout 로그 금지·`.js` 확장자 import 등은 한 번 막히면 디버깅이 길다. 패턴을 박아두면 다음 MCP 작업이 빨라진다.

## 적용
- 새 MCP: 위 구조로 시작. 도구는 registerTool(ZodRawShape). 빌드본 + smoke 로 검증.
- 사용법은 `docs/mcp-usage.md` 형식(Claude Code `.mcp.json`/CLI, Codex `config.toml`)을 따른다.
- [[monorepo-apps-layout]] 앱 배치, [[pnpm-filter-run-script]] 스크립트 실행 규칙과 함께.
