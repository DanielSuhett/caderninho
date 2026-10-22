import {
  createMcpHandler,
  Server,
  specTypeSchemas,
} from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { z } from "zod/v4";

import {
  AggregateQuerySchema,
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
  "CHART_TOO_LARGE",
  "CHART_NEGATIVE_VALUES",
  "NOT_FOUND",
  "RESTART_REQUIRED",
  "CURSOR_SCOPE_MISMATCH",
  "UNKNOWN_TOOL",
  "IMPORT_FAILED",
]);
export async function fetchMcp(request: Request, env: Bindings) {
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
            if (error) {
              markFailure(error, { phase: SpanName.mcpCall });
              span.annotate({ failure: classifyFailure(error) });
            }
            reportDiagnostic({
              action,
              event: DiagnosticEvent.mcp,
              ...(!error && { outcome: Outcome.success }),
            });
            const payload = error ? { error: publicError(error) } : data;
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
    handler.fetch(request),
  );
  if (error) {
    await handler.close();
    throw error;
  }
  if (!response.body) {
    await handler.close();
    return response;
  }
  return streamMcpResponse({
    action: "unknown",
    close: () => handler.close(),
    response,
    signal: request.signal,
  });
}

function publicError(error: Error) {
  if (safeErrors.has(error.message)) {
    return error.message;
  }
  if (error instanceof z.ZodError) {
    return "INVALID_FILTER";
  }
  if (error instanceof Fault && error.code.startsWith("UPSTREAM_")) {
    return "UPSTREAM_UNAVAILABLE";
  }
  return "IMPORT_FAILED";
}
