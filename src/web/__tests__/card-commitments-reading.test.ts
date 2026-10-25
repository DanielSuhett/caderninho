import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CardCommitmentsSchema } from "../../contracts";
import { cardCommitmentsFixture } from "../../fixtures/card-commitments";
import {
  CardCommitmentsPanel,
  CardCreditLimits,
} from "../account/card-commitments-panel";
import {
  amountProportion,
  categorySlices,
} from "../account/investments-presentation";

function visibleText(html: string) {
  return html.replace(/<[^>]+>/g, "");
}

test("the shared investment demo keeps currencies and the selected twelve-month horizon separate", () => {
  const fixture = CardCommitmentsSchema.parse(cardCommitmentsFixture());
  assert.equal(fixture.from, "2026-10-01");
  assert.equal(fixture.to, "2027-09-30");
  assert.equal(
    fixture.months.filter((month) => month.currency === "BRL").length,
    12,
  );
  assert.equal(
    fixture.totals.find((total) => total.currency === "BRL")?.spentMinor,
    "172100",
  );
  assert.equal(
    fixture.totals.find((total) => total.currency === "BRL")?.pendingMinor,
    "53000",
  );
  assert.equal(
    fixture.totals.find((total) => total.currency === "USD")?.spentMinor,
    "12500",
  );
  const later = CardCommitmentsSchema.parse(
    cardCommitmentsFixture({ month: "2026-11" }),
  );
  assert.equal(later.to, "2027-10-31");
  assert.equal(
    later.installments.some((row) => row.date < "2026-11-01"),
    false,
  );
  assert.equal(
    later.totals.find((total) => total.currency === "BRL")?.spentMinor,
    "0",
  );
});

test("investment reading separates observed commitments, unavailable limits, and native card currencies", () => {
  const html = renderToStaticMarkup(
    createElement(CardCommitmentsPanel, {
      currency: "BRL",
      data: cardCommitmentsFixture(),
    }),
  );
  const text = visibleText(html);
  assert.ok(
    text.includes("Gastos realizados1721,00 BRL") ||
      text.includes("Gastos realizados1.721,00 BRL"),
  );
  assert.ok(text.includes("Pendentes530,00 BRL"));
  assert.ok(text.includes("Compromissos por categoria"));
  assert.ok(text.includes("Não representam o limite ocupado no banco"));
  assert.ok(text.includes("Indisponível · BRL"));
  assert.ok(text.includes("Cartão internacional"));
  assert.ok(text.includes("5.000,00 USD"));
  assert.ok(text.includes("62,4%"));
  assert.ok(text.includes("Limite total cadastrado manualmente"));
  assert.ok(
    text.includes("Realizados") &&
      text.includes("Pendentes") &&
      text.includes("Futuros"),
  );
});

test("partial, unknown-only categories and net credits remain visible outside the positive pie", () => {
  const fixture = cardCommitmentsFixture({
    categories: [
      {
        amountMinor: null,
        color: "#64748b",
        currency: "BRL",
        id: "unknown",
        knownAmountMinor: "0",
        name: "Saúde sem valor",
        unknownAmountCount: 1,
      },
      {
        amountMinor: "-1000",
        color: "#64748b",
        currency: "BRL",
        id: "credit",
        knownAmountMinor: "-1000",
        name: "Estorno de mercado",
        unknownAmountCount: 0,
      },
    ],
  });
  const html = renderToStaticMarkup(
    createElement(CardCommitmentsPanel, {
      currency: "BRL",
      data: fixture,
      partial: true,
    }),
  );
  const text = visibleText(html);
  assert.ok(text.includes("Dados parciais"));
  assert.ok(text.includes("Categorias sem valor conhecido, fora da pizza"));
  assert.ok(text.includes("Saúde sem valorIndisponível · BRL"));
  assert.ok(text.includes("Créditos líquidos, fora da pizza"));
  assert.ok(text.includes("Estorno de mercado−10,00 BRL"));
  assert.ok(text.includes("Nenhum valor para representar"));
});

test("an available amount without a total does not fabricate allocated credit or a meter", () => {
  const [account] = cardCommitmentsFixture().accounts;
  assert.ok(account);
  const html = renderToStaticMarkup(
    createElement(CardCreditLimits, {
      accounts: [
        { ...account, allocatedCreditMinor: null, creditLimitMinor: null },
      ],
    }),
  );
  const text = visibleText(html);
  assert.ok(
    text.includes("Não há informações suficientes para calcular a ocupação"),
  );
  assert.equal(text.includes("Ocupação calculada pelo limite total"), false);
  assert.equal(html.includes('role="meter"'), false);
  const zero = renderToStaticMarkup(
    createElement(CardCreditLimits, {
      accounts: [
        {
          ...account,
          allocatedCreditMinor: "0",
          availableCreditMinor: "0",
          creditLimitMinor: "0",
        },
      ],
    }),
  );
  assert.ok(visibleText(zero).includes("0,00 BRL"));
  assert.equal(zero.includes('role="meter"'), false);
});

test("an empty card scope gives a recovery action without rendering invented financial zeroes", () => {
  const html = renderToStaticMarkup(
    createElement(CardCommitmentsPanel, {
      currency: "BRL",
      data: cardCommitmentsFixture({
        accounts: [],
        categories: [],
        installments: [],
        months: [],
        totals: [],
      }),
    }),
  );
  assert.ok(html.includes("Nenhum cartão neste escopo"));
  assert.ok(html.includes('href="/account/connections"'));
  assert.equal(html.includes("Gastos realizados"), false);
});

test("chart proportions are bounded while exact amounts above Number precision stay intact", () => {
  const amountMinor = "900719925474099312345";
  assert.equal(amountProportion(amountMinor, amountMinor), 100);
  assert.equal(amountProportion("1", "3"), 33.33);
  assert.equal(amountProportion("0", "0"), 0);
  const slices = categorySlices([
    { amountMinor, color: "#64748b", id: "large", name: "Compra grande" },
  ]);
  assert.equal(slices?.[0]?.amountMinor, amountMinor);
  assert.equal(slices?.[0]?.proportion, 100);
  assert.equal(
    categorySlices([
      { amountMinor: "-1", color: "#64748b", id: "credit", name: "Crédito" },
    ]),
    null,
  );
  assert.deepEqual(
    categorySlices([
      { amountMinor: "0", color: "#64748b", id: "zero", name: "Zero" },
    ]),
    [],
  );
});
