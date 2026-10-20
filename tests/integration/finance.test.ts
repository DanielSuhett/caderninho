import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";

import {
  AggregateQuerySchema,
  CorrectionSchema,
  TransactionQuerySchema,
} from "../../src/contracts";
import { createFinancialService } from "../../src/worker/finance";
import { createFinancialRepository } from "../../src/worker/finance/repository";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { account, collect, setup, source, transaction } from "./fixture";
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
          merchant: { name: "Shop" },
        }),
        transaction({ amount: "15.01", id: "income", type: "CREDIT" }),
        transaction({ amount: "0", id: "zero" }),
        transaction({ amount: "-2.34", id: "unknown" }),
        transaction({ accountId: "credit", amount: "-20", id: "card" }),
        transaction({
          amount: "-20",
          id: "bill",
          operationType: "PAGAMENTO_FATURA",
        }),
        transaction({ amount: "-500", id: "pending", status: "PENDING" }),
        transaction({ amount: "-500", date: "2026-10-02", id: "future" }),
        transaction({ amount: "-3.21", currencyCode: "USD", id: "usd" }),
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
  const consumption = await service.aggregate({ metric: "known_spending" });
  assert.equal(
    consumption.groups.find((g) => g.currency === "BRL")?.totalMinor,
    "9007199254740993123456791012",
  );
  assert.equal(
    consumption.groups.find((g) => g.currency === "BRL")
      ?.unclassifiedDebitMinor,
    "234",
  );
  assert.equal(flow.partial, true, "unsupported precision must be explicit");
  const counts = await service.aggregate({ metric: "count" });
  assert.equal(counts.groups.find((g) => g.currency === "BRL")?.count, "9");
});
test("field corrections preserve empty descriptions/false, restore with null and invalidate cursors only on changes", async () => {
  await collect(
    source([
      transaction({ category: "Original", id: "1" }),
      transaction({ id: "2" }),
    ]),
  );
  const service = finance();
  const first = await service.query({ limit: 1 });
  assert.ok(first.cursor);
  const corrected = await service.correct({
    accountId: "a",
    connectionId: "c",
    id: "1",
    patch: { category: "Local", description: "", ignored: false },
  });
  assert.equal(corrected.effectiveDescription, "");
  assert.equal(corrected.ignored, false);
  await assert.rejects(service.query({ cursor: first.cursor, limit: 1 }), {
    message: "RESTART_REQUIRED",
  });
  const revised = await service.query({ limit: 1 });
  assert.ok(revised.cursor);
  await service.correct({
    accountId: "a",
    connectionId: "c",
    id: "1",
    patch: { category: "Local", description: "", ignored: false },
  });
  await service.query({ cursor: revised.cursor, limit: 1 });
  await collect(
    source([
      transaction({
        category: "Changed",
        description: "Source changed",
        id: "1",
      }),
      transaction({ id: "2" }),
    ]),
    "2026-10-02T00:00:00.000Z",
  );
  const [row] = (
    await service.query({ filter: { category: "Local" }, limit: 20 })
  ).records;
  assert.equal(row?.effectiveDescription, "");
  assert.equal(row?.category, "Changed");
  const reset = await service.correct({
    accountId: "a",
    connectionId: "c",
    id: "1",
    patch: { category: null, description: null, ignored: null },
  });
  assert.equal(reset.effectiveDescription, "Source changed");
  assert.equal(reset.effectiveCategory, "Changed");
});
test("new IDs and shorter history leave uncertain originals and never duplicate confirmed spending", async () => {
  await collect(
    source([
      transaction({ amount: "-10", id: "old", merchant: { name: "Shop" } }),
    ]),
  );
  await finance().correct({
    accountId: "a",
    connectionId: "c",
    id: "old",
    patch: { category: "Keep" },
  });
  await collect(
    source([
      transaction({ amount: "-10", id: "new", merchant: { name: "Shop" } }),
    ]),
    "2026-10-02T00:00:00.000Z",
  );
  const result = await finance().aggregate({ metric: "known_spending" });
  assert.equal(result.groups[0]?.totalMinor, "1000");
  assert.equal(result.groups[0]?.unconfirmed, "1");
  assert.equal(result.partial, true);
  const old = await finance().query({
    filter: { presence: "not_observed" },
    limit: 10,
  });
  assert.equal(old.records[0]?.id, "old");
  assert.equal(old.records[0]?.effectiveCategory, "Keep");
  await collect(source([]), "2026-10-03T00:00:00.000Z");
  assert.equal(
    (await finance().aggregate({ metric: "debits" })).groups[0]?.totalMinor,
    null,
  );
});
test("strict filters, scoped cursors and signed magnitude filters preserve unknowns", async () => {
  await collect(
    source([
      transaction({ amount: "-10", id: "negative" }),
      transaction({ amount: "10", id: "positive", type: "CREDIT" }),
      transaction({ amount: "0", id: "zero" }),
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
  assert.equal(
    CorrectionSchema.safeParse({
      accountId: "a",
      connectionId: "c",
      id: "t",
      patch: {},
    }).success,
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

test("category hints and unproven transfers remain uncertain spending even after a complete collection", async () => {
  await collect(
    source([
      transaction({
        amount: "-100",
        id: "purchase",
        merchant: { name: "Shop" },
      }),
      transaction({
        amount: "-10",
        category: "Investments",
        id: "investment-hint",
      }),
      transaction({
        amount: "-20",
        category: "Credit card payment",
        id: "bill-hint",
      }),
      transaction({ amount: "-5", id: "transfer", operationType: "PIX" }),
      transaction({
        amount: "-30",
        id: "proven-bill",
        operationType: "PAGAMENTO_FATURA",
      }),
    ]),
  );
  const result = await finance().aggregate({ metric: "known_spending" });
  assert.equal(result.accounts[0]?.collectionStatus, "complete");
  assert.equal(result.partial, true);
  assert.equal(result.groups[0]?.totalMinor, "10000");
  assert.equal(result.groups[0]?.unclassifiedDebitMinor, "3500");
  assert.equal(
    (await finance().aggregate({ metric: "debits" })).partial,
    false,
  );
});
