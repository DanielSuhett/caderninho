import assert from "node:assert/strict";

import type { D1Migration } from "@cloudflare/vitest-plugin";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";
import { test, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod/v4";

import type { OperationInput } from "#contracts/operation.ts";
import { FilterSchema, type Identity } from "#contracts/queries.ts";
import { convertPredicate } from "#domain/rules/convert-rules.ts";
import { importRules } from "#domain/rules/import-rules.ts";
import {
  RuleSchema,
  compileRules,
  EMPTY_RULES,
  txContext,
} from "#domain/rules/rules.ts";
import type { ProviderRecord } from "#domain/schemas.ts";
import type { JsonValue } from "#shared/json.ts";
import { required, responseJson } from "#testing/helpers.ts";
import { mockNetwork } from "#testing/network.ts";
import type { Bindings, DurableInstance } from "#worker/bindings.ts";
import {
  syncService,
  financialQueries,
  synchronizationDependencies,
} from "#worker/composition.ts";
import {
  prepareEntity,
  override,
} from "#worker/finance/entities.repository.ts";
import {
  moneyKey,
  queryEntities,
  aggregateEntities,
} from "#worker/finance/repository.ts";
import { saveRules, rulesFor } from "#worker/finance/rules.repository.ts";
import { fetchMcp } from "#worker/mcp/controller.ts";
import { task } from "#worker/mcp/tasks.ts";
import { startOperation, getOperation } from "#worker/sync/repository.ts";
import { type FinancialSource, runOperation } from "#worker/sync/service.ts";

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

test("D1 queries, local corrections and task progress remain available without Pluggy or vault credentials", async () => {
  const { db, op } = await setup();
  const engine = await rulesFor(db, "alice", op.rules_revision);
  await db.batch(
    (
      await prepareEntity(
        db,
        identity("offline"),
        transaction("offline"),
        account,
        op,
        engine,
      )
    ).statements,
  );
  let upstream = 0;
  mockNetwork(async () => {
    upstream++;
    throw new Error("Pluggy unavailable");
  });
  const queries = financialQueries(env(db), "alice");
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
  const { principal: _principal, ...reference } = identity("offline");
  const before = await db
    .prepare("SELECT revision FROM principals WHERE id='alice'")
    .first("revision");
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
    await db
      .prepare("SELECT revision FROM principals WHERE id='alice'")
      .first("revision"),
    Number(before) + 2,
  );
  const publicTask = await task(env(db), "alice", op.id);
  assert.equal(publicTask.status, "working");
  for (const field of [
    "input_hash",
    "cancel_requested",
    "dispatched",
    "synthetic-secret",
  ])
    assert.ok(!JSON.stringify(publicTask).includes(field));
  await assert.rejects(
    financialQueries(env(db), "bob").correctRecord({
      ...reference,
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
  await db.exec(
    `INSERT INTO principals(id) VALUES('alice'),('bob');INSERT INTO items VALUES('alice','item','["accounts","transactions"]',1);INSERT INTO items VALUES('bob','other','["accounts"]',1);`,
  );
  const op = await startOperation(db, "alice", "first", {
    kind: "sync",
    itemIds: ["item"],
  });
  return { db, op };
}
const identity = (id: string): Identity => ({
  principal: "alice",
  itemId: "item",
  resource: "transactions",
  parentId: "account",
  id,
});
function steps() {
  const saved = new Map<string, unknown>();
  return {
    async do<T extends Rpc.Serializable<T>>(
      k: string,
      f: () => Promise<T>,
    ): Promise<T> {
      if (saved.has(k)) {
        // Only the result of this checkpoint callback is stored under its stable key.
        return saved.get(k) as T;
      }
      const r = await f();
      saved.set(k, r);
      return r;
    },
    async sleep() {},
    saved,
  };
}
function providerFixture() {
  let count = 0;
  const calls: {
    resource: Parameters<FinancialSource["page"]>[0];
    parent: string | null;
    cursor: string | null;
    floor: string | null;
  }[] = [];
  return {
    calls,
    async page(
      ...[resource, , parent, cursor, floor]: Parameters<
        FinancialSource["page"]
      >
    ) {
      calls.push({ resource, parent, cursor, floor });
      if (resource === "accounts") return { records: [account], next: null };
      count++;
      if (!floor && cursor === null)
        return { records: [transaction("old")], next: "two" };
      if (!floor)
        return {
          records: [
            transaction("backdated", { createdAt: "2026-10-02T00:00:00.000Z" }),
          ],
          next: null,
        };
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
    async subscribe() {
      throw new Error("Unexpected native subscription in SQL unit test");
    },
  };
}
// Synthetic binding boundary: these unit tests exercise DB and FINANCE; runtime tests separately verify rejection of forged OAuth identity headers.
const env = (db: D1Database) =>
  ({
    DB: db,
    FINANCE: {
      async create({ id }: { id: string }) {
        return instance(id);
      },
      async get(id: string) {
        return instance(id);
      },
    },
  }) as Bindings;

test("bootstrap all pages, incremental floor excludes old history and classifies zero unchanged records", async () => {
  const { db, op } = await setup(),
    source = providerFixture();
  await runOperation(
    synchronizationDependencies(env(db)),
    op.id,
    steps(),
    source,
  );
  assert.equal(
    required(
      await db
        .prepare(
          "SELECT COUNT(*) n FROM entities WHERE resource='transactions'",
        )
        .first(),
    ).n,
    2,
  );
  const first = await getOperation(db, "alice", op.id);
  assert.equal(first.status, "completed");
  assert.equal(JSON.parse(first.progress).classified, 2);
  const next = await startOperation(db, "alice", "second", {
    kind: "sync",
    itemIds: ["item"],
  });
  source.calls.length = 0;
  await runOperation(
    synchronizationDependencies(env(db)),
    next.id,
    steps(),
    source,
  );
  const second = await getOperation(db, "alice", next.id);
  assert.equal(JSON.parse(second.progress).classified, 0);
  assert.equal(
    required(source.calls.find((c) => c.resource === "transactions")).floor,
    "2026-10-02T00:00:00.000Z",
  );
  assert.equal(
    required(
      await db
        .prepare(
          "SELECT COUNT(*) n FROM entities WHERE resource='transactions'",
        )
        .first(),
    ).n,
    2,
  );
});
test("idempotent operation, foreign principal denied and dispatch response loss recovered", async () => {
  const { db, op } = await setup();
  assert.equal(
    (
      await startOperation(db, "alice", "first", {
        kind: "sync",
        itemIds: ["item"],
      })
    ).id,
    op.id,
  );
  await assert.rejects(getOperation(db, "bob", op.id));
  await assert.rejects(
    startOperation(db, "bob", "bad", { kind: "sync", itemIds: ["item"] }),
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
      await db
        .prepare("SELECT dispatched FROM operations WHERE id=?")
        .bind(op.id)
        .first(),
    ).dispatched,
    1,
  );
});
test("rule phases, priorities, exact decimals, accents, templates, tags and rejects unsafe regex", async () => {
  const doc = structuredClone(EMPTY_RULES);
  doc.categories.push({
    id: "food",
    name: "Food",
    group_id: "other",
    aliases: [],
  });
  doc.rules = [
    fixtureRule({
      id: "a",
      name: "a",
      stage: "classify",
      priority: 1,
      is_active: true,
      when: { "opf.regex": [{ var: "tx.description" }, "^cafe$"] },
      actions: [{ op: "set_category", value: "food" }],
    }),
    fixtureRule({
      id: "b",
      name: "b",
      stage: "enrich",
      priority: 2,
      is_active: true,
      when: { "===": [{ var: "result.category_id" }, "food"] },
      actions: [
        { op: "set_description", value: "{{tx.counterparty_name}}" },
        { op: "set_tag", key: "kind", value: "first" },
      ],
    }),
    fixtureRule({
      id: "c",
      name: "c",
      stage: "enrich",
      priority: 3,
      is_active: true,
      when: true,
      actions: [
        { op: "set_description", value: "Fallback" },
        { op: "set_tag", key: "kind", value: "second" },
        { op: "ignore" },
      ],
    }),
  ];
  const tx = txContext({
      id: "tx",
      description: "CAFÉ",
      amount: "9007199254740993.01",
      accountingDate: "2026-01-01",
    }),
    engine = compileRules(doc),
    result = await engine.evaluate(tx);
  assert.equal(result.category_id, "food");
  assert.equal(result.description, "Fallback");
  assert.equal(result.tags.kind, "first");
  assert.equal(result.ignored, true);
  required(doc.rules[0]).conditions = {
    all: [
      convertPredicate(
        {
          "opf.decimal_compare": [
            { var: "tx.amount" },
            "eq",
            "9007199254740993.01",
          ],
        },
        "test",
      ),
    ],
  };
  assert.equal((await compileRules(doc).evaluate(tx)).category_id, "food");
  required(doc.rules[0]).conditions = {
    all: [{ fact: "tx.description", operator: "regex", value: "(a)\\1" }],
  };
  assert.throws(() => compileRules(doc));
});
test("manual override survives sync, rule version changes and exact SQL aggregate above Number safe range", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, "alice", op.rules_revision),
    i = identity("huge");
  let p = await prepareEntity(
    db,
    i,
    transaction("huge", { amount: "-9007199254740993.01" }),
    account,
    op,
    engine,
  );
  await db.batch(p.statements);
  await override(db, i, "description", "Manual");
  p = await prepareEntity(
    db,
    i,
    transaction("huge", {
      description: "Changed",
      amount: "-9007199254740993.02",
    }),
    account,
    op,
    engine,
  );
  await db.batch(p.statements);
  const query = await queryEntities(db, "alice", {});
  assert.equal(required(query.records[0]).effective_description, "Manual");
  assert.equal(
    required((await aggregateEntities(db, "alice", {})).groups[0]).totalMinor,
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
  await saveRules(db, "alice", rules, true);
  const unchanged = await prepareEntity(
    db,
    i,
    transaction("huge", {
      description: "Changed",
      amount: "-9007199254740993.02",
    }),
    account,
    op,
    engine,
  );
  assert.equal(unchanged.classified, 0);
  await override(db, i, "description", null);
  assert.equal(
    required((await queryEntities(db, "alice", {})).records[0])
      .effective_description,
    "Changed",
  );
});
test("filters select exact amounts, composition and revision rejects stale pagination", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, "alice", op.rules_revision);
  for (const [id, amount] of [
    ["a", "-10.01"],
    ["b", "-20.02"],
  ] as const)
    await db.batch(
      (
        await prepareEntity(
          db,
          identity(id),
          transaction(id, { amount }),
          account,
          op,
          engine,
        )
      ).statements,
    );
  const filter = {
    and: [
      { field: "amountMinor", op: "lte", value: "-2000" },
      { field: "currency", op: "eq", value: "BRL" },
    ],
  };
  assert.equal(
    (await queryEntities(db, "alice", { filter })).records.length,
    1,
  );
  assert.equal(
    required((await aggregateEntities(db, "alice", { filter })).groups[0])
      .totalMinor,
    "-2002",
  );
  const first = await queryEntities(db, "alice", { limit: 1 });
  await override(db, identity("a"), "description", "edited");
  await assert.rejects(
    queryEntities(db, "alice", { cursor: first.cursor }),
    /RESTART_REQUIRED/,
  );
  assert.ok(moneyKey("-100") < moneyKey("-1"));
  assert.ok(moneyKey("-1") < moneyKey("0"));
});
test("Securo dry run rejects unknown fields instead of silently discarding rules", () => {
  const report = importRules({
    format: "securo-categorization-rules",
    version: 1,
    rules: [
      {
        name: "Synthetic",
        conditions_op: "and",
        conditions: [{ op: "equals", field: "payee_id", value: "fake" }],
        actions: [{ op: "set_category", value: "food" }],
        priority: 1,
        is_active: true,
      },
    ],
  });
  assert.equal(report.compatible, false);
  assert.equal(report.document, null);
  assert.ok(report.issues.some((i) => i.code === "FIELD_MAPPING_REQUIRED"));
  assert.ok(report.issues.some((i) => i.code === "CATALOG_REQUIRED"));
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
test("modern Tasks wire rejects absent capability, returns flat durable handle and authorizes get/update/cancel", async () => {
  const { db } = await setup(),
    e = env(db),
    args = {
      name: "caderninho_sync",
      arguments: { requestKey: "wire", itemIds: ["item"] },
    };
  const missing = await responseJson(
    await fetchMcp(rpc("tools/call", args), e, "alice"),
  );
  assert.equal(required(missing.error).code, -32021);
  const created = await responseJson(
    await fetchMcp(rpc("tools/call", { ...args, _meta: meta }), e, "alice"),
  );
  assert.equal(required(created.result).resultType, "task");
  assert.equal(required(created.result).task, undefined);
  const taskId = required(required(created.result).taskId);
  const get = await responseJson(
    await fetchMcp(rpc("tasks/get", { taskId, _meta: meta }), e, "alice"),
  );
  assert.equal(required(get.result).taskId, taskId);
  const forbidden = await responseJson(
    await fetchMcp(rpc("tasks/get", { taskId, _meta: meta }), e, "bob"),
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
      "alice",
    ),
  );
  assert.deepEqual(update.result, { resultType: "complete" });
  const cancel = await responseJson(
    await fetchMcp(rpc("tasks/cancel", { taskId, _meta: meta }), e, "alice"),
  );
  assert.deepEqual(cancel.result, { resultType: "complete" });
});
test("reapply freezes selection even when its filter changes and preserves manual overrides", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, "alice", op.rules_revision);
  for (let n = 0; n < 43; n++)
    await db.batch(
      (
        await prepareEntity(
          db,
          identity("r" + n),
          transaction("r" + n),
          account,
          op,
          engine,
        )
      ).statements,
    );
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
  await saveRules(db, "alice", rules, true);
  const run = await startOperation(db, "alice", "reapply", {
    kind: "reapply",
    itemIds: ["item"],
    filter: { field: "original.description", op: "eq", value: "Café" },
  });
  await runOperation(
    synchronizationDependencies(env(db)),
    run.id,
    steps(),
    providerFixture(),
  );
  assert.equal(
    required(
      await db
        .prepare("SELECT COUNT(*) n FROM derived WHERE description='Changed'")
        .first(),
    ).n,
    43,
  );
  assert.equal(
    required(
      await db
        .prepare(
          "SELECT effective_description FROM effective_entities WHERE id='r0'",
        )
        .first(),
    ).effective_description,
    "Manual",
  );
  assert.equal(
    JSON.parse((await getOperation(db, "alice", run.id)).progress).classified,
    43,
  );
});
test("updated/deleted webhooks resolve current state, delayed deletion does not erase reappearance", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, "alice", op.rules_revision);
  await db.batch(
    (
      await prepareEntity(
        db,
        {
          principal: "alice",
          itemId: "item",
          resource: "accounts",
          parentId: "",
          id: "account",
        },
        account,
        null,
        op,
        engine,
      )
    ).statements,
  );
  await db.batch(
    (
      await prepareEntity(
        db,
        identity("t"),
        transaction("t", { status: "PENDING" }),
        account,
        op,
        engine,
      )
    ).statements,
  );
  async function event(key: string, records: ProviderRecord[]) {
    await db
      .prepare(
        "INSERT INTO inbox(event_id,principal,item_id,account_id,event,payload,received_at) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(
        key,
        "alice",
        "item",
        "account",
        "transactions/deleted",
        JSON.stringify({ transactionIds: ["t"] }),
        new Date().toISOString(),
      )
      .run();
    const o = await startOperation(db, "alice", key, {
      kind: "webhook",
      itemIds: ["item"],
      eventId: key,
    });
    await runOperation(synchronizationDependencies(env(db)), o.id, steps(), {
      ...providerFixture(),
      async ids() {
        return records;
      },
    });
  }
  await event("updated", [
    transaction("t", { status: "POSTED", description: "Updated" }),
  ]);
  assert.equal(
    required(
      await db.prepare("SELECT status FROM entities WHERE id='t'").first(),
    ).status,
    "POSTED",
  );
  await event("deleted", []);
  assert.equal(
    required(
      await db.prepare("SELECT deleted FROM entities WHERE id='t'").first(),
    ).deleted,
    1,
  );
  await event("late-delete", [transaction("t", { description: "Reappeared" })]);
  const current = await db
    .prepare("SELECT deleted,original_description FROM entities WHERE id='t'")
    .first();
  assert.equal(required(current).deleted, 0);
  assert.equal(required(current).original_description, "Reappeared");
});
test("future matures once without rule evaluation; cancellation preserves prior commits", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, "alice", op.rules_revision);
  const future = transaction("future", { date: "2099-01-01T00:00:00.000Z" });
  await db.batch(
    (await prepareEntity(db, identity("future"), future, account, op, engine))
      .statements,
  );
  const run = await startOperation(db, "alice", "mature", {
    kind: "reapply",
    itemIds: ["item"],
    filter: { field: "account", op: "eq", value: "nonexistent" },
  });
  await db
    .prepare("UPDATE operations SET reference_day=? WHERE id=?")
    .bind("2099-01-02", run.id)
    .run();
  await runOperation(
    synchronizationDependencies(env(db)),
    run.id,
    steps(),
    providerFixture(),
  );
  assert.equal(
    required(
      await db
        .prepare("SELECT eligible FROM entities WHERE id='future'")
        .first(),
    ).eligible,
    1,
  );
  assert.equal(
    JSON.parse((await getOperation(db, "alice", run.id)).progress).classified,
    0,
  );
  const cancelled = await startOperation(db, "alice", "cancelled", {
    kind: "sync",
    itemIds: ["item"],
  });
  await db
    .prepare("UPDATE operations SET cancel_requested=1 WHERE id=?")
    .bind(cancelled.id)
    .run();
  await runOperation(
    synchronizationDependencies(env(db)),
    cancelled.id,
    steps(),
    providerFixture(),
  );
  assert.equal(
    (await getOperation(db, "alice", cancelled.id)).status,
    "cancelled",
  );
  assert.equal(
    required(
      await db
        .prepare("SELECT COUNT(*) n FROM entities WHERE id='future'")
        .first(),
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
    ...base,
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
    synchronizationDependencies(env(db)),
    op.id,
    durable,
    source,
  );
  assert.equal(
    JSON.parse((await getOperation(db, "alice", op.id)).progress).classified,
    2,
  );
  assert.equal(
    required(
      await db
        .prepare(
          "SELECT COUNT(*) n FROM entities WHERE resource='transactions'",
        )
        .first(),
    ).n,
    2,
  );
});

