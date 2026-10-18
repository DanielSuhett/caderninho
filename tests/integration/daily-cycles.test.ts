import assert from "node:assert/strict";

import { count, eq } from "drizzle-orm";
import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { Fault, localDay, Resource } from "../../src/domain";
import { EMPTY_RULES } from "../../src/domain/rules";
import { reapplyRules, syncService } from "../../src/worker/composition";
import { database } from "../../src/worker/database";
import {
  aggregateEntities,
  correctRecord,
  explainRecord,
  queryEntities,
  revision,
  saveRules,
} from "../../src/worker/finance/repository";
import { fetchMcp } from "../../src/worker/mcp";
import { task } from "../../src/worker/mcp/tasks";
import {
  checkpoints,
  settings as config,
  derived,
  entities,
  inbox,
  items,
  operation_targets,
  operations,
  page_commits,
} from "../../src/worker/schema";
import { createSyncService } from "../../src/worker/sync";
import {
  admitOperation,
  compactOperations,
  createSyncRepository,
  finish,
  startOperation,
} from "../../src/worker/sync/repository";
import { required } from "../support";
import { settings, testMigrations } from "./personal-fixture";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";

const item = "11111111-1111-4111-8111-111111111111";
const now = new Date("2030-01-01T23:00:00.000Z");
const conflictPattern = /REAPPLICATION_CONFLICT/;
const largePattern = /REAPPLICATION_TOO_LARGE_USE_BATCHES/;
const orm = database(env.DB);

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, testMigrations);
  await orm.insert(items).values({ id: item });
  await orm.update(config).set({ sync_enabled: 1 });
});

test("retention removes at most 200 rows per table and preserves the operation", async () => {
  const op = await startOperation(env.DB, "retention-backlog", {
    itemIds: [item],
    kind: "sync",
  });
  await orm
    .update(operations)
    .set({ status: "completed", updated_at: "2000-01-01T00:00:00.000Z" })
    .where(eq(operations.id, op.id));
  await env.DB.batch([
    env.DB.prepare(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<201) INSERT INTO checkpoints(operation_id,item_id,resource,parent_id) SELECT ?,?,'transactions',CAST(x AS TEXT) FROM n",
    ).bind(op.id, item),
    env.DB.prepare(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<201) INSERT INTO page_commits(operation_id,step_key,progress) SELECT ?,CAST(x AS TEXT),'{}' FROM n",
    ).bind(op.id),
    env.DB.prepare(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<201) INSERT INTO operation_targets(operation_id,item_id,resource,parent_id,id) SELECT ?,?,'transactions','account',CAST(x AS TEXT) FROM n",
    ).bind(op.id, item),
  ]);
  await compactOperations(env.DB);
  assert.equal(
    (await orm.select({ n: count() }).from(checkpoints).get())?.n,
    1,
  );
  assert.equal(
    (await orm.select({ n: count() }).from(page_commits).get())?.n,
    1,
  );
  assert.equal(
    (await orm.select({ n: count() }).from(operation_targets).get())?.n,
    1,
  );
  assert.equal((await orm.select().from(operations)).length, 1);
});

test("reconciliation and renormalization requested during cooldown belong to the next cycle", async () => {
  const input = { itemIds: [item], kind: "sync" as const };
  const first = required(
    (await admitOperation(env.DB, "initial", input, now)).operation ??
      undefined,
  );
  await finish(env.DB, first, "completed");
  const blocked = await admitOperation(
    env.DB,
    "normalize-later",
    { itemIds: [item], kind: "reconcile", renormalize: true },
    now,
  );
  assert.equal(blocked.operation, null);
  const next = required(
    (
      await admitOperation(
        env.DB,
        "next-cycle",
        input,
        new Date(now.getTime() + 86_400_000),
      )
    ).operation ?? undefined,
  );
  assert.equal(next.kind, "reconcile");
  assert.equal(next.input.renormalize, true);
});

test("incremental upgrade reserves old Items conservatively and preserves active Tasks and legacy inbox", async () => {
  await reset();
  await applyD1Migrations(
    env.DB,
    testMigrations.filter(
      (migration) => migration.name !== "0003_daily_cycles.sql",
    ),
  );
  const rules = await saveRules(env.DB, EMPTY_RULES, true);
  await env.DB.prepare("INSERT INTO items(id) VALUES (?),(?)")
    .bind(item, "unknown-history")
    .run();
  await env.DB.prepare(
    "INSERT INTO operations(id,request_key,kind,input,input_hash,rules_revision,reference_day,created_at,updated_at) VALUES ('legacy','legacy','sync',?,'synthetic',?,'2026-10-18','2026-10-18T10:00:00.000Z','2026-10-18T10:00:00.000Z')",
  )
    .bind(JSON.stringify({ itemIds: [item], kind: "sync" }), rules.id)
    .run();
  await env.DB.prepare(
    "INSERT INTO page_commits(operation_id,step_key,progress) VALUES ('legacy','page','{}')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO inbox(event_id,item_id,account_id,event,payload,received_at) VALUES ('old-event',?,'account','transactions/deleted','{}','2026-10-18T10:00:00.000Z')",
  )
    .bind(item)
    .run();
  await applyD1Migrations(env.DB, testMigrations);
  const migrated = required(
    await orm.select().from(items).where(eq(items.id, item)).get(),
  );
  assert.equal(migrated.cycle_id, "legacy");
  assert.equal(migrated.next_import_at, "2026-10-19T10:00:00.000Z");
  assert.equal(migrated.notice_generation, 1);
  assert.ok(
    (
      await orm
        .select()
        .from(items)
        .where(eq(items.id, "unknown-history"))
        .get()
    )?.next_import_at,
  );
  assert.equal((await orm.select().from(operations)).length, 1);
  assert.equal((await orm.select().from(inbox)).length, 1);
});

