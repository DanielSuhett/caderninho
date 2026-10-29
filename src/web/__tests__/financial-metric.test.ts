import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CreditLimitCard } from "../account/credit-limit-card";
import { FinancialMetric } from "../account/financial-metric";

const markup = /<[^>]*>/g;

function metric(amount: string | null) {
  return renderToStaticMarkup(
    createElement(FinancialMetric, {
      amount,
      currency: "BRL",
      hint: "No período",
      label: "Despesas",
      tone: "expense",
    }),
  );
}
function limit(allocated: string | null, available: string | null) {
  return renderToStaticMarkup(
    createElement(CreditLimitCard, {
      allocated,
      available,
      currency: "BRL",
      limit: "100000",
      name: "Cartão exemplo",
    }),
  );
}

test("financial metric preserves exact digits, currency and missing values", () => {
  const large = metric("9007199254740993").replace(markup, "");
  assert.ok(large.includes("R$ 90.071.992.547.409,93"));
  assert.ok(metric(null).includes("Indisponível"));
  assert.ok(!metric(null).includes("0,00"));
  assert.ok(metric("0").includes('data-money-tone="neutral"'));
  assert.ok(metric("123").includes('data-money-tone="expense"'));
});

test("credit limit distinguishes zero, unavailable, excess credit and over-limit", () => {
  assert.ok(limit("0", "100000").includes("0,0%"));
  assert.ok(limit(null, null).includes("Não informado"));
  assert.ok(!limit(null, null).includes('role="meter"'));
  const excess = limit("-20000", "120000");
  assert.ok(excess.includes("Crédito excedente"));
  assert.ok(excess.includes("R$ 200,00"));
  assert.ok(!excess.includes('role="meter"'));
  assert.ok(limit("120000", "-20000").includes("120,0%"));
});
