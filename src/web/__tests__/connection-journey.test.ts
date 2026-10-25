import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ConnectionInfo } from "../../contracts";
import { connectionFixture, portalFixture } from "../../fixtures/workspace";
import { importFailureMessage } from "../account/connection-journey";
import { bankAppearance, SetupBanks } from "../account/setup-banks";
import { initialImportIds, SetupImport } from "../account/setup-import";

function render(connections: ConnectionInfo[]) {
  return renderToStaticMarkup(
    createElement(SetupImport, {
      busy: false,
      command: () => undefined,
      complete: () => undefined,
      readError: false,
      refresh: () => undefined,
      snapshot: portalFixture({ connections }),
    }),
  );
}

test("import setup keeps published data available but does not claim identified accounts are imported", () => {
  const connection = connectionFixture();
  const initial = render([connection]);
  assert.ok(initial.includes("Importando transações"));
  assert.ok(initial.includes("0 de 1 bancos importados"));
  assert.ok(initial.includes("Aguardando os primeiros lançamentos"));
  assert.equal(initial.includes("Consultar dados disponíveis"), false);
  const partial = render([{ ...connection, hasTransactions: true }]);
  assert.ok(partial.includes("Histórico parcial"));
  assert.ok(partial.includes("Consultar dados disponíveis"));
});

test("initial queue spans people, resumes only unadmitted banks and leaves completed or paused origins untouched", () => {
  const snapshot = portalFixture({
    connections: [
      connectionFixture({
        id: "saved",
        importStatus: "succeeded",
        personId: "self",
      }),
      connectionFixture({ id: "first", importStatus: null, personId: "self" }),
      connectionFixture({
        id: "second",
        importStatus: null,
        personId: "other",
        profileId: "other",
      }),
      connectionFixture({ id: "active", importStatus: "running" }),
      connectionFixture({
        id: "paused",
        importStatus: null,
        profileId: "paused",
      }),
    ],
  });
  snapshot.profiles.push(
    {
      configured: true,
      connectionCount: 1,
      enabled: true,
      id: "other",
      name: "Outro acesso",
      personId: "other",
    },
    {
      configured: true,
      connectionCount: 1,
      enabled: false,
      id: "paused",
      name: "Pausado",
      personId: "other",
    },
  );
  assert.deepEqual(initialImportIds(snapshot), ["first", "second"]);
  assert.deepEqual(
    initialImportIds({
      ...snapshot,
      connections: snapshot.connections.map((connection) =>
        connection.id === "first"
          ? { ...connection, importStatus: "succeeded" as const }
          : connection,
      ),
    }),
    ["second"],
  );
});

test("bank identity uses provider institution metadata, never a guess from the account name", () => {
  assert.equal(
    bankAppearance(connectionFixture({ accounts: {} })).name,
    "Banco autorizado",
  );
  assert.equal(bankAppearance(connectionFixture()).identity?.institution, null);
  const html = renderToStaticMarkup(
    createElement(SetupBanks, {
      connections: [connectionFixture({ importStatus: null })],
    }),
  );
  assert.ok(html.includes("Não importado"));
  assert.equal(html.includes("Conectado · histórico importado"), false);
});

test("confirmed empty imports are complete; failures preserve data and expose the actual retry window", () => {
  const complete = connectionFixture({
    importStatus: "succeeded",
    partial: false,
  });
  assert.ok(render([complete]).includes("1 de 1 bancos importados"));
  const html = render([
    {
      ...complete,
      importError: "UPSTREAM_TIMEOUT",
      importStatus: "failed",
      lastSuccessAt: "2026-10-23T12:00:00Z",
      nextEligibleAt: "2099-10-26T12:00:00Z",
    },
  ]);
  assert.ok(html.includes("demorou a responder"));
  assert.ok(html.includes("Nova tentativa a partir de"));
  assert.ok(html.includes("Consultar dados disponíveis"));
  assert.equal(html.includes("Tentar novamente"), false);
  assert.ok(importFailureMessage("UPSTREAM_AUTH").includes("autorização"));
});
