import assert from "node:assert/strict";

import { z } from "zod/v4";

import { responseJson, required } from "#testing/helpers.ts";

const base = process.env.PRODUCT_TEST_URL ?? "http://127.0.0.1:8894";
const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {
    extensions: { "io.modelcontextprotocol/tasks": {} },
  },
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
  const response = await fetch(base + "/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Method": method,
      "Mcp-Name": params.name ?? params.taskId ?? "",
      "Mcp-Protocol-Version": "2026-07-28",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: { ...params, _meta: meta },
    }),
  });
  if (!response.ok)
    throw new Error(
      `Synthetic RPC ${method}/${params.name ?? ""} failed: HTTP ${response.status}: ${await response.text()}`,
    );
  return response;
}
await fetch(base + "/setup", { method: "POST" });
const result = await responseJson(
  await rpc("tools/call", {
    name: "caderninho_sync",
    arguments: {
      requestKey: crypto.randomUUID(),
      itemIds: ["11111111-1111-4111-8111-111111111111"],
    },
  }),
);
assert.ok(result.result?.taskId, JSON.stringify(result));
const taskId = result.result.taskId;
console.log("durable handle", taskId);
async function subscriber() {
  const response = await rpc("subscriptions/listen", {
    notifications: { taskIds: [taskId] },
  });
  assert.equal(response.headers.get("Content-Type"), "text/event-stream");
  const reader = required(response.body).getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (!text.includes("\n\n")) {
    const part = await reader.read();
    assert.equal(
      part.done,
      false,
      "SSE closed before the acknowledgement event completed",
    );
    text += decoder.decode(part.value, { stream: true });
  }
  assert.match(text, /notifications\/subscriptions\/acknowledged/);
  return { reader, decoder, initial: text };
}
const first = await subscriber(),
  second = await subscriber();
await first.reader.cancel(); // Only the listener ends.
const denied = await responseJson(
  await rpc("tasks/get", { taskId: "unknown-task" }),
);
assert.ok(denied.error);
let terminal;
for (let i = 0; i < 30; i++) {
  const value = await responseJson(await rpc("tasks/get", { taskId }));
  assert.ok(value.result, JSON.stringify(value));
  if (value.result.status !== "working") {
    terminal = value.result;
    break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}
assert.equal(terminal?.status, "completed");
assert.equal(
  required(terminal.result).isError,
  false,
  JSON.stringify(terminal),
);
let received = second.initial;
while (true) {
  const part = await second.reader.read();
  received += second.decoder.decode(part.value, { stream: !part.done });
  if (part.done) break;
}
assert.match(received, /notifications\/tasks/);
assert.match(received, /completed/);
const late = await subscriber();
let output = late.initial;
while (true) {
  const r = await late.reader.read();
  output += late.decoder.decode(r.value, { stream: !r.done });
  if (r.done) break;
}
assert.match(output, /completed/);
const total = await responseJson(
  await rpc("tools/call", { name: "caderninho_aggregate", arguments: {} }),
);
assert.ok(total.result, JSON.stringify(total));
const aggregate = z
  .object({ groups: z.array(z.object({ totalMinor: z.string() })) })
  .parse(
    JSON.parse(required(required(required(total.result.content)[0]).text)),
  );
assert.equal(required(aggregate.groups[0]).totalMinor, "-1801439850948198602");
console.log(
  "PASS: durable Workflow, D1, two subscribers, disconnect, terminal reconnect isolation",
);

const unauth = await fetch(base + "/auth-probe", {
  headers: { "x-user-id": "alice", "x-authenticated-user-id": "alice" },
});
assert.equal(unauth.status, 401);
assert.match(
  required(unauth.headers.get("WWW-Authenticate")),
  /resource_metadata/,
);
const event = {
  eventId: crypto.randomUUID(),
  event: "transactions/updated",
  itemId: "11111111-1111-4111-8111-111111111111",
  accountId: "22222222-2222-4222-8222-222222222222",
  transactionIds: ["33333333-3333-4333-8333-333333333333"],
};
assert.equal(
  (
    await fetch(base + "/webhook", {
      method: "POST",
      body: JSON.stringify(event),
    })
  ).status,
  401,
);
for (let i = 0; i < 2; i++)
  assert.equal(
    (
      await fetch(base + "/webhook", {
        method: "POST",
        headers: { "X-Caderninho-Webhook-Secret": "synthetic-only-secret" },
        body: JSON.stringify(event),
      })
    ).status,
    204,
  );
await fetch(base + "/recover", { method: "POST" });
console.log(
  "PASS: maintained OAuth rejects forged headers; authenticated webhook duplicate receipt and outbox recovery",
);

for (let n = 0; n < 30; n++) {
  const status = z
    .object({
      receipts: z.number(),
      processed: z.boolean(),
      operations: z.number(),
    })
    .parse(
      await (await fetch(base + "/inspect-event?id=" + event.eventId)).json(),
    );
  assert.equal(status.receipts, 1);
  if (status.processed) {
    assert.equal(status.operations, 1);
    break;
  }
  if (n === 29) throw new Error("Webhook outbox did not complete");
  await new Promise((r) => setTimeout(r, 500));
}
assert.equal(
  (
    await fetch(base + "/webhook", {
      method: "POST",
      headers: { "X-Caderninho-Webhook-Secret": "synthetic-only-secret" },
      body: JSON.stringify({ ...event, eventId: "synthetic-force-failure" }),
    })
  ).status,
  503,
);
