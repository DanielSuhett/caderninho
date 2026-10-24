import {
  createMcpHandler,
  Server,
  specTypeSchemas,
} from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { z } from "zod/v4";

import {
  AggregateQuerySchema,
  AuditModelSchema,
  AuditOutcome,
  ConnectionSelectionSchema,
  PlanningCommandSchema,
  PRODUCT_INSTRUCTIONS,
  planningDefinitions,
  ToolName,
  TransactionQuerySchema,
  tools,
} from "../../../contracts";
import { Fault } from "../../../domain";
import { tryCatch } from "../../../shared";
import type { Bindings } from "../../bindings";
import {
  auditRepository,
  financialService,
  installationService,
  planningService,
  syncService,
} from "../../composition";
import {
  classifyFailure,
  DiagnosticEvent,
  markFailure,
  Outcome,
  observeSpan,
  reportDiagnostic,
  SpanName,
} from "../../observability";
import { streamMcpResponse } from "./response";

const catalog = tools.map((tool) => {
  const result = specTypeSchemas.Tool["~standard"].validate(tool);
  if (result.issues) {
    throw new Error("INVALID_TOOL_SCHEMA");
  }
  return result.value;
});
async function invoke(env: Bindings, name: string, args: unknown) {
  if (planningDefinitions.some((tool) => tool.name === name)) {
    const input = PlanningCommandSchema.parse({
      ...z.record(z.string(), z.unknown()).parse(args),
      tool: name,
    });
    return planningService(env).execute(input);
  }
  const finance = financialService(env);
  switch (name) {
    case ToolName.status: {
      const input = ConnectionSelectionSchema.parse(args);
      const installation = installationService(env);
      return {
        ...(await installation.state(input)),
      };
    }
    case ToolName.sync: {
      const input = ConnectionSelectionSchema.parse(args);
      const sync = syncService(env);
      await sync.recover();
      return sync.request(input.connectionIds);
    }
    case ToolName.transactions:
      return finance.query(TransactionQuerySchema.parse(args));
    case ToolName.aggregate:
      return finance.aggregate(AggregateQuerySchema.parse(args));
    default:
      throw new Error("UNKNOWN_TOOL");
  }
}
const safeErrors = new Set([
  "NOT_CONFIGURED",
  "SPACE_MISMATCH",
  "INVALID_PERIOD",
  "CURRENCY_MISMATCH",
  "AMOUNT_MISMATCH",
  "SOURCE_READ_ONLY",
  "RESOURCE_IN_USE",
  "PRIMARY_CARD_REQUIRED",
  "MANUAL_ACCOUNT_REQUIRED",
  "MANUAL_CARD_REQUIRED",
  "BILLING_CYCLE_REQUIRED",
  "INVALID_INSTALLMENT",
  "CARD_REQUIRED",
  "BUDGET_DISABLED",
  "SYSTEM_CATEGORY",
  "ONE_ASSET_REQUIRED",
  "SCHEDULE_EXISTS",
  "PENDING_PAYMENTS",
  "ALREADY_RECONCILED",
  "PAYMENT_ORDER",
  "PAYMENT_MISMATCH",
  "NOT_RECONCILED",
  "SELECTION_TOO_LARGE",
  "PROJECTION_TOO_LARGE",
  "PROJECTION_REQUIRES_CURRENT_OR_FUTURE_PERIOD",
  "IDEMPOTENCY_CONFLICT",
  "CONFIRMATION_REQUIRED",
  "INVALID_RULE",
  "INVALID_RULE_IMPORT_CATEGORY",
  "SPACE_PROTECTED",
  "SPACE_NOT_EMPTY",
  "CHART_TOO_LARGE",
  "CHART_NEGATIVE_VALUES",
  "NOT_FOUND",
  "RESTART_REQUIRED",
  "CURSOR_SCOPE_MISMATCH",
  "UNKNOWN_TOOL",
  "IMPORT_FAILED",
]);
export async function fetchMcp(
  request: Request,
  env: Bindings,
  access?: {
    clientId: string | null;
    keepAlive: (lifetime: Promise<void>) => void;
  },
) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let inputBytes = 0;
  let calledTool: string | null = null;
  let model: string | null = null;
  let toolFailed = false;
  let recorded = false;
  const measuredRequest = request.body
    ? new Request(request, {
        body: request.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              inputBytes += chunk.byteLength;
              controller.enqueue(chunk);
            },
          }),
        ),
      })
    : request;
  async function finish(status: number, outcome: Outcome, outputBytes: number) {
    if (recorded) {
      return;
    }
    recorded = true;
    let finalOutcome: (typeof AuditOutcome)[keyof typeof AuditOutcome] =
      AuditOutcome.success;
    if (toolFailed || status >= 400 || outcome === Outcome.failed) {
      finalOutcome = AuditOutcome.failed;
    }
    if (outcome === Outcome.cancelled) {
      finalOutcome = AuditOutcome.cancelled;
    }
    // Audit is best effort: failure cannot replay a tool or replace its response.
    const { data: _data, error } = await tryCatch(() =>
      auditRepository(env).record({
        clientId: access?.clientId ?? null,
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        id: crypto.randomUUID(),
        inputBytes,
        model,
        outcome: finalOutcome,
        outputBytes,
        startedAt,
        status,
        tool: calledTool,
      }),
    );
    if (error) {
      markFailure(error, { phase: SpanName.mcpStream });
    }
  }

  const handler = createMcpHandler(
    () => {
      const server = new Server(
        { name: "Caderninho", version: "0.4.0" },
        {
          capabilities: { tools: {} },
          instructions: PRODUCT_INSTRUCTIONS,
          jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
        },
      );
      server.setRequestHandler("tools/list", async () => ({ tools: catalog }));
      server.setRequestHandler("tools/call", (r) => {
        calledTool = tools.some((entry) => entry.name === r.params.name)
          ? r.params.name
          : "unknown";
        const declared = AuditModelSchema.safeParse(
          r.params._meta?.["caderninho.app/model"],
        );
        model = declared.success ? declared.data : null;
        const action =
          Object.values(ToolName).find((name) => name === r.params.name) ??
          (planningDefinitions.find((tool) => tool.name === r.params.name)
            ?.readOnly
            ? "query"
            : "write");
        return observeSpan(
          SpanName.mcpCall,
          async (span) => {
            const { data, error } = await tryCatch(() =>
              invoke(env, r.params.name, r.params.arguments ?? {}),
            );
            toolFailed = !!error;
            if (error) {
              markFailure(error, { phase: SpanName.mcpCall });
              span.annotate({ failure: classifyFailure(error) });
            }
            reportDiagnostic({
              action,
              event: DiagnosticEvent.mcp,
              ...(!error && { outcome: Outcome.success }),
            });
            const payload = error ? publicError(error) : data;
            return {
              content: [{ text: JSON.stringify(payload), type: "text" }],
              isError: !!error,
            };
          },
          { action },
        );
      });
      return server;
    },
    {
      keepAliveMs: 0,
      legacy: "stateless",
      maxRequestBodySize: 131_072,
      responseMode: "auto",
    },
  );
  const { data: response, error } = await tryCatch(() =>
    handler.fetch(measuredRequest),
  );
  if (error) {
    await handler.close();
    await finish(500, Outcome.failed, 0);
    throw error;
  }
  if (!response.body) {
    await handler.close();
    await finish(response.status, Outcome.success, 0);
    return response;
  }
  return streamMcpResponse({
    action: "unknown",
    ...(access && { keepAlive: access.keepAlive }),
    close: () => handler.close(),
    onFinish: (outcome, bytes) => finish(response.status, outcome, bytes),
    response,
    signal: request.signal,
  });
}

function publicError(error: Error) {
  if (safeErrors.has(error.message)) {
    return { error: error.message };
  }
  if (error instanceof z.ZodError) {
    return {
      error: "INVALID_FILTER",
      issues: error.issues.map((issue) => ({
        message:
          issue.code === "unrecognized_keys" ? "Unknown field" : issue.message,
        path: issue.path.join("."),
      })),
    };
  }
  if (error instanceof Fault && error.code.startsWith("UPSTREAM_")) {
    return { error: "UPSTREAM_UNAVAILABLE" };
  }
  return { error: "IMPORT_FAILED" };
}
