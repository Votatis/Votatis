---
tldr: 회전형 refresh 토큰 + 동시 401 → 각자 refresh 하다 한쪽이 폐기된 토큰을 써 실패 → clearSession → 억울한 재로그인. 프론트 refresh 는 single-flight(공유 in-flight Promise)로.
tags: [pitfall, auth, frontend, jwt, race-condition]
last_retrieved: 2026-06-15
retrieval_count: 0
---

## 증상

관리자 콘솔에서 "한 번 로그인했는데 자꾸 다시 로그인하라고 함". localStorage 토큰 저장·복원, 백엔드
refresh 로직 모두 정상인데 발생한다.

## 원인

access 토큰이 단명(15분)이고 refresh 토큰은 **회전형**(`refresh` 호출 시 기존 토큰 revoke + 신규 발급).
대시보드처럼 한 페이지가 여러 API 를 **동시 호출**하면, access 만료 후 그 요청들이 동시에 401 을 받고
각자 `tryRefresh()` 를 호출한다. 첫 번째가 refresh 토큰을 회전(기존 폐기)하면, 같은 (구)토큰을 들고 있던
두 번째 refresh 는 이미 폐기된 토큰을 보내 401 → `clearSession()` → 로그인 페이지로 튕긴다.

## 해결 (페르소나 무관, 공통)

프론트 refresh 를 **single-flight** 로: 모듈 레벨 `refreshInFlight: Promise<boolean> | null` 를 두고,
진행 중이면 새로 시작하지 않고 그 Promise 를 공유한다. `finally` 에서 null 로 리셋. 동시 401 들은 같은
refresh 결과를 받고, 갱신된 access 로 재시도한다. (`apps/frontend/src/lib/api/admin.ts`)

```ts
let refreshInFlight: Promise<boolean> | null = null;
function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => { /* ...refresh... */ })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
```

테스트만으론 안 잡힌다(테스트는 보통 순차 호출). 브라우저의 병렬 fetch 에서만 재현.