test("concurrent channels admit one persisted daily cycle, retain cooldown across pause and admit only new Items", async () => {
  const input = { itemIds: [item], kind: "sync" as const };
  const admitted = await Promise.all(
    Array.from({ length: 8 }, (_, n) =>
      admitOperation(env.DB, `race-${n}`, input, now),
    ),
  );
  const cycle = required(
    admitted.find((result) => result.operation)?.operation ?? undefined,
  );
  assert.equal(admitted.filter((result) => result.operation).length, 1);
  assert.equal((await orm.select().from(operations)).length, 1);
  assert.equal(
    (
      await admitOperation(
        env.DB,
        "still-working",
        input,
        new Date(now.getTime() + 86_400_000),
      )
    ).items[0]?.status,
    "working",
  );
  await finish(env.DB, cycle, "completed");
  await orm.update(config).set({ sync_enabled: 0 });
  assert.equal(
    (await admitOperation(env.DB, "paused", input, now)).items[0]?.status,
    "paused",
  );
  await orm.update(config).set({ sync_enabled: 1 });
  const before = new Date(now.getTime() + 86_400_000 - 1);
  assert.equal(
    (await admitOperation(env.DB, "23h59", input, before)).items[0]?.status,
    "cooldown",
  );
  await orm.insert(items).values({ id: "new-item" });
  const mixed = await admitOperation(
    env.DB,
    "mixed",
    { ...input, itemIds: [item, "new-item"] },
    before,
  );
  assert.deepEqual(mixed.operation?.input.itemIds, ["new-item"]);
  const next = await admitOperation(
    env.DB,
    "24h",
    input,
    new Date(now.getTime() + 86_400_000),
  );
  assert.ok(next.operation);
});

test("webhooks consolidate a bounded generation, preserve notices arriving during execution and never dispatch", async () => {
  const service = syncService(settings());
  const event = {
    accountId: item,
    event: "transactions/deleted" as const,
    eventId: "duplicate",
    itemId: item,
    transactionIds: [item],
  };
  await Promise.all(
    Array.from({ length: 3 }, () => service.acceptWebhook(event)),
  );
  assert.equal((await orm.select().from(inbox)).length, 0);
  assert.equal((await orm.select().from(operations)).length, 0);
  const op = required(
    (
      await admitOperation(
        env.DB,
        "notices",
        { itemIds: [item], kind: "sync" },
        now,
      )
    ).operation ?? undefined,
  );
  assert.equal(op.kind, "reconcile");
  await service.acceptWebhook({ ...event, eventId: "during-cycle" });
  await finish(env.DB, op, "completed");
  const connection = required(
    await orm.select().from(items).where(eq(items.id, item)).get(),
  );
  assert.equal(connection.notice_generation, 2);
  assert.equal(connection.notice_consumed, 1);
  const next = await admitOperation(
    env.DB,
    "next-notices",
    { itemIds: [item], kind: "sync" },
    new Date(now.getTime() + 86_400_000),
  );
  assert.equal(next.operation?.kind, "reconcile");
});

test("lost dispatch resumes the same operation and reserves the sole executor without waiting Workflows", async () => {
  const repository = createSyncRepository(env.DB);
  let creates = 0;
  const workflow = {
    create: () => {
      creates += 1;
      return Promise.reject(new Fault("UPSTREAM_UNAVAILABLE"));
    },
    status: () => Promise.reject(new Error("not created")),
  };
  const service = createSyncService(repository, workflow, () => now);
  const first = required(
    (await service.start("lost", { itemIds: [item], kind: "sync" }))
      .operation ?? undefined,
  );
  await assert.rejects(service.dispatch(first));
  assert.equal(
    (await service.start("other-key", { itemIds: [item], kind: "sync" }))
      .operation,
    null,
  );
  const recovered = createSyncService(
    repository,
    {
      create: () => {
        creates += 1;
        return Promise.resolve();
      },
      status: () => Promise.resolve("running"),
    },
    () => now,
  );
  await recovered.recover();
  assert.equal(creates, 2);
  assert.equal((await recovered.read(first.id)).dispatched, 1);
});

