import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import { Fault, FaultCode, Resource } from "../../src/domain";
import { createLogger } from "../../src/shared/logger";
import {
  reapplyRules,
  synchronizationDependencies,
} from "../../src/worker/composition";
import { database } from "../../src/worker/database";
import { withObservation } from "../../src/worker/observability";
import { items } from "../../src/worker/schema";
import { type FinancialSource, runOperation } from "../../src/worker/sync";
import type { ExecutionOutcome, Steps } from "../../src/worker/sync/entity";
import { getOperation, startOperation } from "../../src/worker/sync/repository";
import { sourceUrl } from "../support";
import { mockNetwork, syntheticJwt } from "../support/network";
import { settings, testMigrations } from "./personal-fixture";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, testMigrations);
  await database(env.DB).insert(items).values({ id: "private-item-marker" });
});
afterEach(() => vi.unstubAllGlobals());

test("receipt replay reports work only for the original collection and atomic publication", async () => {
  const op = await startOperation(env.DB, "private-request-marker", {
    itemIds: ["private-item-marker"],
    kind: "sync",
  });
  const work: string[] = [];
  let fetched = 0;
  const source: FinancialSource = {
    ids: () => Promise.resolve([]),
    page: ({ resource }) => {
      if (resource === Resource.connections) {
        fetched += 1;
        return Promise.resolve({
          next: null,
          records: [
            {
              connector: { id: 200, isOpenFinance: false },
              id: "private-item-marker",
            },
          ],
        });
      }
      return Promise.resolve({ next: null, records: [] });
    },
  };
  const observation = {
    observePhase<T>(
      phase: string,
      callback: () => Promise<T>,
      detail?: { resource?: Resource },
    ) {
      if (detail?.resource === Resource.connections) {
        work.push(phase);
      }
      return callback();
    },
  };
  await runOperation(
    {
      ...synchronizationDependencies(settings()),
      ...observation,
      source: () => Promise.resolve(source),
    },
    op.id,
    {
      async do(name, callback) {
        const result = await callback();
        if (name === "page-private-item-marker-connections--0") {
          assert.deepEqual(await callback(), result);
        }
        return result;
      },
      sleep: () => Promise.resolve(),
    },
  );
  assert.equal(fetched, 1);
  assert.deepEqual(work, ["collect", "process", "publish"]);
  assert.equal((await getOperation(env.DB, op.id)).status, "completed");
});

test("100 recoverable source failures produce one bounded partial diagnostic and preserve the final task", async () => {
  const op = await startOperation(env.DB, "partial-request", {
    itemIds: ["private-item-marker"],
    kind: "sync",
  });
  const captured = capture();
  let failures = 0;
  await withObservation({ ...captured.context, operationId: op.id }, () =>
    runOperation(
      {
        ...synchronizationDependencies(settings()),
        source: () =>
          Promise.resolve({
            ids: () => Promise.resolve([]),
            page: ({ resource }) => {
              if (resource === Resource.connections) {
                return Promise.resolve({
                  next: null,
                  records: [
                    {
                      connector: { id: 200, isOpenFinance: false },
                      id: "private-item-marker",
                    },
                  ],
                });
              }
              if (resource === Resource.accounts) {
                return Promise.resolve({
                  next: null,
                  records: Array.from({ length: 100 }, (_, index) => ({
                    balance: "100.00",
                    currencyCode: "BRL",
                    id: `private-account-${index}`,
                    itemId: "private-item-marker",
                    name: "private-bank-name",
                    type: "BANK",
                  })),
                });
              }
              if (resource === Resource.transactions) {
                failures += 1;
                const error = new Fault(FaultCode.UPSTREAM_FORBIDDEN);
                error.message = "private-error-marker";
                return Promise.reject(error);
              }
              return Promise.resolve({ next: null, records: [] });
            },
          }),
      },
      op.id,
      immediateSteps(),
    ),
  );
  const current = await getOperation(env.DB, op.id);
  assert.equal(failures, 100);
  assert.equal(current.status, "completed");
  assert.equal(current.result?.isError, true);
  assert.equal(current.progress.errors, 100);
  assert.equal(captured.lines.length, 1);
  assert.ok(captured.lines[0]?.includes('"outcome":"partial"'));
  assert.ok(captured.lines[0]?.includes('"sourceUnauthorized":100'));
  assert.ok(captured.lines[0]?.includes('"failed":100'));
  assert.equal(
    captured.spans.find((span) => span.phase === "complete")?.outcome,
    "partial",
  );
  assert.ok(!JSON.stringify(captured).includes("private-"));
});

