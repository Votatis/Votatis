// 빌드타임 공개 인덱스 생성 — repo `data/index.json`(spec 0011 export 산출물)을 읽어
// `src/data/archive.generated.json` 으로 복사한다. 데이터가 아직 없으면 빈 배열을 쓴다(빌드 항상 성공).
// 정적 아카이브/검색/통계(spec 0010)가 이 파일을 import 해 클라이언트 검색/표시한다.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../../../data/index.json"); // repo-root/data/index.json
const OUT = resolve(here, "../src/data/archive.generated.json");

let records = [];
if (existsSync(SRC)) {
  try {
    const parsed = JSON.parse(readFileSync(SRC, "utf8"));
    if (Array.isArray(parsed)) records = parsed;
    else console.warn(`[build-archive-index] ${SRC} 가 배열이 아님 — 빈 인덱스 사용`);
  } catch (e) {
    console.warn(`[build-archive-index] ${SRC} 파싱 실패 — 빈 인덱스 사용:`, e.message);
  }
} else {
  console.log(`[build-archive-index] ${SRC} 없음 — 빈 인덱스 생성(아직 공개 데이터 없음)`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(records, null, 2) + "\n", "utf8");
console.log(`[build-archive-index] ${records.length}건 → ${OUT}`);