test("provider Retry-After waits between durable steps and propagates other transient failures", async () => {
  const { providerRetries } = await import("#worker/pluggy/source.ts"),
    delays: string[] = [];
  const wrapped = providerRetries({
    do: async (_name, fn) => fn(),
    sleep: async (_name, duration) => {
      delays.push(duration);
    },
  });
  let calls = 0;
  assert.equal(
    await wrapped.do("page", async () => {
      if (calls++ === 0)
        throw Object.assign(new Error("rate"), {
          code: "UPSTREAM_RATE_LIMIT",
          details: { retryAfterSeconds: 90 },
        });
      return 42;
    }),
    42,
  );
  assert.deepEqual(delays, ["90 seconds"]);
  await assert.rejects(
    wrapped.do("page", async () => {
      throw new Error("transient");
    }),
    /transient/,
  );
});

test("bootstrap retains every supported resource and both account/investment parents", async () => {
  const { RESOURCES } = await import("#domain/finance-model.ts");
  const { db, op } = await setup();
  await db
    .prepare("UPDATE items SET resources=? WHERE id='item'")
    .bind(JSON.stringify(RESOURCES))
    .run();
  const calls: [
    Parameters<FinancialSource["page"]>[0],
    string | null,
    string | null,
  ][] = [];
  const provider = {
    async page(
      ...[resource, , parent, cursor]: Parameters<FinancialSource["page"]>
    ) {
      calls.push([resource, parent, cursor]);
      let records: ProviderRecord[];
      if (resource === "connections")
        records = [{ id: "item", connector: { id: 1, isOpenFinance: true } }];
      else if (resource === "accounts")
        records = [account, { ...account, id: "card", type: "CREDIT" }];
      else if (resource === "transactions")
        records = [
          transaction(parent + "-" + (cursor ?? "one"), { accountId: parent }),
        ];
      else if (resource === "investments")
        records = [{ id: "investment", currencyCode: "BRL", balance: "12" }];
      else if (resource === "consents") records = [];
      else if (resource === "resources") records = [{ resourceId: "r" }];
      else if (resource === "connectors") records = [{ id: "1" }];
      else records = [{ id: resource, currencyCode: "BRL" }];
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
    synchronizationDependencies(env(db)),
    op.id,
    steps(),
    provider,
  );
  assert.equal(
    required(
      await db
        .prepare(
          "SELECT count(DISTINCT resource) n FROM coverage WHERE bootstrap_complete=1",
        )
        .first(),
    ).n,
    RESOURCES.length,
  );
  assert.equal(calls.filter((x) => x[0] === "transactions").length, 4);
  assert.ok(
    calls.some(
      (x) => x[0] === "investment_transactions" && x[1] === "investment",
    ),
  );
  assert.equal(
    required(
      await db
        .prepare(
          "SELECT count(*) n FROM entities WHERE resource='transactions'",
        )
        .first(),
    ).n,
    4,
  );
});

test("exact metrics retain BANK/CREDIT signs and ignore manual tags without erasing source", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, "alice", op.rules_revision);
  for (const [id, type, amount, parent] of [
    ["bank", "DEBIT", "-10", account],
    ["card", "DEBIT", "10", { ...account, type: "CREDIT" }],
  ] satisfies [string, string, string, typeof account][]) {
    await db.batch(
      (
        await prepareEntity(
          db,
          identity(id),
          transaction(id, { type, amount }),
          parent,
          op,
          engine,
        )
      ).statements,
    );
  }
  const gross = await aggregateEntities(db, "alice", { metric: "amount" }),
    flow = await aggregateEntities(db, "alice", { metric: "cashFlow" });
  assert.equal(required(gross.groups[0]).totalMinor, "2000");
  assert.equal(required(flow.groups[0]).totalMinor, "-1000");
  const { invoke } = await import("#worker/mcp/invoke.ts");
  await invoke(financialQueries(env(db), "alice"), "caderninho_override", {
    ...identity("bank"),
    principal: undefined,
    field: "tag",
    key: "project",
    value: "personal",
  });
  assert.equal(
    (
      await queryEntities(db, "alice", {
        filter: { tag: "project", value: "personal" },
      })
    ).records.length,
    1,
  );
  await invoke(financialQueries(env(db), "alice"), "caderninho_override", {
    ...identity("bank"),
    principal: undefined,
    field: "tag",
    key: "project",
    value: null,
  });
  assert.equal(
    (
      await queryEntities(db, "alice", {
        filter: { tag: "project", value: "personal" },
      })
    ).records.length,
    0,
  );
});

