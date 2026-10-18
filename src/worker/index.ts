import { Hono } from "hono";

import { tryCatch } from "#shared/result.ts";
import { authenticatedFetch } from "#worker/auth/controller.ts";
import { compactAccess } from "#worker/auth/repository.ts";
import type { Bindings } from "#worker/bindings.ts";
import { syncService, scheduleSync } from "#worker/composition.ts";
import { failureStatus, requestDiagnostic } from "#worker/http.ts";
import { fetchMcp } from "#worker/mcp/controller.ts";
import { receiveWebhook } from "#worker/sync/controller.ts";
import { compactOperations } from "#worker/sync/repository.ts";
import { FinanceWorkflow } from "#worker/sync/workflow.ts";

export { FinanceWorkflow };
export { receiveWebhook };
const routes = new Hono<{ Bindings: Bindings }>();
routes.use("*", async (c, next) => {
  const correlation = crypto.randomUUID();
  const started = performance.now();
  c.header("X-Request-ID", correlation);
  await next();
  const path = c.req.path;
  const route = path.startsWith("/api/")
    ? "api"
    : path.startsWith("/account")
      ? "account"
      : path === "/mcp"
        ? "mcp"
        : path === "/webhook"
          ? "webhook"
          : "public-or-oauth";
  requestDiagnostic({
    correlation,
    status: c.res.status,
    durationMs: Math.round(performance.now() - started),
    route,
  });
});
routes.onError((error, c) =>
  c.json(
    {
      code: failureStatus(error) === 400 ? "INVALID_REQUEST" : "INTERNAL_ERROR",
    },
    failureStatus(error),
  ),
);

routes.get("/", async (c) => {
  c.header("Referrer-Policy", "no-referrer");
  c.header(
    "Content-Security-Policy",
    "default-src 'none'; font-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  if (!c.env.ASSETS) return c.text("Assets unavailable", 503);
  const response = await c.env.ASSETS.fetch(c.req.raw);
  return c.newResponse(response.body, response);
});

routes.post("/webhook", async (c) => {
  const result = await tryCatch(receiveWebhook(c.req.raw, c.env));
  if (result.error)
    return new Response("Receipt not confirmed; retry", { status: 503 });
  return result.data;
});
routes.all("*", (c) => {
  // Hono forwards the native Workers context; its portable interface omits Workers extensions.
  const ctx = c.executionCtx as ExecutionContext;
  return authenticatedFetch(c.req.raw, c.env, ctx, (request, bindings) =>
    fetchMcp(request, bindings, ctx),
  );
});
const worker = {
  fetch: routes.fetch,
  async scheduled(_event: ScheduledController, env: Bindings) {
    await syncService(env).recover();
    await scheduleSync(env);
    await compactOperations(env.DB);
    await compactAccess(env.DB);
  },
};

export default worker;
