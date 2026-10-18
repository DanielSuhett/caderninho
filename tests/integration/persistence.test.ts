import assert from "node:assert/strict";

import type { D1Migration } from "@cloudflare/vitest-plugin";
import { and, count, countDistinct, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import type { OperationInput } from "#contracts/operation.types.ts";
import type { Identity } from "#contracts/queries.types.ts";
import { Resource } from "#domain/enums.ts";
import type { Filter } from "#domain/filter.types.ts";
import type { ProviderRecord } from "#domain/provider.types.ts";
import { convertPredicate } from "#domain/rules/convert-rules.ts";
import { importRules } from "#domain/rules/import-rules.ts";
import { EMPTY_RULES, txContext } from "#domain/rules/rules.ts";
import type { Rule } from "#domain/rules/rules.types.ts";
import type { JsonValue } from "#shared/json.types.ts";
import { required, responseJson } from "#testing/helpers.ts";
import { mockNetwork } from "#testing/network.ts";
import type { DurableInstance } from "#worker/bindings.ts";
import {
  financialQueries,
  prepareEntity,
  synchronizationDependencies,
  syncService,
} from "#worker/composition.ts";
import { database } from "#worker/database.ts";
import { override } from "#worker/finance/entities.repository.ts";
import {
  aggregateEntities,
  queryEntities,
} from "#worker/finance/repository.ts";
import { rulesFor, saveRules } from "#worker/finance/rules.repository.ts";
import { fetchMcp } from "#worker/mcp/controller.ts";
import { listen, task } from "#worker/mcp/tasks.ts";
import * as tables from "#worker/schema.ts";
import {
  finish,
  getOperation,
  startOperation,
} from "#worker/sync/repository.ts";
import { type FinancialSource, runOperation } from "#worker/sync/service.ts";

import { settings } from "./personal-fixture.ts";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";

declare global {
  namespace Cloudflare {
    interface Env {
      OAUTH_KV: KVNamespace;
      DB: D1Database;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
beforeEach(async () => {
  await reset();
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
});
afterEach(() => vi.unstubAllGlobals());

test("D1 queries, local corrections and task progress remain available without Pluggy credentials", async () => {
  const { db, op } = await setup();
  const engine = await rulesFor(db, op.rules_revision);
  await commit(
    db,
    (
      await prepareEntity(db, {
        identity: identity("offline"),
        source: transaction("offline"),
        parent: account,
        operation: op,
        engine: engine,
      })
    ).statements,
  );
  let upstream = 0;
  mockNetwork(async () => {
    upstream++;
    throw new Error("Pluggy unavailable");
  });
  const queries = financialQueries(env(db));
  assert.equal(
    (await queries.query({ resource: "transactions", limit: 50 })).records
      .length,
    1,
  );
  assert.equal(
    (await queries.aggregate({ resource: "transactions", metric: "amount" }))
      .groups[0]?.totalMinor,
    "1001",
  );
  const reference = identity("offline");
  const before = await database(db)
    .select({ revision: tables.settings.revision })
    .from(tables.settings)
    .where(and(eq(tables.settings.id, 1)))
    .get()
    .then((row) => row?.revision ?? null);
  await queries.correctRecord({
    ...reference,
    field: "description",
    value: "Correção local",
  });
  await queries.correctRecord({
    ...reference,
    field: "tag",
    key: "local",
    value: "yes",
  });
  const explanation = await queries.explainRecord(reference);
  assert.equal(explanation.record?.effective_description, "Correção local");
  assert.equal(explanation.tags[0]?.origin, "manual");
  assert.equal(
    await database(db)
      .select({ revision: tables.settings.revision })
      .from(tables.settings)
      .where(and(eq(tables.settings.id, 1)))
      .get()
      .then((row) => row?.revision ?? null),
    Number(before) + 2,
  );
  const publicTask = await task(env(db), op.id);
  assert.equal(publicTask.status, "working");
  for (const field of [
    "input_hash",
    "cancel_requested",
    "dispatched",
    "synthetic-secret",
  ]) {
    assert.ok(!JSON.stringify(publicTask).includes(field));
  }
  await assert.rejects(
    financialQueries(env(db)).correctRecord({
      ...reference,
      itemId: "unknown-item",
      field: "description",
      value: "forged",
    }),
  );
  await queries.correctRecord({
    ...reference,
    field: "description",
    value: null,
  });
  assert.equal(
    (await queries.explainRecord(reference)).record?.effective_description,
    "Café",
  );
  assert.equal(upstream, 0);
});
const account = {
  id: "account",
  itemId: "item",
  type: "BANK",
  name: "Synthetic",
  currencyCode: "BRL",
  balance: "100.00",
};
const transaction = (id: string, extra: Partial<ProviderRecord> = {}) => ({
  id,
  accountId: "account",
  type: "DEBIT",
  amount: "-10.01",
  currencyCode: "BRL",
  date: "2026-01-01T00:00:00.000Z",
  status: "POSTED",
  description: "Café",
  createdAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});
async function setup() {
  const db = bindings.DB;
  await database(db)
    .insert(tables.items)
    .values({
      id: "item",
      resources: ["accounts", "transactions"],
      enabled: 1,
    });
  const op = await startOperation(db, "first", {
    kind: "sync",
    itemIds: ["item"],
  });
  return { db, op };
}
const identity = (id: string): Identity => ({
  itemId: "item",
  resource: "transactions",
  parentId: "account",
  id,
});

test("coverage groups authorized Items and retains not-synced entries without exposing disabled or disallowed scopes", async () => {
  const { db } = await setup();
  await database(db)
    .insert(tables.items)
    .values([
      { id: "other", resources: ["transactions"], enabled: 1 },
      { id: "restricted", resources: ["accounts"], enabled: 1 },
      { id: "disabled", resources: ["transactions"], enabled: 0 },
    ]);
  await database(db)
    .insert(tables.coverage)
    .values(
      ["item", "restricted", "disabled"].map((item_id) => ({
        item_id,
        resource: Resource.transactions,
        parent_id: "account",
        status: "available" as const,
        bootstrap_complete: 1,
        observed_at: "2026-10-01T00:00:00.000Z",
      })),
    );
  const result = await queryEntities(db, { resource: "transactions" });
  assert.deepEqual(result.coverage, [
    {
      itemId: "item",
      coverage: [
        {
          resource: "transactions",
          parent_id: "account",
          status: "available",
          bootstrap_complete: 1,
          observed_at: "2026-10-01T00:00:00.000Z",
        },
      ],
    },
    {
      itemId: "other",
      coverage: [
        {
          resource: "transactions",
          status: "not_synced",
          bootstrap_complete: 0,
        },
      ],
    },
  ]);
});

test("bulk Task subscriptions preserve requested order and reject missing Tasks or a disabled Item in any scope", async () => {
  const { db, op } = await setup();
  await database(db)
    .insert(tables.items)
    .values({
      id: "other",
      resources: ["transactions"],
      enabled: 1,
    });
  const other = await startOperation(db, "other-task", {
    kind: "sync",
    itemIds: ["other"],
  });
  await finish(db, op, "completed");
  await finish(db, other, "cancelled");
  const request = new Request("https://worker.test/mcp");
  const response = await listen(request, env(db), {
    id: 0,
    ids: [other.id, op.id],
  });
  const message = z.object({
    method: z.string().optional(),
    params: z
      .object({ taskId: z.string().optional(), status: z.string().optional() })
      .optional(),
  });
  const events = (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => message.parse(JSON.parse(line.slice(6))));
  assert.deepEqual(
    events
      .filter((event) => event.method === "notifications/tasks")
      .map((event) => ({
        id: event.params?.taskId,
        status: event.params?.status,
      })),
    [
      { id: other.id, status: "cancelled" },
      { id: op.id, status: "completed" },
    ],
  );
  await assert.rejects(
    listen(request, env(db), { id: 0, ids: [op.id, "missing-task"] }),
    /NOT_FOUND/,
  );
  await database(db)
    .update(tables.items)
    .set({ enabled: 0 })
    .where(eq(tables.items.id, "other"));
  await assert.rejects(
    listen(request, env(db), { id: 0, ids: [op.id, other.id] }),
    /ITEM_NOT_AUTHORIZED/,
  );
});

function steps() {
  // Exercise replay through the D1 receipts, without an untyped checkpoint cache.
  return {
    async do<T extends Rpc.Serializable<T>>(
      _name: string,
      callback: () => Promise<T>,
    ): Promise<T> {
      return callback();
    },
    async sleep() {},
  };
}

test("cancelling a waiting subscription closes the reader and releases its lifetime without cancelling the operation", async () => {
  const { listen } = await import("#worker/mcp/tasks.ts");
  const { db, op } = await setup();
  const released = Promise.withResolvers<void>();
  const response = await listen(new Request("https://local/mcp"), env(db), {
    id: "synthetic-listener",
    ids: [op.id],
    keepAlive: (lifetime) => {
      void lifetime.then(released.resolve);
    },
  });
  const reader = required(response.body).getReader();
  assert.match(
    new TextDecoder().decode((await reader.read()).value),
    /notifications\/subscriptions\/acknowledged/,
  );
  assert.match(
    new TextDecoder().decode((await reader.read()).value),
    /notifications\/tasks/,
  );
  const pending = reader.read();
  await Promise.resolve();
  await reader.cancel();
  assert.equal((await pending).done, true);
  await released.promise;
  assert.equal((await getOperation(db, op.id)).status, "working");
});

function providerFixture() {
  let count = 0;
  const calls: {
    resource: Parameters<FinancialSource["page"]>[0]["resource"];
    parent: string | null;
    cursor: string | null;
    floor: string | null;
  }[] = [];
  return {
    calls,
    async page({
      resource,
      parent,
      cursor,
      floor,
    }: Parameters<FinancialSource["page"]>[0]) {
      calls.push({ resource, parent, cursor, floor });
      if (resource === "accounts") {
        return { records: [account], next: null };
      }
      count++;
      if (!floor && cursor === null) {
        return { records: [transaction("old")], next: "two" };
      }
      if (!floor) {
        return {
          records: [
            transaction("backdated", { createdAt: "2026-10-02T00:00:00.000Z" }),
          ],
          next: null,
        };
      }
      return {
        records: [
          transaction("backdated", { createdAt: "2026-10-02T00:00:00.000Z" }),
        ],
        next: null,
      };
    },
    async ids() {
      return [];
    },
    get count() {
      return count;
    },
  };
}
function instance(id: string): DurableInstance {
  return {
    id,
    async status() {
      return { status: "running" };
    },
  };
}
// Synthetic binding boundary: these unit tests exercise DB and FINANCE; runtime tests separately verify rejection of forged OAuth identity headers.
const env = (db: D1Database) => ({
  ...settings(),
  DB: db,
  FINANCE: {
    async create({ id }: { id: string }) {
      return instance(id);
    },
    async get(id: string) {
      return instance(id);
    },
  },
});

test("bootstrap all pages, incremental floor excludes old history and classifies zero unchanged records", async () => {
  const { db, op } = await setup(),
    source = providerFixture();
  await runOperation(
    { ...synchronizationDependencies(env(db)), source: async () => source },
    op.id,
    steps(),
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.entities)
        .where(and(eq(tables.entities.resource, "transactions")))
        .get()
        .then((row) => row ?? null),
    ).n,
    2,
  );
  const first = await getOperation(db, op.id);
  assert.equal(first.status, "completed");
  assert.equal(first.progress.classified, 2);
  const next = await startOperation(db, "second", {
    kind: "sync",
    itemIds: ["item"],
  });
  source.calls.length = 0;
  await runOperation(
    { ...synchronizationDependencies(env(db)), source: async () => source },
    next.id,
    steps(),
  );
  const second = await getOperation(db, next.id);
  assert.equal(second.progress.classified, 0);
  assert.equal(
    required(source.calls.find((c) => c.resource === "transactions")).floor,
    "2026-10-02T00:00:00.000Z",
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.entities)
        .where(and(eq(tables.entities.resource, "transactions")))
        .get()
        .then((row) => row ?? null),
    ).n,
    2,
  );
});
test("idempotent operation, unknown Items denied and dispatch response loss recovered", async () => {
  const { db, op } = await setup();
  assert.equal(
    (
      await startOperation(db, "first", {
        kind: "sync",
        itemIds: ["item"],
      })
    ).id,
    op.id,
  );
  await assert.rejects(getOperation(db, "unknown-operation"));
  await assert.rejects(
    startOperation(db, "bad", { kind: "sync", itemIds: ["other"] }),
  );
  let creates = 0;
  await syncService({
    ...env(db),
    FINANCE: {
      async create() {
        creates++;
        throw new Error("response lost");
      },
      async get(id) {
        return instance(id);
      },
    },
  }).dispatch(op);
  assert.equal(creates, 1);
  assert.equal(
    required(
      await database(db)
        .select({ dispatched: tables.operations.dispatched })
        .from(tables.operations)
        .where(and(eq(tables.operations.id, op.id)))
        .get()
        .then((row) => row ?? null),
    ).dispatched,
    1,
  );
});