test("migration is replay-safe, preserves useful legacy-only history and reports overlaps", async () => {
  const { db, op } = await setup();
  await db
    .prepare("UPDATE operations SET status='completed' WHERE id=?")
    .bind(op.id)
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
  const m = await startOperation(db, "alice", "migration-one", {
    kind: "migration",
    itemIds: ["item"],
    migration,
    migrationPolicy: "refuse-conflicts",
  });
  await runOperation(
    synchronizationDependencies(env(db)),
    m.id,
    steps(),
    providerFixture(),
  );
  await runOperation(
    synchronizationDependencies(env(db)),
    m.id,
    steps(),
    providerFixture(),
  );
  assert.equal(
    required(
      await db.prepare("SELECT count(*) n FROM migration_imports").first(),
    ).n,
    1,
  );
  assert.equal(
    required(
      await db
        .prepare("SELECT normalizer FROM entities WHERE id='legacy'")
        .first(),
    ).normalizer,
    "legacy-projection-v1",
  );
  const reconcile = await startOperation(
    db,
    "alice",
    "reconcile-after-migration",
    {
      kind: "reconcile",
      itemIds: ["item"],
    },
  );
  await runOperation(
    synchronizationDependencies(env(db)),
    reconcile.id,
    steps(),
    providerFixture(),
  );
  assert.equal(
    required(
      await db
        .prepare("SELECT deleted FROM entities WHERE id='legacy'")
        .first(),
    ).deleted,
    0,
  );
});

