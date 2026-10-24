import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FinancialOverviewSchema,
  MonthlySpendingSchema,
} from "../../contracts";
import {
  monthPeriod,
  selectedMonth,
  shiftMonth,
} from "../account/dashboard-period";
import {
  categoryVolumes,
  safeChartValues,
  summaryCurrency,
} from "../account/financial-presentation";
import { demoMonthly, demoOverview, demoTransactions } from "../demo-data";

test("month selection keeps civil month boundaries and rejects out-of-range URLs", () => {
  assert.deepEqual(monthPeriod("2024-02"), {
    from: "2024-02-01",
    to: "2024-02-29",
  });
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(selectedMonth("0000-12", "2026-10-24"), "2026-10");
  assert.equal(selectedMonth("9999-01", "2026-10-24"), "2026-10");
  assert.equal(selectedMonth("2026-13", "2026-10-24"), "2026-10");
});

test("dashboard keeps currencies and bank balances separate from card debt and hidden accounts", () => {
  const overview = demoOverview("2026-10");
  const bank = summaryCurrency(overview, "BRL");
  assert.equal(bank.bankBalance, "3542586");
  assert.equal(bank.accounts.length, 3);
  assert.equal(summaryCurrency(overview, "USD").bankBalance, "184050");
  const unknown = {
    ...overview,
    accounts: overview.accounts.map((account) => ({
      ...account,
      ...(account.id === "demo-bank" && { balanceMinor: null }),
    })),
  };
  assert.equal(summaryCurrency(unknown, "BRL").bankBalance, null);
  const hidden = {
    ...overview,
    accounts: overview.accounts.map((account) => ({
      ...account,
      hidden: account.id === "demo-bank",
    })),
  };
  assert.equal(summaryCurrency(hidden, "BRL").bankBalance, "2500000");
});
test("demo aggregates the full posted ledger with refunds, transfers, pending and ignored semantics", () => {
  const overview = FinancialOverviewSchema.parse(demoOverview("2026-10"));
  const total = overview.totals.find((row) => row.currency === "BRL");
  assert.equal(total?.incomeMinor, "980000");
  assert.equal(total?.expenseMinor, "439381");
  assert.equal(total?.cashFlowMinor, "605789");
  assert.equal(total?.unclassifiedCount, 1);
  assert.equal(
    overview.groups.find((row) => row.group === "market")?.amountMinor,
    "104411",
  );
  assert.ok(
    demoTransactions({ currency: "BRL", month: "2026-10" }).some(
      (row) => row.status === "PENDING",
    ),
  );
  assert.equal(
    demoTransactions({ month: "2026-10" }).some((row) => row.ignored),
    false,
  );
  const monthly = MonthlySpendingSchema.parse({
    ...demoMonthly("2026-10"),
    groupBy: "month",
  });
  assert.equal(
    monthly.groups.filter((row) => row.currency === "BRL").length,
    6,
  );
  assert.equal(
    monthly.groups.find(
      (row) => row.currency === "BRL" && row.group === "2026-10",
    )?.amountMinor,
    total?.expenseMinor,
  );
  assert.ok(
    demoTransactions({ currency: "USD", month: "2026-10", text: "mercado" })
      .length === 0,
  );
});
test("plotting rejects unsafe magnitudes while meters retain exact signed values and bounded ratios", () => {
  const overview = demoOverview("2026-10");
  const groups = [
    { amountMinor: "-900719925474099301", currency: "BRL", group: "refund" },
    { amountMinor: "1801439850948198602", currency: "BRL", group: "expense" },
  ];
  assert.equal(safeChartValues(groups), null);
  const meters = categoryVolumes({ ...overview, groups }, "BRL");
  assert.equal(meters[0]?.amountMinor, "1801439850948198602");
  assert.equal(meters[0]?.volume, 100);
  assert.equal(meters[1]?.volume, 50);
  assert.equal(meters[1]?.amountMinor, "-900719925474099301");
  assert.deepEqual(
    safeChartValues([{ amountMinor: "0", currency: "BRL", group: "zero" }]),
    [0],
  );
});
