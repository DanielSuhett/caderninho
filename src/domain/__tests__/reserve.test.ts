import assert from "node:assert/strict";
import test from "node:test";

import {
  closedMonths,
  emergencyReservePlan,
  fixedCostBreakdown,
  ReserveHealth,
} from "..";

test("closed months are the whole calendar months before the reference day", () => {
  assert.deepEqual(closedMonths("2026-01-15", 3), [
    { from: "2025-10-01", month: "2025-10", to: "2025-10-31" },
    { from: "2025-11-01", month: "2025-11", to: "2025-11-30" },
    { from: "2025-12-01", month: "2025-12", to: "2025-12-31" },
  ]);
});

test("the reserve target is months times the rounded-up fixed cost average", () => {
  assert.deepEqual(
    emergencyReservePlan({
      balancesMinor: [100_000n, 50_000n],
      monthlyMinor: [100_000n, 100_000n, 100_001n],
      months: 6,
    }),
    {
      averageMinor: "100001",
      coveredMonths: 1.4,
      health: ReserveHealth.low,
      remainingMinor: "450006",
      savedMinor: "150000",
      surplusMinor: null,
      targetMinor: "600006",
    },
  );
});

test("an unknown linked balance leaves the saved amount unknown", () => {
  const plan = emergencyReservePlan({
    balancesMinor: [10n, null],
    monthlyMinor: [0n, 0n, 0n],
    months: 6,
  });
  assert.equal(plan.savedMinor, null);
  assert.equal(plan.coveredMonths, null);
  assert.equal(plan.remainingMinor, null);
  assert.equal(plan.targetMinor, "0");
});

test("health follows the share of the target and the surplus is what exceeds it", () => {
  const plan = (saved: bigint) =>
    emergencyReservePlan({
      balancesMinor: [saved],
      monthlyMinor: [100n],
      months: 4,
    });
  assert.equal(plan(199n).health, ReserveHealth.low);
  assert.equal(plan(200n).health, ReserveHealth.partial);
  assert.equal(plan(400n).health, ReserveHealth.full);
  assert.equal(plan(400n).surplusMinor, null);
  assert.equal(plan(650n).surplusMinor, "250");
});

test("only categories paid every month offer a reduction down to their lowest month", () => {
  const breakdown = fixedCostBreakdown([
    new Map([
      ["rent", 300n],
      ["tax", 900n],
    ]),
    new Map([["rent", 360n]]),
    new Map([["rent", 300n]]),
  ]);
  assert.deepEqual(breakdown, {
    categories: [
      {
        averageMinor: "320",
        id: "rent",
        lowestMinor: "300",
        reductionMinor: "20",
      },
      {
        averageMinor: "300",
        id: "tax",
        lowestMinor: null,
        reductionMinor: "0",
      },
    ],
    reductionMinor: "20",
  });
});
