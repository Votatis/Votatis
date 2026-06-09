---
tldr: Cloudflare Worker 테스트(@cloudflare/vitest-pool-workers)는 ①miniflare/wrangler 양쪽에 compatibilityFlags "nodejs_compat" 필수, ②테스트에서 R2/KV를 직접 쓰면 isolatedStorage:false 로 꺼야 "Isolated storage failed" 회피, ③pnpm은 onlyBuiltDependencies로 workerd·esbuild 빌드를 허용해야 함.
tags: [pitfall, cloudflare, testing, pnpm]
last_retrieved: 2026-06-09
retrieval_count: 0
---

## 규칙 / 교훈
Cloudflare Workers를 vitest로 테스트할 때 초기 셋업에서 반복적으로 막히는 3가지.

1. **nodejs_compat 플래그**: `vitest.config.ts`의 `poolOptions.workers.miniflare.compatibilityFlags`에 `"nodejs_compat"`이 없으면 풀이 아예 안 뜬다(에러: must contain one of "nodejs_compat"/"nodejs_compat_v2"). `wrangler.jsonc`의 `compatibility_flags`에도 동일하게 넣어 런타임과 일치시킨다.
2. **isolatedStorage**: 테스트 본문에서 `env.<BUCKET>.put`/`env.<KV>.put` 등 스토리지를 직접 조작하면 기본 `isolatedStorage:true`의 스택 검증과 충돌해 `Isolated storage failed` 로 죽는다. 테스트마다 IP/key를 분리해 격리를 직접 관리한다면 `poolOptions.workers.isolatedStorage:false`로 끈다.
3. **pnpm 빌드 스크립트**: pnpm은 기본적으로 `workerd`·`esbuild`·`sharp`의 postinstall을 차단한다("Ignored build scripts"). `package.json`에 `"pnpm": { "onlyBuiltDependencies": ["workerd","esbuild","sharp"] }`를 넣고 재설치(또는 `pnpm rebuild`)해야 workerd 바이너리가 준비된다.

## 왜
- 셋 다 증상이 "테스트가 한 줄도 안 돌거나 알 수 없는 assertion으로 죽음"이라 원인 파악에 시간이 든다. 한 번 겪으면 바로 짚을 수 있게 남긴다.

## 적용
- 새 Worker 패키지 scaffold 시 vitest.config.ts에 nodejs_compat + isolatedStorage:false(스토리지 직접 조작 테스트가 있을 때)를 처음부터 넣는다.
- compatibility date 경고("falling back to ...")는 로컬 런타임이 최신 날짜로 폴백하는 것뿐이라 무해 — 무시한다.

관련: [[spec-create-workflow]]
