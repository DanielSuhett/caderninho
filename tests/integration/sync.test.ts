import assert from "node:assert/strict";

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
import { connections } from "../../src/worker/schema";
import { createSyncService, runImport } from "../../src/worker/sync";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { account, admit, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

const now = "2026-10-01T00:00:00.000Z";
const finance = () => createFinancialService(createFinancialRepository(env.DB));
beforeEach(setup);
test("simultaneous manual/cron admissions are isolated by connection and enforce 24h even after failure", async () => {
  const installation = createInstallationRepository(env.DB);
  await installation.register("c");
  await installation.register("d");
  const repository = createSyncRepository(env.DB);
  const results = await Promise.all([
    repository.admit(["c"], now),
    repository.admit(["c"], now),
    repository.admit(["d"], now),
  ]);
  assert.equal(results[0]?.[0]?.importId, results[1]?.[0]?.importId);
  assert.equal((await repository.active()).length, 2);
  const c = results[0]?.[0]?.importId;
  assert.ok(c);
  await repository.fail(c, "SYNTHETIC_FAILURE");
  assert.equal((await repository.admit(["c"], now))[0]?.status, "cooldown");
  assert.equal(
    (await repository.admit(["c"], "2026-10-01T23:59:59.999Z"))[0]?.status,
    "cooldown",
  );
  assert.equal(
    (await repository.admit(["c"], "2026-10-02T00:00:00.000Z"))[0]?.status,
    "started",
  );
});
test("connection checkpoints survive response loss, races and completed-run replay; stale/nonexistent runs never write", async () => {
  const repository = createSyncRepository(env.DB);
  const id = await admit();
  await repository.start(id);
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
  const version = (await repository.read(id)).sequence;
  assert.deepEqual(await repository.publish(input), results[0]);
  assert.equal((await repository.read(id)).sequence, version);
  const latest = await repository.read(id);
  const done = {
    done: true,
    next: { accountId: null, cursor: null, phase: "finish" as const },
    now,
    run: latest,
    transactions: [normalizeTransaction(transaction(), "a")],
  };
  await repository.publish(done);
  assert.deepEqual(await repository.publish(done), {
    checkpoint: done.next,
    done: true,
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
    Object.hasOwn(
      (await createInstallationRepository(env.DB).state()).connections[0]
        ?.accounts ?? {},
      "stale",
    ),
    false,
  );
  assert.equal((await finance().query({ limit: 10 })).records.length, 1);
});
test("a checkpoint failure rolls back financial data, metadata and sequence in the same real D1 batch", async () => {
  const repository = createSyncRepository(env.DB);
  const id = await admit();
  await repository.start(id);
  const run = await repository.read(id);
  const version = (await repository.read(id)).sequence;
  await env.DB.exec(
    "CREATE TRIGGER fail_checkpoint BEFORE UPDATE ON connections WHEN NEW.import_checkpoint<>OLD.import_checkpoint BEGIN SELECT RAISE(ABORT,'synthetic receipt failure'); END;",
  );
  await assert.rejects(
    repository.publish({
      accounts: [normalizeAccount(account(), "c")],
      done: false,
      next: { accountId: null, cursor: null, phase: "finish" },
      now,
      run,
      transactions: [normalizeTransaction(transaction(), "a")],
    }),
  );
  assert.deepEqual(
    (await createInstallationRepository(env.DB).state()).connections[0]
      ?.accounts ?? {},
    {},
  );
  assert.deepEqual((await finance().query({ limit: 10 })).records, []);
  assert.equal((await repository.read(id)).sequence, 0);
  assert.equal((await repository.read(id)).sequence, version);
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
  assert.equal(state.connections[0]?.partial, true);
  assert.equal(state.connections[0]?.lastSuccessAt, now);
  assert.equal(
    state.connections[0]?.accounts.a?.balanceObservedAt,
    "2026-10-02T00:00:00.000Z",
  );
  assert.equal(state.connections[0]?.importStatus, "failed");
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
  const stateAfterEmpty = await createInstallationRepository(env.DB).state();
  assert.equal(
    stateAfterEmpty.connections[0]?.lastSuccessAt,
    "2026-10-04T00:00:00.000Z",
  );
  assert.equal(stateAfterEmpty.connections[0]?.partial, false);
  assert.equal((await finance().query({ limit: 10 })).records.length, 2);
});
test("dispatch uncertainty recovers the same ID and terminal native failures do not free cooldown", async () => {
  let creates = 0;
  let native = "running";
  const ids: string[] = [];
  const repository = createSyncRepository(env.DB);
  await createInstallationRepository(env.DB).register("c");
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
  assert.equal(first.connections[0]?.importId, ids[2]);
  native = "errored";
  await service.recover();
  assert.equal((await repository.active()).length, 0);
  assert.equal(
    (await service.request(["c"])).connections[0]?.status,
    "cooldown",
  );
});
test("a replaced or missing connection cannot publish, fail or restart an old executor", async () => {
  const repository = createSyncRepository(env.DB);
  const id = await admit();
  await repository.start(id);
  const run = await repository.read(id);
  await repository.fail(id, "IMPORT_FAILED");
  const replacement = await admit("2026-10-02T00:00:00.000Z");
  const publish = () =>
    repository.publish({
      accounts: [normalizeAccount(account(), "c")],
      done: false,
      next: { accountId: "a", cursor: null, phase: "transactions" },
      now,
      run,
    });
  await assert.rejects(publish, { message: "STALE_COMMIT" });
  await repository.fail(id, "OLD_EXECUTOR");
  await repository.start(id);
  assert.equal((await repository.read(replacement)).status, "pending");
  assert.deepEqual(
    (await createInstallationRepository(env.DB).state()).connections[0]
      ?.accounts ?? {},
    {},
  );
  await database(env.DB).delete(connections);
  await assert.rejects(publish, { message: "STALE_COMMIT" });
  assert.deepEqual(
    (await createInstallationRepository(env.DB).state()).connections[0]
      ?.accounts ?? {},
    {},
  );
});

test("a retried native step rebuilds the last committed page and terminal result before any source I/O", async () => {
  const repository = createSyncRepository(env.DB);
  const id = await admit();
  let calls = 0;
  const input = source([transaction()]);
  await runImport(
    {
      now: () => now,
      repository,
      source: {
        ...input,
        transactions: (accountId, cursor) => {
          calls += 1;
          if (calls > 1) {
            throw new Error("COMMITTED_PAGE_REFETCHED");
          }
          return input.transactions(accountId, cursor);
        },
      },
      steps: {
        do: async (_name, fn) => {
          const result = await fn();
          assert.deepEqual(await fn(), result);
          assert.ok(JSON.stringify(result).length < 400);
          return result;
        },
      },
    },
    id,
  );
  assert.equal(calls, 1);
  assert.equal((await repository.read(id)).sequence, 3);
  assert.equal((await finance().query({ limit: 10 })).records[0]?.id, "t");
});

test("an unavailable native status keeps a running import active past the 24h boundary", async () => {
  const repository = createSyncRepository(env.DB);
  const id = await admit();
  await repository.start(id);
  let creates = 0;
  const service = createSyncService(
    repository,
    {
      create: () => {
        creates += 1;
        return Promise.resolve();
      },
      status: () => Promise.reject(new Error("offline")),
    },
    () => new Date("2026-10-03T00:00:00.000Z"),
  );
  await service.recover();
  assert.equal(creates, 0);
  assert.equal((await repository.read(id)).status, "running");
  const [admission] = await repository.admit(["c"], "2026-10-03T00:00:00.000Z");
  assert.equal(admission?.status, "working");
  assert.equal(admission?.importId, id);
});
