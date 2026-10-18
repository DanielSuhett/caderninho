import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { createLogger } from "../../src/shared/logger";
import { fetchMcp } from "../../src/worker/mcp";
import { withObservation } from "../../src/worker/observability";
import { startOperation } from "../../src/worker/sync/repository";
import { responseJson } from "../support";
import { settings, testMigrations } from "./personal-fixture";
import {
  applyD1Migrations,
  createExecutionContext,
  reset,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";

const meta = {
  "io.modelcontextprotocol/clientCapabilities": {
    extensions: { "io.modelcontextprotocol/tasks": {} },
  },
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
};
function rpc(
  method: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const name = typeof params.name === "string" ? params.name : "";
  const taskId = typeof params.taskId === "string" ? params.taskId : "";
  return new Request("https://synthetic.test/mcp?secret=private-url", {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method,
      params: { _meta: meta, ...params },
    }),
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "Mcp-Method": method,
      "Mcp-Name": name || taskId,
      "Mcp-Protocol-Version": "2026-07-28",
      "X-Private": "private-header",
    },
    method: "POST",
    ...(signal && { signal }),
  });
}
function observation(correlation = "synthetic-mcp") {
  const lines: string[] = [];
  const spans: object[] = [];
  const output = createLogger({
    destination: { write: (line) => lines.push(line) },
    level: "warn",
    name: "synthetic-mcp",
  });
  return {
    input: {
      correlation,
      onSpan: (span: object) => spans.push(span),
      output,
    },
    lines,
    spans,
  };
}
beforeEach(async () => {
  await reset();
  await applyD1Migrations(bindings.DB, testMigrations);
});

test("an internal tool error remains HTTP 200 and emits one safe MCP failure", async () => {
  await bindings.DB.exec("DROP VIEW effective_entities");
  const observed = observation();
  const response = await withObservation(observed.input, () =>
    fetchMcp(
      rpc("tools/call", {
        arguments: {
          filter: {
            field: "original.description",
            op: "eq",
            value: "private-financial-filter",
          },
        },
        name: "caderninho_query",
      }),
      settings(),
    ),
  );
  assert.equal(response.status, 200);
  const wire = await responseJson(response);
  assert.equal(
    z.object({ isError: z.literal(true) }).parse(wire.result).isError,
    true,
  );
  assert.equal(observed.lines.length, 1);
  z.object({
    correlation: z.literal("synthetic-mcp"),
    event: z.literal("MCP_REQUEST"),
    failure: z.literal("INTERNAL_ERROR"),
    level: z.literal(50),
    outcome: z.literal("failed"),
    phase: z.literal("mcp.call"),
  }).parse(JSON.parse(observed.lines.join("")));
  const failedSpans = z
    .array(z.object({ name: z.string(), outcome: z.string() }))
    .parse(observed.spans)
    .filter((span) => span.outcome === "failed")
    .map((span) => span.name);
  assert.ok(failedSpans.includes("mcp.call"));
  assert.ok(failedSpans.includes("finance.action"));
  const telemetry = JSON.stringify([observed.lines, observed.spans]);
  for (const marker of [
    "private-url",
    "private-header",
    "private-financial-filter",
    "effective_entities",
  ]) {
    assert.equal(telemetry.includes(marker), false);
  }
});

