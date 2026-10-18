import { Hono } from "hono";

import { FaultCode } from "../domain";
import { tryCatch } from "../shared";
import { authenticatedFetch } from "./auth/controller";
import type { Bindings } from "./bindings";
import { authService, scheduleSync, syncService } from "./composition";
import { failureStatus, requestDiagnostic } from "./http";
import { fetchMcp } from "./mcp";
import { receiveWebhook } from "./sync/controller";

export { receiveWebhook } from "./sync/controller";
export { FinanceWorkflow } from "./sync/workflow";

function createRoutes(ctx: ExecutionContext) {
  const routes = new Hono<{ Bindings: Bindings }>();
  routes.use("*", async (c, next) => {
    const correlation = crypto.randomUUID();
    const started = performance.now();
    c.header("X-Request-ID", correlation);
    await next();
    const { path } = c.req;
    let route = "public-or-oauth";
    if (path.startsWith("/api/")) {
      route = "api";
    } else if (path.startsWith("/account")) {
      route = "account";
    } else if (path === "/mcp") {
      route = "mcp";
    } else if (path === "/webhook") {
      route = "webhook";
    }
    requestDiagnostic({
      correlation,
      durationMs: Math.round(performance.now() - started),
      route,
      status: c.res.status,
    });
  });
  routes.onError((error, c) =>
    c.json(
      {
        code:
          failureStatus(error) === 400
            ? "INVALID_REQUEST"
            : FaultCode.INTERNAL_ERROR,
      },
      failureStatus(error),
    ),
  );

  routes.post("/webhook", async (c) => {
    const { data, error } = await tryCatch(() =>
      receiveWebhook(c.req.raw, c.env),
    );
    if (error) {
      return new Response("Receipt not confirmed; retry", { status: 503 });
    }
    return data;
  });
  routes.all("*", (c) =>
    authenticatedFetch(c.req.raw, c.env, ctx, (request, bindings) =>
      fetchMcp(request, bindings, ctx),
    ),
  );
  return routes;
}
const worker = {
  fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return createRoutes(ctx).fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledController, env: Bindings) {
    await syncService(env).recover();
    await scheduleSync(env);
    await syncService(env).compact();
    await authService(env).compact();
  },
};

export default worker;
