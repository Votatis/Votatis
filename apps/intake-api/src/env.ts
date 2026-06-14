// Worker 바인딩/환경 타입. (구 types.ts — 상태 상수는 constants.ts 로 이동)

export interface Env {
  // Bindings
  EVIDENCE_BUCKET: R2Bucket;
  DB: D1Database;

  // Vars
  ALLOWED_ORIGIN: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;

  // Secrets
  TURNSTILE_SECRET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  // 관리자(검수) 공유 토큰. 미설정이면 /admin/* 기능 잠금. 운영은 wrangler secret 으로 주입.
  ADMIN_TOKEN?: string;

  // 선택적 Workers AI 바인딩(검증 보조 분석 증강). 미바인딩이면 휴리스틱만 사용. 프로비저닝은 운영자 몫.
  AI?: Ai;

  // Dev 전용(.dev.vars / --var). "true"면 presigned R2 대신 워커 자체 업로드 경로(/_dev/upload)를
  // 써서 CF 접근(R2 자격증명) 없이 로컬 miniflare R2 로 첨부 흐름을 돌린다. 운영엔 두지 않는다.
  LOCAL_UPLOAD?: string;
}

/** dev 로컬 업로드 shim 활성화 여부. */
export function isLocalUpload(env: Env): boolean {
  return env.LOCAL_UPLOAD === "true" || env.LOCAL_UPLOAD === "1";
}