test("preview, SQL filters and reapply select the same scoped universe; cursor cannot change filter", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, "alice", op.rules_revision);
  for (let n = 0; n < 4; n++)
    await db.batch(
      (
        await prepareEntity(
          db,
          identity("p" + n),
          transaction("p" + n, { amount: String(-n - 1) }),
          account,
          op,
          engine,
        )
      ).statements,
    );
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
  const revision = (await saveRules(db, "alice", doc, true)).id,
    filter = FilterSchema.parse({
      field: "amountMinor",
      op: "lte",
      value: "-200",
    });
  const { invoke } = await import("#worker/mcp/invoke.ts");
  const preview = z
    .object({ selected: z.number(), differences: z.array(z.json()) })
    .parse(
      await invoke(financialQueries(env(db), "alice"), "caderninho_preview", {
        itemIds: ["item"],
        revision,
        filter,
      }),
    );
  const query = await queryEntities(db, "alice", { filter, limit: 1 });
  assert.equal(preview.selected, 3);
  assert.equal(preview.differences.length, 3);
  await assert.rejects(
    queryEntities(db, "alice", {
      filter: { field: "amountMinor", op: "lte", value: "-100" },
      cursor: query.cursor,
    }),
    /CURSOR_SCOPE/,
  );
  const apply = await startOperation(db, "alice", "preview-apply", {
    kind: "reapply",
    itemIds: ["item"],
    filter,
  });
  await runOperation(
    synchronizationDependencies(env(db)),
    apply.id,
    steps(),
    providerFixture(),
  );
  assert.equal(
    required(
      await db
        .prepare("SELECT count(*) n FROM derived WHERE description='Changed'")
        .first(),
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
    if (args[3] === "two" && attempts++ === 0) throw new Error("transient");
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
    synchronizationDependencies(env(db)),
    op.id,
    durable,
    provider,
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
      await db
        .prepare(
          "SELECT bootstrap_complete FROM coverage WHERE resource='transactions'",
        )
        .first(),
    ).bootstrap_complete,
    1,
  );
  const failed = await startOperation(db, "alice", "incomplete", {
    kind: "reconcile",
    itemIds: ["item"],
  });
  const source = {
    ...provider,
    async page(...[resource, ...rest]: Parameters<FinancialSource["page"]>) {
      if (resource === "transactions") throw new Error("unavailable");
      return original(resource, ...rest);
    },
  };
  await assert.rejects(
    runOperation(
      synchronizationDependencies(env(db)),
      failed.id,
      steps(),
      source,
    ),
    /unavailable/,
  );
  assert.equal(
    required(
      await db
        .prepare("SELECT status FROM coverage WHERE resource='transactions'")
        .first(),
    ).status,
    "partial",
  );
  assert.equal(
    JSON.parse((await getOperation(db, "alice", failed.id)).result ?? "null")
      .isError,
    true,
  );
  assert.equal(
    required(
      await db
        .prepare(
          "SELECT count(*) n FROM entities WHERE resource='transactions' AND deleted=0",
        )
        .first(),
    ).n,
    2,
  );
});

