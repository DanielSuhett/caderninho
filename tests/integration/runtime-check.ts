import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod/v4";

import { createLogger } from "../../src/shared/logger";
import { required, responseJson } from "../support";
import { poll } from "../support/process";

const subscriptionAcknowledgementPattern =
  /notifications\/subscriptions\/acknowledged/;

const taskNotificationPattern = /notifications\/tasks/;
const completedPattern = /completed/;
const resourceMetadataPattern = /resource_metadata/;

const logger = createLogger({ level: "info", name: "runtime-check" });

await test("native Workflow, MCP subscriptions and authenticated webhooks", async () => {
  const base = process.env.PRODUCT_TEST_URL ?? "http://127.0.0.1:8894";
  const meta = {
    "io.modelcontextprotocol/clientCapabilities": {
      extensions: { "io.modelcontextprotocol/tasks": {} },
    },
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  };
  async function rpc(
    method: string,
    params: {
      name?: string;
      taskId?: string;
      arguments?: object;
      notifications?: object;
    },
  ) {
    const response = await fetch(`${base}/mcp`, {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method,
        params: { ...params, _meta: meta },
      }),
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "Mcp-Method": method,
        "Mcp-Name": params.name ?? params.taskId ?? "",
        "Mcp-Protocol-Version": "2026-07-28",
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(
        `Synthetic RPC ${method}/${params.name ?? ""} failed: HTTP ${response.status}: ${await response.text()}`,
      );
    }
    return response;
  }
  await fetch(`${base}/setup`, { method: "POST" });
  const result = await responseJson(
    await rpc("tools/call", {
      arguments: {
        itemIds: ["11111111-1111-4111-8111-111111111111"],
        requestKey: process.env.PRODUCT_TEST_REQUEST_KEY ?? crypto.randomUUID(),
      },
      name: "caderninho_sync",
    }),
  );
  assert.ok(result.result?.taskId, JSON.stringify(result));
  const { taskId } = result.result;
  const blocked = await responseJson(
    await rpc("tools/call", {
      arguments: {
        itemIds: ["11111111-1111-4111-8111-111111111111"],
        requestKey: crypto.randomUUID(),
      },
      name: "caderninho_sync",
    }),
  );
  assert.equal(required(blocked.result).resultType, "complete");
  const admission = z
    .object({
      items: z.array(
        z.object({
          operationId: z.string(),
          status: z.enum(["working", "cooldown"]),
        }),
      ),
      operation: z.null(),
    })
    .parse(
      JSON.parse(
        required(required(required(required(blocked.result).content)[0]).text),
      ),
    );
  assert.equal(admission.items[0]?.operationId, taskId);
  logger.info({ taskId }, "Durable handle created");
  async function subscriber() {
    const response = await rpc("subscriptions/listen", {
      notifications: { taskIds: [taskId] },
    });
    assert.equal(response.headers.get("Content-Type"), "text/event-stream");
    const reader = required(response.body).getReader();
    const decoder = new TextDecoder();
    async function acknowledgement(prefix: string): Promise<string> {
      if (prefix.includes("\n\n")) {
        return prefix;
      }
      const part = await reader.read();
      assert.equal(
        part.done,
        false,
        "SSE closed before the acknowledgement event completed",
      );
      return acknowledgement(
        prefix + decoder.decode(part.value, { stream: true }),
      );
    }
    const text = await acknowledgement("");
    assert.match(text, subscriptionAcknowledgementPattern);
    return { decoder, initial: text, reader };
  }
  const first = await subscriber(),
    second = await subscriber();
  await first.reader.cancel(); // Only the listener ends.
  const denied = await responseJson(
    await rpc("tasks/get", { taskId: "unknown-task" }),
  );
  assert.ok(denied.error);
  const terminal = required(
    (
      await poll({
        attempts: 30,
        intervalMs: 1000,
        read: async () => {
          const value = await responseJson(await rpc("tasks/get", { taskId }));
          assert.ok(value.result, JSON.stringify(value));
          return value;
        },
        until: (value) => required(value.result).status !== "working",
      })
    ).result,
  );
  assert.equal(terminal.status, "completed");
  assert.equal(
    required(terminal.result).isError,
    false,
    JSON.stringify(terminal),
  );

  async function readEvents({
    decoder,
    initial,
    reader,
  }: Awaited<ReturnType<typeof subscriber>>): Promise<string> {
    const part = await reader.read();
    const text = initial + decoder.decode(part.value, { stream: !part.done });
    if (part.done) {
      return text;
    }
    return readEvents({ decoder, initial: text, reader });
  }
  const received = await readEvents(second);
  assert.match(received, taskNotificationPattern);
  assert.match(received, completedPattern);
  const late = await subscriber();
  const output = await readEvents(late);
  assert.match(output, completedPattern);
  const total = await responseJson(
    await rpc("tools/call", { arguments: {}, name: "caderninho_aggregate" }),
  );
  assert.ok(total.result, JSON.stringify(total));
  const aggregate = z
    .object({ groups: z.array(z.object({ totalMinor: z.string() })) })
    .parse(
      JSON.parse(required(required(required(total.result.content)[0]).text)),
    );
  assert.equal(
    required(aggregate.groups[0]).totalMinor,
    "-1801439850948198602",
  );
  logger.info(
    "PASS: durable Workflow, D1, two subscribers, disconnect, terminal reconnect isolation",
  );

  const unauth = await fetch(`${base}/auth-probe`, {
    headers: { "x-authenticated-user-id": "alice", "x-user-id": "alice" },
  });
  assert.equal(unauth.status, 401);
  assert.match(
    required(unauth.headers.get("WWW-Authenticate")),
    resourceMetadataPattern,
  );
  const event = {
    accountId: "22222222-2222-4222-8222-222222222222",
    event: "transactions/updated",
    eventId: crypto.randomUUID(),
    itemId: "11111111-1111-4111-8111-111111111111",
    transactionIds: ["33333333-3333-4333-8333-333333333333"],
  };
  assert.equal(
    (
      await fetch(`${base}/webhook`, {
        body: JSON.stringify(event),
        method: "POST",
      })
    ).status,
    401,
  );
  await [0, 1].reduce(async (priorDelivery) => {
    await priorDelivery;
    assert.equal(
      (
        await fetch(`${base}/webhook`, {
          body: JSON.stringify(event),
          headers: { "X-Caderninho-Webhook-Secret": "synthetic-only-secret" },
          method: "POST",
        })
      ).status,
      204,
    );
  }, Promise.resolve());
  await fetch(`${base}/recover`, { method: "POST" });
  logger.info(
    "PASS: maintained OAuth rejects forged headers; authenticated webhooks consolidate notices without dispatching another Workflow",
  );

  const notice = z
    .object({
      generation: z.number(),
      operations: z.number(),
      pending: z.boolean(),
    })
    .parse(await (await fetch(`${base}/inspect-event`)).json());
  assert.equal(notice.operations, 1);
  assert.equal(notice.pending, true);
  assert.equal(notice.generation, 1);
  await fetch(`${base}/fail-notice`, { method: "POST" });
  assert.equal(
    (
      await fetch(`${base}/webhook`, {
        body: JSON.stringify({ ...event, eventId: "synthetic-force-failure" }),
        headers: { "X-Caderninho-Webhook-Secret": "synthetic-only-secret" },
        method: "POST",
      })
    ).status,
    503,
  );
});