test("manual override survives sync, rule version changes and exact SQL aggregate above Number safe range", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, op.rules_revision),
    i = identity("huge");
  let p = await prepareEntity(db, {
    identity: i,
    source: transaction("huge", { amount: "-9007199254740993.01" }),
    parent: account,
    operation: op,
    engine: engine,
  });
  await commit(db, p.statements);
  const { invoke } = await import("#worker/mcp/invoke.ts");
  const queries = financialQueries(env(db));
  const manual = "x".repeat(2048);
  await invoke(queries, "caderninho_override", {
    ...i,
    field: "description",
    value: manual,
  });
  await assert.rejects(
    invoke(queries, "caderninho_override", {
      ...i,
      field: "description",
      value: `${manual}x`,
    }),
  );
  p = await prepareEntity(db, {
    identity: i,
    source: transaction("huge", {
      description: "Changed",
      amount: "-9007199254740993.02",
    }),
    parent: account,
    operation: op,
    engine: engine,
  });
  await commit(db, p.statements);
  const query = await queryEntities(db, {});
  assert.equal(required(query.records[0]).effective_description, manual);
  assert.equal(
    required((await aggregateEntities(db, {})).groups[0]).totalMinor,
    "-900719925474099302",
  );
  const rules = structuredClone(EMPTY_RULES);
  rules.rules.push(
    fixtureRule({
      id: "new",
      name: "new",
      stage: "enrich",
      priority: 1,
      is_active: true,
      when: true,
      actions: [{ op: "set_description", value: "New rules" }],
    }),
  );
  await saveRules(db, rules, true);
  const unchanged = await prepareEntity(db, {
    identity: i,
    source: transaction("huge", {
      description: "Changed",
      amount: "-9007199254740993.02",
    }),
    parent: account,
    operation: op,
    engine: engine,
  });
  assert.equal(unchanged.classified, 0);
  await override(db, i, "description", null);
  assert.equal(
    required((await queryEntities(db, {})).records[0]).effective_description,
    "Changed",
  );
});
test("filters select exact amounts, composition and revision rejects stale pagination", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, op.rules_revision);
  for (const [id, amount] of [
    ["a", "-10.01"],
    ["b", "-20.02"],
  ] as const) {
    await commit(
      db,
      (
        await prepareEntity(db, {
          identity: identity(id),
          source: transaction(id, { amount }),
          parent: account,
          operation: op,
          engine: engine,
        })
      ).statements,
    );
  }
  const filter: Filter = {
    and: [
      { field: "amountMinor", op: "lte", value: "-2000" },
      { field: "currency", op: "eq", value: "BRL" },
    ],
  };
  assert.equal((await queryEntities(db, { filter })).records.length, 1);
  assert.equal(
    required((await aggregateEntities(db, { filter })).groups[0]).totalMinor,
    "-2002",
  );
  const first = await queryEntities(db, { limit: 1 });
  await override(db, identity("a"), "description", "edited");
  await assert.rejects(
    queryEntities(db, { cursor: first.cursor }),
    /RESTART_REQUIRED/,
  );
});

