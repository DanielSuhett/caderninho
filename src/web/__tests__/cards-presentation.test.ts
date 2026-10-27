import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PortalCardsQuerySchema, PortalCardsSchema } from "../../contracts";
import { demoPortalFixture, workspaceFixture } from "../../fixtures/workspace";
import {
  cardLabel,
  cardPercentage,
  cardScope,
} from "../account/card-presentation";
import { CardsDashboard } from "../account/cards-dashboard";
import { demoCards } from "../demo-cards";
import { initialDemoData } from "../demo-data";

const query = PortalCardsQuerySchema.parse({
  month: "2026-10",
  tool: "get_portal_cards",
});
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
      nextHref: null,
      showOwner: false,
    }),
  );
  assert.ok(html.includes("Gastos confirmados"));
  assert.ok(html.includes("em compras"));
  assert.ok(html.includes("Sobre Gastos confirmados"));
  assert.ok(html.includes("6/12 neste mês"));
  assert.equal(html.includes("Parcelas por mês"), false);
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
  assert.equal(scope.hasFilters, true);
  assert.equal(
    scope.context,
    "Pessoal · Todas as pessoas · Todos os cartões · BRL",
  );
  assert.equal(
    cardScope({
      catalog: workspaceFixture(),
      data,
      params: new URLSearchParams({ accountId: "demo-card" }),
      snapshot: demoPortalFixture(),
    }).hasFilters,
    true,
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
test("card labels always keep the observed last digits visible", () => {
  assert.equal(
    cardLabel({ identified: false, name: "3965", number: "3965" }),
    "Cartão final 3965",
  );
  assert.equal(
    cardLabel({ identified: true, name: "Virtual", number: "3965" }),
    "Virtual · final 3965",
  );
  assert.equal(
    cardLabel({ identified: false, name: "Conta", number: null }),
    "Cartão principal",
  );
});
test("demo card edits rename and hide a card without changing the account totals", () => {
  const [account] = demoCards(query, initialDemoData).accounts;
  const id = account?.cards[0]?.id ?? "";
  const edited = demoCards(
    query,
    initialDemoData,
    new Map(),
    new Map([[id, { hidden: true, name: "Virtual" }]]),
  );
  const card = edited.accounts[0]?.cards[0];
  assert.deepEqual(
    [card?.name, card?.identified, card?.hidden],
    ["Virtual", true, true],
  );
  assert.equal(
    edited.confirmed.totalMinor,
    demoCards(query, initialDemoData).confirmed.totalMinor,
  );
});
test("demo person filter follows the card owner and an unknown or hidden card id falls back to every card", () => {
  const all = demoCards(query, initialDemoData);
  const [account] = all.accounts;
  const cardId = account?.cards[0]?.id ?? "";
  const personId = all.accounts.find(
    (item) => item.personId !== account?.personId,
  )?.personId;
  assert.ok(personId);
  const moved = new Map([[cardId, { personId }]]);
  const forNewOwner = demoCards(
    { ...query, personId },
    initialDemoData,
    new Map(),
    moved,
  );
  assert.ok(
    forNewOwner.accounts.some((item) =>
      item.cards.some((card) => card.id === cardId),
    ),
  );
  const unknown = demoCards(
    { ...query, cardId: "missing:0000" },
    initialDemoData,
  );
  assert.equal(unknown.confirmed.totalMinor, all.confirmed.totalMinor);
  const hidden = demoCards(
    { ...query, cardId },
    initialDemoData,
    new Map(),
    new Map([[cardId, { hidden: true }]]),
  );
  assert.equal(hidden.confirmed.totalMinor, all.confirmed.totalMinor);
});
