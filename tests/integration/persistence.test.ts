import assert from "node:assert/strict";

import type { D1Migration } from "@cloudflare/vitest-plugin";
import { and, count, countDistinct, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import type { OperationInput } from "@/contracts/operation.types";
import type { Identity } from "@/contracts/queries.types";
import { Resource } from "@/domain/enums";
import type { ProviderRecord } from "@/domain/provider.entity";
import type { Filter } from "@/domain/query.entity";
import { EMPTY_RULES, importRules, type Rule, txContext } from "@/domain/rules";
import { convertPredicate } from "@/domain/rules/convert-rules";
import type { JsonValue } from "@/shared/json.types";
import { prepareEntity } from "@/testing/finance";
import { required, responseJson } from "@/testing/helpers";
import { mockNetwork } from "@/testing/network";
import type { Bindings, DurableInstance } from "@/worker/bindings";
import {
  financialQueries,
  synchronizationDependencies,
  syncService,
} from "@/worker/composition";
import { database } from "@/worker/database";
import { override } from "@/worker/finance/entities.repository";
import { aggregateEntities, queryEntities } from "@/worker/finance/repository";
import { rulesFor, saveRules } from "@/worker/finance/rules.repository";
import { fetchMcp } from "@/worker/mcp/controller";
import { listen, task } from "@/worker/mcp/tasks";
import {
  checkpoints as checkpointsTable,
  coverage as coverageTable,
  derived as derivedTable,
  effective_entities as effectiveEntitiesTable,
  entities as entitiesTable,
  inbox as inboxTable,
  items as itemsTable,
  locks as locksTable,
  migration_imports as migrationImportsTable,
  operations as operationsTable,
  operation_targets as operationTargetsTable,
  page_commits as pageCommitsTable,
  rule_sets as ruleSetsTable,
  settings as settingsTable,
  tags as tagsTable,
} from "@/worker/schema";
import { type FinancialSource, runOperation } from "@/worker/sync";
import { finish, getOperation, startOperation } from "@/worker/sync/repository";

import { settings } from "./personal-fixture";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";

const notFoundPattern = /NOT_FOUND/;
const subscriptionAcknowledgementPattern =
  /notifications\/subscriptions\/acknowledged/;
const taskNotificationPattern = /notifications\/tasks/;
const syncFilterNotSupportedUseItemScopePattern =
  /SYNC_FILTER_NOT_SUPPORTED_USE_ITEM_SCOPE/;
const renormalizeRequiresReconciliationPattern =
  /RENORMALIZE_REQUIRES_RECONCILIATION/;
const restartRequiredPattern = /RESTART_REQUIRED/;
const unknownMetricPattern = /UNKNOWN_METRIC/;
const cursorScopePattern = /CURSOR_SCOPE/;
const unavailablePattern = /unavailable/;
const sourceIdMismatchPattern = /SOURCE_ID_MISMATCH/;
const canonicalMinorErrorPattern = /canonical integer, at most 30 digits/;
const sourceTotalChangedPattern = /SOURCE_TOTAL_CHANGED/;
const rulesV1RequiresExplicitConversionAndActivationPattern =
  /RULES_V1_REQUIRES_EXPLICIT_CONVERSION_AND_ACTIVATION/;
const bodyLimitPattern = /BODY_LIMIT/;
const syntheticReceiptFailurePattern = /synthetic receipt failure/;

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      OAUTH_KV: KVNamespace;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
beforeEach(async () => {
  await reset();
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
});
afterEach(() => vi.unstubAllGlobals());

test("owner-data migration preserves existing financial records and makes the full history readable", async () => {
  await reset();
  const initial = required(
    bindings.TEST_MIGRATIONS.find(
      (migration) => migration.name === "0001_personal.sql",
    ),
  );
  await applyD1Migrations(bindings.DB, [initial]);
  await bindings.DB.prepare(
    "INSERT INTO items(id, resources, enabled) VALUES (?, ?, ?)",
  )
    .bind("legacy-item", JSON.stringify([]), 0)
    .run();
  await database(bindings.DB)
    .insert(entitiesTable)
    .values({
      first_seen_at: "2026-10-01T00:00:00.000Z",
      id: "legacy-transaction",
      item_id: "legacy-item",
      normalized: {
        amountMinor: "-900719925474099329",
        currency: "BRL",
        id: "legacy-transaction",
      },
      normalizer: "synthetic",
      observed_at: "2026-10-01T00:00:00.000Z",
      parent_id: "legacy-account",
      relevant_hash: "synthetic",
      resource: Resource.transactions,
      source: { id: "legacy-transaction" },
    })
    .run();
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
  const result = await queryEntities(bindings.DB, {
    resource: Resource.transactions,
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0]?.id, "legacy-transaction");
  const normalized = z
    .object({ amountMinor: z.string() })
    .parse(JSON.parse(required(result.records[0]).normalized));
  assert.equal(normalized.amountMinor, "-900719925474099329");
  assert.equal(result.coverage[0]?.itemId, "legacy-item");
});

test("D1 queries, local corrections and task progress remain available without Pluggy credentials", async () => {
  const { db, op } = await setup();
  const engine = await rulesFor(db, op.rules_revision);
  await commit(
    db,
    (
      await prepareEntity(db, {
        engine,
        identity: identity("offline"),
        operation: op,
        parent: account,
        source: transaction("offline"),
      })
    ).statements,
  );
  let upstream = 0;
  mockNetwork(() => {
    upstream += 1;
    return Promise.reject(new Error("Pluggy unavailable"));
  });
  const queries = financialQueries(env(db));
  assert.equal(
    (await queries.query({ limit: 50, resource: "transactions" })).records
      .length,
    1,
  );
  assert.equal(
    (await queries.aggregate({ metric: "amount", resource: "transactions" }))
      .groups[0]?.totalMinor,
    "1001",
  );
  const reference = identity("offline");
  const before = await database(db)
    .select({ revision: settingsTable.revision })
    .from(settingsTable)
    .where(and(eq(settingsTable.id, 1)))
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
      .select({ revision: settingsTable.revision })
      .from(settingsTable)
      .where(and(eq(settingsTable.id, 1)))
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
      field: "description",
      itemId: "unknown-item",
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
  balance: "100.00",
  currencyCode: "BRL",
  id: "account",
  itemId: "item",
  name: "Synthetic",
  type: "BANK",
};
const connection = {
  connector: { id: 200, isOpenFinance: false },
  id: "item",
};
const transaction = (id: string, extra: Partial<ProviderRecord> = {}) => ({
  accountId: "account",
  amount: "-10.01",
  createdAt: "2026-10-01T00:00:00.000Z",
  currencyCode: "BRL",
  date: "2026-01-01T00:00:00.000Z",
  description: "Café",
  id,
  status: "POSTED",
  type: "DEBIT",
  ...extra,
});
async function setup() {
  const { DB: db } = bindings;
  await database(db).insert(itemsTable).values({
    id: "item",
  });
  const op = await startOperation(db, "first", {
    itemIds: ["item"],
    kind: "sync",
  });
  return { db, op };
}
const identity = (id: string): Identity => ({
  id,
  itemId: "item",
  parentId: "account",
  resource: "transactions",
});

test("coverage groups connected Items and retains not-synced entries", async () => {
  const { db } = await setup();
  await database(db).insert(itemsTable).values({ id: "other" });
  await database(db)
    .insert(coverageTable)
    .values(
      ["item"].map((item_id) => ({
        bootstrap_complete: 1,
        item_id,
        observed_at: "2026-10-01T00:00:00.000Z",
        parent_id: "account",
        resource: Resource.transactions,
        status: "available" as const,
      })),
    );
  const result = await queryEntities(db, { resource: "transactions" });
  assert.deepEqual(result.coverage, [
    {
      coverage: [
        {
          bootstrap_complete: 1,
          observed_at: "2026-10-01T00:00:00.000Z",
          parent_id: "account",
          resource: "transactions",
          status: "available",
        },
      ],
      itemId: "item",
    },
    {
      coverage: [
        {
          bootstrap_complete: 0,
          resource: "transactions",
          status: "not_synced",
        },
      ],
      itemId: "other",
    },
  ]);
});

test("bulk Task subscriptions preserve requested order and reject missing Tasks", async () => {
  const { db, op } = await setup();
  await database(db).insert(itemsTable).values({
    id: "other",
  });
  const other = await startOperation(db, "other-task", {
    itemIds: ["other"],
    kind: "sync",
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
      .object({ status: z.string().optional(), taskId: z.string().optional() })
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
    notFoundPattern,
  );
});

function steps() {
  // Exercise replay through the D1 receipts, without an untyped checkpoint cache.
  return {
    do<T extends Rpc.Serializable<T>>(
      _name: string,
      callback: () => Promise<T>,
    ): Promise<T> {
      return Promise.resolve(callback());
    },
    sleep() {
      return Promise.resolve();
    },
  };
}

test("cancelling a waiting subscription closes the reader and releases its lifetime without cancelling the operation", async () => {
  const { listen: listenTasks } = await import("@/worker/mcp/tasks");
  const { db, op } = await setup();
  const released = Promise.withResolvers<void>();
  const response = await listenTasks(
    new Request("https://local/mcp"),
    env(db),
    {
      id: "synthetic-listener",
      ids: [op.id],
      keepAlive: (lifetime) => {
        void lifetime.then(released.resolve);
      },
    },
  );
  const reader = required(response.body).getReader();
  assert.match(
    new TextDecoder().decode((await reader.read()).value),
    subscriptionAcknowledgementPattern,
  );
  assert.match(
    new TextDecoder().decode((await reader.read()).value),
    taskNotificationPattern,
  );
  const pending = reader.read();
  await Promise.resolve();
  await reader.cancel();
  assert.equal((await pending).done, true);
  await released.promise;
  assert.equal((await getOperation(db, op.id)).status, "working");
});

interface ProviderFixture extends FinancialSource {
  calls: Pick<
    Parameters<FinancialSource["page"]>[0],
    "resource" | "parent" | "cursor" | "floor"
  >[];
  readonly count: number;
}
function providerFixture(): ProviderFixture {
  let pages = 0;
  const calls: ProviderFixture["calls"] = [];
  return {
    calls,
    get count() {
      return pages;
    },
    ids() {
      return Promise.resolve([]);
    },
    page({
      resource,
      parent,
      cursor,
      floor,
    }: Parameters<FinancialSource["page"]>[0]): ReturnType<
      FinancialSource["page"]
    > {
      calls.push({ cursor, floor, parent, resource });
      if (resource === "connections") {
        return Promise.resolve({ next: null, records: [connection] });
      }
      if (resource === "accounts") {
        return Promise.resolve({ next: null, records: [account] });
      }
      if (resource !== "transactions") {
        return Promise.resolve({ next: null, records: [] });
      }
      pages += 1;
      if (!floor && cursor === null) {
        return Promise.resolve({ next: "two", records: [transaction("old")] });
      }
      if (!floor) {
        return Promise.resolve({
          next: null,
          records: [
            transaction("backdated", { createdAt: "2026-10-02T00:00:00.000Z" }),
          ],
        });
      }
      return Promise.resolve({
        next: null,
        records: [
          transaction("backdated", { createdAt: "2026-10-02T00:00:00.000Z" }),
        ],
      });
    },
  };
}
function instance(id: string): DurableInstance {
  return {
    id,
    status() {
      return Promise.resolve({ status: "running" });
    },
  };
}
// Synthetic binding boundary: these unit tests exercise DB and FINANCE; runtime tests separately verify rejection of forged OAuth identity headers.
const env = (db: D1Database): Bindings => ({
  ...settings(),
  DB: db,
  FINANCE: {
    create({ id }: { id: string }) {
      return Promise.resolve(instance(id));
    },
    get(id: string) {
      return Promise.resolve(instance(id));
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
        .from(entitiesTable)
        .where(and(eq(entitiesTable.resource, "transactions")))
        .get()
        .then((row) => row ?? null),
    ).n,
    2,
  );
  const first = await getOperation(db, op.id);
  assert.equal(first.status, "completed");
  assert.equal(first.progress.classified, 2);
  const next = await startOperation(db, "second", {
    itemIds: ["item"],
    kind: "sync",
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
        .from(entitiesTable)
        .where(and(eq(entitiesTable.resource, "transactions")))
        .get()
        .then((row) => row ?? null),
    ).n,
    2,
  );
});
for (const flow of ["collection", "event", "pending"] as const) {
  for (const sample of [
    {
      conflict: false,
      error: null,
      missingId: false,
      name: "counts identical IDs once and replays without preparing again",
    },
    {
      conflict: true,
      error: /DUPLICATE_SOURCE_ID_CHANGED_IN_PAGE/,
      missingId: false,
      name: "rejects conflicting IDs atomically",
    },
    {
      conflict: false,
      error: /SOURCE_ID_MISSING/,
      missingId: true,
      name: "rejects missing IDs atomically",
    },
  ]) {
    test(`${flow} publication ${sample.name}`, async () => {
      const rejected = !!sample.error;
      const { db, op: seed } = await setup();
      const engine = await rulesFor(db, seed.rules_revision);
      for (const input of [
        {
          identity: {
            id: "account",
            itemId: "item",
            parentId: "",
            resource: Resource.accounts,
          },
          parent: undefined,
          source: account,
        },
        {
          identity: identity("duplicate"),
          parent: account,
          source: transaction("duplicate", { status: "PENDING" }),
        },
      ]) {
        await commit(
          db,
          (await prepareEntity(db, { ...input, engine, operation: seed }))
            .statements,
        );
      }
      await finish(db, seed, "completed");
      const eventId = "duplicate-event";
      if (flow === "event") {
        await database(db)
          .insert(inboxTable)
          .values({
            account_id: "account",
            event: "transactions/updated",
            event_id: eventId,
            item_id: "item",
            payload: { transactionIds: ["duplicate"] },
            received_at: new Date().toISOString(),
          });
      }
      const op = await startOperation(
        db,
        "duplicate-batch",
        flow === "event"
          ? { eventId, itemIds: ["item"], kind: "webhook" }
          : { itemIds: ["item"], kind: "sync" },
      );
      const record = transaction("duplicate", {
        amount: "-9007199254740993.29",
        description: "Confirmed",
      });
      const records = [
        record,
        {
          ...record,
          ...(sample.conflict && { description: "Conflicting" }),
          ...(sample.missingId && { id: null }),
        },
      ];
      let fetched = 0;
      const source: FinancialSource = {
        ids() {
          fetched += 1;
          return Promise.resolve(records);
        },
        page({ resource }) {
          if (resource === Resource.connections) {
            return Promise.resolve({ next: null, records: [connection] });
          }
          if (resource === Resource.accounts) {
            return Promise.resolve({ next: null, records: [account] });
          }
          if (resource === Resource.transactions && flow === "collection") {
            fetched += 1;
            return Promise.resolve({ next: null, records, total: 1 });
          }
          return Promise.resolve({ next: null, records: [] });
        },
      };
      const dependencies = synchronizationDependencies(env(db));
      let preparations = 0;
      const key =
        flow === "collection"
          ? "page-item-transactions-account-0"
          : `${flow}-0`;
      const durable = steps();
      const execution = runOperation(
        {
          ...dependencies,
          prepare(input) {
            if (input.identity.resource === Resource.transactions) {
              preparations += 1;
            }
            return dependencies.prepare(input);
          },
          source: async () => source,
        },
        op.id,
        {
          async do(name, callback) {
            const result = await callback();
            if (name === key) {
              assert.deepEqual(await callback(), result);
            }
            return result;
          },
          sleep: durable.sleep,
        },
      );
      if (sample.error) {
        await assert.rejects(execution, sample.error);
      } else {
        await execution;
      }
      const current = await getOperation(db, op.id);
      const stored = required(
        await database(db)
          .select()
          .from(entitiesTable)
          .where(
            and(
              eq(entitiesTable.resource, Resource.transactions),
              eq(entitiesTable.id, "duplicate"),
            ),
          )
          .get(),
      );
      assert.equal(fetched, 1);
      assert.equal(preparations, 1);
      assert.equal(current.status, "completed");
      assert.equal(current.result?.isError, rejected);
      assert.equal(current.progress.classified ?? 0, rejected ? 0 : 1);
      assert.equal(current.progress.duplicates ?? 0, rejected ? 0 : 1);
      assert.equal(
        stored.original_description,
        rejected ? "Café" : "Confirmed",
      );
      assert.equal(stored.status, rejected ? "PENDING" : "POSTED");
      assert.equal(
        stored.source.amount,
        rejected ? "-10.01" : "-9007199254740993.29",
      );
      if (!rejected) {
        assert.equal(
          (
            await aggregateEntities(db, {
              metric: "amount",
              resource: Resource.transactions,
            })
          ).groups[0]?.totalMinor,
          "900719925474099329",
        );
      }
      const receipt = await database(db)
        .select()
        .from(pageCommitsTable)
        .where(
          and(
            eq(pageCommitsTable.operation_id, op.id),
            eq(pageCommitsTable.step_key, key),
          ),
        )
        .get();
      assert.equal(!!receipt, !rejected);
      if (flow === "event") {
        const event = required(
          await database(db)
            .select()
            .from(inboxTable)
            .where(eq(inboxTable.event_id, eventId))
            .get(),
        );
        assert.equal(!!event.processed_at, !rejected);
      }
      if (flow === "pending") {
        const target = required(
          await database(db)
            .select()
            .from(operationTargetsTable)
            .where(
              and(
                eq(operationTargetsTable.operation_id, op.id),
                eq(operationTargetsTable.id, "duplicate"),
              ),
            )
            .get(),
        );
        assert.equal(target.processed, rejected ? 0 : 1);
      }
    });
  }
}

test("cancellation inside the migration step remains cancelled and releases the installation lock without opening the source", async () => {
  const { db, op: seed } = await setup();
  await finish(db, seed, "completed");
  const op = await startOperation(db, "cancel-migration", {
    itemIds: ["item"],
    kind: "migration",
    migration: [],
  });
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: () => Promise.reject(new Error("SOURCE_MUST_STAY_CLOSED")),
    },
    op.id,
    {
      async do(name, callback) {
        if (name === "import-legacy") {
          await database(db)
            .update(operationsTable)
            .set({ cancel_requested: 1 })
            .where(eq(operationsTable.id, op.id));
        }
        return callback();
      },
      sleep: steps().sleep,
    },
  );
  const result = await getOperation(db, op.id);
  assert.equal(result.status, "cancelled");
  assert.equal(result.phase, "cancelled");
  assert.equal(result.result?.isError, false);
  assert.equal(await database(db).select().from(locksTable).get(), undefined);
});

test("failure to open the source is persisted and propagated; a terminal operation does not reopen dependencies", async () => {
  const { db, op } = await setup();
  const failure = new Error("synthetic source unavailable");
  let opened = 0;
  const dependencies = {
    ...synchronizationDependencies(env(db)),
    source: () => {
      opened += 1;
      return Promise.reject(failure);
    },
  };
  await assert.rejects(
    runOperation(dependencies, op.id, steps()),
    (error) => error === failure,
  );
  const result = await getOperation(db, op.id);
  assert.equal(result.status, "completed");
  assert.equal(result.phase, "error");
  assert.equal(result.result?.isError, true);
  assert.equal(await database(db).select().from(locksTable).get(), undefined);
  await runOperation(
    {
      ...dependencies,
      repository: {
        ...dependencies.repository,
        rules: () => Promise.reject(new Error("TERMINAL_MUST_NOT_LOAD_RULES")),
      },
    },
    op.id,
    steps(),
  );
  assert.equal(opened, 1);
  assert.deepEqual(await getOperation(db, op.id), result);
});

test("idempotent operation and dispatch response loss recovery", async () => {
  const { db, op } = await setup();
  await assert.rejects(
    startOperation(db, "invalid-filter", {
      filter: { tag: "project", value: "personal" },
      itemIds: ["item"],
      kind: "sync",
    }),
    syncFilterNotSupportedUseItemScopePattern,
  );
  await assert.rejects(
    startOperation(db, "invalid-renormalization", {
      itemIds: ["item"],
      kind: "sync",
      renormalize: true,
    }),
    renormalizeRequiresReconciliationPattern,
  );
  assert.equal(
    (
      await startOperation(db, "first", {
        itemIds: ["item"],
        kind: "sync",
      })
    ).id,
    op.id,
  );
  await assert.rejects(getOperation(db, "unknown-operation"));
  let creates = 0;
  await syncService({
    ...env(db),
    FINANCE: {
      create() {
        creates += 1;
        return Promise.reject(new Error("response lost"));
      },
      get(id) {
        return Promise.resolve(instance(id));
      },
    },
  }).dispatch(op);
  assert.equal(creates, 1);
  assert.equal(
    required(
      await database(db)
        .select({ dispatched: operationsTable.dispatched })
        .from(operationsTable)
        .where(and(eq(operationsTable.id, op.id)))
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
    engine,
    identity: i,
    operation: op,
    parent: account,
    source: transaction("huge", { amount: "-9007199254740993.01" }),
  });
  await commit(db, p.statements);
  const { invoke } = await import("@/worker/mcp/invoke");
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
    engine,
    identity: i,
    operation: op,
    parent: account,
    source: transaction("huge", {
      amount: "-9007199254740993.02",
      description: "Changed",
    }),
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
      actions: [{ op: "set_description", value: "New rules" }],
      id: "new",
      is_active: true,
      name: "new",
      priority: 1,
      stage: "enrich",
      when: true,
    }),
  );
  await saveRules(db, rules, true);
  const unchanged = await prepareEntity(db, {
    engine,
    identity: i,
    operation: op,
    parent: account,
    source: transaction("huge", {
      amount: "-9007199254740993.02",
      description: "Changed",
    }),
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
          engine,
          identity: identity(id),
          operation: op,
          parent: account,
          source: transaction(id, { amount }),
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
    restartRequiredPattern,
  );
});