test("irrelevant provider fields do not trigger rules; explicit normalization backfill does", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, "alice", op.rules_revision),
    raw = transaction("stable");
  await db.batch(
    (await prepareEntity(db, identity("stable"), raw, account, op, engine))
      .statements,
  );
  const next = await startOperation(db, "alice", "stable", {
    kind: "sync",
    itemIds: ["item"],
  });
  const unchanged = await prepareEntity(
    db,
    identity("stable"),
    {
      ...raw,
      updatedAt: "2026-10-12T12:00:00.000Z",
      balance: "999",
      irrelevantDebugField: "different",
    },
    account,
    next,
    engine,
  );
  assert.equal(unchanged.classified, 0);
  assert.equal(unchanged.state, "unchanged");
  const forced = await startOperation(db, "alice", "backfill", {
    kind: "reconcile",
    itemIds: ["item"],
    renormalize: true,
  });
  assert.equal(
    (await prepareEntity(db, identity("stable"), raw, account, forced, engine))
      .classified,
    1,
  );
});

test("operational retention does not remove financial records, rule provenance or idempotency", async () => {
  const { db, op } = await setup();
  await runOperation(
    synchronizationDependencies(env(db)),
    op.id,
    steps(),
    providerFixture(),
  );
  const { compactOperations } = await import("#worker/sync/repository.ts");
  const count = required(
    await db.prepare("SELECT count(*) n FROM entities").first(),
  ).n;
  await compactOperations(db, new Date("2030-01-01T00:00:00Z"));
  assert.equal(
    required(await db.prepare("SELECT count(*) n FROM entities").first()).n,
    count,
  );
  assert.equal(
    required(await db.prepare("SELECT count(*) n FROM page_commits").first()).n,
    0,
  );
  assert.equal(
    (
      await startOperation(db, "alice", "first", {
        kind: "sync",
        itemIds: ["item"],
      })
    ).id,
    op.id,
  );
  assert.ok(await rulesFor(db, "alice", op.rules_revision));
});

