import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ConnectionInfo, PortalResponse } from "../../contracts";
import {
  ConnectionJourney,
  importFailureMessage,
  journeyConnection,
} from "../account/connection-journey";

const announcementPattern = /<p class="sr-only" role="status">(.*?)<\/p>/;
const timePattern = /2026|13:06|Estado consultado/;
const setupPattern = /Configurar ou reativar perfil|Conectar Meu Pluggy/;
const phasePattern = /Importando transações/;
const credentialPattern = /perfil|autorização/;
const connection: ConnectionInfo = {
  accounts: {
    a: {
      balanceMinor: null,
      balanceObservedAt: null,
      currency: "BRL",
      name: "Conta exemplo",
      type: "BANK",
    },
  },
  hasTransactions: false,
  id: "c",
  importCheckpoint: { accountId: "a", phase: "transactions" },
  importError: null,
  importStatus: "running",
  lastSuccessAt: null,
  nextEligibleAt: null,
  partial: true,
  personName: "Pessoa exemplo",
  profileName: "Perfil exemplo",
};
function render(connections: ConnectionInfo[], configured = true) {
  const snapshot: PortalResponse = {
    configured,
    connections,
    csrf: "synthetic",
    origin: "https://example.test",
    people: [{ id: "self", name: "Pessoa exemplo" }],
    profiles: [
      {
        configured,
        connectionCount: connections.length,
        enabled: true,
        id: "default",
        name: "Perfil exemplo",
        personId: "self",
      },
    ],
  };
  return renderToStaticMarkup(
    createElement(ConnectionJourney, {
      activity: null,
      cancel: () => undefined,
      connect: () => undefined,
      manage: () => undefined,
      observedAt: "2026-10-23T13:06:56Z",
      readError: false,
      snapshot,
    }),
  );
}
test("identified accounts alone do not unlock a transaction CTA; published data unlocks partial consultation", () => {
  const initial = render([connection]);
  assert.ok(initial.includes("Importando transações"));
  assert.ok(initial.includes("1 conta identificada"));
  assert.ok(initial.includes("Aguardando os primeiros lançamentos"));
  assert.equal(initial.includes("Ver transações disponíveis"), false);
  const partial = render([{ ...connection, hasTransactions: true }]);
  assert.ok(partial.includes("Dados parciais"));
  assert.ok(partial.includes("Ver transações disponíveis"));
  assert.ok(partial.includes("A importação continua"));
  const announcement = partial.match(announcementPattern)?.[1];
  assert.match(announcement ?? "", phasePattern);
  assert.doesNotMatch(announcement ?? "", timePattern);
});
test("a confirmed empty import is a legitimate consultable result even if another profile is not configured", () => {
  const html = render(
    [
      {
        ...connection,
        importStatus: "succeeded",
        lastSuccessAt: "2026-10-23T13:07:02Z",
        partial: false,
      },
    ],
    false,
  );
  assert.ok(html.includes("Importação concluída"));
  assert.ok(html.includes("Nenhuma transação foi retornada"));
  assert.ok(html.includes("Ver transações"));
  assert.doesNotMatch(html, setupPattern);
});
test("existing consultation takes precedence over an unrelated failed connection, independent of page filters", () => {
  const available = {
    ...connection,
    hasTransactions: true,
    importStatus: "succeeded" as const,
    lastSuccessAt: "2026-10-23T13:07:02Z",
  };
  const failed = {
    ...connection,
    id: "other",
    importStatus: "failed" as const,
  };
  assert.equal(journeyConnection([failed, available])?.id, available.id);
  assert.ok(render([]).includes("Conecte seu primeiro banco"));
  assert.ok(render([]).includes("primeira importação começa automaticamente"));
});

test("import failure recovery distinguishes a provider timeout from a rejected authorization", () => {
  assert.ok(
    importFailureMessage("UPSTREAM_TIMEOUT").includes("demorou a responder"),
  );
  assert.doesNotMatch(
    importFailureMessage("UPSTREAM_TIMEOUT"),
    credentialPattern,
  );
  assert.match(importFailureMessage("UPSTREAM_AUTH"), credentialPattern);
  assert.doesNotMatch(
    importFailureMessage("INTERNAL_ERROR"),
    credentialPattern,
  );
  const html = render([
    {
      ...connection,
      hasTransactions: true,
      importError: "UPSTREAM_TIMEOUT",
      importStatus: "failed",
    },
  ]);
  assert.ok(html.includes("Ver transações disponíveis"));
  assert.ok(html.includes("Código: UPSTREAM_TIMEOUT"));
});
