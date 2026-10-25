import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PortalCardsQuerySchema, PortalCardsSchema } from "../../contracts";
import { demoPortalFixture, workspaceFixture } from "../../fixtures/workspace";
import { cardPercentage, cardScope } from "../account/card-presentation";
import { CardsDashboard } from "../account/cards-dashboard";
import { demoCards } from "../demo-cards";
import { initialDemoData } from "../demo-data";

const query = PortalCardsQuerySchema.parse({
  month: "2026-10",
  tool: "get_portal_cards",
});
const monthHref = (month: string) => `/demo/cards?month=${month}`;
test("the card demo uses the shared ledger, reports only received months and shows the complete spending denominator", () => {
  const { data } = PortalCardsSchema.parse({
    data: demoCards(query, initialDemoData),
    partial: false,
  });
  assert.equal(data.confirmed.totalMinor, "47170");
  assert.equal(data.months[1]?.future.totalMinor, "30800");
  assert.equal(data.months[7]?.future.count, 0);
  const html = renderToStaticMarkup(
    createElement(CardsDashboard, {
      accountId: "",
      categories: initialDemoData.categories,
      data,
      monthHref,
      nextHref: null,
      showOwner: false,
    }),
  );
  assert.ok(html.includes("Gastos confirmados do mês"));
  assert.ok(html.includes("em compras"));
  assert.ok(html.includes("não acompanham o mês escolhido"));
  assert.ok(html.includes("Parcela 6 de 12"));
  assert.ok(html.includes("Sem parcelas recebidas"));
  assert.equal(html.includes("Parcela 13 de 12"), false);
});
test("the card scope keeps card selection inline and limits the filter dialog to owner or group choices", () => {
  const data = demoCards(query, initialDemoData);
  const scope = cardScope({
    catalog: workspaceFixture(),
    data,
    params: new URLSearchParams(),
    snapshot: demoPortalFixture(),
  });
  assert.equal(scope.hasFilters, false);
  assert.equal(scope.context, "Pessoal · Cartão pessoal · BRL");
  assert.equal(
    cardScope({
      catalog: workspaceFixture(),
      data,
      params: new URLSearchParams({ accountId: "demo-card" }),
      snapshot: demoPortalFixture(),
    }).hasFilters,
    false,
  );
  assert.equal(
    cardPercentage("900719925474099301", "1801439850948198602")?.label,
    "50,0%",
  );
  assert.deepEqual(cardPercentage("120", "100"), {
    label: "120,0%",
    meter: 100,
  });
  assert.equal(cardPercentage("0", "0"), null);
  assert.equal(cardPercentage(null, "100"), null);
});

test("known zero limits and missing provider limits have different explanations", () => {
  const report = demoCards(query, initialDemoData);
  function render(limit: string | null) {
    return renderToStaticMarkup(
      createElement(CardsDashboard, {
        accountId: "",
        categories: initialDemoData.categories,
        data: {
          ...report,
          accounts: report.accounts.map((account) => ({
            ...account,
            allocatedMinor: limit,
            availableCreditMinor: limit,
            creditLimitMinor: limit,
          })),
        },
        monthHref,
        nextHref: null,
        showOwner: false,
      }),
    );
  }
  const zero = render("0");
  assert.ok(zero.includes("0,00 BRL"));
  assert.ok(zero.includes("Limite informado não é positivo"));
  assert.equal(zero.includes("limite ou disponível não informado"), false);
  const unknown = render(null);
  assert.ok(unknown.includes("Não informado"));
  assert.ok(unknown.includes("limite ou disponível não informado"));
});