test("changed totals during pagination retain partial coverage and never advance complete checkpoint", async () => {
  const { db, op } = await setup();
  await db.exec(`UPDATE items SET resources='["accounts"]' WHERE id='item'`);
  const source = {
    async ids() {
      return [];
    },
    async page(...[, , , cursor]: Parameters<FinancialSource["page"]>) {
      return cursor
        ? { records: [{ ...account, id: "second" }], next: null, total: 3 }
        : { records: [account], next: "2", total: 2 };
    },
  };
  await assert.rejects(
    runOperation(synchronizationDependencies(env(db)), op.id, steps(), source),
    /SOURCE_TOTAL_CHANGED/,
  );
  assert.equal(
    required(
      await db.prepare("SELECT bootstrap_complete FROM coverage").first(),
    ).bootstrap_complete,
    0,
  );
  assert.equal(
    required(await db.prepare("SELECT status FROM coverage").first()).status,
    "partial",
  );
  assert.equal(
    required(await db.prepare("SELECT count(*) n FROM entities").first()).n,
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
  actions: z.infer<typeof RuleSchema>["event"]["params"]["actions"];
}) {
  const condition = convertPredicate(r.when, "fixture");
  return RuleSchema.parse({
    id: r.id,
    name: r.name,
    priority: r.priority,
    is_active: r.is_active,
    conditions: "fact" in condition ? { all: [condition] } : condition,
    event: { type: r.stage, params: { actions: r.actions } },
  });
}

test("native D1 rolls back entity data and checkpoint when any batch statement fails", async () => {
  const { db, op } = await setup();
  const engine = await rulesFor(db, "alice", op.rules_revision);
  const entity = await prepareEntity(
    db,
    identity("atomic"),
    transaction("atomic"),
    account,
    op,
    engine,
  );
  await assert.rejects(
    db.batch([
      ...entity.statements,
      db
        .prepare(
          "INSERT INTO checkpoints(operation_id,item_id,resource) VALUES(?,?,?)",
        )
        .bind(op.id, "item", "transactions"),
      db
        .prepare("INSERT INTO locks(principal,operation_id) VALUES(?,?)")
        .bind("alice", "missing-operation"),
    ]),
  );
  assert.equal(
    await db
      .prepare("SELECT COUNT(*) AS n FROM entities WHERE id='atomic'")
      .first("n"),
    0,
  );
  assert.equal(
    await db
      .prepare("SELECT COUNT(*) AS n FROM derived WHERE id='atomic'")
      .first("n"),
    0,
  );
  assert.equal(
    await db
      .prepare("SELECT COUNT(*) AS n FROM checkpoints WHERE operation_id=?")
      .bind(op.id)
      .first("n"),
    0,
  );
});

test("legacy revisions remain readable; explicit conversion creates a new revision without rewriting frozen operations", async () => {
  const { db } = await setup();
  const { readRules } = await import("#worker/finance/rules.repository.ts");
  const { NORMALIZER } = await import("#domain/entity.ts");
  const { convertRules } = await import("#domain/rules/convert-rules.ts");
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
  await db
    .prepare(
      "INSERT INTO rule_sets(principal,id,document,normalizer,created_at,ready) VALUES(?,?,?,?,?,1)",
    )
    .bind("alice", "legacy", serialized, NORMALIZER, new Date().toISOString())
    .run();
  await db
    .prepare("UPDATE principals SET active_rules='legacy' WHERE id='alice'")
    .run();
  const frozen = await startOperation(db, "alice", "legacy-operation", {
    kind: "sync",
    itemIds: ["item"],
  });
  assert.deepEqual(await readRules(db, "alice", "legacy"), old);
  assert.deepEqual(
    await invoke(financialQueries(env(db), "alice"), "caderninho_rules", {
      action: "read",
      revision: "legacy",
    }),
    old,
  );
  await assert.rejects(
    rulesFor(db, "alice", "legacy"),
    /RULES_V1_REQUIRES_EXPLICIT_CONVERSION_AND_ACTIVATION/,
  );
  const report = convertRules(old);
  assert.ok(report.document);
  const saved = await saveRules(db, "alice", report.document, true);
  assert.notEqual(saved.id, "legacy");
  assert.equal(
    (await getOperation(db, "alice", frozen.id)).rules_revision,
    "legacy",
  );
  assert.equal(
    await db
      .prepare("SELECT document FROM rule_sets WHERE id='legacy'")
      .first("document"),
    serialized,
  );
  assert.equal(
    (
      await (
        await rulesFor(db, "alice", saved.id)
      ).evaluate(txContext({ id: "x" }))
    ).description,
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
  const before = await db
    .prepare("SELECT COUNT(*) AS n FROM rule_sets")
    .first("n");
  const old = { ...EMPTY_RULES, version: 1 };
  const response = await fetchMcp(
    new Request("https://local/mcp/rules/import", {
      method: "POST",
      body: JSON.stringify({ document: old }),
    }),
    env(db),
    "alice",
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
    await db.prepare("SELECT COUNT(*) AS n FROM rule_sets").first("n"),
    before,
  );
  await assert.rejects(
    fetchMcp(
      new Request("https://local/mcp/rules/import", {
        method: "POST",
        body: " ".repeat(1048577),
      }),
      env(db),
      "alice",
    ),
    /BODY_LIMIT/,
  );
});

test("Hono OAuth consent requires owner session, escapes client text and preserves consent redirects", async () => {
  const { db } = await setup();
  const { oauth } = await import("#worker/auth/controller.ts");
  const { createExecutionContext } = await import("cloudflare:test");
  const config = {
    ...env(db),
    OWNER_GITHUB_ID: "123",
    OAUTH_KV: bindings.OAUTH_KV,
    PUBLIC_ORIGIN: "https://local",
    GITHUB_CLIENT_ID: "synthetic-app",
    GITHUB_CLIENT_SECRET: "synthetic-secret",
  };
  const { hash, statement } = await import("#worker/database.ts");
  await db.exec("INSERT INTO principals(id) VALUES('github:123')");
  await statement(
    db,
    "INSERT INTO portal_sessions(id,principal,csrf,expires) VALUES(?,?,?,?)",
    await hash("synthetic-session"),
    "github:123",
    "synthetic-csrf",
    Date.now() + 60000,
  ).run();
  const ownerCookie = "__Host-caderninho=synthetic-session";
  const provider = oauth(config, async () => new Response("verified"));
  const request = (path: string, options?: RequestInit) =>
    provider.fetch(
      new Request("https://local" + path, options),
      config,
      createExecutionContext(),
    );
  const registered = await request("/oauth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "<script>synthetic</script>",
      redirect_uris: ["http://localhost:8123/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    }),
  });
  assert.equal(registered.status, 201);
  const client = z
    .object({ client_id: z.string() })
    .parse(await registered.json());
  const authorize =
    "/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: "http://localhost:8123/callback",
      scope: "finance",
      code_challenge: "a".repeat(43),
      code_challenge_method: "S256",
      state: "synthetic-state",
    });
  async function consent(decision: string) {
    const page = await request(authorize, { headers: { Cookie: ownerCookie } });
    assert.equal(page.status, 200);
    assert.match(page.headers.get("Content-Type") ?? "", /text\/html/);
    const body = await page.text();
    assert.ok(body.includes("&lt;script&gt;synthetic&lt;/script&gt;"));
    assert.ok(!body.includes("<script>synthetic</script>"));
    const handle = z
      .string()
      .parse(body.match(/name="handle" value="([^"]+)"/)?.[1]);
    const cookie = page.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
    assert.ok(cookie);
    return request("/authorize", {
      method: "POST",
      headers: {
        Cookie: cookie + "; " + ownerCookie,
        Origin: "https://local",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ handle, decision }),
    });
  }
  const denied = await consent("deny");
  assert.equal(denied.status, 302);
  const target = new URL(z.string().parse(denied.headers.get("Location")));
  assert.equal(target.origin, "http://localhost:8123");
  assert.equal(target.searchParams.get("error"), "access_denied");
  assert.equal(target.searchParams.get("state"), "synthetic-state");
  assert.ok(denied.headers.get("Set-Cookie"));
  const approved = await consent("approve");
  assert.equal(approved.status, 302);
  const callback = new URL(z.string().parse(approved.headers.get("Location")));
  assert.equal(callback.origin, "http://localhost:8123");
  assert.ok(callback.searchParams.get("code"));
  assert.equal(callback.searchParams.get("state"), "synthetic-state");
  assert.ok(approved.headers.get("Set-Cookie"));
});