const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {
    extensions: { "io.modelcontextprotocol/tasks": {} },
  },
};
const rpc = (
  method: string,
  params: {
    name?: string;
    taskId?: string;
    arguments?: object;
    _meta?: object;
    inputResponses?: object;
  },
) =>
  new Request("https://example.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      "Mcp-Name": params.name ?? params.taskId ?? "",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
test("modern Tasks wire rejects absent capability, returns flat durable handle and validates get/update/cancel", async () => {
  const { db } = await setup(),
    e = env(db),
    args = {
      name: "caderninho_sync",
      arguments: { requestKey: "wire", itemIds: ["item"] },
    };
  const catalogue = await responseJson(
    await fetchMcp(rpc("tools/list", { _meta: meta }), e),
  );
  assert.ok(catalogue.result, JSON.stringify(catalogue));
  const listed = z
    .object({
      result: z.object({ tools: z.array(z.object({ name: z.string() })) }),
    })
    .parse(catalogue);
  for (const name of ["caderninho_sync", "caderninho_override"]) {
    assert.ok(listed.result.tools.some((tool) => tool.name === name));
  }
  const missing = await responseJson(
    await fetchMcp(rpc("tools/call", args), e),
  );
  assert.equal(required(missing.error).code, -32021);
  const created = await responseJson(
    await fetchMcp(rpc("tools/call", { ...args, _meta: meta }), e),
  );
  assert.equal(required(created.result).resultType, "task");
  assert.equal(required(created.result).task, undefined);
  const taskId = required(required(created.result).taskId);
  const get = await responseJson(
    await fetchMcp(rpc("tasks/get", { taskId, _meta: meta }), e),
  );
  assert.equal(required(get.result).taskId, taskId);
  const forbidden = await responseJson(
    await fetchMcp(
      rpc("tasks/get", { taskId: "unknown-task", _meta: meta }),
      e,
    ),
  );
  assert.ok(forbidden.error);
  const update = await responseJson(
    await fetchMcp(
      rpc("tasks/update", {
        taskId,
        inputResponses: { unknown: { resultType: "complete", roots: [] } },
        _meta: meta,
      }),
      e,
    ),
  );
  assert.deepEqual(update.result, { resultType: "complete" });
  const cancel = await responseJson(
    await fetchMcp(rpc("tasks/cancel", { taskId, _meta: meta }), e),
  );
  assert.deepEqual(cancel.result, { resultType: "complete" });
});
test("reapply freezes selection even when its filter changes and preserves manual overrides", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, op.rules_revision);
  for (let n = 0; n < 43; n++) {
    await commit(
      db,
      (
        await prepareEntity(db, {
          identity: identity(`r${n}`),
          source: transaction(`r${n}`),
          parent: account,
          operation: op,
          engine: engine,
        })
      ).statements,
    );
  }
  await override(db, identity("r0"), "description", "Manual");
  const rules = structuredClone(EMPTY_RULES);
  rules.rules.push(
    fixtureRule({
      id: "rename",
      name: "rename",
      stage: "enrich",
      priority: 1,
      is_active: true,
      when: true,
      actions: [{ op: "set_description", value: "Changed" }],
    }),
  );
  await saveRules(db, rules, true);
  const run = await startOperation(db, "reapply", {
    kind: "reapply",
    itemIds: ["item"],
    filter: { field: "original.description", op: "eq", value: "Café" },
  });
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: async () => providerFixture(),
    },
    run.id,
    steps(),
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.derived)
        .where(and(eq(tables.derived.description, "Changed")))
        .get()
        .then((row) => row ?? null),
    ).n,
    43,
  );
  assert.equal(
    required(
      await database(db)
        .select({
          effective_description:
            tables.effective_entities.effective_description,
        })
        .from(tables.effective_entities)
        .where(and(eq(tables.effective_entities.id, "r0")))
        .get()
        .then((row) => row ?? null),
    ).effective_description,
    "Manual",
  );
  assert.equal((await getOperation(db, run.id)).progress.classified, 43);
});
test("updated/deleted webhooks resolve current state, delayed deletion does not erase reappearance", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, op.rules_revision);
  await commit(
    db,
    (
      await prepareEntity(db, {
        identity: {
          itemId: "item",
          resource: "accounts",
          parentId: "",
          id: "account",
        },
        source: account,
        parent: undefined,
        operation: op,
        engine: engine,
      })
    ).statements,
  );
  await commit(
    db,
    (
      await prepareEntity(db, {
        identity: identity("t"),
        source: transaction("t", { status: "PENDING" }),
        parent: account,
        operation: op,
        engine: engine,
      })
    ).statements,
  );
  async function event(key: string, records: ProviderRecord[]) {
    await database(db)
      .insert(tables.inbox)
      .values({
        event_id: key,
        item_id: "item",
        account_id: "account",
        event: "transactions/deleted",
        payload: { transactionIds: ["t"] },
        received_at: new Date().toISOString(),
      })
      .run();
    const o = await startOperation(db, key, {
      kind: "webhook",
      itemIds: ["item"],
      eventId: key,
    });
    await runOperation(
      {
        ...synchronizationDependencies(env(db)),
        source: async () => ({
          ...providerFixture(),
          async ids() {
            return records;
          },
        }),
      },
      o.id,
      steps(),
    );
  }
  await event("updated", [
    transaction("t", { status: "POSTED", description: "Updated" }),
  ]);
  assert.equal(
    required(
      await database(db)
        .select({ status: tables.entities.status })
        .from(tables.entities)
        .where(and(eq(tables.entities.id, "t")))
        .get()
        .then((row) => row ?? null),
    ).status,
    "POSTED",
  );
  await event("deleted", []);
  assert.equal(
    required(
      await database(db)
        .select({ deleted: tables.entities.deleted })
        .from(tables.entities)
        .where(and(eq(tables.entities.id, "t")))
        .get()
        .then((row) => row ?? null),
    ).deleted,
    1,
  );
  await event("late-delete", [transaction("t", { description: "Reappeared" })]);
  const current = await database(db)
    .select({
      deleted: tables.entities.deleted,
      original_description: tables.entities.original_description,
    })
    .from(tables.entities)
    .where(and(eq(tables.entities.id, "t")))
    .get()
    .then((row) => row ?? null);
  assert.equal(required(current).deleted, 0);
  assert.equal(required(current).original_description, "Reappeared");
});
test("future matures once without rule evaluation; cancellation preserves prior commits", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, op.rules_revision);
  const future = transaction("future", { date: "2099-01-01T00:00:00.000Z" });
  await commit(
    db,
    (
      await prepareEntity(db, {
        identity: identity("future"),
        source: future,
        parent: account,
        operation: op,
        engine: engine,
      })
    ).statements,
  );
  const run = await startOperation(db, "mature", {
    kind: "reapply",
    itemIds: ["item"],
    filter: { field: "account", op: "eq", value: "nonexistent" },
  });
  await database(db)
    .update(tables.operations)
    .set({ reference_day: "2099-01-02" })
    .where(eq(tables.operations.id, run.id))
    .run();
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: async () => providerFixture(),
    },
    run.id,
    steps(),
  );
  assert.equal(
    required(
      await database(db)
        .select({ eligible: tables.entities.eligible })
        .from(tables.entities)
        .where(and(eq(tables.entities.id, "future")))
        .get()
        .then((row) => row ?? null),
    ).eligible,
    1,
  );
  assert.equal((await getOperation(db, run.id)).progress.classified, 0);
  const cancelled = await startOperation(db, "cancelled", {
    kind: "sync",
    itemIds: ["item"],
  });
  await database(db)
    .update(tables.operations)
    .set({ cancel_requested: 1 })
    .where(eq(tables.operations.id, cancelled.id))
    .run();
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: async () => providerFixture(),
    },
    cancelled.id,
    steps(),
  );
  assert.equal((await getOperation(db, cancelled.id)).status, "cancelled");
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.entities)
        .where(and(eq(tables.entities.id, "future")))
        .get()
        .then((row) => row ?? null),
    ).n,
    1,
  );
});
test("page commit is replay-safe when Workflow loses the step acknowledgement", async () => {
  const { db, op } = await setup(),
    source = providerFixture(),
    base = steps();
  let replayed = false;
  const durable = {
    sleep: base.sleep,
    async do<T extends Rpc.Serializable<T>>(
      name: string,
      fn: () => Promise<T>,
    ) {
      const r = await base.do(name, fn);
      if (name.startsWith("page-") && !replayed) {
        replayed = true;
        const again = await fn();
        assert.deepEqual(again, r);
      }
      return r;
    },
  };
  await runOperation(
    { ...synchronizationDependencies(env(db)), source: async () => source },
    op.id,
    durable,
  );
  assert.equal((await getOperation(db, op.id)).progress.classified, 2);
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.entities)
        .where(and(eq(tables.entities.resource, "transactions")))
        .get()
        .then((row) => row ?? null),
    ).n,
    2,
  );
});

