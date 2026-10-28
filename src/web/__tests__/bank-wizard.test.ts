import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ConnectionInfo, PortalResponse } from "../../contracts";
import { connectionFixture, portalFixture } from "../../fixtures/workspace";
import {
  WizardBody,
  type WizardViewProps,
  wizardTitle,
} from "../account/add-bank-wizard";
import {
  accessStep,
  backStep,
  ImportOutcome,
  importableIds,
  importOutcome,
  journeyConnections,
  openingStep,
  pendingImports,
  resumeBaseline,
  WizardStep,
} from "../account/bank-wizard";

function connection(input: Partial<ConnectionInfo>) {
  return connectionFixture({ personId: "self", ...input });
}

function snapshotWith(
  connections: ConnectionInfo[],
  input: Partial<PortalResponse> = {},
) {
  return portalFixture({ connections, ...input });
}

function view(input: Partial<WizardViewProps>): WizardViewProps {
  const snapshot = input.snapshot ?? snapshotWith([]);
  return {
    back: null,
    busy: false,
    created: false,
    draft: null,
    importable: 0,
    issue: "",
    journey: [],
    markDirty: () => undefined,
    message: "",
    onAddAnother: () => undefined,
    onOtherPerson: () => undefined,
    onSaveCredentials: async () => undefined,
    onSavePerson: async () => undefined,
    onSelect: () => undefined,
    outcome: ImportOutcome.waiting,
    person: snapshot.people[0],
    profile: snapshot.profiles[0],
    selected: "",
    snapshot,
    step: WizardStep.authorize,
    ...input,
  };
}

function html(props: WizardViewProps) {
  return renderToStaticMarkup(createElement(WizardBody, { props }));
}

test("a second bank starts a journey that excludes earlier connections", () => {
  const old = connection({
    id: "old",
    importStatus: "succeeded",
    partial: false,
  });
  const added = connection({ id: "new", importStatus: null });
  const snapshot = snapshotWith([old, added]);
  const baseline = new Set(["old"]);
  const journey = journeyConnections({ baseline, personId: "self", snapshot });
  assert.deepEqual(
    journey.map((value) => value.id),
    ["new"],
  );
  assert.deepEqual(importableIds({ connections: journey, now: 0, snapshot }), [
    "new",
  ]);
});

test("after a reload the journey is whatever D1 still shows as authorized only", () => {
  const snapshot = snapshotWith([
    connection({ id: "old", importStatus: "succeeded", partial: false }),
    connection({ id: "waiting", importStatus: null }),
    connection({ id: "elsewhere", importStatus: null, personId: "other" }),
  ]);
  const baseline = new Set(snapshot.connections.map((value) => value.id));
  assert.deepEqual(
    journeyConnections({ baseline, personId: "self", snapshot }).map(
      (value) => value.id,
    ),
    ["waiting"],
  );
  assert.equal(pendingImports(snapshot, "self"), 1);
  assert.equal(pendingImports(snapshot, "other"), 1);
  assert.equal(
    pendingImports(
      snapshotWith([connection({ importStatus: "succeeded", partial: false })]),
      "self",
    ),
    0,
  );
  assert.equal(
    pendingImports(
      snapshotWith([connection({ importStatus: "failed" })]),
      "self",
    ),
    1,
  );
  // Resuming follows what is unsettled, including failures and running imports.
  const mixed = snapshotWith([
    connection({ id: "done", importStatus: "succeeded", partial: false }),
    connection({ id: "failed", importStatus: "failed" }),
    connection({ id: "running", importStatus: "running" }),
    connection({ id: "waiting", importStatus: null }),
  ]);
  assert.deepEqual(
    journeyConnections({
      baseline: resumeBaseline(mixed),
      personId: "self",
      snapshot: mixed,
    }).map((value) => value.id),
    ["failed", "running", "waiting"],
  );
});

test("import requests skip running, completed, ineligible and paused origins", () => {
  const now = Date.parse("2026-01-02T00:00:00Z");
  const snapshot = snapshotWith([], {
    profiles: [
      {
        configured: true,
        connectionCount: 1,
        enabled: true,
        id: "default",
        name: "Acesso",
        personId: "self",
      },
      {
        configured: true,
        connectionCount: 1,
        enabled: false,
        id: "paused",
        name: "Pausado",
        personId: "self",
      },
    ],
  });
  const connections = [
    connection({ id: "fresh", importStatus: null }),
    connection({ id: "running", importStatus: "running" }),
    connection({ id: "done", importStatus: "succeeded", partial: false }),
    connection({
      id: "retry",
      importStatus: "failed",
      nextEligibleAt: "2026-01-01T00:00:00Z",
    }),
    connection({
      id: "later",
      importStatus: "failed",
      nextEligibleAt: "2026-01-03T00:00:00Z",
    }),
    connection({ id: "off", importStatus: null, profileId: "paused" }),
  ];
  assert.deepEqual(importableIds({ connections, now, snapshot }), [
    "fresh",
    "retry",
  ]);
});

test("authorization, import, success and partial results keep distinct meanings", () => {
  const authorized = connection({ importStatus: null });
  const running = connection({ importStatus: "running" });
  const failed = connection({ importStatus: "failed" });
  const partial = connection({ importStatus: "succeeded", partial: true });
  const done = connection({ importStatus: "succeeded", partial: false });
  assert.equal(importOutcome([authorized, done]), ImportOutcome.waiting);
  assert.equal(importOutcome([running, failed]), ImportOutcome.running);
  assert.equal(importOutcome([failed, done]), ImportOutcome.attention);
  assert.equal(importOutcome([partial, done]), ImportOutcome.partial);
  assert.equal(importOutcome([done]), ImportOutcome.done);
});

