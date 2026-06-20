---
tldr: @hono/zod-openapi 의 .openapi(route,handler) 는 핸들러가 반환할 수 있는 모든 status 를 createRoute 의 responses 에 선언해야 타입 통과한다 — 공유 HttpError(status 유니온)를 catch 해 c.json({error}, e.status) 로 응답하면 그 유니온의 모든 코드(400/401/403/404/409/503 등)를 선언해야 함. 그리고 공유 responses 객체에 `as const` 를 붙이면 응답의 json content 추론이 깨져 200 외 반환이 거부된다 → as const 빼라.
tags: [pitfall, hono, openapi, typescript, intake-api]
last_retrieved: 2026-06-15
retrieval_count: 2
---

## 규칙 / 교훈

`@hono/zod-openapi` 라우트(`createRoute` + `router.openapi(route, handler)`)에서:

1. **반환 가능한 모든 status 선언**: 핸들러가 `c.json(x, S)` 로 낼 수 있는 **모든** status `S` 가 `createRoute({ responses })` 에 있어야 한다. 없으면 `Type 'JSONRespondReturn<…, S>' is not assignable to TypedResponse<…,200>` 류 에러.
   - 서비스에서 공유 `HttpError`(예: `status: 400|401|403|404|409|503`)를 던지고 라우트에서 `catch (e) { if (e instanceof HttpError) return c.json({error}, e.status); }` 로 매핑하면, **그 유니온의 모든 코드를 responses 에 선언**해야 한다(일부만 쓰더라도). 공유 `errResponses` 객체 하나로 6개를 다 넣고 스프레드하는 게 편하다.

2. **공유 responses 객체에 `as const` 금지**: 여러 라우트가 쓰는 `const errResponses = { 400: {...}, ... }` 에 `as const` 를 붙이면, 각 응답의 `content['application/json'].schema` 추론이 좁아져 **그 status 가 json 응답으로 등록되지 않는다** → 핸들러가 그 status 로 `c.json` 반환 시 거부(200 만 허용된 것처럼 보임). `as const` 를 빼면 정상.

3. **에러 매핑은 인라인이 안전**: `fail(c,e)` 같은 헬퍼로 빼면 반환 타입이 `Response` 로 넓어져 핸들러의 `TypedResponse` 유니온과 안 맞을 수 있다. `} catch (e) { if (e instanceof HttpError) return c.json({error}, e.status); throw e; }` 를 핸들러 안에 그대로 두는 편이 무난.

## 왜
에러 메시지가 "200 만 반환 가능"처럼 보여 원인(=responses 누락 / as const)이 직관적이지 않다. spec 0015 admin 인증 라우트 작성 때 한참 헤맸다.

## 적용
- 새 openapi 라우트: 200 + 핸들러가 낼 수 있는 모든 에러 status 를 responses 에 선언, 공유 errResponses 는 `as const` 없이, 에러 매핑은 인라인 try/catch. [[intake-api-src-layering]]
