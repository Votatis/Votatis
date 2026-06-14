---
tldr: Next.js app/ 라우트 디렉터리를 git mv 로 한 단계 옮기면 — 함께 안 옮긴 형제 파일(예: app-shell.css)로의 상대 import 가 ../ 한 단계 어긋난다(같이 옮긴 mock.css 는 그대로 유효). 추가로 .next 캐시가 옛 경로(free/...) 타입을 참조해 빌드/타입체크가 깨지니 rm -rf .next 후 재빌드.
tags: [pitfall, nextjs, frontend, refactor, build]
last_retrieved: 2026-06-14
retrieval_count: 1
---

## 규칙 / 교훈

`apps/frontend/src/app/` 의 라우트 디렉터리를 옮길 때(예: `free/{admin,mock,preview}` → `app/{admin,mock,preview}` 로 prefix 제거):

1. **상대 import 깊이 보정**: 이동한 파일 안의 `../` 상대경로 import 중,
   - **함께 이동한 대상**(예: `mock.css` 도 같이 위로 올라감)으로의 경로는 **그대로 유효**.
   - **이동하지 않은 대상**(예: `src/app/app-shell.css` 는 제자리)으로의 경로는 디렉터리가 한 단계 올라간 만큼 **`../` 를 하나 줄여야** 한다. 안 줄이면 `Module not found: Can't resolve '../../app-shell.css'`.
   - 경로 문자열 라우트 참조(`Link href`, `router.push`, `redirect`, `realPath`)는 `/free/` → `/` 일괄 치환으로 처리되지만, 위 **import 상대경로는 치환과 별개**라 따로 점검해야 한다.
2. **.next 캐시 제거**: 옮긴 직후 typecheck/build 가 `Cannot find module '../../src/app/free/.../page.js'` 같이 **옛 경로**를 가리키면 `.next/types/validator.ts` 잔재다. `rm -rf .next` 후 재빌드하면 사라진다. (관련 [[nextjs-static-export-dynamic-routes]] 의 ".next 캐시 의심" 과 같은 계열)
3. **zsh 함정**: 다중 파일 일괄 sed 시 `for f in $files` 는 zsh 에서 word-split 안 돼 전체가 한 파일명이 된다 → `grep -rl ... | while IFS= read -r f; do sed -i '' ... "$f"; done`.

## 왜
라우트 prefix 제거 같은 단순 이동도 (a)상대 import 깊이 (b)빌드 캐시 두 군데서 깨지는데, 에러 메시지가 "옛 경로"를 가리켜 원인 추적이 헷갈린다. 실제로 build 두 번 실패함.

## 적용
- 라우트 디렉터리 이동 = `git mv` + 경로문자열 치환 + **이동 안 한 대상으로의 상대 import 깊이 보정** + `rm -rf .next` + 재빌드(typecheck/build 통과 확인).
