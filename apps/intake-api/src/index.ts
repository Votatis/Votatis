import type { Env } from "./types";
import { preflight } from "./cors";
import { handleSubmissions } from "./submissions";
import { handleFinalize } from "./finalize";
import { openapiSpec, referenceHtml } from "./openapi";

const FINALIZE_RE = /^\/submissions\/([^/]+)\/finalize$/;

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return preflight(env, request);

    if (request.method === "POST" && url.pathname === "/submissions") {
      return handleSubmissions(request, env);
    }

    const m = FINALIZE_RE.exec(url.pathname);
    if (request.method === "POST" && m) {
      return handleFinalize(request, env, decodeURIComponent(m[1]));
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    if (request.method === "GET" && url.pathname === "/openapi.json") {
      return new Response(JSON.stringify(openapiSpec), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (request.method === "GET" && (url.pathname === "/reference" || url.pathname === "/docs")) {
      return new Response(referenceHtml, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