test("a subscription failure after headers keeps correlation and closes its lifetime", async () => {
  const operation = await startOperation(bindings.DB, "private-stream-key", {
    itemIds: ["11111111-1111-4111-8111-111111111111"],
    kind: "sync",
  });
  const observed = observation("synthetic-stream");
  const context = createExecutionContext();
  const response = await withObservation(observed.input, () =>
    fetchMcp(
      rpc("subscriptions/listen", {
        notifications: { taskIds: [operation.id] },
      }),
      settings(),
      context,
    ),
  );
  assert.equal(response.status, 200);
  assert.ok(response.body);
  const reader = response.body.getReader();
  await reader.read();
  await reader.read();
  await bindings.DB.exec("DROP TABLE operations");
  const failed = await reader.read();
  assert.equal(failed.done, false);
  assert.ok(
    new TextDecoder()
      .decode(failed.value)
      .includes("SUBSCRIPTION_CLOSED_RECONNECT"),
  );
  assert.equal((await reader.read()).done, true);
  reader.releaseLock();
  await waitOnExecutionContext(context);
  assert.equal(observed.lines.length, 1);
  z.object({
    correlation: z.literal("synthetic-stream"),
    event: z.literal("MCP_STREAM"),
    failure: z.literal("INTERNAL_ERROR"),
    level: z.literal(50),
    outcome: z.literal("failed"),
    phase: z.literal("mcp.stream"),
  }).parse(JSON.parse(observed.lines.join("")));
  const streamSpans = z
    .array(z.object({ name: z.string(), outcome: z.string() }))
    .parse(observed.spans)
    .filter((span) => span.name === "mcp.stream");
  assert.deepEqual(
    streamSpans.map((span) => span.outcome),
    ["failed"],
  );
  assert.equal(
    JSON.stringify([observed.lines, observed.spans]).includes("private-"),
    false,
  );
});

test("100 polls, rejections and normal cancellations stay quiet and close every stream", async () => {
  const operation = await startOperation(bindings.DB, "private-poll-key", {
    itemIds: ["11111111-1111-4111-8111-111111111111"],
    kind: "sync",
  });
  const observed = observation();
  await Array.from({ length: 100 }, (_, index) => index).reduce(
    async (previous, index) => {
      await previous;
      const poll = await withObservation(
        { ...observed.input, correlation: `poll-${index}` },
        () => fetchMcp(rpc("tasks/get", { taskId: operation.id }), settings()),
      );
      assert.equal((await responseJson(poll)).result?.status, "working");
      const rejected = await withObservation(
        { ...observed.input, correlation: `rejected-${index}` },
        () =>
          fetchMcp(
            rpc("tools/call", {
              arguments: { secret: "private-input" },
              name: "private-unknown-tool",
            }),
            settings(),
          ),
      );
      assert.equal((await responseJson(rejected)).result?.isError, true);
      const abort = new AbortController();
      const context = createExecutionContext();
      const request =
        index % 2
          ? rpc(
              "subscriptions/listen",
              {
                notifications: { taskIds: [operation.id] },
              },
              abort.signal,
            )
          : rpc("tools/list", {}, abort.signal);
      const response = await withObservation(
        { ...observed.input, correlation: `cancelled-${index}` },
        () => fetchMcp(request, settings(), context),
      );
      assert.ok(response.body);
      if (index % 3 === 0) {
        abort.abort();
      }
      await response.body.cancel();
      abort.abort();
      await waitOnExecutionContext(context);
    },
    Promise.resolve(),
  );
  assert.deepEqual(observed.lines, []);
  const spans = z
    .array(
      z.object({
        action: z.string(),
        correlation: z.string(),
        name: z.string(),
        outcome: z.string(),
      }),
    )
    .parse(observed.spans);
  assert.equal(
    spans.filter(
      (span) => span.name === "mcp.call" && span.action === "tasks_get",
    ).length,
    100,
  );
  assert.equal(
    spans.filter(
      (span) =>
        span.name === "mcp.call" &&
        span.action === "unknown" &&
        span.outcome === "rejected",
    ).length,
    100,
  );
  assert.equal(
    spans.filter(
      (span) => span.name === "mcp.stream" && span.outcome === "cancelled",
    ).length,
    100,
  );
  for (const span of spans) {
    if (span.action === "unknown") {
      assert.ok(span.correlation.startsWith("rejected-"));
    }
  }
  assert.equal(
    JSON.stringify([observed.lines, observed.spans]).includes("private-"),
    false,
  );
});
