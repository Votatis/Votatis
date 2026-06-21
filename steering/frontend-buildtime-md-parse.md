---
tldr: 프론트(Next16 Turbopack, output:export)에서 빌드타임에 repo data/*.md 를 서버컴포넌트로 읽어 상세 렌더(archive-md.ts). 함정① js-yaml v5 는 default export 없음 → `import { load as yamlLoad } from "js-yaml"`(default import 하면 Turbopack "Export default doesn't exist"). 함정② 파일 경로는 next build cwd(=apps/frontend) 기준 `resolve(process.cwd(),"../../data")`. 공개 인덱스(archive.generated.json)는 슬림 요약만, 상세 풀데이터 단일 원천은 .md.
tags: [pitfall, frontend, nextjs, build, js-yaml, archive]
last_retrieved: 2026-06-21
retrieval_count: 1
---

## 규칙 / 교훈
공개 아카이브 상세(/archive/[id])는 빌드타임에 repo `data/{election-slug}/{id}.md` 를 파싱해 렌더한다(`apps/frontend/src/lib/archive-md.ts`, 서버 컴포넌트에서만 import). 인덱스(archive.generated.json)는 슬림 요약(목록·탐색·통계)만 담아 번들 비대화를 막는다(spec 0011).

### 함정① js-yaml v5 = named export only
`import yaml from "js-yaml"` 는 v5(ESM)에서 **default export 가 없어** Turbopack 빌드가
`Export default doesn't exist in target module` 로 실패한다(typecheck 는 통과할 수 있어 더 헷갈림).
→ `import { load as yamlLoad } from "js-yaml"` 로 named import.

### 함정② 빌드타임 파일 경로
`next build` 의 cwd 는 `apps/frontend` 다. repo 루트의 `data/` 를 읽으려면
`resolve(process.cwd(), "../../data")`. (ESM Next 모듈이라 __dirname 없음.)

### 포맷 대응
.md 는 intake-api `src/domain/markdown.ts` `recordToMarkdown` 이 생성(frontmatter=YAML 더블쿼트,
본문=`# 제목`+요약+body). 파서는 frontmatter 를 yamlLoad 로 구조화 필드 복원하고, 본문 섹션에서
생성기가 붙인 `# 제목`·요약 중복을 제거해 순수 body 를 복원한다. 슬러그 규칙은 markdown.ts slug 와 동일하게 맞춰야 파일을 찾는다.

연관: [[nextjs-static-export-dynamic-routes]], [[r2-object-put-evidence-upload]], [[evidence-image-public-serving]].