const meta = {
  "io.modelcontextprotocol/clientCapabilities": {
    extensions: { "io.modelcontextprotocol/tasks": {} },
  },
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
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
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "Mcp-Method": method,
      "Mcp-Name": params.name ?? params.taskId ?? "",
      "Mcp-Protocol-Version": "2026-07-28",
    },
    method: "POST",
  });
test("modern Tasks wire rejects absent capability, returns flat durable handle and validates get/update/cancel", async () => {
  const { db } = await setup(),
    e = env(db),
    args = {
      arguments: { itemIds: ["item"], requestKey: "wire" },
      name: "caderninho_sync",
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
  assert.equal(required(missing.error).code, -32_021);
  const created = await responseJson(
    await fetchMcp(rpc("tools/call", { ...args, _meta: meta }), e),
  );
  assert.equal(required(created.result).resultType, "task");
  assert.equal(required(created.result).task, undefined);
  const taskId = required(required(created.result).taskId);
  const get = await responseJson(
    await fetchMcp(rpc("tasks/get", { _meta: meta, taskId }), e),
  );
  assert.equal(required(get.result).taskId, taskId);
  const forbidden = await responseJson(
    await fetchMcp(
      rpc("tasks/get", { _meta: meta, taskId: "unknown-task" }),
      e,
    ),
  );
  assert.ok(forbidden.error);
  const update = await responseJson(
    await fetchMcp(
      rpc("tasks/update", {
        _meta: meta,
        inputResponses: { unknown: { resultType: "complete", roots: [] } },
        taskId,
      }),
      e,
    ),
  );
  assert.deepEqual(update.result, { resultType: "complete" });
  const cancel = await responseJson(
    await fetchMcp(rpc("tasks/cancel", { _meta: meta, taskId }), e),
  );
  assert.deepEqual(cancel.result, { resultType: "complete" });
});
test("reapply freezes selection even when its filter changes and preserves manual overrides", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, op.rules_revision);
  for (let n = 0; n < 43; n += 1) {
    await commit(
      db,
      (
        await prepareEntity(db, {
          engine,
          identity: identity(`r${n}`),
          operation: op,
          parent: account,
          source: transaction(`r${n}`),
        })
      ).statements,
    );
  }
  await override(db, identity("r0"), "description", "Manual");
  const rules = structuredClone(EMPTY_RULES);
  rules.rules.push(
    fixtureRule({
      actions: [{ op: "set_description", value: "Changed" }],
      id: "rename",
      is_active: true,
      name: "rename",
      priority: 1,
      stage: "enrich",
      when: true,
    }),
  );
  await saveRules(db, rules, true);
  const run = await startOperation(db, "reapply", {
    filter: { field: "original.description", op: "eq", value: "Café" },
    itemIds: ["item"],
    kind: "reapply",
  });
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: () => Promise.reject(new Error("SOURCE_MUST_STAY_CLOSED")),
    },
    run.id,
    steps(),
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(derivedTable)
        .where(and(eq(derivedTable.description, "Changed")))
        .get()
        .then((row) => row ?? null),
    ).n,
    43,
  );
  assert.equal(
    required(
      await database(db)
        .select({
          effective_description: effectiveEntitiesTable.effective_description,
        })
        .from(effectiveEntitiesTable)
        .where(and(eq(effectiveEntitiesTable.id, "r0")))
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
        engine,
        identity: {
          id: "account",
          itemId: "item",
          parentId: "",
          resource: "accounts",
        },
        operation: op,
        parent: undefined,
        source: account,
      })
    ).statements,
  );
  await commit(
    db,
    (
      await prepareEntity(db, {
        engine,
        identity: identity("t"),
        operation: op,
        parent: account,
        source: transaction("t", { status: "PENDING" }),
      })
    ).statements,
  );
  async function event(key: string, records: ProviderRecord[]) {
    await database(db)
      .insert(inboxTable)
      .values({
        account_id: "account",
        event: "transactions/deleted",
        event_id: key,
        item_id: "item",
        payload: { transactionIds: ["t"] },
        received_at: new Date().toISOString(),
      })
      .run();
    const o = await startOperation(db, key, {
      eventId: key,
      itemIds: ["item"],
      kind: "webhook",
    });
    await runOperation(
      {
        ...synchronizationDependencies(env(db)),
        source: async () => ({
          ...providerFixture(),
          ids() {
            return Promise.resolve(records);
          },
        }),
      },
      o.id,
      steps(),
    );
  }
  await event("updated", [
    transaction("t", { description: "Updated", status: "POSTED" }),
  ]);
  assert.equal(
    required(
      await database(db)
        .select({ status: entitiesTable.status })
        .from(entitiesTable)
        .where(and(eq(entitiesTable.id, "t")))
        .get()
        .then((row) => row ?? null),
    ).status,
    "POSTED",
  );
  await event("deleted", []);
  assert.equal(
    required(
      await database(db)
        .select({ deleted: entitiesTable.deleted })
        .from(entitiesTable)
        .where(and(eq(entitiesTable.id, "t")))
        .get()
        .then((row) => row ?? null),
    ).deleted,
    1,
  );
  await event("late-delete", [transaction("t", { description: "Reappeared" })]);
  const current = await database(db)
    .select({
      deleted: entitiesTable.deleted,
      original_description: entitiesTable.original_description,
    })
    .from(entitiesTable)
    .where(and(eq(entitiesTable.id, "t")))
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
        engine,
        identity: identity("future"),
        operation: op,
        parent: account,
        source: future,
      })
    ).statements,
  );
  const run = await startOperation(db, "mature", {
    filter: { field: "account", op: "eq", value: "nonexistent" },
    itemIds: ["item"],
    kind: "reapply",
  });
  await database(db)
    .update(operationsTable)
    .set({ reference_day: "2099-01-02" })
    .where(eq(operationsTable.id, run.id))
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
        .select({ eligible: entitiesTable.eligible })
        .from(entitiesTable)
        .where(and(eq(entitiesTable.id, "future")))
        .get()
        .then((row) => row ?? null),
    ).eligible,
    1,
  );
  assert.equal((await getOperation(db, run.id)).progress.classified, 0);
  const cancelled = await startOperation(db, "cancelled", {
    itemIds: ["item"],
    kind: "sync",
  });
  await database(db)
    .update(operationsTable)
    .set({ cancel_requested: 1 })
    .where(eq(operationsTable.id, cancelled.id))
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
        .from(entitiesTable)
        .where(and(eq(entitiesTable.id, "future")))
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
    sleep: base.sleep,
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
        .from(entitiesTable)
        .where(and(eq(entitiesTable.resource, "transactions")))
        .get()
        .then((row) => row ?? null),
    ).n,
    2,
  );
});

