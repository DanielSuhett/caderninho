import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ConnectionInfo } from "../../contracts";
import { connectionFixture } from "../../fixtures/workspace";
import { importFailureMessage } from "../account/connection-journey";
import { bankAppearance, SetupBanks } from "../account/setup-banks";

test("bank identity uses provider institution metadata, never a guess from the account name", () => {
  assert.equal(
    bankAppearance(connectionFixture({ accounts: {} })).name,
    "Banco não identificado",
  );
  assert.equal(bankAppearance(connectionFixture()).identity?.institution, null);
  const html = renderToStaticMarkup(
    createElement(SetupBanks, {
      connections: [connectionFixture({ importStatus: null })],
      csrf: "synthetic",
      institutions: async () => ({ records: [] }),
      manage: async () => ({ ok: true as const }),
    }),
  );
  assert.ok(html.includes("Não importado"));
  assert.ok(html.includes("Escolher banco"));
  assert.equal(html.includes("Conectado · histórico importado"), false);
});

test("a recognized bank offers a correction while an unknown one invites a choice", () => {
  const recognized = connectionFixture({
    accounts: {
      a: {
        balanceMinor: null,
        balanceObservedAt: null,
        currency: "BRL",
        identity: {
          cardBrand: null,
          institution: {
            id: "compe:208",
            logoUrl: null,
            name: "Banco Sintético",
          },
        },
        name: "Conta exemplo",
        type: "BANK",
      },
    },
  });
  const html = (connection: ConnectionInfo) =>
    renderToStaticMarkup(
      createElement(SetupBanks, {
        connections: [connection],
        csrf: "synthetic",
        institutions: async () => ({ records: [] }),
        manage: async () => ({ ok: true as const }),
      }),
    );
  assert.ok(html(recognized).includes("Corrigir banco de Banco Sintético"));
  assert.equal(html(recognized).includes("Escolher banco"), false);
  assert.ok(html(connectionFixture()).includes("Escolher banco"));
  assert.equal(html(connectionFixture()).includes("Corrigir banco de"), false);
});

test("failures name their cause and keep the published data", () => {
  assert.ok(
    importFailureMessage("UPSTREAM_TIMEOUT").includes("demorou a responder"),
  );
  assert.ok(importFailureMessage("UPSTREAM_AUTH").includes("autorização"));
  assert.ok(
    importFailureMessage("ACCOUNT_ALREADY_CONNECTED").includes("Reautorizar"),
  );
});