test("bootstrap retains every supported resource and both account/investment parents", async () => {
  const resources = Object.values(Resource);
  const { db, op } = await setup();
  await database(db)
    .update(tables.items)
    .set({ resources: resources })
    .where(eq(tables.items.id, "item"))
    .run();
  const calls: [
    Parameters<FinancialSource["page"]>[0]["resource"],
    string | null,
    string | null,
  ][] = [];
  const provider = {
    async page({
      resource,
      parent,
      cursor,
    }: Parameters<FinancialSource["page"]>[0]) {
      calls.push([resource, parent, cursor]);
      let records: ProviderRecord[];
      if (resource === "connections") {
        records = [{ id: "item", connector: { id: 1, isOpenFinance: true } }];
      } else if (resource === "accounts") {
        records = [account, { ...account, id: "card", type: "CREDIT" }];
      } else if (resource === "transactions") {
        records = [
          transaction(`${parent}-${cursor ?? "one"}`, { accountId: parent }),
        ];
      } else if (resource === "investments") {
        records = [{ id: "investment", currencyCode: "BRL", balance: "12" }];
      } else if (resource === "consents") {
        records = [];
      } else if (resource === "resources") {
        records = [{ resourceId: "r" }];
      } else if (resource === "connectors") {
        records = [{ id: "1" }];
      } else {
        records = [{ id: resource, currencyCode: "BRL" }];
      }
      return {
        records,
        next: resource === "transactions" && !cursor ? "two" : null,
      };
    },
    async ids() {
      return [];
    },
  };
  await runOperation(
    { ...synchronizationDependencies(env(db)), source: async () => provider },
    op.id,
    steps(),
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: countDistinct(tables.coverage.resource) })
        .from(tables.coverage)
        .where(and(eq(tables.coverage.bootstrap_complete, 1)))
        .get()
        .then((row) => row ?? null),
    ).n,
    resources.length,
  );
  assert.equal(calls.filter((x) => x[0] === "transactions").length, 4);
  assert.ok(
    calls.some(
      (x) => x[0] === "investment_transactions" && x[1] === "investment",
    ),
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.entities)
        .where(and(eq(tables.entities.resource, "transactions")))
        .get()
        .then((row) => row ?? null),
    ).n,
    4,
  );
});

