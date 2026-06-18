#!/usr/bin/env node
// Votatis 검증 관리 MCP 서버(stdio). intake-api 관리자 API를 AI(Claude Code/Codex)용 도구로 노출.
// 설정: env VOTATIS_API_URL, VOTATIS_ADMIN_TOKEN (mcp-usage.md 참고).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { AdminClient } from "./client.js";
import { registerTools } from "./tools.js";

const config = loadConfig();
const client = new AdminClient(config.apiUrl, config.adminToken, undefined, config.origin);

const server = new McpServer({ name: "votatis-admin-mcp", version: "0.1.0" });
registerTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);

// stdio 서버는 stdout 을 프로토콜에 쓰므로 로그는 stderr 로만.
console.error(
  `[votatis-admin-mcp] 기동: API=${config.apiUrl} token=${config.adminToken ? "set" : "MISSING"} origin=${config.origin ?? "(none)"}`,
);
