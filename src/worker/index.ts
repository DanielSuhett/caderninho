import { Hono } from "hono";

import { FaultCode } from "../domain";
import { tryCatch } from "../shared";
import { authenticatedFetch } from "./auth/controller";
import type { Bindings } from "./bindings";
import { installationService, syncService } from "./composition";
import { failureStatus, requestCategory } from "./http";
import { fetchMcp } from "./mcp";
import {
  classifyFailure,
  DiagnosticEvent,
  markFailure,
  Outcome,
  observeSpan,
  Recovery,
  reportDiagnostic,
  type SafeFields,
  SpanName,
  withObservation,
} from "./observability";

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

  routes.all("*", (c) =>
    authenticatedFetch(c.req.raw, c.env, ctx, (request, bindings, access) =>
      fetchMcp(request, bindings, access),
    ),
  );
  return routes;
}
const worker = {
  fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return createRoutes(ctx).fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledController, env: Bindings) {
    return await withObservation({ runId: crypto.randomUUID() }, () =>
      observeSpan(SpanName.scheduled, async (span) => {
        let phase: SafeFields["phase"] = SpanName.recovery;
        const { data, error } = await tryCatch(async () => {
          await syncService(env).recover();
          phase = SpanName.scheduled;
          const state = await installationService(env).state();
          const ids = state.connections
            .filter((connection) => connection.importStatus !== null)
            .map((connection) => connection.id);
          if (ids.length) {
            await syncService(env, () => new Date(event.scheduledTime)).request(
              ids,
            );
          }
        });
        if (error) {
          const fields: SafeFields = {
            failure: classifyFailure(error),
            outcome: Outcome.failed,
            phase,
            recovery: Recovery.none,
          };
          span.annotate(fields);
          reportDiagnostic({ ...fields, event: DiagnosticEvent.scheduled });
          throw error;
        }
        reportDiagnostic({
          event: DiagnosticEvent.scheduled,
          outcome: Outcome.completed,
        });
        return data;
      }),
    );
  },
};

export default worker;
