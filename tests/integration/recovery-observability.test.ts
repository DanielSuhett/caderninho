import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { createLogger } from "../../src/shared/logger";
import worker from "../../src/worker";
import { syncService } from "../../src/worker/composition";
import { database } from "../../src/worker/database";
import { withObservation } from "../../src/worker/observability";
import { items, operations } from "../../src/worker/schema";
import { startOperation } from "../../src/worker/sync/repository";
import {
  cookies,
  fixture,
  login,
  origin,
  settings,
  testMigrations,
} from "./personal-fixture";
import {
  applyD1Migrations,
  createExecutionContext,
  createScheduledController,
  reset,
} from "cloudflare:test";
import { env } from "cloudflare:workers";

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, testMigrations);
});

test("webhook receipt distinguishes a recorded notice from a duplicate without warning", async () => {
  const config = { ...settings(), WEBHOOK_SECRET: "synthetic-webhook-secret" };
  const itemId = "11111111-1111-4111-8111-111111111111";
  await database(env.DB).insert(items).values({ id: itemId });
  const event = {
    accountId: "22222222-2222-4222-8222-222222222222",
    event: "transactions/created",
    eventId: "synthetic-private-event",
    itemId,
    transactionsCreatedAtFrom: "2026-10-01T00:00:00.000Z",
  };
  const output: string[] = [];
  const spans: { name: string; outcome?: string }[] = [];
  const logger = createLogger({
    destination: { write: (line) => output.push(line) },
    level: "warn",
    name: "synthetic-webhook",
  });
  const deliver = () =>
    worker.fetch(
      new Request(`${origin}/webhook`, {
        body: JSON.stringify(event),
        headers: { "X-Caderninho-Webhook-Secret": config.WEBHOOK_SECRET },
        method: "POST",
      }),
      config,
      createExecutionContext(),
    );
  await withObservation(
    { onSpan: (span) => spans.push(span), output: logger },
    async () => {
      assert.equal((await deliver()).status, 204);
      assert.equal((await deliver()).status, 204);
    },
  );
  assert.deepEqual(
    spans
      .filter((span) => span.name === "sync.admission")
      .map((span) => span.outcome),
    ["success", "noop"],
  );
  assert.equal(output.length, 0);
  assert.ok(!JSON.stringify(spans).includes("synthetic-private"));
  assert.ok(!JSON.stringify(spans).includes(itemId));
});

test("100 unavailable Workflow statuses produce one safe recovery summary", async () => {
  const config = settings();
  const output: string[] = [];
  const logger = createLogger({
    destination: { write: (line) => output.push(line) },
    level: "warn",
    name: "synthetic-recovery",
  });
  await Array.from({ length: 100 }, (_, index) => index).reduce(
    async (previous, index) => {
      await previous;
      await startOperation(env.DB, `synthetic-key-${index}`, {
        itemIds: [],
        kind: "sync",
      });
    },
    Promise.resolve(),
  );
  await database(env.DB).update(operations).set({ dispatched: 1 });
  const unavailable = {
    ...config,
    FINANCE: {
      create: config.FINANCE.create,
      get: () => Promise.reject(new Error("synthetic-private-status-body")),
    },
  };
  await withObservation({ output: logger, runId: "synthetic-cron" }, () =>
    syncService(unavailable).recover(),
  );
  assert.equal(output.length, 1);
  const entry = z
    .object({
      event: z.string(),
      failed: z.number(),
      level: z.number(),
      outcome: z.string(),
      runId: z.string(),
      statusUnavailable: z.number(),
    })
    .parse(JSON.parse(output.join("")));
  assert.equal(entry.event, "SYNC_RECOVERY");
  assert.equal(entry.outcome, "deferred");
  assert.equal(entry.statusUnavailable, 100);
  assert.equal(entry.failed, 100);
  assert.equal(entry.level, 40);
  assert.equal(entry.runId, "synthetic-cron");
  assert.ok(!output.join("").includes("synthetic-private"));
  assert.ok(!output.join("").includes("synthetic-key"));
});

