---
tldr: intake-api 에 새 HTTP 메서드(DELETE 등) 라우트를 추가하면 `middleware/cors.ts` 의 ①preflight `access-control-allow-methods` 목록과 ②`isWriteMethod`(오리진 제한 대상) 둘 다에 그 메서드를 추가해야 한다. 안 하면 브라우저 preflight 가 막아 "실패"로만 보이는데, vitest 는 worker.fetch 직접 호출(preflight 없음)이라 통과 → 테스트 초록인데 브라우저만 깨진다.
tags: [pitfall, cors, intake-api, frontend, testing]
last_retrieved: 2026-06-15
retrieval_count: 1
---

## 규칙 / 교훈

`apps/intake-api/src/middleware/cors.ts` 는 메서드 allowlist 를 **하드코딩**한다. 새 동사를 쓰는 라우트(예: `DELETE /admin/members/{id}`)를 추가하면 두 곳을 같이 고쳐야 한다:

1. **preflight 응답**: `headers["access-control-allow-methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"` — 새 메서드 포함. 빠지면 브라우저가 실제 요청을 보내지 않는다.
2. **`isWriteMethod`**: 오리진 제한(쓰기는 허용 오리진만) 대상에 새 메서드 포함. (DELETE 는 쓰기.)

### 왜 테스트로 안 잡히나 (핵심 함정)
- vitest(`@cloudflare/vitest-pool-workers`)는 `worker.fetch(request, env, ctx)` 를 **직접** 호출한다 → 브라우저 CORS preflight(OPTIONS) 단계가 없다. 그래서 서버 핸들러는 정상 동작 → **테스트는 초록**.
- 실제 브라우저는 DELETE/PATCH 같은 메서드에 preflight 를 먼저 보내고, allow-methods 에 없으면 본 요청을 **차단**한다.
- 게다가 프론트 `catch (e) { e instanceof AdminApiError ? e.message : "...실패했습니다" }` 패턴은 preflight 차단(네트워크 에러)을 **generic 실패 메시지**로 덮어, 원인이 CORS 인지 안 드러난다.

### 진단
- 증상: 특정 메서드만 브라우저에서 "…실패했습니다"(서버 200/정상인데). → `curl -i -X OPTIONS <url> -H "origin: <allowed>" -H "access-control-request-method: DELETE"` 로 `access-control-allow-methods` 에 그 메서드가 있는지 확인.

## 적용
- 새 동사 라우트 추가 시 cors.ts 의 allow-methods + isWriteMethod 동시 갱신. 관련 [[web-dev-port-cors]](오리진 정합).