test("exact metrics retain BANK/CREDIT signs and ignore manual tags without erasing source", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, op.rules_revision);
  for (const [id, type, amount, parent] of [
    ["bank", "DEBIT", "-10", account],
    ["card", "DEBIT", "10", { ...account, type: "CREDIT" }],
  ] satisfies [string, string, string, typeof account][]) {
    await commit(
      db,
      (
        await prepareEntity(db, {
          identity: identity(id),
          source: transaction(id, { type, amount }),
          parent: parent,
          operation: op,
          engine: engine,
        })
      ).statements,
    );
  }
  const gross = await aggregateEntities(db, { metric: "amount" }),
    flow = await aggregateEntities(db, { metric: "cashFlow" });
  assert.equal(required(gross.groups[0]).totalMinor, "2000");
  assert.equal(required(flow.groups[0]).totalMinor, "-1000");
  const { invoke } = await import("#worker/mcp/invoke.ts");
  await invoke(financialQueries(env(db)), "caderninho_override", {
    ...identity("bank"),
    field: "tag",
    key: "project",
    value: "personal",
  });
  assert.equal(
    (
      await queryEntities(db, {
        filter: { tag: "project", value: "personal" },
      })
    ).records.length,
    1,
  );
  await invoke(financialQueries(env(db)), "caderninho_override", {
    ...identity("bank"),
    field: "tag",
    key: "project",
    value: null,
  });
  assert.equal(
    (
      await queryEntities(db, {
        filter: { tag: "project", value: "personal" },
      })
    ).records.length,
    0,
  );
});

test("migration is replay-safe, preserves useful legacy-only history and reports overlaps", async () => {
  const { db, op } = await setup();
  await database(db)
    .update(tables.operations)
    .set({ status: "completed" })
    .where(eq(tables.operations.id, op.id))
    .run();
  const migration: NonNullable<
    Extract<OperationInput, { kind: "migration" }>["migration"]
  > = [
    {
      sourceKey: "collections/a.json#legacy",
      readAt: "2026-01-01T00:00:00.000Z",
      resource: "transactions",
      parentId: "account",
      record: {
        id: "legacy",
        accountId: "account",
        accountType: "BANK",
        type: "DEBIT",
        currencyCode: "BRL",
        amount: "-25",
        amountMinor: "-2500",
        accountingDate: "2020-01-01",
        status: "POSTED",
        description: "Synthetic historic projection",
      },
    },
  ];
  const m = await startOperation(db, "migration-one", {
    kind: "migration",
    itemIds: ["item"],
    migration,
    migrationPolicy: "refuse-conflicts",
  });
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: async () => providerFixture(),
    },
    m.id,
    steps(),
  );
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: async () => providerFixture(),
    },
    m.id,
    steps(),
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.migration_imports)
        .get()
        .then((row) => row ?? null),
    ).n,
    1,
  );
  assert.equal(
    required(
      await database(db)
        .select({ normalizer: tables.entities.normalizer })
        .from(tables.entities)
        .where(and(eq(tables.entities.id, "legacy")))
        .get()
        .then((row) => row ?? null),
    ).normalizer,
    "legacy-projection-v1",
  );
  const reconcile = await startOperation(db, "reconcile-after-migration", {
    kind: "reconcile",
    itemIds: ["item"],
  });
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: async () => providerFixture(),
    },
    reconcile.id,
    steps(),
  );
  assert.equal(
    required(
      await database(db)
        .select({ deleted: tables.entities.deleted })
        .from(tables.entities)
        .where(and(eq(tables.entities.id, "legacy")))
        .get()
        .then((row) => row ?? null),
    ).deleted,
    0,
  );
});

test("preview, SQL filters and reapply select the same scoped universe; cursor cannot change filter", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, op.rules_revision);
  for (let n = 0; n < 4; n++) {
    await commit(
      db,
      (
        await prepareEntity(db, {
          identity: identity(`p${n}`),
          source: transaction(`p${n}`, { amount: String(-n - 1) }),
          parent: account,
          operation: op,
          engine: engine,
        })
      ).statements,
    );
  }
  const doc = structuredClone(EMPTY_RULES);
  doc.rules = [
    fixtureRule({
      id: "description",
      name: "description",
      stage: "enrich",
      priority: 1,
      is_active: true,
      when: true,
      actions: [{ op: "set_description", value: "Changed" }],
    }),
  ];
  const revision = (await saveRules(db, doc, true)).id,
    filter = {
      field: "amountMinor",
      op: "lte",
      value: "-200",
    } satisfies Filter;
  const { invoke } = await import("#worker/mcp/invoke.ts");
  const preview = z
    .object({ selected: z.number(), differences: z.array(z.json()) })
    .parse(
      await invoke(financialQueries(env(db)), "caderninho_preview", {
        itemIds: ["item"],
        revision,
        filter,
      }),
    );
  const query = await queryEntities(db, { filter, limit: 1 });
  assert.equal(preview.selected, 3);
  assert.equal(preview.differences.length, 3);
  await assert.rejects(
    queryEntities(db, {
      filter: { field: "amountMinor", op: "lte", value: "-100" },
      cursor: query.cursor,
    }),
    /CURSOR_SCOPE/,
  );
  const apply = await startOperation(db, "preview-apply", {
    kind: "reapply",
    itemIds: ["item"],
    filter,
  });
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: async () => providerFixture(),
    },
    apply.id,
    steps(),
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.derived)
        .where(and(eq(tables.derived.description, "Changed")))
        .get()
        .then((row) => row ?? null),
    ).n,
    3,
  );
});