test("uncertain creation keeps the outbox pending and is recoverable by the cron", async () => {
  const config = settings();
  const operation = await startOperation(env.DB, "synthetic-pending", {
    itemIds: [],
    kind: "sync",
  });
  const unavailable = {
    ...config,
    FINANCE: {
      create: () => Promise.reject(new Error("synthetic-private-create")),
      get: () => Promise.reject(new Error("synthetic-private-status")),
    },
  };
  const output: string[] = [];
  const logger = createLogger({
    destination: { write: (line) => output.push(line) },
    level: "warn",
    name: "synthetic-dispatch",
  });
  await withObservation(
    { output: logger, runId: "synthetic-dispatch" },
    async () => {
      await assert.rejects(syncService(unavailable).dispatch(operation));
    },
  );
  assert.equal((await syncService(config).read(operation.id)).dispatched, 0);
  assert.equal(output.length, 1);
  assert.equal(
    z.object({ outcome: z.string() }).parse(JSON.parse(output.join("")))
      .outcome,
    "deferred",
  );
  await worker.scheduled(
    createScheduledController({
      scheduledTime: Date.parse("2026-10-18T12:37:00Z"),
    }),
    config,
  );
  assert.equal((await syncService(config).read(operation.id)).dispatched, 1);
});

test("cron identifies failed auth maintenance and preserves the thrown failure", async () => {
  const config = settings();
  await startOperation(env.DB, "synthetic-unavailable-status", {
    itemIds: [],
    kind: "sync",
  });
  await database(env.DB).update(operations).set({ dispatched: 1 });
  await env.DB.exec("DROP TABLE login_attempts");
  const output: string[] = [];
  const spans: {
    action?: string;
    name: string;
    outcome?: string;
    parent?: string;
    runId?: string;
  }[] = [];
  const logger = createLogger({
    destination: { write: (line) => output.push(line) },
    level: "warn",
    name: "synthetic-cron",
  });
  await withObservation(
    { onSpan: (span) => spans.push(span), output: logger },
    async () => {
      await assert.rejects(
        worker.scheduled(createScheduledController(), {
          ...config,
          FINANCE: {
            create: config.FINANCE.create,
            get: () => Promise.reject(new Error("synthetic-private-status")),
          },
        }),
      );
    },
  );
  assert.equal(output.length, 2);
  const entries = z
    .array(
      z.object({
        action: z.string().optional(),
        event: z.string(),
        level: z.number(),
        outcome: z.string(),
        phase: z.string(),
        recovery: z.string(),
        runId: z.string(),
      }),
    )
    .parse(output.map((line) => JSON.parse(line)));
  const entry = entries.find((item) => item.level === 50);
  assert.ok(entry);
  assert.deepEqual(
    {
      action: entry.action,
      event: entry.event,
      level: entry.level,
      outcome: entry.outcome,
      phase: entry.phase,
      recovery: entry.recovery,
    },
    {
      action: "compact_auth",
      event: "SYNC_SCHEDULED",
      level: 50,
      outcome: "failed",
      phase: "sync.maintenance",
      recovery: "none",
    },
  );
  const scheduled = spans.find(
    (span) => span.name === "sync.scheduled" && !span.parent,
  );
  assert.ok(scheduled?.runId);
  assert.ok(entries.every((item) => item.runId === scheduled.runId));
  assert.ok(spans.every((span) => span.runId === scheduled.runId));
  assert.ok(
    spans.some(
      (span) =>
        span.name === "sync.maintenance" &&
        span.action === "compact_auth" &&
        span.outcome === "failed",
    ),
  );
  assert.ok(!output.join("").includes("login_attempts"));
});

test("unexpected readiness failure remains a usable account response with a safe diagnostic", async () => {
  const config = settings();
  const session = await login(fixture(config));
  const faulty = new Proxy(config.DB, {
    get(target, property) {
      if (property === "batch") {
        return () => Promise.reject(new Error("synthetic-private-readiness"));
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const output: string[] = [];
  const logger = createLogger({
    destination: { write: (line) => output.push(line) },
    level: "warn",
    name: "synthetic-readiness",
  });
  const response = await withObservation({ output: logger }, () =>
    worker.fetch(
      new Request(`${origin}/api/account`, {
        headers: { Cookie: cookies(session) },
      }),
      { ...config, DB: faulty },
      createExecutionContext(),
    ),
  );
  assert.equal(response.status, 200);
  const body = z
    .object({ checks: z.object({ migrations: z.boolean() }) })
    .parse(await response.json());
  assert.equal(body.checks.migrations, false);
  assert.equal(output.length, 1);
  const entry = z
    .object({ action: z.string(), level: z.number() })
    .parse(JSON.parse(output.join("")));
  assert.equal(entry.action, "readiness");
  assert.equal(entry.level, 40);
  assert.ok(!output.join("").includes("synthetic-private"));
});