test("bootstrap retains every supported resource and both account/investment parents", async () => {
  const resources = Object.values(Resource);
  const { db, op } = await setup();
  const calls: [
    Parameters<FinancialSource["page"]>[0]["resource"],
    string | null,
    string | null,
  ][] = [];
  const provider = {
    ids() {
      return Promise.resolve([]);
    },
    page({
      resource,
      parent,
      cursor,
    }: Parameters<FinancialSource["page"]>[0]): ReturnType<
      FinancialSource["page"]
    > {
      calls.push([resource, parent, cursor]);
      let records: ProviderRecord[];
      if (resource === "connections") {
        records = [{ connector: { id: 1, isOpenFinance: true }, id: "item" }];
      } else if (resource === "accounts") {
        records = [account, { ...account, id: "card", type: "CREDIT" }];
      } else if (resource === "transactions") {
        records = [
          transaction(`${parent}-${cursor ?? "one"}`, { accountId: parent }),
        ];
      } else if (resource === "investments") {
        records = [{ balance: "12", currencyCode: "BRL", id: "investment" }];
      } else if (resource === "consents") {
        records = [];
      } else if (resource === "resources") {
        records = [{ resourceId: "r" }];
      } else if (resource === "connectors") {
        records = [{ id: "1" }];
      } else {
        records = [{ currencyCode: "BRL", id: resource }];
      }
      return Promise.resolve({
        next: resource === "transactions" && !cursor ? "two" : null,
        records,
      });
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
        .select({ n: countDistinct(coverageTable.resource) })
        .from(coverageTable)
        .where(and(eq(coverageTable.bootstrap_complete, 1)))
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
        .from(entitiesTable)
        .where(and(eq(entitiesTable.resource, "transactions")))
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
          engine,
          identity: identity(id),
          operation: op,
          parent,
          source: transaction(id, { amount, type }),
        })
      ).statements,
    );
  }
  const gross = await aggregateEntities(db, { metric: "amount" }),
    flow = await aggregateEntities(db, { metric: "cashFlow" });
  await assert.rejects(
    aggregateEntities(db, { metric: "toString" }),
    unknownMetricPattern,
  );
  assert.equal(required(gross.groups[0]).totalMinor, "2000");
  assert.equal(required(flow.groups[0]).totalMinor, "-1000");
  const { invoke } = await import("@/worker/mcp/invoke");
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
    .update(operationsTable)
    .set({ status: "completed" })
    .where(eq(operationsTable.id, op.id))
    .run();
  const migration: NonNullable<
    Extract<OperationInput, { kind: "migration" }>["migration"]
  > = [
    {
      parentId: "account",
      readAt: "2026-01-01T00:00:00.000Z",
      record: {
        accountId: "account",
        accountingDate: "2020-01-01",
        accountType: "BANK",
        amount: "-25",
        amountMinor: "-2500",
        currencyCode: "BRL",
        description: "Synthetic historic projection",
        id: "legacy",
        status: "POSTED",
        type: "DEBIT",
      },
      resource: "transactions",
      sourceKey: "collections/a.json#legacy",
    },
  ];
  const m = await startOperation(db, "migration-one", {
    itemIds: ["item"],
    kind: "migration",
    migration,
    migrationPolicy: "refuse-conflicts",
  });
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: () => Promise.reject(new Error("SOURCE_MUST_STAY_CLOSED")),
    },
    m.id,
    steps(),
  );
  await runOperation(
    {
      ...synchronizationDependencies(env(db)),
      source: () => Promise.reject(new Error("SOURCE_MUST_STAY_CLOSED")),
    },
    m.id,
    steps(),
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(migrationImportsTable)
        .get()
        .then((row) => row ?? null),
    ).n,
    1,
  );
  assert.equal(
    required(
      await database(db)
        .select({ normalizer: entitiesTable.normalizer })
        .from(entitiesTable)
        .where(and(eq(entitiesTable.id, "legacy")))
        .get()
        .then((row) => row ?? null),
    ).normalizer,
    "legacy-projection-v1",
  );
  const reconcile = await startOperation(db, "reconcile-after-migration", {
    itemIds: ["item"],
    kind: "reconcile",
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
        .select({ deleted: entitiesTable.deleted })
        .from(entitiesTable)
        .where(and(eq(entitiesTable.id, "legacy")))
        .get()
        .then((row) => row ?? null),
    ).deleted,
    0,
  );
});

