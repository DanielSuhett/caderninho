import assert from "node:assert/strict";
import { after, test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PortalResponse } from "../../contracts";
import { connectionFixture, portalFixture } from "../../fixtures/workspace";
import { DashboardView } from "../account/dashboard-view";
import { AccountBalances } from "../account/financial-dashboard";

const previousLocation = Object.getOwnPropertyDescriptor(
  globalThis,
  "location",
);
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: new URL("https://example.test/account"),
});
after(() => {
  if (previousLocation) {
    Object.defineProperty(globalThis, "location", previousLocation);
  } else {
    Reflect.deleteProperty(globalThis, "location");
  }
});
const snapshot: PortalResponse = portalFixture({
  connections: [
    connectionFixture({
      accounts: {
        card: {
          balanceMinor: "0",
          balanceObservedAt: "2026-10-23",
          currency: "BRL",
          name: "Cartão exemplo",
          type: "CREDIT",
        },
      },
      hasTransactions: true,
      id: "synthetic",
      importCheckpoint: null,
      importStatus: "succeeded",
      lastSuccessAt: "2026-10-23T12:00:00Z",
      partial: false,
      personId: "self",
      profileId: "default",
    }),
  ],
});

function render(
  state: PortalResponse,
  section: "overview" | "connections" = "overview",
) {
  return renderToStaticMarkup(
    createElement(DashboardView, {
      activity: null,
      busy: false,
      cancel: () => undefined,
      command: () => undefined,
      connect: () => undefined,
      manage: async () => ({ ok: true as const }),
      message: "",
      observedAt: null,
      personId: "",
      readError: false,
      refresh: () => undefined,
      section,
      snapshot: state,
    }),
  );
}
function renderBalances(state: PortalResponse) {
  return renderToStaticMarkup(
    createElement(AccountBalances, {
      accounts: state.connections.flatMap((connection) =>
        Object.entries(connection.accounts).map(([id, account]) => ({
          ...account,
          hidden: false,
          id,
          manual: false,
          personId: connection.personId ?? "self",
        })),
      ),
      partial: state.connections.some((connection) => connection.partial),
      people: state.people,
      transactionsHref: "/account/transactions",
    }),
  );
}
test("the overview preserves zero card balances and their meaning without repeating a finished import", () => {
  const html = renderBalances(snapshot);
  assert.ok(html.includes("Cartão exemplo"));
  assert.ok(html.includes("0,00 BRL"));
  assert.ok(html.includes("Cartão · não é dinheiro disponível"));
  assert.equal(html.includes("22/10/2026"), false);
  assert.equal(html.includes("Importação concluída"), false);
  assert.ok(render(snapshot, "connections").includes("Importação concluída"));
});
test("a partial or unrelated unconfigured profile does not block the saved accounts", () => {
  const html = renderBalances({
    ...snapshot,
    configured: false,
    connections: snapshot.connections.map((connection) => ({
      ...connection,
      importStatus: "failed",
      partial: true,
    })),
    profiles: [
      ...snapshot.profiles,
      {
        configured: false,
        connectionCount: 0,
        enabled: true,
        id: "other",
        name: "Outro perfil",
        personId: "self",
      },
    ],
  });
  assert.ok(html.includes("Cartão exemplo"));
  assert.ok(html.includes("Dados parciais"));
  assert.ok(html.includes('href="/account/transactions?accountId=card"'));
});
test("an installation without imported data still exposes the first connection action", () => {
  const html = render({ ...snapshot, connections: [] });
  assert.ok(html.includes("Conecte seu primeiro banco"));
  assert.ok(html.includes("Conectar Meu Pluggy"));
});

test("connections keep partial data consultable with one progress warning", () => {
  const html = render(
    {
      ...snapshot,
      connections: snapshot.connections.map((connection) => ({
        ...connection,
        importStatus: "running",
        partial: true,
      })),
    },
    "connections",
  );
  assert.ok(
    html.includes(
      "Histórico parcial. Os dados já recebidos continuam disponíveis.",
    ),
  );
  assert.ok(html.includes("Ver transações disponíveis"));
  assert.equal((html.match(/Histórico parcial/g) ?? []).length, 1);
});