async function transactions(total: number) {
  await saveRules(env.DB, EMPTY_RULES, true);
  const rows = Array.from({ length: total }, (_, index) => {
    const id = String(index).padStart(4, "0");
    return {
      amount_key: "0999999999999999999999999999876",
      amount_minor: "-123",
      currency: "BRL",
      first_seen_at: now.toISOString(),
      id,
      item_id: item,
      normalized: {
        amountMinor: "-123",
        currencyCode: "BRL",
        date: "2026-01-01",
        description: "Synthetic",
        id,
        status: "POSTED",
      },
      normalizer: "synthetic",
      observed_at: now.toISOString(),
      parent_id: "account",
      relevant_hash: id,
      resource: Resource.transactions,
      source: { id },
      status: "POSTED",
      transaction_date: "2026-01-01",
    };
  });
  await rows.reduce(async (previous, row) => {
    await previous;
    await orm.insert(entities).values(row);
  }, Promise.resolve());
}

test("local batches publish only on demand, replay receipts, preserve overrides and stop on external changes", async () => {
  await transactions(12);
  const reapply = reapplyRules(settings());
  const input = { itemIds: [item], requestKey: "local" };
  await assert.rejects(reapply(input), largePattern);
  assert.equal((await orm.select().from(derived)).length, 0);
  const first = await reapply({ ...input, batches: true });
  assert.equal(first.processed, 5);
  assert.equal(first.status, "partial");
  const before = await revision(env.DB);
  assert.deepEqual(await reapply({ ...input, batches: true }), first);
  assert.equal(await revision(env.DB), before);
  assert.equal((await orm.select().from(derived)).length, 5);
  await syncService(settings()).recover();
  assert.equal((await orm.select().from(derived)).length, 5);
  assert.equal(
    (await task(settings(), `${first.operationId}/batch/0`)).status,
    "completed",
  );
  const second = await reapply({
    ...input,
    batches: true,
    continuation: required(first.continuation ?? undefined),
  });
  assert.equal(second.totalProcessed, 10);
  await correctRecord(
    env.DB,
    {
      id: "0011",
      itemId: item,
      parentId: "account",
      resource: Resource.transactions,
    },
    { field: "description", value: "manual" },
  );
  await assert.rejects(
    reapply({
      ...input,
      batches: true,
      continuation: required(second.continuation ?? undefined),
    }),
    conflictPattern,
  );
  assert.equal((await orm.select().from(derived)).length, 10);
  const fresh = await reapply({
    filter: { field: "original.description", op: "eq", value: "unmatched" },
    itemIds: [item],
    requestKey: "new-local",
  });
  assert.equal(fresh.status, "completed");
  assert.equal(fresh.processed, 0);
  assert.equal(
    (await orm.select().from(operations)).every((op) => op.dispatched === 0),
    true,
  );
});

test("small reapplication supports synchronous MCP and preserves revision on equivalent input", async () => {
  await transactions(1);
  const args = { itemIds: [item], requestKey: "mcp-local" };
  const response = await fetchMcp(
    new Request("https://example.com/mcp", {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: args, name: "caderninho_reapply" },
      }),
      headers: {
        "Content-Type": "application/json",
        "Mcp-Method": "tools/call",
        "Mcp-Name": "caderninho_reapply",
        "Mcp-Protocol-Version": "2026-07-28",
      },
      method: "POST",
    }),
    settings(),
  );
  const wire = z
    .object({ result: z.object({ resultType: z.literal("complete") }) })
    .parse(await response.json());
  assert.equal(wire.result.resultType, "complete");
  const before = await revision(env.DB);
  await reapplyRules(settings())({ ...args, requestKey: "equivalent" });
  assert.equal(await revision(env.DB), before);
  await saveRules(env.DB, EMPTY_RULES, true);
  assert.equal(await revision(env.DB), before);
});

test("time eligibility remains correct while paused without GET writes", async () => {
  await transactions(1);
  await orm.update(config).set({ sync_enabled: 0 });
  const today = localDay(new Date());
  await orm.update(entities).set({ eligible: 0, transaction_date: today });
  const before = await revision(env.DB);
  assert.equal(
    (
      await explainRecord(env.DB, {
        id: "0000",
        itemId: item,
        parentId: "account",
        resource: Resource.transactions,
      })
    ).record?.eligible,
    1,
  );
  assert.equal(
    (
      await queryEntities(env.DB, {
        filter: { field: "eligible", op: "eq", value: true },
      })
    ).records.length,
    1,
  );
  await orm.update(entities).set({ transaction_date: "2999-01-01" });
  assert.equal(
    (
      await queryEntities(env.DB, {
        filter: { field: "eligible", op: "eq", value: true },
      })
    ).records.length,
    0,
  );
  await orm
    .update(entities)
    .set({ status: "PENDING", transaction_date: today });
  assert.equal(
    (
      await queryEntities(env.DB, {
        filter: { field: "eligible", op: "eq", value: true },
      })
    ).records.length,
    0,
  );
  assert.equal(await revision(env.DB), before);
  assert.equal(
    (
      await aggregateEntities(env.DB, {
        metric: "count",
        resource: Resource.transactions,
      })
    ).groups[0]?.count,
    "1",
  );
});
