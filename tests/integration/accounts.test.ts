import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { TransactionQuerySchema } from "../../src/contracts";
import { type FinancialSource, ProviderAccountSchema } from "../../src/domain";
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
  await collect(
    source([], [account({ balance: undefined, name: "Renamed" })]),
    "2026-10-02T00:00:00.000Z",
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
      "currency",
      "date",
      "description",
      "direction",
      "id",
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

test("catalog rereads skip a disappearing account and conservatively report the connection as partial", async () => {
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
    transactions: (accountId) => {
      requested.push(accountId);
      if (accountId !== "a") {
        throw new Error("DISAPPEARED_ACCOUNT_FETCHED");
      }
      return Promise.resolve({ next: null, records: [transaction()] });
    },
  };
  await runImport(
    {
      now: () => "2026-10-01T00:00:00.000Z",
      repository: createSyncRepository(env.DB),
      source: provider,
      steps: { do: (_name, fn) => fn() },
    },
    id,
  );
  assert.deepEqual(requested, ["a"]);
  const status = await createInstallationRepository(env.DB).state();
  assert.equal(status.connections[0]?.partial, true);
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
