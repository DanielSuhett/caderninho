import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { createLogger } from "../../src/shared/logger";
import { fetchMcp } from "../../src/worker/mcp";
import { withObservation } from "../../src/worker/observability";
import { responseJson } from "../support";
import { settings, testMigrations } from "./personal-fixture";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";

const meta = {
  "io.modelcontextprotocol/clientCapabilities": {
    extensions: { "io.modelcontextprotocol/tasks": {} },
  },
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
};
function rpc(method: string, params: Record<string, unknown>) {
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