test("transient page failure retries the same checkpoint; failed incomplete page never claims coverage", async () => {
  const { db, op } = await setup(),
    provider = providerFixture(),
    original = provider.page.bind(provider);
  let attempts = 0;
  provider.page = async (...args) => {
    if (args[0].cursor === "two" && attempts++ === 0) {
      throw new Error("transient");
    }
    return original(...args);
  };
  const durable = steps(),
    base = durable.do.bind(durable);
  durable.do = async (name, fn) => {
    try {
      return await base(name, fn);
    } catch {
      return base(name, fn);
    }
  };
  await runOperation(
    { ...synchronizationDependencies(env(db)), source: async () => provider },
    op.id,
    durable,
  );
  assert.equal(attempts, 2);
  assert.equal(
    provider.calls.filter(
      (c) => c.resource === "transactions" && c.cursor === null,
    ).length,
    1,
  );
  assert.equal(
    required(
      await database(db)
        .select({ bootstrap_complete: tables.coverage.bootstrap_complete })
        .from(tables.coverage)
        .where(and(eq(tables.coverage.resource, "transactions")))
        .get()
        .then((row) => row ?? null),
    ).bootstrap_complete,
    1,
  );
  const failed = await startOperation(db, "incomplete", {
    kind: "reconcile",
    itemIds: ["item"],
  });
  const source = {
    ...provider,
    async page(input: Parameters<FinancialSource["page"]>[0]) {
      if (input.resource === "transactions") {
        throw new Error("unavailable");
      }
      return original(input);
    },
  };
  await assert.rejects(
    runOperation(
      { ...synchronizationDependencies(env(db)), source: async () => source },
      failed.id,
      steps(),
    ),
    /unavailable/,
  );
  assert.equal(
    required(
      await database(db)
        .select({ status: tables.coverage.status })
        .from(tables.coverage)
        .where(and(eq(tables.coverage.resource, "transactions")))
        .get()
        .then((row) => row ?? null),
    ).status,
    "partial",
  );
  assert.equal((await getOperation(db, failed.id)).result?.isError, true);
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.entities)
        .where(
          and(
            eq(tables.entities.resource, "transactions"),
            eq(tables.entities.deleted, 0),
          ),
        )
        .get()
        .then((row) => row ?? null),
    ).n,
    2,
  );
});

test("irrelevant provider fields do not trigger rules; explicit normalization backfill does", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, op.rules_revision),
    raw = transaction("stable");
  await commit(
    db,
    (
      await prepareEntity(db, {
        identity: identity("stable"),
        source: raw,
        parent: account,
        operation: op,
        engine: engine,
      })
    ).statements,
  );
  const next = await startOperation(db, "stable", {
    kind: "sync",
    itemIds: ["item"],
  });
  const unchanged = await prepareEntity(db, {
    identity: identity("stable"),
    source: {
      ...raw,
      updatedAt: "2026-10-12T12:00:00.000Z",
      balance: "999",
      irrelevantDebugField: "different",
    },
    parent: account,
    operation: next,
    engine: engine,
  });
  assert.equal(unchanged.classified, 0);
  assert.equal(unchanged.state, "unchanged");
  const forced = await startOperation(db, "backfill", {
    kind: "reconcile",
    itemIds: ["item"],
    renormalize: true,
  });
  assert.equal(
    (
      await prepareEntity(db, {
        identity: identity("stable"),
        source: raw,
        parent: account,
        operation: forced,
        engine: engine,
      })
    ).classified,
    1,
  );
});

test("observation, resurrection and parent changes preserve identity, first-seen time and classification semantics", async () => {
  const { db, op } = await setup();
  const engine = await rulesFor(db, op.rules_revision);
  const source = transaction("lifecycle");
  const input = {
    identity: identity("lifecycle"),
    source,
    parent: account,
    operation: op,
    engine,
  };
  const firstSeen = "2026-10-01T10:00:00.000Z";
  const observedAt = "2026-10-02T10:00:00.000Z";
  const created = await prepareEntity(db, { ...input, observedAt: firstSeen });
  assert.equal(created.state, "new");
  await commit(db, created.statements);
  const observed = await prepareEntity(db, {
    ...input,
    observedAt,
    source: {
      ...source,
      updatedAt: observedAt,
      irrelevantDebugField: "preserved",
    },
    engine: {
      ...engine,
      async evaluate() {
        throw new Error("Unchanged entities must skip rules");
      },
    },
  });
  assert.equal(observed.state, "unchanged");
  assert.equal(observed.seenInOperation, true);
  assert.equal(observed.classified, 0);
  await commit(db, observed.statements);
  const stored = required(
    await database(db)
      .select()
      .from(tables.entities)
      .where(eq(tables.entities.id, "lifecycle"))
      .get(),
  );
  assert.equal(stored.first_seen_at, firstSeen);
  assert.equal(stored.observed_at, observedAt);
  assert.equal(stored.source.irrelevantDebugField, "preserved");
  await database(db)
    .update(tables.entities)
    .set({ deleted: 1 })
    .where(eq(tables.entities.id, "lifecycle"))
    .run();
  const resurrected = await prepareEntity(db, { ...input, observedAt });
  assert.equal(resurrected.state, "changed");
  assert.equal(resurrected.classified, 1);
  await commit(db, resurrected.statements);
  const renamed = await prepareEntity(db, {
    ...input,
    parent: { ...account, name: "Renamed synthetic account" },
  });
  assert.equal(renamed.state, "changed");
  assert.equal(renamed.classified, 1);
  await commit(db, renamed.statements);
  const active = required(
    await database(db)
      .select()
      .from(tables.entities)
      .where(eq(tables.entities.id, "lifecycle"))
      .get(),
  );
  assert.equal(active.first_seen_at, firstSeen);
  assert.equal(active.deleted, 0);
  assert.equal(active.normalized.accountName, "Renamed synthetic account");
  await assert.rejects(
    prepareEntity(db, { ...input, source: { ...source, id: "different" } }),
    /SOURCE_ID_MISMATCH/,
  );
});

test("legacy entry rejects noncanonical secondary money without publishing an entity", async () => {
  const { db, op } = await setup();
  const engine = await rulesFor(db, op.rules_revision);
  await assert.rejects(
    prepareEntity(db, {
      identity: identity("invalid-legacy"),
      source: { id: "invalid-legacy" },
      parent: undefined,
      operation: op,
      engine,
      legacyProjection: {
        id: "invalid-legacy",
        amountMinor: "1000",
        legacyFeeMinor: "001",
      },
    }),
    /canonical integer, at most 30 digits/,
  );
  assert.equal(
    await database(db)
      .select()
      .from(tables.entities)
      .where(eq(tables.entities.id, "invalid-legacy"))
      .get(),
    undefined,
  );
});

