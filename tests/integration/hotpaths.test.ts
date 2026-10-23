import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";

import { normalizeTransaction, type TransactionFilter } from "../../src/domain";
import { createFinancialService } from "../../src/worker/finance";
import { createFinancialRepository } from "../../src/worker/finance/repository";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import type { Publication } from "../../src/worker/sync/entity";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { required } from "../support";
import { account, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
afterEach(() => vi.restoreAllMocks());

const scanCases: { filter: TransactionFilter; label: string }[] = [
  { filter: {}, label: "all" },
  { filter: { category: "Target" }, label: "category" },
  { filter: { status: "POSTED" }, label: "posted" },
  { filter: { status: "PENDING" }, label: "pending" },
  { filter: { accountIds: ["a"] }, label: "one account" },
  {
    filter: { category: "Target", from: "2026-10-01", to: "2026-10-01" },
    label: "category and date",
  },
  {
    filter: { from: "2026-10-01", status: "POSTED", to: "2026-10-01" },
    label: "status and date",
  },
];

test.each(scanCases)(
  "pages stay within their scan budget across ties: $label",
  async ({ filter }) => {
    await collect(source([], [account(), account({ id: "b" })]));
    await env.DB.prepare(
      `WITH RECURSIVE records(i) AS (
      VALUES(0) UNION ALL SELECT i+1 FROM records WHERE i<9999
    )
    INSERT INTO transactions(id,account_id,date,status,direction,currency,amount_minor,description,category)
    SELECT printf('t%05d',i),CASE WHEN i%3=0 THEN 'b' ELSE 'a' END,
      CASE WHEN i%2=0 THEN '2026-10-02' ELSE '2026-10-01' END,
      CASE WHEN i%5=0 THEN 'PENDING' ELSE 'POSTED' END,
      'DEBIT','BRL','999999999999999999999999999999','Synthetic',
      CASE WHEN i%7=0 THEN 'Target' ELSE 'Other' END
    FROM records`,
    ).run();
    const batches: D1Meta[][] = [];
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementation(async function measured<T>(
      statements: D1PreparedStatement[],
    ) {
      const results = await batch<T>(statements);
      batches.push(results.map((result) => result.meta));
      return results;
    });
    const finance = createFinancialService(createFinancialRepository(env.DB));
    const first = await finance.query({ filter, limit: 25 });
    assert.ok(first.cursor);
    const second = await finance.query({
      cursor: first.cursor,
      filter,
      limit: 25,
    });
    const records = [...first.records, ...second.records];
    const expected = Array.from({ length: 10_000 }, (_, i) => ({
      accountId: i % 3 === 0 ? "b" : "a",
      category: i % 7 === 0 ? "Target" : "Other",
      date: i % 2 === 0 ? "2026-10-02" : "2026-10-01",
      id: `t${String(i).padStart(5, "0")}`,
      status: i % 5 === 0 ? "PENDING" : "POSTED",
    }))
      .filter(
        (row) =>
          (!filter.category || row.category === filter.category) &&
          (!filter.status || row.status === filter.status) &&
          (!filter.accountIds || filter.accountIds.includes(row.accountId)) &&
          (!filter.from || row.date >= filter.from) &&
          (!filter.to || row.date <= filter.to),
      )
      .sort((left, right) =>
        `${right.date}/${right.accountId}/${right.id}`.localeCompare(
          `${left.date}/${left.accountId}/${left.id}`,
        ),
      )
      .slice(0, 50)
      .map((row) => row.id);
    assert.deepEqual(
      records.map((row) => row.id),
      expected,
    );
    assert.equal(new Set(records.map((row) => row.id)).size, 50);
    if (filter.to) {
      const outside = await finance.query({
        cursor: { ...first.cursor, date: "2026-10-03" },
        filter,
        limit: 25,
      });
      assert.deepEqual(outside.records, first.records);
    }
    assert.equal(batches.length, filter.to ? 3 : 2);
    for (const [index, [transactions, catalog]] of batches.entries()) {
      assert.ok(transactions);
      assert.ok(catalog);
      assert.ok(
        transactions.rows_read <= 27,
        `Page ${index + 1} of ${JSON.stringify(filter)} scanned ${transactions.rows_read} transaction rows`,
      );
      assert.equal(catalog.rows_read, 1);
    }
  },
);

test.each(["debits", "credits"] as const)(
  "%s scans its posted direction once and preserves exact currency groups",
  async (metric) => {
    await collect(source([]));
    await env.DB.prepare(
      `WITH RECURSIVE records(i) AS (
      VALUES(0) UNION ALL SELECT i+1 FROM records WHERE i<9999
    )
    INSERT INTO transactions(id,account_id,date,status,direction,currency,amount_minor,description,category)
    SELECT printf('t%05d',i),'a','2026-10-01',
      CASE WHEN i%5=0 THEN 'PENDING' ELSE 'POSTED' END,
      CASE WHEN i%3=0 THEN 'CREDIT' ELSE 'DEBIT' END,
      CASE WHEN i%7=0 THEN 'USD' ELSE 'BRL' END,
      CASE WHEN i%97=0 THEN NULL ELSE '-999999999999999999999999999999' END,
      'Synthetic',NULL FROM records`,
    ).run();
    const batches: D1Meta[][] = [];
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch").mockImplementation(async function measured<T>(
      statements: D1PreparedStatement[],
    ) {
      const results = await batch<T>(statements);
      batches.push(results.map((result) => result.meta));
      return results;
    });
    const finance = createFinancialService(createFinancialRepository(env.DB));
    const direction = metric === "debits" ? "DEBIT" : "CREDIT";
    const expected = ["BRL", "USD"].map((currency) => {
      let count = 0n;
      let unknownAmountCount = 0n;
      for (let i = 0; i < 10_000; i += 1) {
        if (
          i % 5 === 0 ||
          (i % 3 === 0 ? "CREDIT" : "DEBIT") !== direction ||
          (i % 7 === 0 ? "USD" : "BRL") !== currency
        ) {
          continue;
        }
        count += 1n;
        if (i % 97 === 0) {
          unknownAmountCount += 1n;
        }
      }
      return {
        count: count.toString(),
        currency,
        group: null,
        totalMinor: (
          (count - unknownAmountCount) *
          999999999999999999999999999999n
        ).toString(),
        unknownAmountCount: unknownAmountCount.toString(),
      };
    });
    const totals = await finance.aggregate({ metric });
    assert.deepEqual(totals.groups, expected);
    assert.equal(totals.partial, true);
    const [transactions, catalog] = required(batches.at(-1));
    assert.ok(transactions);
    assert.ok(catalog);
    const count = Number(
      expected.reduce((sum, group) => sum + BigInt(group.count), 0n),
    );
    assert.ok(
      transactions.rows_read <= count + 1,
      `${metric} scanned ${transactions.rows_read} rows for ${count} posted records`,
    );
    assert.equal(catalog.rows_read, 1);
  },
);

