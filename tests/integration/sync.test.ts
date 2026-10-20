import assert from "node:assert/strict";

import { eq } from "drizzle-orm";
import { beforeEach, test } from "vitest";

import {
  Fault,
  FaultCode,
  normalizeAccount,
  normalizeTransaction,
} from "../../src/domain";
import { database } from "../../src/worker/database";
import { createFinancialService } from "../../src/worker/finance";
import { createFinancialRepository } from "../../src/worker/finance/repository";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { settings, sync_runs, transactions } from "../../src/worker/schema";
import { createSyncService, runImport } from "../../src/worker/sync";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { account, admit, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

const now = "2026-10-01T00:00:00.000Z";
const finance = () => createFinancialService(createFinancialRepository(env.DB));
beforeEach(setup);
test("simultaneous manual/cron admissions are isolated by connection and enforce pause/24h even after failure", async () => {
  const installation = createInstallationRepository(env.DB);
  await installation.register({ connector: { id: 200 }, id: "c" }, now);
  await installation.register({ connector: { id: 200 }, id: "d" }, now);
  const repository = createSyncRepository(env.DB);
  const results = await Promise.all([
    repository.admit(["c"], now),
    repository.admit(["c"], now),
    repository.admit(["d"], now),
  ]);
  assert.equal(results[0]?.[0]?.runId, results[1]?.[0]?.runId);
  assert.equal((await repository.active()).length, 2);
  const c = results[0]?.[0]?.runId;
  assert.ok(c);
  await repository.fail(c, "SYNTHETIC_FAILURE", now);
  assert.equal((await repository.admit(["c"], now))[0]?.status, "cooldown");
  await installation.enable(false);
  assert.equal(
    (await repository.admit(["c"], "2026-10-03T00:00:00.000Z"))[0]?.status,
    "paused",
  );
  await installation.enable(true);
  assert.equal(
    (await repository.admit(["c"], "2026-10-02T00:00:00.000Z"))[0]?.status,
    "started",
  );
});
test("receipts survive response loss, races and completed-run replay; stale/nonexistent runs never write", async () => {
  const repository = createSyncRepository(env.DB);
  const id = await admit();
  await repository.start(id, now);
  const run = await repository.read(id);
  const input = {
    accounts: [normalizeAccount(account(), "c")],
    done: false,
    next: { accountId: "a", cursor: null, phase: "transactions" as const },
    now,
    run,
  };
  const results = await Promise.all([
    repository.publish(input),
    repository.publish(input),
  ]);
  assert.deepEqual(results[0], results[1]);
  const version = (await finance().query({ limit: 10 })).revision;
  assert.deepEqual(await repository.publish(input), results[0]);
  assert.equal((await finance().query({ limit: 10 })).revision, version);
  const latest = await repository.read(id);
  const done = {
    completeAccountId: "a",
    done: true,
    next: { accountId: null, cursor: null, phase: "finish" as const },
    now,
    run: latest,
    transactions: [
      normalizeTransaction(transaction(), normalizeAccount(account(), "c")),
    ],
  };
  await repository.publish(done);
  assert.deepEqual(await repository.publish(done), {
    checkpoint: done.next,
    done: true,
    records: 1,
    sequence: 2,
  });
  await assert.rejects(
    repository.publish({
      ...input,
      accounts: [normalizeAccount(account({ id: "stale" }), "c")],
    }),
    { message: "STALE_COMMIT" },
  );
  await assert.rejects(
    repository.publish({ ...input, run: { ...run, id: "missing" } }),
    { message: "STALE_COMMIT" },
  );
  assert.equal(
    (await finance().accounts()).some((row) => row.id === "stale"),
    false,
  );
  assert.equal((await finance().query({ limit: 10 })).records.length, 1);
});
test("a receipt/checkpoint failure rolls back records and revision in the same real D1 batch", async () => {
  const repository = createSyncRepository(env.DB);
  const id = await admit();
  await repository.start(id, now);
  const run = await repository.read(id);
  const version = (await finance().query({ limit: 10 })).revision;
  await env.DB.exec(
    "CREATE TRIGGER fail_receipt BEFORE UPDATE ON sync_runs WHEN NEW.sequence>OLD.sequence BEGIN SELECT RAISE(ABORT,'synthetic receipt failure'); END;",
  );
  await assert.rejects(
    repository.publish({
      accounts: [normalizeAccount(account(), "c")],
      done: false,
      next: { accountId: null, cursor: null, phase: "finish" },
      now,
      run,
    }),
  );
  assert.equal((await finance().accounts()).length, 0);
  assert.equal((await repository.read(id)).sequence, 0);
  assert.equal((await finance().query({ limit: 10 })).revision, version);
});
test("partial pages keep prior success and confirmed data, reject conflicting IDs, and do not restart terminal runs", async () => {
  await collect(source([transaction({ date: "2026-09-01", id: "old" })]));
  const repository = createSyncRepository(env.DB);
  const id = await admit("2026-10-02T00:00:00.000Z");
  let calls = 0;
  const partialSource = {
    ...source([]),
    transactions: () => {
      calls += 1;
      if (calls === 2) {
        return Promise.reject(new Fault(FaultCode.UPSTREAM_AUTH));
      }
      return Promise.resolve({
        next: "next",
        records: [transaction({ date: "2026-10-02", id: `page-${calls}` })],
      });
    },
  };
  await assert.rejects(
    runImport(
      {
        now: () => "2026-10-02T00:00:00.000Z",
        repository,
        source: partialSource,
        steps: { do: (_name, fn) => fn() },
      },
      id,
    ),
    { code: "UPSTREAM_AUTH" },
  );
  const state = await createInstallationRepository(env.DB).state();
  assert.equal(state.accounts[0]?.collectionStatus, "partial");
  assert.equal(state.accounts[0]?.lastSuccessAt, now);
  assert.equal(state.accounts[0]?.observedFrom, "2026-10-02");
  assert.equal(state.accounts[0]?.observedTo, "2026-10-02");
  assert.equal(state.accounts[0]?.lastCompletedFrom, "2026-09-01");
  assert.equal(state.accounts[0]?.lastCompletedTo, "2026-09-01");
  assert.equal(
    (await finance().accounts())[0]?.lastCompletedFrom,
    "2026-09-01",
  );
  assert.equal(state.runs[0]?.status, "failed");
  assert.equal((await finance().query({ limit: 10 })).records.length, 2);
  assert.equal((await finance().aggregate({ metric: "debits" })).partial, true);
  await runImport(
    {
      now: () => now,
      repository,
      source: partialSource,
      steps: { do: (_name, fn) => fn() },
    },
    id,
  );
  assert.equal(calls, 2);
  const conflictId = await admit("2026-10-03T00:00:00.000Z");
  await assert.rejects(
    runImport(
      {
        now: () => "2026-10-03T00:00:00.000Z",
        repository,
        source: source([transaction(), transaction({ amount: "-99" })]),
        steps: { do: (_name, fn) => fn() },
      },
      conflictId,
    ),
    { message: "DUPLICATE_CHANGED" },
  );
  await collect(source([]), "2026-10-04T00:00:00.000Z");
  const {
    accounts: [empty],
  } = await createInstallationRepository(env.DB).state();
  assert.equal(empty?.lastSuccessAt, "2026-10-04T00:00:00.000Z");
  assert.equal(empty?.observedFrom, null);
  assert.equal(empty?.observedTo, null);
  assert.equal(empty?.lastCompletedFrom, null);
  assert.equal(empty?.lastCompletedTo, null);
});
test("dispatch uncertainty recovers the same ID and terminal native failures do not free cooldown", async () => {
  let creates = 0;
  let native = "running";
  const ids: string[] = [];
  const repository = createSyncRepository(env.DB);
  await createInstallationRepository(env.DB).register(
    { connector: { id: 200 }, id: "c" },
    now,
  );
  const service = createSyncService(
    repository,
    {
      create: (id) => {
        creates += 1;
        ids.push(id);
        if (creates < 3) {
          return Promise.reject(new Error("uncertain"));
        }
        return Promise.resolve();
      },
      status: () => {
        if (creates < 3) {
          return Promise.reject(new Error("offline"));
        }
        return Promise.resolve(native);
      },
    },
    () => new Date(now),
  );
  const first = await service.request(["c"]);
  assert.equal((await repository.active())[0]?.status, "pending");
  await service.recover();
  assert.equal(creates, 2);
  assert.equal(new Set(ids).size, 1);
  await service.request(["c"]);
  assert.equal(first.connections[0]?.runId, ids[2]);
  native = "errored";
  await service.recover();
  assert.equal((await repository.active()).length, 0);
  assert.equal(
    (await service.request(["c"])).connections[0]?.status,
    "cooldown",
  );
});
test("retention removes only old terminal summaries and keeps financial references and active imports", async () => {
  const terminal = await collect(source([transaction()]));
  const active = await admit("2026-10-03T00:00:00.000Z");
  await createSyncRepository(env.DB).compact("2026-11-03T00:00:00.000Z");
  assert.equal(
    await database(env.DB)
      .select()
      .from(sync_runs)
      .where(eq(sync_runs.id, terminal))
      .get(),
    undefined,
  );
  assert.ok(
    await database(env.DB)
      .select()
      .from(sync_runs)
      .where(eq(sync_runs.id, active))
      .get(),
  );
  assert.equal((await finance().query({ limit: 10 })).records.length, 1);
  assert.equal((await database(env.DB).select().from(transactions)).length, 1);
  assert.ok((await database(env.DB).select().from(settings))[0]);
});

test("a missing singleton cannot bypass the publication guard", async () => {
  const repository = createSyncRepository(env.DB);
  const id = await admit();
  await repository.start(id, now);
  const run = await repository.read(id);
  await database(env.DB).delete(settings);
  await assert.rejects(
    repository.publish({
      accounts: [normalizeAccount(account(), "c")],
      done: false,
      next: { accountId: null, cursor: null, phase: "finish" },
      now,
      run,
    }),
  );
  assert.equal((await createFinancialRepository(env.DB).accounts()).length, 0);
  assert.equal((await repository.read(id)).sequence, 0);
});