test("operational retention does not remove financial records, rule provenance or idempotency", async () => {
  const { db, op } = await setup();
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: async () => providerFixture(),
    },
    op.id,
    steps(),
  );
  const { compactOperations } = await import("#worker/sync/repository.ts");
  const financialCount = required(
    await database(db)
      .select({ n: count() })
      .from(tables.entities)
      .get()
      .then((row) => row ?? null),
  ).n;
  await compactOperations(db, new Date("2030-01-01T00:00:00Z"));
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.entities)
        .get()
        .then((row) => row ?? null),
    ).n,
    financialCount,
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.page_commits)
        .get()
        .then((row) => row ?? null),
    ).n,
    0,
  );
  assert.equal(
    (
      await startOperation(db, "first", {
        kind: "sync",
        itemIds: ["item"],
      })
    ).id,
    op.id,
  );
  assert.ok(await rulesFor(db, op.rules_revision));
});

test("changed totals during pagination retain partial coverage and never advance complete checkpoint", async () => {
  const { db, op } = await setup();
  await database(db)
    .update(tables.items)
    .set({ resources: ["accounts"] })
    .where(eq(tables.items.id, "item"));
  const source = {
    async ids() {
      return [];
    },
    async page({ cursor }: Parameters<FinancialSource["page"]>[0]) {
      return cursor
        ? { records: [{ ...account, id: "second" }], next: null, total: 3 }
        : { records: [account], next: "2", total: 2 };
    },
  };
  await assert.rejects(
    runOperation(
      { ...synchronizationDependencies(env(db)), source: async () => source },
      op.id,
      steps(),
    ),
    /SOURCE_TOTAL_CHANGED/,
  );
  assert.equal(
    required(
      await database(db)
        .select({ bootstrap_complete: tables.coverage.bootstrap_complete })
        .from(tables.coverage)
        .get()
        .then((row) => row ?? null),
    ).bootstrap_complete,
    0,
  );
  assert.equal(
    required(
      await database(db)
        .select({ status: tables.coverage.status })
        .from(tables.coverage)
        .get()
        .then((row) => row ?? null),
    ).status,
    "partial",
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(tables.entities)
        .get()
        .then((row) => row ?? null),
    ).n,
    1,
  );
});

function fixtureRule(r: {
  id: string;
  name: string;
  stage: "classify" | "enrich";
  priority: number;
  is_active: boolean;
  when: JsonValue;
  actions: Rule["event"]["params"]["actions"];
}): Rule {
  const condition = convertPredicate(r.when, "fixture");
  return {
    id: r.id,
    name: r.name,
    priority: r.priority,
    is_active: r.is_active,
    conditions: "fact" in condition ? { all: [condition] } : condition,
    event: { type: r.stage, params: { actions: r.actions } },
  };
}

test("legacy revisions remain readable; explicit conversion creates a new revision without rewriting frozen operations", async () => {
  const { db } = await setup();
  const { readRules } = await import("#worker/finance/rules.repository.ts");
  const { NORMALIZER } = await import("#domain/entity.ts");
  const { invoke } = await import("#worker/mcp/invoke.ts");
  const old = {
    ...EMPTY_RULES,
    version: 1,
    rules: [
      {
        id: "old",
        name: "Old",
        priority: 1,
        is_active: true,
        stage: "enrich",
        when: true,
        actions: [{ op: "set_description", value: "Legacy" }],
      },
    ],
  };
  const serialized = JSON.stringify(old);
  await database(db)
    .insert(tables.rule_sets)
    .values({
      id: "legacy",
      document: sql`${serialized}`,
      normalizer: NORMALIZER,
      created_at: new Date().toISOString(),
      ready: 1,
    })
    .run();
  await database(db)
    .update(tables.settings)
    .set({ active_rules: "legacy" })
    .where(eq(tables.settings.id, 1))
    .run();
  const frozen = await startOperation(db, "legacy-operation", {
    kind: "sync",
    itemIds: ["item"],
  });
  assert.deepEqual(await readRules(db, "legacy"), old);
  assert.deepEqual(
    await invoke(financialQueries(env(db)), "caderninho_rules", {
      action: "read",
      revision: "legacy",
    }),
    old,
  );
  await assert.rejects(
    rulesFor(db, "legacy"),
    /RULES_V1_REQUIRES_EXPLICIT_CONVERSION_AND_ACTIVATION/,
  );
  const report = importRules(old);
  assert.ok(report.document);
  const saved = await saveRules(db, report.document, true);
  assert.notEqual(saved.id, "legacy");
  assert.equal((await getOperation(db, frozen.id)).rules_revision, "legacy");
  assert.equal(
    await database(db)
      .select({ document: sql<string>`${tables.rule_sets.document}` })
      .from(tables.rule_sets)
      .where(and(eq(tables.rule_sets.id, "legacy")))
      .get()
      .then((row) => row?.document ?? null),
    serialized,
  );
  assert.equal(
    (await (await rulesFor(db, saved.id)).evaluate(txContext({ id: "x" })))
      .description,
    "Legacy",
  );
});

test("HTTP conversion defaults to dry run and oversized import bodies fail before storage", async () => {
  const { boundedJson } = await import("#worker/http.ts");
  assert.deepEqual(
    await boundedJson(
      new Request("https://local/import", {
        method: "POST",
        body: '{"amount":9007199254740993.01}',
      }),
    ),
    { amount: "9007199254740993.01" },
  );
  const { db } = await setup();
  const before = await database(db)
    .select({ n: count() })
    .from(tables.rule_sets)
    .get()
    .then((row) => row?.n ?? null);
  const old = { ...EMPTY_RULES, version: 1 };
  const response = await fetchMcp(
    new Request("https://local/mcp/rules/import", {
      method: "POST",
      body: JSON.stringify({ document: old }),
    }),
    env(db),
  );
  assert.equal(response.status, 200);
  const report = z
    .object({
      compatible: z.literal(true),
      document: z.object({ version: z.literal(2) }),
    })
    .parse(await response.json());
  assert.equal(report.document.version, 2);
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(tables.rule_sets)
      .get()
      .then((row) => row?.n ?? null),
    before,
  );
  await assert.rejects(
    fetchMcp(
      new Request("https://local/mcp/rules/import", {
        method: "POST",
        body: " ".repeat(1048577),
      }),
      env(db),
    ),
    /BODY_LIMIT/,
  );
});

