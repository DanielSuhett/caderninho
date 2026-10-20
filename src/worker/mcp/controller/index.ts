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
  CorrectionSchema,
  PRODUCT_INSTRUCTIONS,
  StatusInputSchema,
  ToolName,
  TransactionQuerySchema,
  tools,
} from "../../../contracts";
import { tryCatch } from "../../../shared";
import type { Bindings } from "../../bindings";
import {
  financialService,
  installationService,
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
  const finance = financialService(env);
  switch (name) {
    case ToolName.status: {
      const input = StatusInputSchema.parse(args);
      const installation = installationService(env);
      return {
        configured: installation.configured,
        ...(await installation.state(input)),
      };
    }
    case ToolName.sync: {
      const input = ConnectionSelectionSchema.parse(args);
      const sync = syncService(env);
      await sync.recover();
      return sync.request(input.connectionIds);
    }
    case ToolName.accounts:
      return finance.accounts(
        ConnectionSelectionSchema.parse(args).connectionIds,
      );
    case ToolName.transactions:
      return finance.query(TransactionQuerySchema.parse(args));
    case ToolName.aggregate:
      return finance.aggregate(AggregateQuerySchema.parse(args));
    case ToolName.correct:
      return finance.correct(CorrectionSchema.parse(args));
    default:
      throw new Error("UNKNOWN_TOOL");
  }
}
const safeErrors = new Set([
  "NOT_FOUND",
  "RESTART_REQUIRED",
  "CURSOR_SCOPE_MISMATCH",
  "UNKNOWN_TOOL",
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
          tools.find((tool) => tool.name === r.params.name)?.name ?? "unknown";
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
      maxRequestBodySize: 32_768,
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
    return "INVALID_REQUEST";
  }
  return "REQUEST_FAILED";
}
