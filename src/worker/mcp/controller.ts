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
  PRODUCT_INSTRUCTIONS,
  tools,
} from "#contracts/mcp-contract.ts";
import { RulesSchema } from "#domain/rules/rules.ts";
import { parseJson } from "#shared/json.ts";
import { tryCatch } from "#shared/result.ts";
import type { Bindings } from "#worker/bindings.ts";
import {
  financialQueries,
  ruleActions,
  syncService,
} from "#worker/composition.ts";
import { importRuleDocument } from "#worker/finance/service.ts";
import { boundedJson } from "#worker/http.ts";
import { invoke } from "#worker/mcp/invoke.ts";
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
} from "#worker/mcp/tasks.ts";
import { migrationHttp } from "#worker/sync/controller.ts";
import { getOperation, startOperation } from "#worker/sync/repository.ts";

const Envelope = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.json()).optional(),
});
const longKinds = new Map<string, "sync" | "reconcile" | "reapply">([
  ["caderninho_sync", "sync"],
  ["caderninho_reconcile", "reconcile"],
  ["caderninho_reapply", "reapply"],
]);
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
  return routes.fetch(request, env);
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
    const parsed = Envelope.safeParse(message);
    if (parsed.success) {
      const m = parsed.data;
      const params = m.params ?? {};
      let kind: "sync" | "reconcile" | "reapply" | undefined;
      if (m.method === "tools/call" && typeof params.name === "string") {
        kind = longKinds.get(params.name);
      }
      if (
        m.method.startsWith("tasks/") ||
        m.method === "subscriptions/listen" ||
        kind
      ) {
        return handleTaskRequest({ request, env, m, params, kind, ctx });
      }
    }
  }
  const handler = createMcpHandler(
    () => {
      const server = new Server(
        { name: "Caderninho", version: "0.4.0" },
        {
          capabilities: { tools: {}, extensions: { [EXTENSION]: {} } },
          instructions: PRODUCT_INSTRUCTIONS,
          jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
        },
      );
      server.setRequestHandler("tools/list", async () => ({
        tools: tools.map((tool) => {
          const validated = specTypeSchemas.Tool["~standard"].validate(tool);
          if (validated.issues) {
            throw new Error("INVALID_TOOL_SCHEMA");
          }
          return validated.value;
        }),
      }));
      server.setRequestHandler("tools/call", async (r) => {
        const outcome = await tryCatch(
          invoke(
            financialQueries(env),
            r.params.name,
            r.params.arguments ?? {},
          ),
        );
        const data = outcome.error
          ? { error: outcome.error.message }
          : outcome.data;
        return {
          resultType: "complete",
          content: [{ type: "text", text: JSON.stringify(data) }],
          isError: Boolean(outcome.error),
        };
      });
      return server;
    },
    {
      legacy: "stateless",
      responseMode: "auto",
      maxRequestBodySize: 32768,
      keepAliveMs: 0,
    },
  );
  const req =
    text === undefined
      ? request
      : new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: text,
          signal: request.signal,
        });
  const result = await tryCatch(handler.fetch(req));
  if (result.error) {
    await handler.close();
    throw result.error;
  }
  const response = result.data;
  if (!response.body) {
    await handler.close();
    return response;
  }
  const reader = response.body.getReader();
  const stream = new ReadableStream({
    async pull(controller) {
      const r = await tryCatch(reader.read());
      if (r.error) {
        await handler.close();
        controller.error(r.error);
        return;
      }
      if (r.data.done) {
        await handler.close();
        controller.close();
        return;
      }
      controller.enqueue(r.data.value);
    },
    async cancel() {
      await reader.cancel();
      await handler.close();
    },
  });
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(stream, { status: response.status, headers });
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
  m: z.infer<typeof Envelope>;
  params: NonNullable<z.infer<typeof Envelope>["params"]>;
  kind: "sync" | "reconcile" | "reapply" | undefined;
  ctx: ExecutionContext | undefined;
}) {
  const response = (result: unknown) =>
    Response.json(
      { jsonrpc: "2.0", id: m.id, result },
      { headers: { "Cache-Control": "no-store" } },
    );
  const error = (code: number, message: string, data?: unknown) =>
    Response.json(
      {
        jsonrpc: "2.0",
        id: m.id ?? null,
        error: { code, message, ...(data ? { data } : {}) },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  if (m.id === undefined) {
    return error(-32600, "Request id required");
  }
  if (request.headers.get("Mcp-Protocol-Version") !== "2026-07-28") {
    return error(-32600, "Tasks require protocol 2026-07-28");
  }
  const expectedName = kind ? params.name : params.taskId;
  if (
    request.headers.get("Mcp-Method") !== m.method ||
    (expectedName && request.headers.get("Mcp-Name") !== expectedName)
  ) {
    return error(-32020, "MCP routing headers disagree with request");
  }
  const version = z
    .object({
      "io.modelcontextprotocol/protocolVersion": z.literal("2026-07-28"),
    })
    .loose()
    .safeParse(params._meta);
  if (params._meta && !version.success) {
    return error(-32600, "Protocol metadata must match routing version");
  }
  if (!negotiated(params)) {
    return error(-32021, "Missing required client capability", {
      requiredCapabilities: { extensions: { [EXTENSION]: {} } },
    });
  }
  const attempt = await tryCatch(
    (async () => {
      if (kind) {
        const op = await createLongOperation(env, { kind, params });
        return response(
          validateTaskWire("CreateTaskResult", {
            ...(await task(env, op.id)),
            resultType: "task",
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
        await getOperation(env.DB, a.taskId);
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
          return error(-32600, "SSE Accept required");
        }
        return listen(request, env, {
          id: m.id ?? "",
          ids: a.notifications.taskIds,
          keepAlive: ctx ? (lifetime) => ctx.waitUntil(lifetime) : undefined,
        });
      }
      return error(-32601, "Method not found");
    })(),
  );
  if (attempt.error) {
    return error(-32602, "Invalid or unauthorized operation");
  }
  return attempt.data;
}

async function createLongOperation(
  env: Bindings,
  {
    kind,
    params,
  }: {
    kind: "sync" | "reconcile" | "reapply";
    params: NonNullable<z.infer<typeof Envelope>["params"]>;
  },
) {
  const args = LongInput.parse(params.arguments);
  if (kind !== "reapply" && args.filter) {
    throw new Error("SYNC_FILTER_NOT_SUPPORTED_USE_ITEM_SCOPE");
  }
  if (args.renormalize && kind !== "reconcile") {
    throw new Error("RENORMALIZE_REQUIRES_RECONCILIATION");
  }
  const op = await startOperation(env.DB, args.requestKey, {
    kind,
    itemIds: args.itemIds,
    ...(args.renormalize ? { renormalize: true } : {}),
    ...(args.filter ? { filter: args.filter } : {}),
  });
  await tryCatch(syncService(env).dispatch(op)); // Durable outbox survives uncertain Workflow creation.
  return op;
}

export const MAX_MCP_BODY_BYTES = 32768;

// Consume the original stream under the SDK's byte limit, before auth/JSON parsing.
// Cloning first would leave an unbounded tee buffer for the unread branch.
export async function readMcpBody(
  request: Request,
): Promise<string | Response> {
  const result = await tryCatch(readRequestBody(request, MAX_MCP_BODY_BYTES));

  if (result.error) {
    return new Response("Unreadable request body", { status: 400 });
  }

  if (result.data.tooLarge) {
    return new Response("Request too large", { status: 413 });
  }

  return result.data.text;
}

export async function importHttp(request: Request, env: Bindings) {
  const a = z
    .object({
      document: z.json(),
      catalog: RulesSchema.pick({ groups: true, categories: true }).optional(),
      mode: z.enum(["dry-run", "save", "activate"]).default("dry-run"),
    })
    .strict()
    .parse(await boundedJson(request, 1048576, true));
  return Response.json(await importRuleDocument(ruleActions(env), a), {
    headers: { "Cache-Control": "no-store" },
  });
}