test("preview, SQL filters and reapply select the same selected records; cursor cannot change filter", async () => {
  const { db, op } = await setup(),
    engine = await rulesFor(db, op.rules_revision);
  for (let n = 0; n < 4; n += 1) {
    await commit(
      db,
      (
        await prepareEntity(db, {
          engine,
          identity: identity(`p${n}`),
          operation: op,
          parent: account,
          source: transaction(`p${n}`, { amount: String(-n - 1) }),
        })
      ).statements,
    );
  }
  const doc = structuredClone(EMPTY_RULES);
  doc.rules = [
    fixtureRule({
      actions: [{ op: "set_description", value: "Changed" }],
      id: "description",
      is_active: true,
      name: "description",
      priority: 1,
      stage: "enrich",
      when: true,
    }),
  ];
  const { id: revision } = await saveRules(db, doc, true),
    filter = {
      field: "amountMinor",
      op: "lte",
      value: "-200",
    } satisfies Filter;
  const { invoke } = await import("@/worker/mcp/invoke");
  const preview = z
    .object({ differences: z.array(z.json()), selected: z.number() })
    .parse(
      await invoke(financialQueries(env(db)), "caderninho_preview", {
        filter,
        itemIds: ["item"],
        revision,
      }),
    );
  const query = await queryEntities(db, { filter, limit: 1 });
  assert.equal(preview.selected, 3);
  assert.equal(preview.differences.length, 3);
  await assert.rejects(
    queryEntities(db, {
      cursor: query.cursor,
      filter: { field: "amountMinor", op: "lte", value: "-100" },
    }),
    cursorScopePattern,
  );
  const apply = await startOperation(db, "preview-apply", {
    filter,
    itemIds: ["item"],
    kind: "reapply",
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
        .from(derivedTable)
        .where(and(eq(derivedTable.description, "Changed")))
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
  provider.page = (...args) => {
    if (args[0].cursor === "two") {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(new Error("transient"));
      }
    }
    return Promise.resolve(original(...args));
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
        .select({ bootstrap_complete: coverageTable.bootstrap_complete })
        .from(coverageTable)
        .where(and(eq(coverageTable.resource, "transactions")))
        .get()
        .then((row) => row ?? null),
    ).bootstrap_complete,
    1,
  );
  const failed = await startOperation(db, "incomplete", {
    itemIds: ["item"],
    kind: "reconcile",
  });
  const source = {
    ...provider,
    page(input: Parameters<FinancialSource["page"]>[0]) {
      if (input.resource === "transactions") {
        return Promise.reject(new Error("unavailable"));
      }
      return Promise.resolve(original(input));
    },
  };
  await assert.rejects(
    runOperation(
      { ...synchronizationDependencies(env(db)), source: async () => source },
      failed.id,
      steps(),
    ),
    unavailablePattern,
  );
  assert.equal(
    required(
      await database(db)
        .select({ status: coverageTable.status })
        .from(coverageTable)
        .where(and(eq(coverageTable.resource, "transactions")))
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
        .from(entitiesTable)
        .where(
          and(
            eq(entitiesTable.resource, "transactions"),
            eq(entitiesTable.deleted, 0),
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
        engine,
        identity: identity("stable"),
        operation: op,
        parent: account,
        source: raw,
      })
    ).statements,
  );
  const next = await startOperation(db, "stable", {
    itemIds: ["item"],
    kind: "sync",
  });
  const unchanged = await prepareEntity(db, {
    engine,
    identity: identity("stable"),
    operation: next,
    parent: account,
    source: {
      ...raw,
      balance: "999",
      irrelevantDebugField: "different",
      updatedAt: "2026-10-12T12:00:00.000Z",
    },
  });
  assert.equal(unchanged.classified, 0);
  assert.equal(unchanged.state, "unchanged");
  const forced = await startOperation(db, "backfill", {
    itemIds: ["item"],
    kind: "reconcile",
    renormalize: true,
  });
  assert.equal(
    (
      await prepareEntity(db, {
        engine,
        identity: identity("stable"),
        operation: forced,
        parent: account,
        source: raw,
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
    engine,
    identity: identity("lifecycle"),
    operation: op,
    parent: account,
    source,
  };
  const firstSeen = "2026-10-01T10:00:00.000Z";
  const observedAt = "2026-10-02T10:00:00.000Z";
  const created = await prepareEntity(db, { ...input, observedAt: firstSeen });
  assert.equal(created.state, "new");
  await commit(db, created.statements);
  const observed = await prepareEntity(db, {
    ...input,
    engine: {
      ...engine,
      evaluate() {
        return Promise.reject(new Error("Unchanged entities must skip rules"));
      },
    },
    observedAt,
    source: {
      ...source,
      irrelevantDebugField: "preserved",
      updatedAt: observedAt,
    },
  });
  assert.equal(observed.state, "unchanged");
  assert.equal(observed.seenInOperation, true);
  assert.equal(observed.classified, 0);
  await commit(db, observed.statements);
  const stored = required(
    await database(db)
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.id, "lifecycle"))
      .get(),
  );
  assert.equal(stored.first_seen_at, firstSeen);
  assert.equal(stored.observed_at, observedAt);
  assert.equal(stored.source.irrelevantDebugField, "preserved");
  await database(db)
    .update(entitiesTable)
    .set({ deleted: 1 })
    .where(eq(entitiesTable.id, "lifecycle"))
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
      .from(entitiesTable)
      .where(eq(entitiesTable.id, "lifecycle"))
      .get(),
  );
  assert.equal(active.first_seen_at, firstSeen);
  assert.equal(active.deleted, 0);
  assert.equal(active.normalized.accountName, "Renamed synthetic account");
  await assert.rejects(
    prepareEntity(db, { ...input, source: { ...source, id: "different" } }),
    sourceIdMismatchPattern,
  );
});

