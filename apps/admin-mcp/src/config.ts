// MCP 서버 설정 — intake-api 베이스 URL + 관리자 토큰(클라이언트 MCP 설정에서 env 로 주입).

export interface Config {
  apiUrl: string;
  adminToken: string | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiUrl = (env.VOTATIS_API_URL ?? "http://localhost:8787").replace(/\/+$/, "");
  return { apiUrl, adminToken: env.VOTATIS_ADMIN_TOKEN };
}