test("partial totals follow source corrections to status, direction, currency and category", async () => {
  await collect(source([transaction({ amount: "-1.23", status: "PENDING" })]));
  const finance = createFinancialService(createFinancialRepository(env.DB));
  assert.deepEqual((await finance.aggregate({ metric: "debits" })).groups, []);
  await collect(
    source([transaction({ amount: "-1.23", category: "Original" })]),
    "2026-10-02T00:00:00.000Z",
  );
  assert.equal(
    (await finance.aggregate({ metric: "debits" })).groups[0]?.totalMinor,
    "123",
  );
  const corrected = transaction({
    amount: "-4.56",
    category: "Corrected",
    currencyCode: "USD",
    type: "CREDIT",
  });
  await collect(source([corrected]), "2026-10-03T00:00:00.000Z");
  assert.deepEqual((await finance.aggregate({ metric: "debits" })).groups, []);
  assert.deepEqual(
    (await finance.aggregate({ groupBy: "category", metric: "credits" }))
      .groups,
    [
      {
        count: "1",
        currency: "USD",
        group: "Corrected",
        totalMinor: "456",
        unknownAmountCount: "0",
      },
    ],
  );
  await collect(
    source([{ ...corrected, status: "PENDING" }]),
    "2026-10-04T00:00:00.000Z",
  );
  assert.deepEqual((await finance.aggregate({ metric: "credits" })).groups, []);
  assert.equal((await finance.query({ limit: 1 })).records[0]?.id, "t");
});

