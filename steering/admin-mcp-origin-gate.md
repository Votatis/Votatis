---
tldr: intake-api 는 /admin/* 의 **모든 메서드**를 ALLOWED_ORIGIN 화이트리스트로 막는다(cors.ts: restricted = isWriteMethod || isAdminPath). admin-mcp 는 서버-서버라도 허용 Origin 헤더를 보내야 통과 → 안 보내면 admin 도구 전부 403 "허용되지 않은 오리진". 운영 등록 시 VOTATIS_ORIGIN=https://votatis-web.pages.dev 필수. Node fetch 는 Origin 수동 설정 가능(브라우저와 달리).
tags: [pitfall, cors, admin-mcp, intake-api, mcp, origin]
last_retrieved: 2026-06-21
retrieval_count: 1
---

## 함정 — /admin/* 는 Origin 게이트(메서드 무관)
`apps/intake-api/src/middleware/cors.ts` 의 `restricted = isWriteMethod || isAdminPath` 때문에
**`/admin/*` 는 GET 포함 모든 요청이 Origin 화이트리스트 검사**를 받는다. `isOriginAllowed(env, null)`
는 `false` 라(Origin 헤더가 없으면 무조건 막힘), Origin 을 안 실으면 **403 `허용되지 않은 오리진입니다`**.

- `/health`, `/stats` 만 비제한(공개 GET) → admin-mcp 의 `health` 도구는 부분 동작하지만,
  토큰검증(`POST /admin/session`)·`list_review_queue`·`get_report`·`analyze`·`view_attachment`·
  `record_verdict`·`list_publishable` 은 전부 admin 경로라 Origin 없으면 403.
- 이건 운영뿐 아니라 로컬에서도 동일. **단위테스트는 fetchFn 주입이라 안 걸리고 smoke 는 도구 노출만**
  확인해서 드러나지 않는 잠재 버그였다.
- **admin-mcp 만의 문제가 아니다**: `/admin/export` 를 호출하는 `apps/intake-api/scripts/export-data.ts`
  도 똑같이 막힌다. 이 스크립트도 `ORIGIN` 환경변수로 Origin 헤더를 보내야 운영 export 가 통과한다
  (`ORIGIN=https://votatis-web.pages.dev`). 게이트가 나중에 추가되며 기존 export 스크립트를 깨뜨린 사례.
  → /admin/* 를 부르는 **모든 서버-서버 호출자**는 허용 Origin 을 실어야 한다.

## 해결 — MCP 가 허용 Origin 을 헤더로 전송
`apps/admin-mcp` 에 `VOTATIS_ORIGIN` env 추가(config.ts→AdminClient 4번째 인자→req 에서
`headers["origin"]` 부착). 운영 등록 시 `VOTATIS_ORIGIN=https://votatis-web.pages.dev`(intake-api
ALLOWED_ORIGIN 에 있는 값) 설정. **Node(undici) fetch 는 브라우저와 달리 Origin 을 수동 설정 가능**.

검증: 빌드본 client 로 운영 실호출 → `health {reachable:true, tokenValid:true}`,
`listQueue {total:1}`. (Origin 없이는 403, 붙이면 200 으로 직접 재현됨)

## 운영 MCP 등록 시 토큰 보안
운영 ADMIN_TOKEN 을 레포 커밋되는 `.mcp.json`(방법 A, 팀공유)에 넣으면 git 노출.
`claude mcp add --scope local`(이 프로젝트 비공유, `~/.claude.json` 의 project 섹션)로 등록하고
토큰은 `.env`(gitignore) 에서 `set -a; . ./.env; set +a` 로 로드한다. 운영 URL/토큰 출처: [[wrangler-deploy-env]], `loops/HUMAN.md`. 운영 베이스 URL `https://votatis-intake-api.3dulev.workers.dev` 는 [[frontend-pages-deploy]] 참고.
