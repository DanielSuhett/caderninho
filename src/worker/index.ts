import { Hono } from "hono";

import { FaultCode } from "../domain";
import { tryCatch } from "../shared";
import { authenticatedFetch } from "./auth/controller";
import type { Bindings } from "./bindings";
import { authService, scheduleSync, syncService } from "./composition";
import { failureStatus, requestCategory } from "./http";
import { fetchMcp } from "./mcp";
import {
  DiagnosticEvent,
  markFailure,
  observeSpan,
  reportDiagnostic,
  SpanName,
  withObservation,
} from "./observability";
import { receiveWebhook } from "./sync/controller";

export { receiveWebhook } from "./sync/controller";
export { FinanceWorkflow } from "./sync/workflow";

function createRoutes(ctx: ExecutionContext) {
  const routes = new Hono<{ Bindings: Bindings }>();
  routes.use("*", (c, next) => {
    const correlation = crypto.randomUUID();
    c.header("X-Request-ID", correlation);
    return withObservation({ correlation }, () =>
      observeSpan(SpanName.httpRequest, async (span) => {
        const started = performance.now();
        await next();
        c.header("X-Request-ID", correlation);
        span.annotate(
          reportDiagnostic({
            durationMs: Math.round(performance.now() - started),
            event: DiagnosticEvent.http,
            ...requestCategory(c.req.path),
            status: c.res.status,
          }),
        );
      }),
    );
  });
  routes.onError((error, c) => {
    markFailure(error, { phase: SpanName.httpRequest });
    return c.json(
      {
        code:
          failureStatus(error) === 400
            ? "INVALID_REQUEST"
            : FaultCode.INTERNAL_ERROR,
      },
      failureStatus(error),
    );
  });

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
  async scheduled(event: ScheduledController, env: Bindings) {
    await syncService(env).recover();
    await scheduleSync(env, new Date(event.scheduledTime));
    await syncService(env).compact();
    await authService(env).compact();
  },
};

export default worker;
