import { createRouter } from "../router";

export const metaRoutes = createRouter();

metaRoutes.get("/health", (c) => c.text("ok"));

const REFERENCE_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Votatis Intake API</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

metaRoutes.get("/reference", (c) => c.html(REFERENCE_HTML));
metaRoutes.get("/docs", (c) => c.html(REFERENCE_HTML));
