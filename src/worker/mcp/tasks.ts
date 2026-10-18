import { Validator } from "@cfworker/json-schema";
import { specTypeSchemas } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

import { JsonValueSchema } from "#shared/json.ts";
import { tryCatch } from "#shared/result.ts";
import type { Bindings } from "#worker/bindings.ts";
import { syncService } from "#worker/composition.ts";
import { operationState } from "#worker/sync/repository.ts";
import schema from "#worker/vendor/ext-tasks/schema.json" with { type: "json" };

// Shape of ext-tasks/schema/2026-07-28, not the legacy SDK Task aliases.
export const EXTENSION = "io.modelcontextprotocol/tasks";
const Base = {
  taskId: z.string(),
  createdAt: z.string(),
  lastUpdatedAt: z.string(),
  ttlMs: z.number().int().nullable(),
  pollIntervalMs: z.number().int().optional(),
  statusMessage: z.string().optional(),
};
export const TaskSchema = z.discriminatedUnion("status", [
  z.object({ ...Base, status: z.literal("working") }),
  z.object({ ...Base, status: z.literal("cancelled") }),
  z.object({
    ...Base,
    status: z.literal("completed"),
    result: z.record(z.string(), JsonValueSchema),
  }),
  z.object({
    ...Base,
    status: z.literal("failed"),
    error: z.record(z.string(), JsonValueSchema),
  }),
]);
export const TaskParams = z.object({ taskId: z.string() });
export const UpdateParams = TaskParams.extend({
  inputResponses: z.record(z.string(), JsonValueSchema),
});
export async function task(
  env: Bindings,
  id: string,
): Promise<z.infer<typeof TaskSchema>> {
  const state = await operationState(env.DB, id);
  const base = {
    taskId: state.id,
    createdAt: state.createdAt,
    lastUpdatedAt: state.updatedAt,
    statusMessage: state.summary,
    ttlMs: null,
    pollIntervalMs: 5000,
  };
  if (state.status === "completed") {
    return { ...base, status: state.status, result: state.result ?? {} };
  }
  if (state.status === "failed") {
    return { ...base, status: state.status, error: state.error ?? {} };
  }
  return { ...base, status: state.status };
}