for (const code of [
  FaultCode.UPSTREAM_RATE_LIMIT,
  FaultCode.UPSTREAM_TIMEOUT,
]) {
  test(`${code} persists deferral and produces one warning without altering the exception`, async () => {
    const op = await startOperation(env.DB, "deferred-request", {
      itemIds: ["private-item-marker"],
      kind: "sync",
    });
    const error = new Fault(code);
    error.message = "private-upstream-marker";
    error.details = { retryAfterSeconds: 31 };
    const captured = capture();
    await assert.rejects(
      withObservation({ ...captured.context, operationId: op.id }, () =>
        runOperation(
          {
            ...synchronizationDependencies(settings()),
            source: () => Promise.reject(error),
          },
          op.id,
          immediateSteps(),
        ),
      ),
      (actual) => actual === error,
    );
    assert.equal((await getOperation(env.DB, op.id)).result?.isError, true);
    assert.equal(captured.lines.length, 1);
    assert.ok(captured.lines[0]?.includes('"outcome":"deferred"'));
    assert.ok(captured.lines[0]?.includes('"delayMs":31000'));
    assert.ok(captured.lines[0]?.includes('"level":40'));
    assert.equal(
      captured.spans.find((span) => span.name === "pluggy.read")?.outcome,
      "deferred",
    );
    assert.ok(!JSON.stringify(captured).includes("private-"));
  });
}

test("an unexpected source failure emits one safe terminal error and preserves the rejected exception", async () => {
  const op = await startOperation(env.DB, "failed-request", {
    itemIds: ["private-item-marker"],
    kind: "sync",
  });
  const error = new Error("private-upstream-marker", {
    cause: { secret: "private-cause-marker" },
  });
  const captured = capture();
  await assert.rejects(
    withObservation({ ...captured.context, operationId: op.id }, () =>
      runOperation(
        {
          ...synchronizationDependencies(settings()),
          source: () => Promise.reject(error),
        },
        op.id,
        immediateSteps(),
      ),
    ),
    (actual) => actual === error,
  );
  assert.equal((await getOperation(env.DB, op.id)).result?.isError, true);
  assert.equal(captured.lines.length, 1);
  assert.ok(captured.lines[0]?.includes('"level":50'));
  assert.ok(captured.lines[0]?.includes('"failure":"INTERNAL_ERROR"'));
  assert.ok(captured.lines[0]?.includes('"outcome":"failed"'));
  assert.ok(!JSON.stringify(captured).includes("private-"));
});

test("an invalid provider schema remains the original validation error and emits one upstream failure", async () => {
  const op = await startOperation(env.DB, "invalid-provider", {
    itemIds: ["private-item-marker"],
    kind: "sync",
  });
  mockNetwork((input) =>
    Promise.resolve(
      sourceUrl(input).pathname === "/auth"
        ? Response.json({ apiKey: syntheticJwt() })
        : Response.json(["private-provider-marker"]),
    ),
  );
  const captured = capture();
  await assert.rejects(
    withObservation({ ...captured.context, operationId: op.id }, () =>
      runOperation(
        synchronizationDependencies(settings()),
        op.id,
        immediateSteps(),
      ),
    ),
    (error) => error instanceof z.ZodError,
  );
  assert.equal((await getOperation(env.DB, op.id)).result?.isError, true);
  assert.equal(captured.lines.length, 1);
  assert.ok(captured.lines[0]?.includes('"level":50'));
  assert.ok(captured.lines[0]?.includes('"failure":"INVALID_RESPONSE"'));
  assert.equal(
    captured.spans.find((span) => span.name === "pluggy.read")?.outcome,
    "failed",
  );
  assert.ok(!JSON.stringify(captured).includes("private-"));
});

