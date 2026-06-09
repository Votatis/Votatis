import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        isolatedStorage: false,
        miniflare: {
          compatibilityDate: "2026-06-01",
          compatibilityFlags: ["nodejs_compat"],
          kvNamespaces: ["PENDING_KV"],
          r2Buckets: ["EVIDENCE_BUCKET"],
          bindings: {
            ALLOWED_ORIGIN: "https://app.test",
            GITHUB_REPO: "votatis/archive",
            R2_ACCOUNT_ID: "testacct",
            R2_BUCKET: "votatis-evidence",
            TURNSTILE_SECRET: "test-secret",
            GITHUB_TOKEN: "test-token",
            R2_ACCESS_KEY_ID: "test-akid",
            R2_SECRET_ACCESS_KEY: "test-secret-key",
          },
        },
      },
    },
  },
});
