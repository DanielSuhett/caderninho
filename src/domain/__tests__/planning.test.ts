import assert from "node:assert/strict";
import { test } from "node:test";

import { financialCharts, monthDate, sacSchedule } from "..";

test("SAC distributes every minor unit and rounds each interest charge half up", () => {
  const rows = sacSchedule({
    count: 3,
    loanId: "l",
    monthlyRateBps: 5000,
    principalMinor: "101",
    startDate: "2024-01-31",
  });
  assert.deepEqual(
    rows.map((r) => r.principalMinor),
    ["34", "34", "33"],
  );
  assert.deepEqual(
    rows.map((r) => r.interestMinor),
    ["51", "34", "17"],
  );
  assert.equal(
    rows.reduce((sum, r) => sum + BigInt(r.principalMinor), 0n),
    101n,
  );
  assert.equal(monthDate("2024-01-31", 1), "2024-02-29");
  assert.equal(monthDate("2024-01-31", 2), "2024-03-31");
});
test("SVG charts escape labels, separate currencies and retain exact monetary labels", () => {
  const groups = [
    {
      amountMinor: "999999999999999999999999999999",
      currency: "BRL",
      group: '<script>alert("x")</script>',
    },
    { amountMinor: "1", currency: "USD", group: "Other" },
  ];
  for (const type of ["bar", "line", "doughnut"] as const) {
    const charts = financialCharts({ groups, type });
    assert.equal(charts.length, 2);
    assert.equal(charts[0]?.svg.includes("<script>"), false);
    assert.ok(charts[0]?.svg.includes("999999999999999999999999999999"));
    assert.ok(charts[0]?.svg.includes("&lt;script&gt;"));
  }
  assert.throws(
    () =>
      financialCharts({
        groups: [{ amountMinor: "-1", currency: "BRL", group: "Refund" }],
        type: "doughnut",
      }),
    { message: "CHART_NEGATIVE_VALUES" },
  );
});
