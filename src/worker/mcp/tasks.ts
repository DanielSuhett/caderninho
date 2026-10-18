import { Validator } from "@cfworker/json-schema";
import { specTypeSchemas } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

import { JsonValueSchema } from "#shared/json.ts";
import { tryCatch } from "#shared/result.ts";
import type { Bindings, InstanceEvents } from "#worker/bindings.ts";
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
export async function task(env: Bindings, principal: string, id: string) {
  const state = await operationState(env.DB, principal, id);
  return TaskSchema.parse({
    taskId: state.id,
    status: state.status,
    createdAt: state.createdAt,
    lastUpdatedAt: state.updatedAt,
    statusMessage: state.summary,
    ...(state.result ? { result: state.result } : {}),
    ...(state.error ? { error: state.error } : {}),
    ttlMs: null,
    pollIntervalMs: 5000,
  });
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
    p.data._meta?.["io.modelcontextprotocol/clientCapabilities"]?.extensions &&
    Object.hasOwn(
      p.data._meta["io.modelcontextprotocol/clientCapabilities"].extensions,
      EXTENSION,
    ),
  );
}
export async function cancel(env: Bindings, principal: string, id: string) {
  await syncService(env).cancel(principal, id);
  return { resultType: "complete" };
}
export async function listen(
  request: Request,
  env: Bindings,
  principal: string,
  id: string | number,
  ids: string[],
  keepAlive?: (lifetime: Promise<void>) => void,
) {
  if (ids.length < 1 || ids.length > 10 || new Set(ids).size !== ids.length)
    throw new Error("SUBSCRIPTION_LIMIT");
  const current = await Promise.all(ids.map((t) => task(env, principal, t)));
  const sources: InstanceEvents[] = [];
  // D1 watchdog also covers native-stream stalls and the create/subscribe race.
  if (current.some((t) => t.status === "working"))
    sources.push(pollingEvents());
  if (env.TASK_EVENT_SOURCE === "workflow")
    for (const state of current)
      if (state.status === "working") {
        let expired = false,
          timer: ReturnType<typeof setTimeout> | undefined;
        const opening = tryCatch(
          env.FINANCE.get(state.taskId).then((instance) =>
            instance.subscribe({
              filter: [
                "step_completed",
                "workflow_completed",
                "workflow_errored",
                "workflow_terminated",
              ],
            }),
          ),
        ).then((result) => {
          if (expired && !result.error) result.data[Symbol.dispose]();
          return result;
        });
        const result = await Promise.race([
          opening,
          new Promise<null>((resolve) => {
            timer = setTimeout(() => {
              expired = true;
              resolve(null);
            }, 2000);
          }),
        ]);
        if (timer !== undefined) clearTimeout(timer);
        if (result && !result.error) sources.push(result.data);
      }
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
  const expires = setTimeout(() => dispose(), 300000);
  const pending = new Map<number, Promise<{ index: number; done: boolean }>>();
  function advance(index: number) {
    const source = sources[index];
    if (!source) throw new Error("TASK_SOURCE_NOT_FOUND");
    pending.set(
      index,
      tryCatch(source.next()).then((r) => ({
        index,
        done: r.error ? true : r.data.done,
      })),
    );
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    release();
    clearTimeout(expires);
    for (const source of sources) source[Symbol.dispose]();
    request.signal.removeEventListener("abort", abort);
  }
  function abort() {
    clientClosed = true;
    dispose();
  }
  request.signal.addEventListener("abort", abort, { once: true });
  const stream = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const outcome = await tryCatch(
          (async () => {
            if (clientClosed) return;
            if (disposed && queue.length === 0) {
              controller.close();
              return;
            }
            if (queue.length === 0) {
              if (pending.size === 0) {
                for (let i = 0; i < sources.length; i++) advance(i);
              }
              if (pending.size) {
                const event = await Promise.race(pending.values());
                if (clientClosed) return;
                pending.delete(event.index);
                if (!event.done) advance(event.index);
                let allTerminal = true;
                for (const t of ids) {
                  const state = await task(env, principal, t);
                  if (state.status === "working") allTerminal = false;
                  queue.push({
                    jsonrpc: "2.0",
                    method: "notifications/tasks",
                    params: { ...state, _meta: meta },
                  });
                }
                if (allTerminal || (event.done && pending.size === 0)) {
                  queue.push({
                    jsonrpc: "2.0",
                    id,
                    result: validateSubscriptionWire(
                      "SubscriptionsListenResult",
                      {
                        resultType: "complete",
                      },
                    ),
                  });
                  dispose();
                }
              } else {
                queue.push({
                  jsonrpc: "2.0",
                  id,
                  result: validateSubscriptionWire(
                    "SubscriptionsListenResult",
                    {
                      resultType: "complete",
                    },
                  ),
                });
                dispose();
              }
            }
            const message = queue.shift();
            if (
              message &&
              typeof message === "object" &&
              "method" in message &&
              message.method === "notifications/tasks"
            )
              validateTaskWire("TaskStatusNotification", message);
            if (message)
              controller.enqueue(
                new TextEncoder().encode(
                  "event: message\ndata: " + JSON.stringify(message) + "\n\n",
                ),
              );
            if (disposed && queue.length === 0) controller.close();
          })(),
        );
        if (outcome.error && !clientClosed) {
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
export function pollingEvents(intervalMs = 5000): InstanceEvents {
  let disposed = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    wake: (() => void) | undefined;
  return {
    async next() {
      if (disposed) return { done: true };
      await new Promise<void>((resolve) => {
        wake = resolve;
        timer = setTimeout(resolve, intervalMs);
      });
      wake = undefined;
      return disposed
        ? { done: true }
        : { done: false, value: { type: "poll", eventId: 0 } };
    },
    [Symbol.dispose]() {
      disposed = true;
      if (timer) clearTimeout(timer);
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
  if (!result.valid)
    throw new Error(`Invalid official Tasks contract: ${name}`);
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
  if (result.issues)
    throw new Error(`Invalid official subscription contract: ${name}`);
  return result.value;
}
