import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { TransactionQuerySchema } from "../../src/contracts";
import {
  type CommitResult,
  type FinancialSource,
  ProviderAccountSchema,
} from "../../src/domain";
import { tryCatch } from "../../src/shared";
import { createFinancialService } from "../../src/worker/finance";
import { createFinancialRepository } from "../../src/worker/finance/repository";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { runImport } from "../../src/worker/sync";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { cookies, fixture, login } from "./access-fixture";
import { account, admit, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

const metadata = z
  .object({
    balanceMinor: z.string().nullable(),
    balanceObservedAt: z.string().nullable(),
    currency: z.string(),
    name: z.string(),
    type: z.enum(["BANK", "CREDIT"]),
  })
  .strict();
const state = z.object({
  connections: z.array(
    z.object({
      accounts: z.record(z.string(), metadata),
      id: z.string(),
      partial: z.boolean(),
    }),
  ),
});

beforeEach(setup);
test("status preserves absent accounts and unread balances with their original reference time", async () => {
  await collect(
    source(
      [transaction()],
      [account(), account({ balance: "0", id: "card", type: "CREDIT" })],
    ),
  );
  await assert.rejects(
    collect(
      source([], [account({ balance: undefined, name: "Renamed" })]),
      "2026-10-02T00:00:00.000Z",
    ),
    { message: "SOURCE_ACCOUNTS_CHANGED" },
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  const response = await app.request("/api/account", {
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200);
  const result = state.parse(await response.json());
  assert.deepEqual(result.connections[0]?.accounts, {
    a: {
      balanceMinor: "12345",
      balanceObservedAt: "2026-10-01T00:00:00.000Z",
      currency: "BRL",
      name: "Renamed",
      type: "BANK",
    },
    card: {
      balanceMinor: "0",
      balanceObservedAt: "2026-10-01T00:00:00.000Z",
      currency: "BRL",
      name: "Synthetic",
      type: "CREDIT",
    },
  });
  assert.equal(result.connections[0]?.partial, true);
});

test("global Pluggy account IDs select connections and BANK totals without repeating metadata in transactions", async () => {
  const firstConnection = "7b8f72a0-49f1-4340-b119-0ab8ce1d0001";
  const secondConnection = "7b8f72a0-49f1-4340-b119-0ab8ce1d0002";
  const bankId = "7b8f72a0-49f1-4340-b119-0ab8ce1d0011";
  const cardId = "7b8f72a0-49f1-4340-b119-0ab8ce1d0012";
  const otherBankId = "7b8f72a0-49f1-4340-b119-0ab8ce1d0013";
  const bankTransaction = "7b8f72a0-49f1-4340-b119-0ab8ce1d0021";
  const cardTransaction = "7b8f72a0-49f1-4340-b119-0ab8ce1d0022";
  const catalog = [
    ProviderAccountSchema.parse({
      ...account({ id: bankId, itemId: firstConnection }),
      number: "0001/12345-0",
    }),
    account({
      balance: null,
      id: cardId,
      itemId: firstConnection,
      type: "CREDIT",
    }),
    ProviderAccountSchema.parse({
      ...account({ id: otherBankId, itemId: secondConnection }),
      number: "0001/12345-0",
    }),
  ];
  const provider = source(
    [
      transaction({
        accountId: bankId,
        amount: "-3.21",
        currencyCode: "USD",
        id: bankTransaction,
      }),
      transaction({ accountId: cardId, amount: "-20", id: cardTransaction }),
      transaction({
        accountId: otherBankId,
        amount: "0",
        id: "7b8f72a0-49f1-4340-b119-0ab8ce1d0023",
        type: "CREDIT",
      }),
      transaction({
        accountId: otherBankId,
        amount: null,
        id: "7b8f72a0-49f1-4340-b119-0ab8ce1d0024",
        status: "PENDING",
      }),
    ],
    catalog,
  );
  const now = "2026-10-01T00:00:00.000Z";
  await collect(provider, now, firstConnection);
  await collect(provider, now, secondConnection);
  const imported = await createInstallationRepository(env.DB).state({
    connectionIds: [firstConnection],
  });
  assert.equal(imported.connections[0]?.accounts[cardId]?.balanceMinor, null);
  assert.equal(
    imported.connections[0]?.accounts[cardId]?.balanceObservedAt,
    null,
  );
  const finance = createFinancialService(createFinancialRepository(env.DB));
  const selection = { connectionIds: [firstConnection] };
  const page = await finance.query(
    TransactionQuerySchema.parse({ filter: selection, limit: 1 }),
  );
  assert.ok(page.cursor);
  assert.equal(Object.hasOwn(page.cursor, "connectionId"), false);
  const next = await finance.query({
    cursor: page.cursor,
    filter: selection,
    limit: 1,
  });
  assert.deepEqual(
    [...page.records, ...next.records].map((row) => row.id).sort(),
    [bankTransaction, cardTransaction],
  );
  for (const row of [...page.records, ...next.records]) {
    assert.deepEqual(Object.keys(row).sort(), [
      "accountId",
      "amountMinor",
      "category",
      "classification",
      "currency",
      "date",
      "description",
      "direction",
      "id",
      "identification",
      "status",
    ]);
  }
  const bank = await finance.query(
    TransactionQuerySchema.parse({ filter: { accountIds: [bankId] } }),
  );
  assert.equal(bank.records[0]?.currency, "USD");
  assert.equal(bank.records[0]?.amountMinor, "-321");
  assert.deepEqual(
    (
      await finance.aggregate({
        filter: selection,
        groupBy: "account",
        metric: "cash_flow",
      })
    ).groups,
    [
      {
        count: "1",
        currency: "USD",
        group: bankId,
        totalMinor: "-321",
        unknownAmountCount: "0",
      },
    ],
  );
  assert.equal(
    (
      await finance.aggregate({
        filter: { accountIds: [cardId] },
        groupBy: "account",
        metric: "debits",
      })
    ).groups[0]?.group,
    cardId,
  );
  assert.deepEqual(
    (
      await finance.query({
        filter: { accountIds: [bankId], connectionIds: [secondConnection] },
        limit: 10,
      })
    ).records,
    [],
  );
  const other = await finance.query({
    filter: { accountIds: [otherBankId] },
    limit: 10,
  });
  assert.equal(
    other.records.find((row) => row.status === "PENDING")?.amountMinor,
    null,
  );
  assert.equal(
    other.records.find((row) => row.direction === "CREDIT")?.amountMinor,
    "0",
  );
});

test("catalog rereads stop at a disappearing account and preserve confirmed pages as partial", async () => {
  const id = await admit();
  let reads = 0;
  const requested: string[] = [];
  const provider: FinancialSource = {
    ...source([]),
    accounts: () => {
      reads += 1;
      return Promise.resolve(
        reads === 1
          ? [account(), account({ balance: "42", id: "z" })]
          : [account()],
      );
    },
    transactions: (accountId, cursor) => {
      requested.push(accountId);
      if (accountId !== "a") {
        throw new Error("DISAPPEARED_ACCOUNT_FETCHED");
      }
      return Promise.resolve({
        next: cursor ? null : "next",
        records: cursor ? [] : [transaction()],
      });
    },
  };
  await assert.rejects(
    runImport(
      {
        now: () => "2026-10-01T00:00:00.000Z",
        repository: createSyncRepository(env.DB),
        source: provider,
        steps: {
          do: async (_name, fn) => {
            const result = await fn();
            assert.deepEqual(await fn(), result);
            return result;
          },
        },
      },
      id,
    ),
    { message: "SOURCE_ACCOUNTS_CHANGED" },
  );
  assert.deepEqual(requested, ["a", "a"]);
  const status = await createInstallationRepository(env.DB).state();
  assert.equal(status.connections[0]?.partial, true);
  assert.equal(status.connections[0]?.importStatus, "failed");
  assert.equal(status.connections[0]?.importError, "SOURCE_ACCOUNTS_CHANGED");
  assert.equal(status.connections[0]?.accounts.z?.balanceMinor, "4200");
  assert.equal(
    status.connections[0]?.accounts.z?.balanceObservedAt,
    "2026-10-01T00:00:00.000Z",
  );
  const finance = createFinancialService(createFinancialRepository(env.DB));
  assert.equal((await finance.query({ limit: 10 })).partial, true);
  assert.equal(
    (await finance.aggregate({ metric: "debits" })).groups[0]?.totalMinor,
    "1000",
  );
});

test("a temporarily missing account cannot complete an import after the catalog recovers", async () => {
  const accounts = [
    account(),
    account({ balance: "42", id: "b" }),
    account({ id: "c" }),
  ];
  await collect(
    source(
      accounts.map((row) =>
        transaction({ accountId: row.id, id: `old-${row.id}` }),
      ),
      accounts,
    ),
  );
  const now = "2026-10-02T00:00:00.000Z";
  const id = await admit(now);
  const repository = createSyncRepository(env.DB);
  const requested: string[] = [];
  const catalogs: string[][] = [];
  const provider: FinancialSource = {
    ...source([]),
    accounts: () => {
      const current =
        catalogs.length === 1
          ? accounts.filter((row) => row.id !== "b")
          : accounts;
      catalogs.push(current.map((row) => row.id));
      return Promise.resolve(current);
    },
    transactions: (accountId, cursor) => {
      requested.push(accountId);
      if (accountId === "a" && !cursor) {
        return Promise.resolve({
          next: "next",
          records: [transaction({ amount: "-7.00", id: "confirmed-page" })],
        });
      }
      return Promise.resolve({ next: null, records: [] });
    },
  };
  const dependencies = {
    now: () => now,
    repository,
    source: provider,
    steps: {
      do: async (_name: string, fn: () => Promise<CommitResult>) => {
        const result = await fn();
        assert.deepEqual(await fn(), result);
        return result;
      },
    },
  };
  const { data: _data, error } = await tryCatch(() =>
    runImport(dependencies, id),
  );
  const { connections: status } = await createInstallationRepository(
    env.DB,
  ).state();
  const [connection] = status;
  assert.equal(
    connection?.importStatus,
    "failed",
    `catalogs=${JSON.stringify(catalogs)}; transactions=${JSON.stringify(requested)}`,
  );
  assert.equal(error?.message, "SOURCE_ACCOUNTS_CHANGED");
  assert.equal(connection?.importError, "SOURCE_ACCOUNTS_CHANGED");
  assert.equal(connection?.partial, true);
  assert.equal(connection?.lastSuccessAt, "2026-10-01T00:00:00.000Z");
  assert.equal(connection?.accounts.b?.balanceMinor, "4200");
  assert.equal(connection?.accounts.b?.balanceObservedAt, now);
  assert.deepEqual(catalogs, [
    ["a", "b", "c"],
    ["a", "c"],
  ]);
  assert.deepEqual(
    (await provider.accounts("c")).map((row) => row.id),
    ["a", "b", "c"],
  );
  await runImport(dependencies, id);
  assert.deepEqual(requested, ["a", "a"]);
  assert.equal((await repository.read(id)).status, "failed");
  const finance = createFinancialService(createFinancialRepository(env.DB));
  const page = await finance.query({ limit: 10 });
  assert.equal(page.partial, true);
  assert.deepEqual(page.records.map((row) => row.id).sort(), [
    "confirmed-page",
    "old-a",
    "old-b",
    "old-c",
  ]);
  const total = await finance.aggregate({ metric: "debits" });
  assert.equal(total.partial, true);
  assert.equal(total.groups[0]?.totalMinor, "3700");
});

test("source Item and transaction account mismatches never publish records to another account", async () => {
  await assert.rejects(
    collect({
      ...source([]),
      accounts: async () => [account({ itemId: "wrong" })],
    }),
    { message: "SOURCE_IDENTITY_MISMATCH" },
  );
  await assert.rejects(
    collect(
      {
        ...source([]),
        transactions: async () => ({
          next: null,
          records: [transaction({ accountId: "wrong" })],
        }),
      },
      "2026-10-02T00:00:00.000Z",
    ),
    { message: "SOURCE_IDENTITY_MISMATCH" },
  );
  const finance = createFinancialService(createFinancialRepository(env.DB));
  assert.deepEqual((await finance.query({ limit: 10 })).records, []);
  assert.equal(
    (await createInstallationRepository(env.DB).state()).connections[0]
      ?.partial,
    true,
  );
});