test("page publication rolls back data, progress, checkpoint and receipt together, then replays once", async () => {
  const { publishPage } = await import("#worker/sync/publication.ts");
  const { db, op } = await setup();
  const engine = await rulesFor(db, op.rules_revision);
  await database(db)
    .insert(tables.checkpoints)
    .values({
      operation_id: op.id,
      item_id: "item",
      resource: "transactions",
      parent_id: "account",
    })
    .run();
  const before = await database(db)
    .select({ progress: sql<string>`${tables.operations.progress}` })
    .from(tables.operations)
    .where(and(eq(tables.operations.id, op.id)))
    .get()
    .then((row) => row?.progress ?? null);
  await db.exec(
    "CREATE TRIGGER fail_page_receipt BEFORE INSERT ON page_commits BEGIN SELECT RAISE(ABORT, 'synthetic receipt failure'); END",
  );
  let fetched = 0;
  const publication = {
    db,
    op,
    name: "atomic-page",
    prepare: (input: Parameters<typeof prepareEntity>[1]) =>
      prepareEntity(db, input),
    resource: "transactions" as const,
    item: { id: "item" },
    parentId: "account",
    parent: { normalized: account, relevant_hash: "synthetic-parent" },
    engine,
    provider: {
      async page() {
        fetched++;
        return { records: [transaction("atomic-page")], next: null, total: 1 };
      },
    },
  };
  await assert.rejects(publishPage(publication), /synthetic receipt failure/);
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(tables.entities)
      .get()
      .then((row) => row?.n ?? null),
    0,
  );
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(tables.derived)
      .get()
      .then((row) => row?.n ?? null),
    0,
  );
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(tables.page_commits)
      .get()
      .then((row) => row?.n ?? null),
    0,
  );
  assert.equal(
    await database(db)
      .select({ page: tables.checkpoints.page })
      .from(tables.checkpoints)
      .where(and(eq(tables.checkpoints.operation_id, op.id)))
      .get()
      .then((row) => row?.page ?? null),
    0,
  );
  assert.equal(
    await database(db)
      .select({ progress: sql<string>`${tables.operations.progress}` })
      .from(tables.operations)
      .where(and(eq(tables.operations.id, op.id)))
      .get()
      .then((row) => row?.progress ?? null),
    before,
  );
  await db.exec("DROP TRIGGER fail_page_receipt");
  await publishPage(publication);
  const progress = await database(db)
    .select({ progress: sql<string>`${tables.operations.progress}` })
    .from(tables.operations)
    .where(and(eq(tables.operations.id, op.id)))
    .get()
    .then((row) => row?.progress ?? null);
  await publishPage(publication);
  assert.equal(fetched, 2);
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(tables.entities)
      .get()
      .then((row) => row?.n ?? null),
    1,
  );
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(tables.page_commits)
      .get()
      .then((row) => row?.n ?? null),
    1,
  );
  assert.equal(
    await database(db)
      .select({ progress: sql<string>`${tables.operations.progress}` })
      .from(tables.operations)
      .where(and(eq(tables.operations.id, op.id)))
      .get()
      .then((row) => row?.progress ?? null),
    progress,
  );
});

async function commit(db: D1Database, queries: BatchItem<"sqlite">[]) {
  const [first, ...rest] = queries;
  if (!first) {
    throw new Error("Empty fixture batch");
  }
  return database(db).batch([first, ...rest]);
}

test("Drizzle JSON mapping preserves public strings, default progress and manual tag precedence", async () => {
  const { db, op } = await setup();
  assert.deepEqual(op.input, { kind: "sync", itemIds: ["item"] });
  assert.deepEqual(op.progress, {});
  const engine = await rulesFor(db, op.rules_revision);
  const source = transaction("json", { description: 'Café "especial" ☕' });
  await commit(
    db,
    (
      await prepareEntity(db, {
        identity: identity("json"),
        source: source,
        parent: account,
        operation: op,
        engine: engine,
      })
    ).statements,
  );
  const stored = required(
    await database(db)
      .select()
      .from(tables.entities)
      .where(eq(tables.entities.id, "json"))
      .get(),
  );
  assert.deepEqual(stored.source, source);
  assert.equal(stored.normalized.description, source.description);
  const { invoke } = await import("#worker/mcp/invoke.ts");
  await database(db).insert(tables.tags).values({
    item_id: "item",
    resource: "transactions",
    parent_id: "account",
    id: "json",
    key: "project",
    value: "derived",
    origin: "derived",
  });
  await invoke(financialQueries(env(db)), "caderninho_override", {
    ...identity("json"),
    field: "tag",
    key: "project",
    value: "manual",
  });
  assert.equal(
    (await queryEntities(db, { filter: { tag: "project", value: "derived" } }))
      .records.length,
    0,
  );
  const record = required(
    (await queryEntities(db, { filter: { tag: "project", value: "manual" } }))
      .records[0],
  );
  assert.equal(record.source, JSON.stringify(source));
  assert.equal(record.normalized, JSON.stringify(stored.normalized));
  assert.equal(record.effective_tags, '{"project":"manual"}');
  assert.equal(typeof record.evidence, "string");
  await invoke(financialQueries(env(db)), "caderninho_override", {
    ...identity("json"),
    field: "tag",
    key: "project",
    value: null,
  });
  assert.equal(
    (await queryEntities(db, { filter: { tag: "project", value: "derived" } }))
      .records.length,
    1,
  );
});

test("integer limb aggregation cancels huge signed amounts and keeps missing measures separate by currency", async () => {
  const { db, op } = await setup();
  const engine = await rulesFor(db, op.rules_revision);
  for (const [id, amount, currencyCode] of [
    ["positive", "9007199254740993.01", "BRL"],
    ["negative", "-9007199254740993.00", "BRL"],
    ["missing", null, "BRL"],
    ["usd-missing", null, "USD"],
    ["eur-zero", "0", "EUR"],
  ] as const) {
    await commit(
      db,
      (
        await prepareEntity(db, {
          identity: identity(id),
          source: transaction(id, { amount, currencyCode }),
          parent: account,
          operation: op,
          engine: engine,
        })
      ).statements,
    );
  }
  const groups = (await aggregateEntities(db, {})).groups;
  assert.deepEqual(
    groups.find((g) => g.currency === "BRL"),
    { currency: "BRL", count: "3", known: "2", totalMinor: "1", partial: true },
  );
  assert.deepEqual(
    groups.find((g) => g.currency === "USD"),
    {
      currency: "USD",
      count: "1",
      known: "0",
      totalMinor: null,
      partial: true,
    },
  );
  assert.deepEqual(
    groups.find((g) => g.currency === "EUR"),
    {
      currency: "EUR",
      count: "1",
      known: "1",
      totalMinor: "0",
      partial: false,
    },
  );
});