test("the opening step reuses access, asks for credentials only when missing and never guesses a holder", () => {
  const ready = snapshotWith([]);
  assert.deepEqual(openingStep(ready), {
    personId: "self",
    step: WizardStep.authorize,
  });
  const missing = snapshotWith([], { profiles: [] });
  assert.deepEqual(openingStep(missing), {
    personId: "self",
    step: WizardStep.credentials,
  });
  const many = snapshotWith([], {
    people: [
      { id: "self", name: "Pessoa exemplo" },
      { id: "other", name: "Outra pessoa" },
    ],
  });
  assert.deepEqual(openingStep(many), {
    personId: null,
    step: WizardStep.holder,
  });
  assert.equal(accessStep(many, "other"), WizardStep.credentials);
  assert.deepEqual(openingStep(snapshotWith([], { people: [] })), {
    personId: null,
    step: WizardStep.person,
  });
});

test("going back keeps a saved person instead of starting over", () => {
  assert.equal(
    backStep({ created: true, multiple: true, step: WizardStep.credentials }),
    WizardStep.person,
  );
  assert.equal(
    backStep({ created: false, multiple: true, step: WizardStep.authorize }),
    WizardStep.holder,
  );
  assert.equal(
    backStep({ created: false, multiple: false, step: WizardStep.authorize }),
    null,
  );
  assert.equal(
    backStep({ created: false, multiple: true, step: WizardStep.review }),
    null,
  );
});

test("a single holder shows identity without a selector and states consent", () => {
  const markup = html(view({}));
  assert.ok(markup.includes("Pessoa exemplo"));
  assert.equal(markup.includes("aria-pressed"), false);
  assert.ok(markup.includes("Fechar a janela não revoga"));
  assert.ok(markup.includes('aria-current="step"'));
});

test("several holders can be chosen, and another person can be registered", () => {
  const snapshot = snapshotWith([], {
    people: [
      { id: "self", name: "Pessoa exemplo" },
      { id: "other", name: "Outra pessoa" },
    ],
  });
  const markup = html(
    view({ selected: "other", snapshot, step: WizardStep.holder }),
  );
  assert.ok(markup.includes('aria-pressed="true"'));
  assert.ok(markup.includes("Outra pessoa"));
  assert.ok(markup.includes("Cada pessoa usa o próprio acesso"));
});

test("a paused access explains how to recover instead of opening authorization", () => {
  const snapshot = snapshotWith([]);
  const [profile] = snapshot.profiles;
  const markup = html(
    view({
      profile: profile && { ...profile, enabled: false },
      snapshot,
    }),
  );
  assert.ok(markup.includes("pausado"));
  assert.ok(markup.includes("Ajustes"));
});

test("the person step leaves actions to the dialog and never carries credentials", () => {
  const markup = html(view({ person: undefined, step: WizardStep.person }));
  assert.ok(markup.includes('id="wizard-person"'));
  assert.equal(markup.includes("Salvar pessoa"), false);
  assert.ok(markup.includes("Nome da pessoa"));
  const credentials = html(view({ step: WizardStep.credentials }));
  assert.ok(credentials.includes('id="wizard-credentials"'));
  assert.ok(credentials.includes('type="password"'));
});

test("going back to the holder choice restores the unsaved person", () => {
  const markup = html(
    view({
      draft: { name: "Maria Sintética", photo: null },
      person: undefined,
      step: WizardStep.person,
    }),
  );
  assert.ok(markup.includes('value="Maria Sintética"'));
});

test("consent and review guidance use content size, not metadata size", () => {
  const consent = html(view({}));
  assert.equal(consent.includes('class="muted"'), false);
});

test("the review lists only the journey and offers the second action", () => {
  const journey = [connection({ id: "new", importStatus: null })];
  const markup = html(
    view({ journey, outcome: ImportOutcome.waiting, step: WizardStep.review }),
  );
  assert.ok(markup.includes("Autorizado"));
  assert.ok(markup.includes("Adicionar outro banco"));
  assert.ok(markup.includes("Nada é importado até você pedir"));
});

test("import results show failure recovery, duplicates and empty successes honestly", () => {
  const failed = connection({
    importError: "ACCOUNT_ALREADY_CONNECTED",
    importStatus: "failed",
    nextEligibleAt: "2999-01-01T00:00:00Z",
  });
  const attention = html(
    view({
      journey: [failed],
      outcome: ImportOutcome.attention,
      step: WizardStep.importing,
    }),
  );
  assert.ok(attention.includes("Reautorizar"));
  assert.ok(attention.includes("Nova tentativa a partir de"));
  assert.ok(attention.includes("precisa de atenção"));
  const empty = connection({
    hasTransactions: false,
    importStatus: "succeeded",
    partial: false,
  });
  const done = html(
    view({
      journey: [empty],
      outcome: ImportOutcome.done,
      step: WizardStep.importing,
    }),
  );
  assert.ok(done.includes("Importação concluída"));
  assert.ok(done.includes("Nenhum lançamento encontrado"));
  assert.equal(
    wizardTitle(WizardStep.importing, ImportOutcome.done),
    "Resultado da importação",
  );
});

test("a running import offers progress without claiming completion", () => {
  const markup = html(
    view({
      journey: [connection({ importStatus: "running" })],
      outcome: ImportOutcome.running,
      step: WizardStep.importing,
    }),
  );
  assert.ok(markup.includes("Importando"));
  assert.equal(markup.includes("Importação concluída"), false);
});
