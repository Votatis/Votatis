// D1 검증완료 레코드를 공개 마크다운(data/{election}/{id}.md) + data/index.json 으로 내보낸다.
// /admin/export 를 호출하므로 실행 중인 API + 접근 가능한 D1 이 필요하다.
//   로컬:  pnpm dev:remote (또는 dev) 로 API 띄운 뒤
//          API_URL=http://localhost:8787 ADMIN_TOKEN=dev-admin-token ORIGIN=http://localhost:3000 pnpm export:data
//   운영:  API_URL=<배포 URL> ADMIN_TOKEN=<운영 토큰> ORIGIN=https://votatis-web.pages.dev pnpm export:data
//          (자격증명 필요 → HUMAN.md)
//
// 증분/전체 (spec 0018): EXPORT_MODE=incremental(기본)|full.
//   - incremental: 서버가 변경분(export_dirty=1)만 반환 → 변경된 .md 만 재작성, index 는 기존과 병합,
//     로컬 기록 성공 후 /admin/export/ack 로 서버 dirty 해제.
//   - full: PUBLISHABLE 전체 반환 → index 전체 재작성(고아 정리). version 동일·.md 존재 시 파일 재작성은 skip.
//   버전(version=updated_at)으로 idempotency: 로컬과 같고 .md 가 있으면 skip.
//
// ⚠️ /admin/* 는 cors.ts 가 Origin 화이트리스트로 막는다(Origin 미전송 시 403) → ORIGIN 환경변수.
//
// 산출물: <OUT_DIR(기본 repo data/)>/{election-slug}/{id}.md  +  <OUT_DIR>/index.json
// index.json 은 빌드타임 인덱스의 단일 원천(슬림 요약 + version). md 는 사람용 상세 공개본.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  recordToMarkdown,
  recordRelPath,
  recordToSummary,
  type PublicRecord,
  type RecordSummary,
} from "../src/domain/markdown";

const API_URL = process.env.API_URL ?? "http://localhost:8787";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "dev-admin-token";
const ORIGIN = process.env.ORIGIN ?? "http://localhost:3000";
const MODE = process.env.EXPORT_MODE === "full" ? "full" : "incremental";
const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.OUT_DIR ?? resolve(here, "../../../data"); // repo-root/data
const INDEX_PATH = resolve(OUT_DIR, "index.json");

function loadLocalIndex(): Map<string, RecordSummary> {
  if (!existsSync(INDEX_PATH)) return new Map();
  try {
    const arr = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as RecordSummary[];
    return new Map(arr.map((s) => [s.id, s]));
  } catch {
    return new Map(); // 깨졌으면 전체 재작성
  }
}

async function main() {
  const res = await fetch(`${API_URL}/admin/export?mode=${MODE}`, {
    headers: { authorization: `Bearer ${ADMIN_TOKEN}`, origin: ORIGIN },
  });
  if (!res.ok) {
    throw new Error(`export 호출 실패: HTTP ${res.status} — ${await res.text()}`);
  }
  const { records } = (await res.json()) as { mode: string; records: PublicRecord[] };

  const local = loadLocalIndex();
  // full: 응답 전체가 곧 인덱스(고아 제거). incremental: 기존 인덱스에 변경분만 덮어쓴다.
  const index = MODE === "full" ? new Map<string, RecordSummary>() : new Map(local);

  let written = 0;
  let skipped = 0;
  for (const r of records) {
    const rel = recordRelPath(r, OUT_DIR);
    const prev = local.get(r.id);
    // version(=updated_at) 같고 .md 가 이미 있으면 재작성 skip(idempotency).
    if (prev && prev.version === r.updated_at && existsSync(rel)) {
      skipped++;
    } else {
      mkdirSync(dirname(rel), { recursive: true });
      writeFileSync(rel, recordToMarkdown(r), "utf8");
      written++;
    }
    index.set(r.id, recordToSummary(r));
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const summaries = [...index.values()];
  writeFileSync(INDEX_PATH, JSON.stringify(summaries, null, 2) + "\n", "utf8");

  // 로컬 기록 성공 후 ack → 서버 export_dirty=0. (응답에 온 id 전체. 실패해도 다음 회차 재시도.)
  const ids = records.map((r) => r.id);
  if (ids.length) {
    const ack = await fetch(`${API_URL}/admin/export/ack`, {
      method: "POST",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}`, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!ack.ok) {
      console.warn(`ack 실패: HTTP ${ack.status} — dirty 유지(다음 export 에 다시 포함됨)`);
    }
  }

  console.log(
    `export(${MODE}) 완료: 변경 ${written}건 작성, ${skipped}건 skip · index ${summaries.length}건 · ack ${ids.length}건 (${OUT_DIR})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