test("sync control responses exclude large account catalogs while preserving recovery and replay", async () => {
  const name = "Synthetic account ".repeat(100);
  await collect(
    source(
      [],
      Array.from({ length: 100 }, (_, i) => account({ id: `a${i}`, name })),
    ),
  );
  const installation = createInstallationRepository(env.DB);
  await Promise.all(
    Array.from({ length: 9 }, (_, i) => installation.register(`other-${i}`)),
  );
  const responses: Array<() => Promise<number[]>> = [];
  const prepare = env.DB.prepare.bind(env.DB);
  vi.spyOn(env.DB, "prepare").mockImplementation((query) => {
    const statement = prepare(query);
    const bind = statement.bind.bind(statement);
    vi.spyOn(statement, "bind").mockImplementation((...values) => {
      const bound = bind(...values);
      const raw = vi.spyOn(bound, "raw");
      responses.push(() =>
        Promise.all(
          raw.mock.results.flatMap((result) =>
            result.type === "return"
              ? [
                  result.value.then(
                    (rows) =>
                      new TextEncoder().encode(JSON.stringify(rows)).byteLength,
                  ),
                ]
              : [],
          ),
        ),
      );
      return bound;
    });
    return statement;
  });
  const batch = env.DB.batch.bind(env.DB);
  const batchSizes: number[] = [];
  vi.spyOn(env.DB, "batch").mockImplementation(async function measured<T>(
    statements: D1PreparedStatement[],
  ) {
    const results = await batch<T>(statements);
    batchSizes.push(
      new TextEncoder().encode(
        JSON.stringify(results.map((result) => result.results)),
      ).byteLength,
    );
    return results;
  });
  const repository = createSyncRepository(env.DB);
  const now = "2026-10-02T00:00:00.000Z";
  const admission = required((await repository.admit(["c"], now))[0]);
  assert.equal(admission.status, "started");
  assert.ok(admission.importId);
  const run = await repository.read(admission.importId);
  assert.deepEqual(await repository.active(), [run]);
  await repository.start(run.id);
  const running = await repository.read(run.id);
  const publication: Publication = {
    done: false,
    next: { accountId: "a0", cursor: "next", phase: "transactions" },
    now,
    run: running,
    transactions: [
      normalizeTransaction(
        transaction({ accountId: "a0", amount: `-${"9".repeat(28)}.99` }),
        "a0",
      ),
    ],
  };
  const committed = await repository.publish(publication);
  assert.deepEqual(await repository.publish(publication), committed);
  await assert.rejects(
    repository.publish({
      ...publication,
      run: { ...running, connectionId: "other-0" },
    }),
    { message: "STALE_COMMIT" },
  );
  await repository.publish({
    done: true,
    next: { accountId: null, cursor: null, phase: "finish" },
    now,
    run: await repository.read(run.id),
  });
  assert.deepEqual(await repository.active(), []);
  assert.equal((await repository.admit(["c"], now))[0]?.status, "cooldown");
  const sizes = [
    ...(await Promise.all(responses.map((read) => read()))).flat(),
  ];
  assert.ok(sizes.length >= 6);
  for (const size of [...sizes, ...batchSizes]) {
    assert.ok(size < 2048, `Sync control returned ${size} bytes`);
  }
  vi.restoreAllMocks();
  const finance = createFinancialService(createFinancialRepository(env.DB));
  assert.equal(
    (await finance.query({ limit: 1 })).records[0]?.amountMinor,
    `-${"9".repeat(30)}`,
  );
  const state = await installation.state({ connectionIds: ["c"] });
  assert.equal(Object.keys(state.connections[0]?.accounts ?? {}).length, 100);
  assert.equal(state.connections[0]?.accounts.a0?.name, name);
  assert.equal(state.connections[0]?.lastSuccessAt, now);
});
