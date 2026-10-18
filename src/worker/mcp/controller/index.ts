import {
  createMcpHandler,
  readRequestBody,
  Server,
  specTypeSchemas,
} from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { Hono } from "hono";
import { z } from "zod/v4";

import {
  LongInput,
  type LongOperationKind,
  OperationKind,
  PRODUCT_INSTRUCTIONS,
  ReapplicationInputSchema,
  RuleImportMode,
  ToolName,
  tools,
} from "../../../contracts";
import { RulesSchema } from "../../../domain/rules";
import { parseJson, tryCatch } from "../../../shared";
import type { Bindings } from "../../bindings";
import {
  financialQueries,
  reapplyRules,
  ruleActions,
  syncService,
} from "../../composition";
import { importRuleDocument } from "../../finance";
import { boundedJson } from "../../http";
import { migrationHttp } from "../../sync/controller";
import { invoke } from "../invoke";
import type { Envelope } from "../protocol.types";
import {
  cancel,
  EXTENSION,
  listen,
  negotiated,
  TaskParams,
  task,
  UpdateParams,
  validateSubscriptionWire,
  validateTaskWire,
} from "../tasks";

const EnvelopeSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.record(z.string(), z.json()).optional(),
}) satisfies z.ZodType<Envelope>;
const longKinds = new Map<string, LongOperationKind>([
  [ToolName.sync, OperationKind.sync],
  [ToolName.reconcile, OperationKind.reconcile],
  [ToolName.reapply, OperationKind.reapply],
]);
// The catalog is controlled code. Adapt it to the SDK once per isolate,
// instead of validating the same declarations on every tools/list request.
const catalog = tools.map((tool) => {
  const validated = specTypeSchemas.Tool["~standard"].validate(tool);
  if (validated.issues) {
    throw new Error("INVALID_TOOL_SCHEMA");
  }
  return validated.value;
});
export async function fetchMcp(
  request: Request,
  env: Bindings,
  ctx?: ExecutionContext,
) {
  const routes = new Hono<{ Bindings: Bindings }>();
  routes.onError((error) => {
    throw error;
  });
  routes.post("/mcp/rules/import", (c) => importHttp(c.req.raw, c.env));
  routes.post("/mcp/migration", (c) => migrationHttp(c.req.raw, c.env));
  routes.all("*", (c) => fetchTransport(c.req.raw, c.env, ctx));
  return await routes.fetch(request, env);
}
async function fetchTransport(
  request: Request,
  env: Bindings,
  ctx?: ExecutionContext,
) {
  let text: string | undefined;
  if (request.method === "POST") {
    const body = await readMcpBody(request);
    if (body instanceof Response) {
      return body;
    }
    text = body;
    let message: unknown;
    try {
      message = parseJson(body);
    } catch {
      message = null;
    }
    const parsed = EnvelopeSchema.safeParse(message);
    if (parsed.success) {
      const { data: m } = parsed;
      const params = m.params ?? {};
      let kind: LongOperationKind | undefined;
      if (m.method === "tools/call" && typeof params.name === "string") {
        kind = longKinds.get(params.name);
      }
      if (
        m.method.startsWith("tasks/") ||
        m.method === "subscriptions/listen" ||
        kind
      ) {
        return handleTaskRequest({ ctx, env, kind, m, params, request });
      }
    }
  }
  const handler = createMcpHandler(
    () => {
      const server = new Server(
        { name: "Caderninho", version: "0.4.0" },
        {
          capabilities: { extensions: { [EXTENSION]: {} }, tools: {} },
          instructions: PRODUCT_INSTRUCTIONS,
          jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
        },
      );
      server.setRequestHandler("tools/list", async () => ({ tools: catalog }));
      server.setRequestHandler("tools/call", async (r) => {
        const { data, error } = await tryCatch(() =>
          invoke(
            financialQueries(env),
            r.params.name,
            r.params.arguments ?? {},
          ),
        );
        const payload = error ? { error: error.message } : data;
        return {
          content: [{ text: JSON.stringify(payload), type: "text" }],
          isError: !!error,
          resultType: "complete",
        };
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
  const req =
    text === undefined
      ? request
      : new Request(request.url, {
          body: text,
          headers: request.headers,
          method: request.method,
          signal: request.signal,
        });
  const { data, error } = await tryCatch(() => handler.fetch(req));
  if (error) {
    await handler.close();
    throw error;
  }
  const response = data;
  if (!response.body) {
    await handler.close();
    return response;
  }
  const reader = response.body.getReader();
  const stream = new ReadableStream({
    async cancel() {
      await reader.cancel();
      await handler.close();
    },
    async pull(controller) {
      const { data: chunk, error: readError } = await tryCatch(() =>
        reader.read(),
      );
      if (readError) {
        await handler.close();
        controller.error(readError);
        return;
      }
      if (chunk.done) {
        await handler.close();
        controller.close();
        return;
      }
      controller.enqueue(chunk.value);
    },
  });
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(stream, { headers, status: response.status });
}

async function handleTaskRequest({
  request,
  env,
  m,
  params,
  kind,
  ctx,
}: {
  request: Request;
  env: Bindings;
  m: Envelope;
  params: NonNullable<Envelope["params"]>;
  kind: LongOperationKind | undefined;
  ctx: ExecutionContext | undefined;
}) {
  const response = (result: unknown) =>
    Response.json(
      { id: m.id, jsonrpc: "2.0", result },
      { headers: { "Cache-Control": "no-store" } },
    );
  const failure = (code: number, message: string, details?: unknown) =>
    Response.json(
      {
        error: { code, message, ...(!!details && { data: details }) },
        id: m.id ?? null,
        jsonrpc: "2.0",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  if (m.id === undefined) {
    return failure(-32_600, "Request id required");
  }
  if (request.headers.get("Mcp-Protocol-Version") !== "2026-07-28") {
    return failure(-32_600, "Tasks require protocol 2026-07-28");
  }
  const expectedName = kind ? params.name : params.taskId;
  if (
    request.headers.get("Mcp-Method") !== m.method ||
    (expectedName && request.headers.get("Mcp-Name") !== expectedName)
  ) {
    return failure(-32_020, "MCP routing headers disagree with request");
  }
  const version = z
    .object({
      "io.modelcontextprotocol/protocolVersion": z.literal("2026-07-28"),
    })
    .loose()
    .safeParse(params._meta);
  if (params._meta && !version.success) {
    return failure(-32_600, "Protocol metadata must match routing version");
  }
  if (kind !== OperationKind.reapply && !negotiated(params)) {
    return failure(-32_021, "Missing required client capability", {
      requiredCapabilities: { extensions: { [EXTENSION]: {} } },
    });
  }
  const { data, error } = await tryCatch(async () => {
    if (kind === OperationKind.reapply) {
      return response(await localReapplication(env, params));
    }
    if (kind) {
      const admitted = await createLongOperation(env, { kind, params });
      if (!admitted.operation) {
        return response({
          content: [{ text: JSON.stringify(admitted), type: "text" }],
          isError: false,
          resultType: "complete",
        });
      }
      return response(
        validateTaskWire("CreateTaskResult", {
          ...(await task(env, admitted.operation.id)),
          resultType: "task",
          statusMessage: JSON.stringify(admitted.items),
        }),
      );
    }
    if (m.method === "tasks/get") {
      validateTaskWire("GetTaskRequest", m);
      const a = TaskParams.parse(params);
      return response(
        validateTaskWire("GetTaskResult", {
          ...(await task(env, a.taskId)),
          resultType: "complete",
        }),
      );
    }
    if (m.method === "tasks/cancel") {
      validateTaskWire("CancelTaskRequest", m);
      const a = TaskParams.parse(params);
      return response(
        validateTaskWire("CancelTaskResult", await cancel(env, a.taskId)),
      );
    }
    if (m.method === "tasks/update") {
      validateTaskWire("UpdateTaskRequest", m);
      const a = UpdateParams.parse(params);
      await task(env, a.taskId);
      return response(
        validateTaskWire("UpdateTaskResult", {
          resultType: "complete",
        }),
      );
    }
    if (m.method === "subscriptions/listen") {
      validateSubscriptionWire("SubscriptionsListenRequest", m);
      const a = z
        .object({
          notifications: z.object({ taskIds: z.array(z.string()) }),
        })
        .parse(params);
      if (!request.headers.get("Accept")?.includes("text/event-stream")) {
        return failure(-32_600, "SSE Accept required");
      }
      return listen(request, env, {
        id: m.id ?? "",
        ids: a.notifications.taskIds,
        ...(ctx && {
          keepAlive: (lifetime: Promise<void>) => ctx.waitUntil(lifetime),
        }),
      });
    }
    return failure(-32_601, "Method not found");
  });
  if (error) {
    return failure(-32_602, operationError(error));
  }
  return data;
}

const operationErrors = new Set([
  "IDEMPOTENCY_CONFLICT",
  "REAPPLICATION_CONFLICT_START_NEW_REQUEST",
  "REAPPLICATION_TOO_LARGE_USE_BATCHES",
  "REAPPLICATION_SELECTION_CONFLICT",
  "FINANCIAL_EXECUTOR_BUSY_RETRY_BATCH",
  "REAPPLICATION_CANCELLED",
  "RENORMALIZE_REQUIRES_RECONCILIATION",
  "SYNC_FILTER_NOT_SUPPORTED_USE_ITEM_SCOPE",
]);
function operationError(error: Error) {
  return operationErrors.has(error.message)
    ? error.message
    : "Invalid operation";
}

async function localReapplication(
  env: Bindings,
  params: NonNullable<Envelope["params"]>,
) {
  const input = ReapplicationInputSchema.parse(params.arguments);
  const result = await reapplyRules(env)(input);
  if (!negotiated(params)) {
    return {
      content: [{ text: JSON.stringify(result), type: "text" }],
      isError: false,
      resultType: "complete",
    };
  }
  return validateTaskWire("CreateTaskResult", {
    ...(await task(
      env,
      `${result.operationId}/batch/${input.continuation?.batch ?? 0}`,
    )),
    resultType: "task",
  });
}

async function createLongOperation(
  env: Bindings,
  {
    kind,
    params,
  }: {
    kind: LongOperationKind;
    params: NonNullable<Envelope["params"]>;
  },
) {
  const args = LongInput.parse(params.arguments);
  const admitted = await syncService(env).start(args.requestKey, {
    itemIds: args.itemIds,
    kind,
    ...(args.renormalize && { renormalize: true }),
    ...(args.filter && { filter: args.filter }),
  });
  // Durable outbox survives uncertain Workflow creation.
  const op = admitted.operation;
  if (!op) {
    return admitted;
  }
  await tryCatch(() => syncService(env).dispatch(op)).then(({ data, error }) =>
    error ? undefined : data,
  );
  return admitted;
}

const MAX_MCP_BODY_BYTES = 32_768;

// Consume the original stream under the SDK's byte limit, before auth/JSON parsing.
// Cloning first would leave an unbounded tee buffer for the unread branch.
async function readMcpBody(request: Request): Promise<string | Response> {
  const { data, error } = await tryCatch(() =>
    readRequestBody(request, MAX_MCP_BODY_BYTES),
  );

  if (error) {
    return new Response("Unreadable request body", { status: 400 });
  }

  if (data.tooLarge) {
    return new Response("Request too large", { status: 413 });
  }

  return data.text;
}

async function importHttp(request: Request, env: Bindings) {
  const a = z
    .object({
      catalog: RulesSchema.pick({ categories: true, groups: true }).optional(),
      document: z.json(),
      mode: z.enum(RuleImportMode).default(RuleImportMode.dry_run),
    })
    .strict()
    .parse(await boundedJson(request, 1_048_576, true));
  return Response.json(await importRuleDocument(ruleActions(env), a), {
    headers: { "Cache-Control": "no-store" },
  });
}
