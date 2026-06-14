import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "./env";

/**
 * 공용 OpenAPIHono 팩토리 — Zod 검증 실패를 통일된 { error } 400 으로 변환하는 defaultHook 을 단다.
 * 루트 앱과 각 도메인 라우트 sub-app 이 모두 이 팩토리로 생성돼 같은 에러 포맷을 공유한다.
 */
export function createRouter() {
  return new OpenAPIHono<{ Bindings: Env }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const msg = result.error.issues[0]?.message ?? "유효하지 않은 요청입니다.";
        return c.json({ error: msg }, 400);
      }
    },
  });
}

export type AppRouter = ReturnType<typeof createRouter>;
