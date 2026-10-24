import assert from "node:assert/strict";
import { after, test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { PortalResponse } from "../../contracts";
import { DashboardView } from "../account/dashboard-view";

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
const snapshot: PortalResponse = {
  configured: true,
  connections: [
    {
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
      importError: null,
      importStatus: "succeeded",
      lastSuccessAt: "2026-10-23T12:00:00Z",
      nextEligibleAt: null,
      partial: false,
      personId: "self",
      personName: "Pessoa exemplo",
      profileId: "default",
      profileName: "Perfil exemplo",
    },
  ],
  csrf: "synthetic",
  origin: "https://example.test",
  people: [{ id: "self", name: "Pessoa exemplo" }],
  profiles: [
    {
      configured: true,
      connectionCount: 1,
      enabled: true,
      id: "default",
      name: "Perfil exemplo",
      personId: "self",
    },
  ],
};
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
      manage: () => undefined,
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
test("the overview preserves zero card balances and their meaning without repeating a finished import", () => {
  const html = render(snapshot);
  assert.ok(html.includes("Cartão exemplo"));
  assert.ok(html.includes("0,00 BRL"));
  assert.ok(html.includes("Cartão · não é dinheiro disponível"));
  assert.equal(html.includes("22/10/2026"), false);
  assert.equal(html.includes("Importação concluída"), false);
  assert.ok(render(snapshot, "connections").includes("Importação concluída"));
});
test("a partial or unrelated unconfigured profile does not block the saved accounts", () => {
  const html = render({
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
  assert.ok(html.includes("Histórico parcial"));
  assert.ok(html.includes('href="/account/connections"'));
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
    html.includes("Dados parciais. A importação ainda está em andamento."),
  );
  assert.ok(html.includes("Ver transações disponíveis"));
  assert.equal(html.includes("Histórico parcial"), false);
});
