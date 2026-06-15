---
tldr: Hono 핸들러가 `new Response()`를 직접 반환하면 corsMiddleware 가 c.header()로 건 access-control-allow-origin 이 계승되지 않는다. 스트리밍/바이너리 응답은 핸들러에서 ACAO 헤더를 직접 부여해야 브라우저가 안 막는다.
tags: [pitfall, cors, hono, intake-api, streaming]
last_retrieved: 2026-06-15
retrieval_count: 0
---

## 증상
관리자 콘솔(브라우저)에서 증거 이미지 fetch 시 `No 'Access-Control-Allow-Origin' header is present` CORS 오류.
같은 서버의 `c.json()` 응답(목록·상세·판정)은 멀쩡한데 **증거 스트리밍만** 막힘.

## 원인
`corsMiddleware` 는 `c.header("access-control-allow-origin", origin)` 으로 헤더를 건다. Hono 는 이 값을
`c.json/c.text/c.body` 로 만든 응답엔 병합하지만, 핸들러가 **`return new Response(stream, {...})`** 로
완전히 새 Response 를 반환하면 그 헤더가 계승되지 않는다(빈 ACAO → 브라우저 차단).
vitest 는 worker.fetch 직접 호출(브라우저 CORS 미적용)이라 초록인데 브라우저만 깨진다.

## 해결
raw Response 를 반환하는 핸들러(증거 바이트 스트리밍 등)는 ACAO 를 직접 넣는다:
```ts
const origin = c.req.header("Origin") ?? null;
const headers = { "content-type": mime, vary: "Origin" };
if (isOriginAllowed(c.env, origin)) headers["access-control-allow-origin"] = origin;
return new Response(body, { status: 200, headers });
```
테스트도 worker.fetch 헤더로 ACAO 존재를 단언(브라우저 미흉내라도 헤더 자체는 검증 가능). 관련 [[web-dev-port-cors]], [[cors-allow-methods-new-verb]].