test("legacy entry rejects noncanonical secondary money without publishing an entity", async () => {
  const { db, op } = await setup();
  const engine = await rulesFor(db, op.rules_revision);
  await assert.rejects(
    prepareEntity(db, {
      engine,
      identity: identity("invalid-legacy"),
      legacyProjection: {
        amountMinor: "1000",
        id: "invalid-legacy",
        legacyFeeMinor: "001",
      },
      operation: op,
      parent: undefined,
      source: { id: "invalid-legacy" },
    }),
    canonicalMinorErrorPattern,
  );
  assert.equal(
    await database(db)
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.id, "invalid-legacy"))
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
  const { compactOperations } = await import("@/worker/sync/repository");
  const { n: financialCount } = required(
    await database(db)
      .select({ n: count() })
      .from(entitiesTable)
      .get()
      .then((row) => row ?? null),
  );
  await compactOperations(db, new Date("2030-01-01T00:00:00Z"));
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(entitiesTable)
        .get()
        .then((row) => row ?? null),
    ).n,
    financialCount,
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(pageCommitsTable)
        .get()
        .then((row) => row ?? null),
    ).n,
    0,
  );
  assert.equal(
    (
      await startOperation(db, "first", {
        itemIds: ["item"],
        kind: "sync",
      })
    ).id,
    op.id,
  );
  assert.ok(await rulesFor(db, op.rules_revision));
});

