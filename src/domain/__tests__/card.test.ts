import assert from "node:assert/strict";
import { test } from "node:test";

import {
  allocatedCredit,
  type CardActivityRow,
  createCardActivity,
  isCardExpense,
} from "../card.entity";

const row = (input: Partial<CardActivityRow> = {}): CardActivityRow => ({
  amountMinor: "-10000",
  category: "home",
  date: "2026-10-10",
  direction: "DEBIT",
  installmentNumber: 2,
  status: "POSTED",
  totalInstallments: 6,
  ...input,
});
test("card totals count each received installment once and separate pending from future", () => {
  const activity = createCardActivity({
    month: "2026-10",
    referenceDay: "2026-10-24",
  });
  activity.add(row());
  activity.add(
    row({
      amountMinor: "2000",
      direction: "CREDIT",
      installmentNumber: null,
      totalInstallments: null,
    }),
  );
  activity.add(row({ status: "PENDING" }));
  activity.add(row({ date: "2026-10-30", status: "PENDING" }));
  activity.add(row({ date: "2026-11-10", installmentNumber: 3 }));
  const result = activity.result();
  assert.equal(result.confirmed.totalMinor, "8000");
  assert.equal(result.purchases.totalMinor, "10000");
  assert.equal(result.refunds.totalMinor, "2000");
  assert.equal(result.pending.totalMinor, "10000");
  assert.equal(result.future.totalMinor, "10000");
  assert.equal(result.categories[0]?.totalMinor, "10000");
  assert.equal(result.months[0]?.confirmed.count, 1);
  assert.equal(result.months[0]?.pending.count, 1);
  assert.equal(result.months[0]?.future.count, 1);
  assert.equal(result.months[1]?.future.totalMinor, "10000");
  assert.equal(result.months[2]?.future.count, 0);
});
test("card totals preserve unknowns, zero, unclassified purchases and integers beyond Number precision", () => {
  const activity = createCardActivity({
    month: "2026-10",
    referenceDay: "2026-10-24",
  });
  activity.add(row({ amountMinor: "-900719925474099312345", category: null }));
  activity.add(row({ amountMinor: "0", category: null }));
  activity.add(row({ amountMinor: null, category: null }));
  const result = activity.result();
  assert.equal(result.confirmed.totalMinor, null);
  assert.equal(result.confirmed.knownMinor, "900719925474099312345");
  assert.equal(result.confirmed.unknownCount, 1);
  assert.equal(result.categories[0]?.categoryId, null);
  assert.equal(result.categories[0]?.totalMinor, null);
  assert.equal(allocatedCredit("0", "0"), "0");
  assert.equal(allocatedCredit("100", "120"), "-20");
  assert.equal(
    allocatedCredit("900719925474099312345", "12345"),
    "900719925474099300000",
  );
  assert.equal(allocatedCredit(null, "100"), null);
});
test("invoice payments, transfers and income are excluded while unclassified debits and expense refunds remain", () => {
  assert.equal(
    isCardExpense({
      categoryKind: undefined,
      direction: "DEBIT",
      operationType: null,
    }),
    true,
  );
  assert.equal(
    isCardExpense({
      categoryKind: "expense",
      direction: "CREDIT",
      operationType: null,
    }),
    true,
  );
  assert.equal(
    isCardExpense({
      categoryKind: undefined,
      direction: "CREDIT",
      operationType: null,
    }),
    false,
  );
  assert.equal(
    isCardExpense({
      categoryKind: "expense",
      direction: "DEBIT",
      operationType: "PAGAMENTO_FATURA",
    }),
    false,
  );
  assert.equal(
    isCardExpense({
      categoryKind: "transfer",
      direction: "DEBIT",
      operationType: null,
    }),
    false,
  );
});
