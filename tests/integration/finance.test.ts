import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";

import {
  AggregateQuerySchema,
  TransactionQuerySchema,
} from "../../src/contracts";
import { normalizeAccount, normalizeTransaction } from "../../src/domain";
import { createFinancialService } from "../../src/worker/finance";
import { createFinancialRepository } from "../../src/worker/finance/repository";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { account, admit, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

const finance = () =>
  createFinancialService(
    createFinancialRepository(env.DB),
    () => new Date("2026-10-02T02:00:00.000Z"),
  );
beforeEach(setup);
test("SQL totals keep 30 digits, currencies, BANK/CREDIT semantics and eligibility across the full selection", async () => {
  await collect(
    source(
      [
        transaction({
          amount: "-90071992547409931234567890.12",
          id: "huge",
        }),
        transaction({ amount: "-15.01", id: "income", type: "CREDIT" }),
        transaction({
          amount: "0",
          category: "Zero",
          description: "",
          id: "zero",
        }),
        transaction({ amount: "-2.34", id: "unknown" }),
        transaction({ accountId: "credit", amount: "-20", id: "card" }),
        transaction({
          amount: "-20",
          id: "bill",
        }),
        transaction({ amount: "-500", id: "pending", status: "PENDING" }),
        transaction({ amount: "-500", date: "2026-10-02", id: "future" }),
        transaction({ amount: "-3.21", currencyCode: "USD", id: "usd" }),
        transaction({
          amount: "-1",
          currencyCode: "ZZZ",
          id: "unknown-currency",
        }),
        transaction({
          amount: "1.001",
          currencyCode: "BRL",
          id: "unsupported",
        }),
      ],
      [account(), account({ id: "credit", type: "CREDIT" })],
    ),
  );
  const service = finance();
  const page = await service.query({ limit: 1 });
  assert.equal(page.records.length, 1);
  assert.ok(page.cursor);
  const debits = await service.aggregate({ metric: "debits" });
  assert.equal(
    debits.groups.find((g) => g.currency === "BRL")?.totalMinor,
    "9007199254740993123456793246",
  );
  assert.equal(
    debits.groups.find((g) => g.currency === "USD")?.totalMinor,
    "321",
  );
  const flow = await service.aggregate({ metric: "cash_flow" });
  assert.equal(
    flow.groups.find((g) => g.currency === "BRL")?.totalMinor,
    "-9007199254740993123456789745",
  );
  assert.equal(flow.partial, true, "unsupported precision must be explicit");
  assert.equal(
    debits.groups.find((g) => g.currency === "BRL")?.unknownAmountCount,
    "1",
  );
  assert.deepEqual(
    debits.groups.find((g) => g.currency === "ZZZ"),
    {
      count: "1",
      currency: "ZZZ",
      group: null,
      totalMinor: null,
      unknownAmountCount: "1",
    },
  );
  assert.equal(
    (await service.aggregate({ metric: "credits" })).groups[0]?.totalMinor,
    "1501",
  );
  const zero = await service.aggregate({
    filter: { category: "Zero" },
    metric: "debits",
  });
  assert.equal(zero.groups[0]?.totalMinor, "0");
  assert.equal(zero.partial, false);
  assert.equal(
    (await service.query({ filter: { category: "Zero" }, limit: 10 }))
      .records[0]?.description,
    "",
  );
  assert.equal(
    (await service.query({ filter: { status: "PENDING" }, limit: 10 })).records
      .length,
    1,
  );
  assert.equal(
    (await service.query({ filter: { from: "2026-10-02" }, limit: 10 })).records
      .length,
    1,
  );
  assert.deepEqual(
    (
      await service.aggregate({
        filter: { from: "2026-10-02" },
        metric: "debits",
      })
    ).groups,
    [],
  );
  assert.equal(
    (await service.query({ filter: { currency: "ZZZ" }, limit: 10 })).records[0]
      ?.amountMinor,
    null,
  );
  const counts = await service.aggregate({ metric: "count" });
  assert.equal(counts.groups.find((g) => g.currency === "BRL")?.count, "9");
});
test("strict filters, scoped cursors and signed magnitude filters preserve unknowns", async () => {
  await collect(
    source([
      transaction({ amount: "-10", id: "negative" }),
      transaction({ amount: "10", id: "positive", type: "CREDIT" }),
      transaction({
        amount: "0",
        category: "Zero",
        description: "",
        id: "zero",
      }),
    ]),
  );
  const service = finance();
  const page = await service.query({ limit: 1 });
  assert.ok(page.cursor);
  await assert.rejects(
    service.query({
      cursor: page.cursor,
      filter: { currency: "BRL" },
      limit: 1,
    }),
    { message: "CURSOR_SCOPE_MISMATCH" },
  );
  assert.equal(
    (
      await service.query({
        filter: { currency: "BRL", minAmountMinor: "0" },
        limit: 10,
      })
    ).records.length,
    2,
  );
  assert.equal(
    (
      await service.query({
        filter: { currency: "BRL", maxAmountMinor: "-1" },
        limit: 10,
      })
    ).records[0]?.id,
    "negative",
  );
  assert.equal(
    TransactionQuerySchema.safeParse({ filter: { minAmountMinor: "0" } })
      .success,
    false,
  );
  assert.equal(
    TransactionQuerySchema.safeParse({ filter: { foo: "bar" } }).success,
    false,
  );
  assert.equal(
    AggregateQuerySchema.safeParse({ metric: "spending" }).success,
    false,
  );
});

test("100 account references remain a valid bounded query within D1 parameter limits", async () => {
  await collect(source([transaction()]));
  const accounts = Array.from({ length: 100 }, (_, index) => ({
    accountId: index === 0 ? "a" : `missing-${index}`,
    connectionId: "c",
  }));
  assert.equal(
    (await finance().query({ filter: { accounts }, limit: 10 })).records.length,
    1,
  );
  assert.equal(
    (await finance().aggregate({ filter: { accounts }, metric: "debits" }))
      .groups[0]?.totalMinor,
    "1000",
  );
});

test("admitting a new import invalidates cursors when selection quality changes", async () => {
  await collect(source([transaction({ id: "1" }), transaction({ id: "2" })]));
  const service = finance();
  const page = await service.query({ limit: 1 });
  assert.ok(page.cursor);
  await createSyncRepository(env.DB).admit(["c"], "2026-10-02T00:00:00.000Z");
  await assert.rejects(service.query({ cursor: page.cursor, limit: 1 }), {
    message: "RESTART_REQUIRED",
  });
});

test("selected pagination ignores unrelated imports and reconnects but rejects each committed page of the same import", async () => {
  await collect(source([transaction({ id: "1" }), transaction({ id: "2" })]));
  const service = finance();
  const input = { filter: { connectionIds: ["c"] }, limit: 1 };
  const first = await service.query(input);
  assert.ok(first.cursor);
  const installation = createInstallationRepository(env.DB);
  await installation.register({ id: "d" });
  const unselected = await createSyncRepository(env.DB).admit(
    ["d"],
    "2026-10-02T00:00:00.000Z",
  );
  assert.equal(unselected[0]?.status, "started");
  await installation.register({ id: "c", status: "UPDATED" });
  assert.equal(
    (await service.query({ ...input, cursor: first.cursor })).records.length,
    1,
  );
  const unfiltered = await service.query({ limit: 1 });
  assert.ok(unfiltered.cursor);
  await installation.register({ id: "new" });
  await assert.rejects(service.query({ cursor: unfiltered.cursor, limit: 1 }), {
    message: "RESTART_REQUIRED",
  });
  const repository = createSyncRepository(env.DB);
  const id = await admit("2026-10-02T00:00:00.000Z");
  await repository.start(id);
  const beforePage = await service.query(input);
  assert.ok(beforePage.cursor);
  const run = await repository.read(id);
  await repository.publish({
    done: false,
    next: run.checkpoint,
    now: "2026-10-02T00:00:00.000Z",
    run,
    transactions: [
      normalizeTransaction(
        transaction({ description: "Changed", id: "1" }),
        normalizeAccount(account(), "c"),
      ),
    ],
  });
  await assert.rejects(service.query({ ...input, cursor: beforePage.cursor }), {
    message: "RESTART_REQUIRED",
  });
  assert.equal((await repository.read(id)).sequence, run.sequence + 1);
});
