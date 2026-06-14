// D1 검증완료 레코드를 공개 마크다운(data/{election}/{id}.md) + data/index.json 으로 내보낸다.
// /admin/export 를 호출하므로 실행 중인 API + 접근 가능한 D1 이 필요하다.
//   로컬:  pnpm dev:remote (또는 dev) 로 API 띄운 뒤
//          API_URL=http://localhost:8787 ADMIN_TOKEN=dev-admin-token pnpm export:data
//   운영:  API_URL=<배포 URL> ADMIN_TOKEN=<운영 토큰> pnpm export:data  (자격증명 필요 → HUMAN.md)
//
// 산출물: <OUT_DIR(기본 repo data/)>/{election-slug}/{id}.md  +  <OUT_DIR>/index.json
// index.json 은 빌드타임 인덱스의 단일 원천(프론트가 그대로 소비). md 는 사람용 공개본.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { recordToMarkdown, recordRelPath, type PublicRecord } from "../src/export-md";

const API_URL = process.env.API_URL ?? "http://localhost:8787";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "dev-admin-token";
const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.OUT_DIR ?? resolve(here, "../../../data"); // repo-root/data

async function main() {
  const res = await fetch(`${API_URL}/admin/export`, {
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`export 호출 실패: HTTP ${res.status} — ${await res.text()}`);
  }
  const { records } = (await res.json()) as { records: PublicRecord[] };

  let written = 0;
  for (const r of records) {
    const rel = recordRelPath(r, OUT_DIR);
    mkdirSync(dirname(rel), { recursive: true });
    writeFileSync(rel, recordToMarkdown(r), "utf8");
    written++;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, "index.json"), JSON.stringify(records, null, 2) + "\n", "utf8");

  console.log(`export 완료: 마크다운 ${written}건 + index.json (${OUT_DIR})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
