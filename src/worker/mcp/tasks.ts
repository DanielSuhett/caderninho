import { Validator } from "@cfworker/json-schema";
import { specTypeSchemas } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

import { OperationStatus } from "@/contracts/operation.types";
import { JsonValueSchema } from "@/shared/json";
import { tryCatch } from "@/shared/result";
import type { OperationState } from "@/worker/sync/entity";
import schema from "@/worker/vendor/ext-tasks/schema.json" with {
  type: "json",
};

import type { Bindings } from "../bindings";
import { syncService } from "../composition";
import type { Task } from "./protocol.types";

// Shape of ext-tasks/schema/2026-07-28, not the legacy SDK Task aliases.
export const EXTENSION = "io.modelcontextprotocol/tasks";
export const TaskParams = z.object({ taskId: z.string() });
export const UpdateParams = TaskParams.extend({
  inputResponses: z.record(z.string(), JsonValueSchema),
});
export async function task(env: Bindings, id: string): Promise<Task> {
  return taskResult(await syncService(env).state(id));
}

function taskResult(state: OperationState): Task {
  const base = {
    createdAt: state.createdAt,
    lastUpdatedAt: state.updatedAt,
    pollIntervalMs: 5000,
    statusMessage: state.summary,
    taskId: state.id,
    ttlMs: null,
  };
  if (state.status === OperationStatus.completed) {
    return { ...base, result: state.result ?? {}, status: state.status };
  }
  if (state.status === OperationStatus.failed) {
    return { ...base, error: state.error ?? {}, status: state.status };
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
  if (!p.success) {
    return false;
  }
  const extensions =
    p.data._meta?.["io.modelcontextprotocol/clientCapabilities"]?.extensions;
  return !!extensions && Object.hasOwn(extensions, EXTENSION);
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
    keepAlive?: (lifetime: Promise<void>) => void;
  },
) {
  if (!ids.length || ids.length > 10 || new Set(ids).size !== ids.length) {
    throw new Error("SUBSCRIPTION_LIMIT");
  }
  const readTasks = async () =>
    (await syncService(env).states(ids)).map(taskResult);
  const current = await readTasks();
  const polling = current.some(
    (state) => state.status === OperationStatus.working,
  )
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
  let release: () => void = () => undefined;
  const lifetime = new Promise<void>((resolve) => {
    release = resolve;
  });
  keepAlive?.(lifetime);
  let disposed = false,
    clientClosed = false;
  // Read live cancellation state after awaits; callbacks may change it meanwhile.
  const isClientClosed = () => clientClosed;
  const expires = setTimeout(() => dispose(), 300_000);
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
    const latest = await readTasks();
    if (isClientClosed()) {
      return true;
    }
    for (const state of latest) {
      queue.push({
        jsonrpc: "2.0",
        method: "notifications/tasks",
        params: { ...state, _meta: meta },
      });
    }
    return latest.every((state) => state.status !== OperationStatus.working);
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
    if (disposed && !queue.length) {
      controller.close();
    }
  }
  const stream = new ReadableStream<Uint8Array>(
    {
      cancel() {
        clientClosed = true;
        dispose();
      },
      async pull(controller) {
        const { data: _data, error } = await tryCatch(async () => {
          if (isClientClosed()) {
            return;
          }
          if (disposed && !queue.length) {
            controller.close();
            return;
          }
          if (!queue.length) {
            const allTerminal = await enqueueTaskUpdates();
            if (isClientClosed()) {
              return;
            }
            if (allTerminal) {
              queue.push({
                id,
                jsonrpc: "2.0",
                result: validateSubscriptionWire("SubscriptionsListenResult", {
                  resultType: "complete",
                }),
              });
              dispose();
            }
          }
          flushMessage(controller);
        });
        if (error && !isClientClosed()) {
          dispose();
          // Finish the SSE response with a protocol error. Erroring a response
          // stream can abort unrelated requests in the local RPC bridge.
          controller.enqueue(
            new TextEncoder().encode(
              "event: message\ndata: " +
                JSON.stringify({
                  error: {
                    code: -32_603,
                    message: "SUBSCRIPTION_CLOSED_RECONNECT",
                  },
                  id,
                  jsonrpc: "2.0",
                }) +
                "\n\n",
            ),
          );
          controller.close();
        }
      },
    },
    { highWaterMark: 1 },
  );
  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  });
}

// Portable wake-up source: execution stays in Workflows, authoritative state in
// D1. A timer only drives the open SSE reader; it never performs financial work.
function pollingEvents() {
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
        timer = setTimeout(resolve, 5000);
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
