import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { connectionFixture, portalFixture } from "../../fixtures/workspace";
import { ScopePicker } from "../account/scope-picker";
import { isSearchShortcut } from "../account/search-shortcut";
import {
  nextSetupTask,
  SetupProgress,
  SetupTask,
  setupStatus,
} from "../account/setup-progress";

test("a fresh installation points at the access first", () => {
  const snapshot = portalFixture({ configured: false, connections: [] });
  const statuses = setupStatus(snapshot);
  assert.deepEqual(
    statuses.map((status) => status.done),
    [false, false, false],
  );
  assert.equal(nextSetupTask(statuses)?.id, SetupTask.access);
});

test("progress follows what D1 holds: access, authorized bank, then a succeeded import", () => {
  const authorized = portalFixture({
    connections: [connectionFixture({ importStatus: null })],
  });
  assert.equal(nextSetupTask(setupStatus(authorized))?.id, SetupTask.import);
  const running = portalFixture({
    connections: [connectionFixture({ importStatus: "running" })],
  });
  assert.equal(nextSetupTask(setupStatus(running))?.id, SetupTask.import);
  const finished = portalFixture({
    connections: [
      connectionFixture({ importStatus: "succeeded", partial: false }),
    ],
  });
  assert.equal(nextSetupTask(setupStatus(finished)), undefined);
});

test("the checklist marks one current step and disappears once everything is imported", () => {
  const html = renderToStaticMarkup(
    createElement(SetupProgress, {
      snapshot: portalFixture({
        connections: [connectionFixture({ importStatus: null })],
      }),
    }),
  );
  assert.ok(html.includes("Configure o Caderninho"));
  assert.ok(html.includes('aria-current="step"'));
  assert.ok(html.includes("wizard=import"));
  const done = renderToStaticMarkup(
    createElement(SetupProgress, {
      snapshot: portalFixture({
        connections: [
          connectionFixture({ importStatus: "succeeded", partial: false }),
        ],
      }),
    }),
  );
  assert.equal(done, "");
});

test("the scope picker marks the current owner and offers the create action beside it", () => {
  const html = renderToStaticMarkup(
    createElement(ScopePicker, {
      create: { label: "Outro grupo", onClick: () => undefined },
      currentId: "family",
      items: [
        { href: "/account/groups", id: "personal", name: "Pessoal" },
        { href: "/account/groups?space=family", id: "family", name: "Família" },
      ],
      label: "Grupos",
    }),
  );
  assert.ok(html.includes('aria-current="page"'));
  assert.ok(html.includes("Outro grupo"));
  assert.ok(html.includes('aria-label="Grupos"'));
});

test("the search shortcut ignores modifiers and anything already being typed in", () => {
  const key = { altKey: false, ctrlKey: false, key: "/", metaKey: false };
  assert.equal(isSearchShortcut({ ...key, target: null }), true);
  assert.equal(
    isSearchShortcut({ ...key, ctrlKey: true, target: null }),
    false,
  );
  assert.equal(isSearchShortcut({ ...key, key: "a", target: null }), false);
});