test("page publication rolls back data, progress, checkpoint and receipt together, then replays once", async () => {
  const { publishPage } = await import("#worker/sync/publication.ts");
  const { db, op } = await setup();
  const engine = await rulesFor(db, "alice", op.rules_revision);
  await db
    .prepare(
      "INSERT INTO checkpoints(operation_id,item_id,resource,parent_id) VALUES(?,?,'accounts','')",
    )
    .bind(op.id, "item")
    .run();
  const before = await db
    .prepare("SELECT progress FROM operations WHERE id=?")
    .bind(op.id)
    .first("progress");
  await db.exec(
    "CREATE TRIGGER fail_page_receipt BEFORE INSERT ON page_commits BEGIN SELECT RAISE(ABORT, 'synthetic receipt failure'); END",
  );
  let fetched = 0;
  const publication = {
    db,
    op,
    name: "atomic-page",
    resource: "accounts" as const,
    item: { id: "item" },
    parentId: "",
    parent: null,
    engine,
    provider: {
      async page() {
        fetched++;
        return { records: [account], next: null, total: 1 };
      },
    },
  };
  await assert.rejects(publishPage(publication), /synthetic receipt failure/);
  assert.equal(
    await db.prepare("SELECT COUNT(*) n FROM entities").first("n"),
    0,
  );
  assert.equal(
    await db.prepare("SELECT COUNT(*) n FROM page_commits").first("n"),
    0,
  );
  assert.equal(
    await db
      .prepare("SELECT page FROM checkpoints WHERE operation_id=?")
      .bind(op.id)
      .first("page"),
    0,
  );
  assert.equal(
    await db
      .prepare("SELECT progress FROM operations WHERE id=?")
      .bind(op.id)
      .first("progress"),
    before,
  );
  await db.exec("DROP TRIGGER fail_page_receipt");
  await publishPage(publication);
  const progress = await db
    .prepare("SELECT progress FROM operations WHERE id=?")
    .bind(op.id)
    .first("progress");
  await publishPage(publication);
  assert.equal(fetched, 2);
  assert.equal(
    await db.prepare("SELECT COUNT(*) n FROM entities").first("n"),
    1,
  );
  assert.equal(
    await db.prepare("SELECT COUNT(*) n FROM page_commits").first("n"),
    1,
  );
  assert.equal(
    await db
      .prepare("SELECT progress FROM operations WHERE id=?")
      .bind(op.id)
      .first("progress"),
    progress,
  );
});