test("pre-acquisition failure and cancellation each report their true outcome without opening the source", async () => {
  const op = await startOperation(env.DB, "cancelled-request", {
    itemIds: ["private-item-marker"],
    kind: "sync",
  });
  const dependencies = synchronizationDependencies(settings());
  const outcomes: ExecutionOutcome[] = [];
  const error = new Error("private-rules-marker");
  let opened = 0;
  const source = () => {
    opened += 1;
    return Promise.reject(error);
  };
  await assert.rejects(
    runOperation(
      {
        ...dependencies,
        onOutcome: (result) => outcomes.push(result),
        repository: {
          ...dependencies.repository,
          rules: () => Promise.reject(error),
        },
        source,
      },
      op.id,
      immediateSteps(),
    ),
    (actual) => actual === error,
  );
  assert.equal((await getOperation(env.DB, op.id)).status, "working");
  assert.equal(outcomes[0]?.outcome, "failed");
  assert.equal(outcomes[0]?.phase, "select");
  const { syncService } = await import("../../src/worker/composition");
  await syncService(settings()).cancel(op.id);
  await runOperation(
    { ...dependencies, onOutcome: (result) => outcomes.push(result), source },
    op.id,
    immediateSteps(),
  );
  assert.equal(opened, 0);
  assert.equal(outcomes[1]?.outcome, "cancelled");
  assert.equal((await getOperation(env.DB, op.id)).status, "cancelled");
});

test("a local reapplication receipt has a replay span and performs no fresh publication", async () => {
  const captured = capture();
  const input = {
    itemIds: ["private-item-marker"],
    requestKey: "private-request-marker",
  };
  const first = await withObservation(captured.context, () =>
    reapplyRules(settings())(input),
  );
  captured.spans.length = 0;
  const replay = await withObservation(captured.context, () =>
    reapplyRules(settings())(input),
  );
  assert.deepEqual(replay, first);
  assert.equal(captured.spans.length, 1);
  assert.equal(captured.spans[0]?.name, "finance.reapply");
  assert.equal(captured.spans[0]?.outcome, "replayed");
  assert.equal(captured.spans[0]?.operationId, first.operationId);
  assert.equal(captured.lines.length, 0);
  assert.ok(!JSON.stringify(captured).includes("private-"));
});

test("increasing records within one collection page does not create per-record spans or warnings", async () => {
  const volumes: { spans: number; logs: number }[] = [];
  await [1, 100].reduce(async (previous, count) => {
    await previous;
    const op = await startOperation(env.DB, `volume-${count}`, {
      itemIds: ["private-item-marker"],
      kind: "sync",
    });
    const captured = capture();
    await withObservation({ ...captured.context, operationId: op.id }, () =>
      runOperation(
        {
          ...synchronizationDependencies(settings()),
          source: () =>
            Promise.resolve({
              ids: () => Promise.resolve([]),
              page: ({ resource }) => {
                if (resource === Resource.connections) {
                  return Promise.resolve({
                    next: null,
                    records: [
                      {
                        connector: { id: 200, isOpenFinance: false },
                        id: "private-item-marker",
                      },
                    ],
                  });
                }
                if (resource === Resource.categories) {
                  return Promise.resolve({
                    next: null,
                    records: Array.from({ length: count }, (_, index) => ({
                      id: `private-category-${index}`,
                      name: "private-category-name",
                    })),
                  });
                }
                return Promise.resolve({ next: null, records: [] });
              },
            }),
        },
        op.id,
        immediateSteps(),
      ),
    );
    volumes.push({ logs: captured.lines.length, spans: captured.spans.length });
    assert.ok(!JSON.stringify(captured).includes("private-"));
  }, Promise.resolve());
  assert.equal(volumes[0]?.logs, 0);
  assert.equal(volumes[1]?.logs, 0);
  assert.equal(volumes[0]?.spans, volumes[1]?.spans);
});

function immediateSteps(): Steps {
  return {
    do: (_name, callback) => callback(),
    sleep: () => Promise.resolve(),
  };
}

function capture() {
  const lines: string[] = [];
  const spans: {
    name: string;
    outcome?: string;
    operationId?: string;
    phase?: string;
  }[] = [];
  return {
    context: {
      onSpan: (span: {
        name: string;
        outcome?: string;
        operationId?: string;
        phase?: string;
      }) => spans.push(span),
      output: createLogger({
        destination: { write: (line) => lines.push(line) },
        level: "warn",
        name: "synthetic",
      }),
      runId: "synthetic-run",
    },
    lines,
    spans,
  };
}
