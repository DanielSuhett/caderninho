import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { Resource } from "../../src/domain";
import { createLogger } from "../../src/shared/logger";
import worker from "../../src/worker";
import { synchronizationDependencies } from "../../src/worker/composition";
import { database } from "../../src/worker/database";
import { fetchMcp } from "../../src/worker/mcp";
import { withObservation } from "../../src/worker/observability";
import { items, settings as settingsTable } from "../../src/worker/schema";
import { type FinancialSource, runOperation } from "../../src/worker/sync";
import type { Steps } from "../../src/worker/sync/entity";
import { responseJson } from "../support";
import { settings, testMigrations } from "./personal-fixture";
import {
  applyD1Migrations,
  createScheduledController,
  reset,
} from "cloudflare:test";
import { env } from "cloudflare:workers";

const itemId = "11111111-1111-4111-8111-111111111111";
const meta = {
  "io.modelcontextprotocol/clientCapabilities": {
    extensions: { "io.modelcontextprotocol/tasks": {} },
  },
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
};

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, testMigrations);
  await database(env.DB).insert(items).values({ id: itemId });
  await database(env.DB).update(settingsTable).set({ sync_enabled: 1 });
});

test("a durable MCP operation is recoverable, queryable and safely correlated across invocations and receipt replay", async () => {
  const lines: string[] = [];
  const spans: {
    correlation?: string;
    name: string;
    operationId?: string;
    resource?: Resource;
    runId?: string;
  }[] = [];
  const context = {
    onSpan: (span: (typeof spans)[number]) => spans.push(span),
    output: createLogger({
      destination: { write: (line) => lines.push(line) },
      level: "warn",
      name: "synthetic-journey",
    }),
  };
  const config = settings();
  const unavailable = {
    ...config,
    FINANCE: {
      create: () => Promise.reject(new Error("private-workflow-create")),
      get: () => Promise.reject(new Error("private-workflow-status")),
    },
  };
  const created = await withObservation(
    { ...context, correlation: "synthetic-admission" },
    async () =>
      responseJson(
        await fetchMcp(
          rpc("tools/call", {
            arguments: { itemIds: [itemId], requestKey: "private-request" },
            name: "caderninho_sync",
          }),
          unavailable,
        ),
      ),
  );
  const { taskId } = z
    .object({ resultType: z.literal("task"), taskId: z.string() })
    .parse(created.result);
  assert.equal(lines.length, 1);
  z.object({
    correlation: z.literal("synthetic-admission"),
    event: z.literal("SYNC_DISPATCH"),
    operationId: z.literal(taskId),
    outcome: z.literal("deferred"),
    recovery: z.literal("scheduled"),
  }).parse(JSON.parse(lines[0] ?? "null"));

  const dispatched: string[] = [];
  await withObservation(context, () =>
    worker.scheduled(createScheduledController(), {
      ...config,
      FINANCE: {
        ...config.FINANCE,
        create(input) {
          dispatched.push(input.id);
          return config.FINANCE.create(input);
        },
      },
    }),
  );
  assert.deepEqual(dispatched, [taskId]);

  let fetched = 0;
  const source: FinancialSource = {
    ids: () => Promise.resolve([]),
    page({ resource }) {
      fetched += 1;
      if (resource === Resource.connections) {
        return Promise.resolve({
          next: null,
          records: [
            { connector: { id: 200, isOpenFinance: false }, id: itemId },
          ],
        });
      }
      if (resource === Resource.accounts) {
        return Promise.resolve({
          next: null,
          records: [
            {
              balance: "100.00",
              currencyCode: "BRL",
              id: "private-account",
              itemId,
              name: "private-bank",
              type: "BANK",
            },
          ],
        });
      }
      if (resource === Resource.transactions) {
        return Promise.resolve({
          next: null,
          records: [
            {
              accountId: "private-account",
              amount: "-10.01",
              createdAt: "2026-10-01T00:00:00.000Z",
              currencyCode: "BRL",
              date: "2026-01-01T00:00:00.000Z",
              description: "private-transaction",
              id: "private-transaction",
              status: "POSTED",
              type: "DEBIT",
            },
          ],
        });
      }
      return Promise.resolve({ next: null, records: [] });
    },
  };
  let replayed = false;
  const steps: Steps = {
    async do(name, callback) {
      const result = await callback();
      if (name === `page-${itemId}-transactions-private-account-0`) {
        const priorFetches = fetched;
        const publications = spans.filter(
          (span) => span.name === "finance.publish",
        ).length;
        assert.deepEqual(await callback(), result);
        assert.equal(fetched, priorFetches);
        assert.equal(
          spans.filter((span) => span.name === "finance.publish").length,
          publications,
        );
        replayed = true;
      }
      return result;
    },
    sleep: () => Promise.resolve(),
  };
  const dependencies = {
    ...synchronizationDependencies(config),
    source: () => Promise.resolve(source),
  };
  await withObservation(
    { ...context, operationId: taskId, runId: "synthetic-execution" },
    () => runOperation(dependencies, taskId, steps),
  );
  assert.equal(replayed, true);
  const priorFetches = fetched;
  const priorSpans = spans.length;
  await withObservation(
    { ...context, operationId: taskId, runId: "synthetic-replay" },
    () => runOperation(dependencies, taskId, steps),
  );
  assert.equal(fetched, priorFetches);
  assert.equal(spans.length, priorSpans);

  const complete = await withObservation(
    { ...context, correlation: "synthetic-task" },
    async () =>
      responseJson(await fetchMcp(rpc("tasks/get", { taskId }), config)),
  );
  z.object({ status: z.literal("completed"), taskId: z.literal(taskId) }).parse(
    complete.result,
  );
  const queried = await withObservation(
    { ...context, correlation: "synthetic-query" },
    async () =>
      responseJson(
        await fetchMcp(
          rpc("tools/call", {
            arguments: { resource: "transactions" },
            name: "caderninho_query",
          }),
          config,
        ),
      ),
  );
  const content = z
    .object({ content: z.array(z.object({ text: z.string() })) })
    .parse(queried.result);
  const records = z
    .object({
      records: z.array(z.object({ amount_minor: z.string(), id: z.string() })),
    })
    .parse(JSON.parse(content.content[0]?.text ?? "null"));
  assert.deepEqual(
    records.records.map(({ id, amount_minor }) => ({ amount_minor, id })),
    [{ amount_minor: "-1001", id: "private-transaction" }],
  );
  assert.equal(lines.length, 1);
  assert.ok(
    spans.some(
      (span) =>
        span.name === "sync.dispatch" &&
        span.operationId === taskId &&
        span.correlation === "synthetic-admission",
    ),
  );
  assert.ok(
    spans.some(
      (span) =>
        span.name === "sync.scheduled" && !!span.runId && !span.correlation,
    ),
  );
  assert.ok(
    spans.some(
      (span) =>
        span.name === "finance.publish" &&
        span.operationId === taskId &&
        span.runId === "synthetic-execution",
    ),
  );
  assert.ok(
    spans.some(
      (span) =>
        span.name === "mcp.call" && span.correlation === "synthetic-query",
    ),
  );
  const telemetry = JSON.stringify([lines, spans]);
  assert.equal(telemetry.includes("private-"), false);
  assert.equal(telemetry.includes(itemId), false);
});

function rpc(
  method: string,
  params: { name?: string; taskId?: string; arguments?: object },
) {
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
      "Mcp-Name": params.name ?? params.taskId ?? "",
      "Mcp-Protocol-Version": "2026-07-28",
    },
    method: "POST",
  });
}