test("changed totals during pagination retain partial coverage and never advance complete checkpoint", async () => {
  const { db, op } = await setup();
  const source = {
    ids() {
      return Promise.resolve([]);
    },
    page({
      resource,
      cursor,
    }: Parameters<FinancialSource["page"]>[0]): ReturnType<
      FinancialSource["page"]
    > {
      if (resource === "connections") {
        return Promise.resolve({ next: null, records: [connection] });
      }
      if (resource !== "accounts") {
        return Promise.resolve({ next: null, records: [] });
      }
      return Promise.resolve(
        cursor
          ? { next: null, records: [{ ...account, id: "second" }], total: 3 }
          : { next: "2", records: [account], total: 2 },
      );
    },
  };
  await assert.rejects(
    runOperation(
      { ...synchronizationDependencies(env(db)), source: async () => source },
      op.id,
      steps(),
    ),
    sourceTotalChangedPattern,
  );
  assert.equal(
    required(
      await database(db)
        .select({ bootstrap_complete: coverageTable.bootstrap_complete })
        .from(coverageTable)
        .where(eq(coverageTable.resource, Resource.accounts))
        .get()
        .then((row) => row ?? null),
    ).bootstrap_complete,
    0,
  );
  assert.equal(
    required(
      await database(db)
        .select({ status: coverageTable.status })
        .from(coverageTable)
        .where(eq(coverageTable.resource, Resource.accounts))
        .get()
        .then((row) => row ?? null),
    ).status,
    "partial",
  );
  assert.equal(
    required(
      await database(db)
        .select({ n: count() })
        .from(entitiesTable)
        .where(eq(entitiesTable.resource, Resource.accounts))
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
    conditions: "fact" in condition ? { all: [condition] } : condition,
    event: { params: { actions: r.actions }, type: r.stage },
    id: r.id,
    is_active: r.is_active,
    name: r.name,
    priority: r.priority,
  };
}

test("legacy revisions remain readable; explicit conversion creates a new revision without rewriting frozen operations", async () => {
  const { db } = await setup();
  const { readRules } = await import("@/worker/finance/rules.repository");
  const { NORMALIZER } = await import("@/domain/finance.entity");
  const { invoke } = await import("@/worker/mcp/invoke");
  const old = {
    ...EMPTY_RULES,
    rules: [
      {
        actions: [{ op: "set_description", value: "Legacy" }],
        id: "old",
        is_active: true,
        name: "Old",
        priority: 1,
        stage: "enrich",
        when: true,
      },
    ],
    version: 1,
  };
  const serialized = JSON.stringify(old);
  await database(db)
    .insert(ruleSetsTable)
    .values({
      created_at: new Date().toISOString(),
      document: sql`${serialized}`,
      id: "legacy",
      normalizer: NORMALIZER,
      ready: 1,
    })
    .run();
  await database(db)
    .update(settingsTable)
    .set({ active_rules: "legacy" })
    .where(eq(settingsTable.id, 1))
    .run();
  const frozen = await startOperation(db, "legacy-operation", {
    itemIds: ["item"],
    kind: "sync",
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
    rulesV1RequiresExplicitConversionAndActivationPattern,
  );
  const report = importRules(old);
  assert.ok(report.document);
  const saved = await saveRules(db, report.document, true);
  assert.notEqual(saved.id, "legacy");
  assert.equal((await getOperation(db, frozen.id)).rules_revision, "legacy");
  assert.equal(
    await database(db)
      .select({ document: sql<string>`${ruleSetsTable.document}` })
      .from(ruleSetsTable)
      .where(and(eq(ruleSetsTable.id, "legacy")))
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
  const { boundedJson } = await import("@/worker/http");
  assert.deepEqual(
    await boundedJson(
      new Request("https://local/import", {
        body: '{"amount":9007199254740993.01}',
        method: "POST",
      }),
    ),
    { amount: "9007199254740993.01" },
  );
  const { db } = await setup();
  const before = await database(db)
    .select({ n: count() })
    .from(ruleSetsTable)
    .get()
    .then((row) => row?.n ?? null);
  const old = { ...EMPTY_RULES, version: 1 };
  const response = await fetchMcp(
    new Request("https://local/mcp/rules/import", {
      body: JSON.stringify({ document: old }),
      method: "POST",
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
      .from(ruleSetsTable)
      .get()
      .then((row) => row?.n ?? null),
    before,
  );
  await assert.rejects(
    fetchMcp(
      new Request("https://local/mcp/rules/import", {
        body: " ".repeat(1_048_577),
        method: "POST",
      }),
      env(db),
    ),
    bodyLimitPattern,
  );
});

test("page publication rolls back data, progress, checkpoint and receipt together, then replays once", async () => {
  const { publishPage } = await import("@/worker/sync/execution.service");
  const { createExecutionRepository } = await import(
    "@/worker/sync/execution.repository"
  );
  const { db, op } = await setup();
  const engine = await rulesFor(db, op.rules_revision);
  await database(db)
    .insert(checkpointsTable)
    .values({
      item_id: "item",
      operation_id: op.id,
      parent_id: "account",
      resource: "transactions",
    })
    .run();
  const before = await database(db)
    .select({ progress: sql<string>`${operationsTable.progress}` })
    .from(operationsTable)
    .where(and(eq(operationsTable.id, op.id)))
    .get()
    .then((row) => row?.progress ?? null);
  await db.exec(
    "CREATE TRIGGER fail_page_receipt BEFORE INSERT ON page_commits BEGIN SELECT RAISE(ABORT, 'synthetic receipt failure'); END",
  );
  let fetched = 0;
  const execution = {
    engine,
    op,
    prepare: (input: Parameters<typeof prepareEntity>[1]) =>
      prepareEntity(db, input),
    repository: createExecutionRepository(db),
    step: {
      do: async <T>(_name: string, fn: () => Promise<T>) => fn(),
      sleep: () => Promise.resolve(),
    },
  };
  const provider = {
    ids() {
      return Promise.resolve([]);
    },
    page() {
      fetched += 1;
      return Promise.resolve({
        next: null,
        records: [transaction("atomic-page")],
        total: 1,
      });
    },
  };
  const publication = {
    identity: {
      itemId: "item",
      operationId: op.id,
      parentId: "account",
      resource: Resource.transactions,
    },
    name: "atomic-page",
    parent: { normalized: account, relevant_hash: "synthetic-parent" },
  };
  await assert.rejects(
    publishPage(execution, provider, publication),
    syntheticReceiptFailurePattern,
  );
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(entitiesTable)
      .get()
      .then((row) => row?.n ?? null),
    0,
  );
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(derivedTable)
      .get()
      .then((row) => row?.n ?? null),
    0,
  );
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(pageCommitsTable)
      .get()
      .then((row) => row?.n ?? null),
    0,
  );
  assert.equal(
    await database(db)
      .select({ page: checkpointsTable.page })
      .from(checkpointsTable)
      .where(and(eq(checkpointsTable.operation_id, op.id)))
      .get()
      .then((row) => row?.page ?? null),
    0,
  );
  assert.equal(
    await database(db)
      .select({ progress: sql<string>`${operationsTable.progress}` })
      .from(operationsTable)
      .where(and(eq(operationsTable.id, op.id)))
      .get()
      .then((row) => row?.progress ?? null),
    before,
  );
  await db.exec("DROP TRIGGER fail_page_receipt");
  await publishPage(execution, provider, publication);
  const progress = await database(db)
    .select({ progress: sql<string>`${operationsTable.progress}` })
    .from(operationsTable)
    .where(and(eq(operationsTable.id, op.id)))
    .get()
    .then((row) => row?.progress ?? null);
  await publishPage(execution, provider, publication);
  assert.equal(fetched, 2);
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(entitiesTable)
      .get()
      .then((row) => row?.n ?? null),
    1,
  );
  assert.equal(
    await database(db)
      .select({ n: count() })
      .from(pageCommitsTable)
      .get()
      .then((row) => row?.n ?? null),
    1,
  );
  assert.equal(
    await database(db)
      .select({ progress: sql<string>`${operationsTable.progress}` })
      .from(operationsTable)
      .where(and(eq(operationsTable.id, op.id)))
      .get()
      .then((row) => row?.progress ?? null),
    progress,
  );
});

function commit(db: D1Database, queries: BatchItem<"sqlite">[]) {
  const [first, ...rest] = queries;
  if (!first) {
    return Promise.reject(new Error("Empty fixture batch"));
  }
  return Promise.resolve(database(db).batch([first, ...rest]));
}

test("Drizzle JSON mapping preserves public strings, default progress and manual tag precedence", async () => {
  const { db, op } = await setup();
  assert.deepEqual(op.input, { itemIds: ["item"], kind: "sync" });
  assert.deepEqual(op.progress, {});
  const engine = await rulesFor(db, op.rules_revision);
  const source = transaction("json", { description: 'Café "especial" ☕' });
  await commit(
    db,
    (
      await prepareEntity(db, {
        engine,
        identity: identity("json"),
        operation: op,
        parent: account,
        source,
      })
    ).statements,
  );
  const stored = required(
    await database(db)
      .select()
      .from(entitiesTable)
      .where(eq(entitiesTable.id, "json"))
      .get(),
  );
  assert.deepEqual(stored.source, source);
  assert.equal(stored.normalized.description, source.description);
  const { invoke } = await import("@/worker/mcp/invoke");
  await database(db).insert(tagsTable).values({
    id: "json",
    item_id: "item",
    key: "project",
    origin: "derived",
    parent_id: "account",
    resource: "transactions",
    value: "derived",
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
          engine,
          identity: identity(id),
          operation: op,
          parent: account,
          source: transaction(id, { amount, currencyCode }),
        })
      ).statements,
    );
  }
  const { groups } = await aggregateEntities(db, {});
  assert.deepEqual(
    groups.find((g) => g.currency === "BRL"),
    { count: "3", currency: "BRL", known: "2", partial: true, totalMinor: "1" },
  );
  assert.deepEqual(
    groups.find((g) => g.currency === "USD"),
    {
      count: "1",
      currency: "USD",
      known: "0",
      partial: true,
      totalMinor: null,
    },
  );
  assert.deepEqual(
    groups.find((g) => g.currency === "EUR"),
    {
      count: "1",
      currency: "EUR",
      known: "1",
      partial: false,
      totalMinor: "0",
    },
  );
});