export function negotiated(input: unknown) {
  const p = z
    .object({
      _meta: z
        .object({
          "io.modelcontextprotocol/clientCapabilities": z
            .object({
              extensions: z.record(z.string(), z.object({}).loose()).optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .safeParse(input);
  return Boolean(
    p.success &&
      p.data._meta?.["io.modelcontextprotocol/clientCapabilities"]
        ?.extensions &&
      Object.hasOwn(
        p.data._meta["io.modelcontextprotocol/clientCapabilities"].extensions,
        EXTENSION,
      ),
  );
}
export async function cancel(env: Bindings, id: string) {
  await syncService(env).cancel(id);
  return { resultType: "complete" };
}
export async function listen(
  request: Request,
  env: Bindings,
  {
    id,
    ids,
    keepAlive,
  }: {
    id: string | number;
    ids: string[];
    keepAlive?: ((lifetime: Promise<void>) => void) | undefined;
  },
) {
  if (ids.length < 1 || ids.length > 10 || new Set(ids).size !== ids.length) {
    throw new Error("SUBSCRIPTION_LIMIT");
  }
  const current = await Promise.all(ids.map((t) => task(env, t)));
  const polling = current.some((state) => state.status === "working")
    ? pollingEvents()
    : undefined;
  const meta = { "io.modelcontextprotocol/subscriptionId": id };
  const queue: unknown[] = [
    {
      jsonrpc: "2.0",
      method: "notifications/subscriptions/acknowledged",
      params: { _meta: meta, notifications: { taskIds: ids } },
    },
    ...current.map((t) => ({
      jsonrpc: "2.0",
      method: "notifications/tasks",
      params: { ...t, _meta: meta },
    })),
  ];
  validateSubscriptionWire("SubscriptionsAcknowledgedNotification", queue[0]);
  validateTaskWire("TaskSubscriptionAcknowledgedNotifications", {
    taskIds: ids,
  });
  let release: () => void = () => {};
  const lifetime = new Promise<void>((resolve) => {
    release = resolve;
  });
  keepAlive?.(lifetime);
  let disposed = false,
    clientClosed = false;
  // Read live cancellation state after awaits; callbacks may change it meanwhile.
  const isClientClosed = () => clientClosed;
  const expires = setTimeout(() => dispose(), 300000);
  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    release();
    clearTimeout(expires);
    polling?.[Symbol.dispose]();
    request.signal.removeEventListener("abort", abort);
  }
  function abort() {
    clientClosed = true;
    dispose();
  }
  request.signal.addEventListener("abort", abort, { once: true });
  async function enqueueTaskUpdates() {
    if (!polling) {
      return true;
    }
    const event = await polling.next();
    if (isClientClosed() || event.done) {
      return true;
    }
    let allTerminal = true;
    for (const taskId of ids) {
      const state = await task(env, taskId);
      if (state.status === "working") {
        allTerminal = false;
      }
      queue.push({
        jsonrpc: "2.0",
        method: "notifications/tasks",
        params: { ...state, _meta: meta },
      });
    }
    return allTerminal;
  }
  function flushMessage(
    controller: ReadableStreamDefaultController<Uint8Array>,
  ) {
    const message = queue.shift();
    if (
      message &&
      typeof message === "object" &&
      "method" in message &&
      message.method === "notifications/tasks"
    ) {
      validateTaskWire("TaskStatusNotification", message);
    }
    if (message) {
      controller.enqueue(
        new TextEncoder().encode(
          `event: message\ndata: ${JSON.stringify(message)}\n\n`,
        ),
      );
    }
    if (disposed && queue.length === 0) {
      controller.close();
    }
  }
  const stream = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const outcome = await tryCatch(
          (async () => {
            if (isClientClosed()) {
              return;
            }
            if (disposed && queue.length === 0) {
              controller.close();
              return;
            }
            if (queue.length === 0) {
              const allTerminal = await enqueueTaskUpdates();
              if (isClientClosed()) {
                return;
              }
              if (allTerminal) {
                queue.push({
                  jsonrpc: "2.0",
                  id,
                  result: validateSubscriptionWire(
                    "SubscriptionsListenResult",
                    { resultType: "complete" },
                  ),
                });
                dispose();
              }
            }
            flushMessage(controller);
          })(),
        );
        if (outcome.error && !isClientClosed()) {
          dispose();
          // Finish the SSE response with a protocol error. Erroring a response
          // stream can abort unrelated requests in the local RPC bridge.
          controller.enqueue(
            new TextEncoder().encode(
              "event: message\ndata: " +
                JSON.stringify({
                  jsonrpc: "2.0",
                  id,
                  error: {
                    code: -32603,
                    message: "SUBSCRIPTION_CLOSED_RECONNECT",
                  },
                }) +
                "\n\n",
            ),
          );
          controller.close();
        }
      },
      cancel() {
        clientClosed = true;
        dispose();
      },
    },
    { highWaterMark: 1 },
  );
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

// Portable wake-up source: execution stays in Workflows, authoritative state in
// D1. A timer only drives the open SSE reader; it never performs financial work.
export function pollingEvents(intervalMs = 5000) {
  let disposed = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    wake: (() => void) | undefined;
  return {
    async next() {
      if (disposed) {
        return { done: true };
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
        timer = setTimeout(resolve, intervalMs);
      });
      wake = undefined;
      return { done: disposed };
    },
    [Symbol.dispose]() {
      disposed = true;
      if (timer) {
        clearTimeout(timer);
      }
      wake?.();
    },
  };
}

const validators = new Map<string, Validator>();
export function validateTaskWire(
  name: keyof typeof schema.$defs,
  value: unknown,
) {
  let validator = validators.get(name);
  if (!validator) {
    validator = new Validator(
      { ...schema, $ref: `#/$defs/${name}` },
      "2020-12",
    );
    validators.set(name, validator);
  }
  const result = validator.validate(value);
  if (!result.valid) {
    throw new Error(`Invalid official Tasks contract: ${name}`);
  }
  return value;
}

export function validateSubscriptionWire(
  name:
    | "SubscriptionsAcknowledgedNotification"
    | "SubscriptionsListenRequest"
    | "SubscriptionsListenResult",
  value: unknown,
) {
  const result = specTypeSchemas[name]["~standard"].validate(value);
  if (result.issues) {
    throw new Error(`Invalid official subscription contract: ${name}`);
  }
  return result.value;
}
