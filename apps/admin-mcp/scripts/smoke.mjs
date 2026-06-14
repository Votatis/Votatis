// 스모크 테스트: 빌드된 stdio MCP 서버에 실제 MCP 클라이언트로 붙어 도구 목록을 확인한다.
// 사용: pnpm --filter votatis-admin-mcp build && node apps/admin-mcp/scripts/smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(here, "../dist/index.js");

const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
  env: { ...process.env, VOTATIS_API_URL: "http://localhost:8787", VOTATIS_ADMIN_TOKEN: "smoke" },
});
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
console.log("도구:", names.join(", "));

const expected = [
  "analyze_report",
  "get_report",
  "get_stats",
  "health",
  "list_publishable",
  "list_review_queue",
  "record_verdict",
  "view_attachment",
];
const missing = expected.filter((e) => !names.includes(e));
await client.close();

if (missing.length) {
  console.error("누락된 도구:", missing.join(", "));
  process.exit(1);
}
console.log(`✅ MCP 서버 정상 — 도구 ${names.length}종 노출`);
