import assert from "node:assert/strict";
import test from "node:test";

import type { WizardState } from "../../../contracts";
import { accountState } from "../../../domain";
import { accountPanel, wizardIssue } from "../entity";

await test("financial failure overrides transport completion and setup never equates partial coverage to complete", () => {
  const evidence = {
    configured: true,
    connected: true,
    coverage: { complete: 1, total: 4 },
    latest: { phase: "error", status: "completed" },
    syncEnabled: true,
  } satisfies Parameters<typeof accountState>[0];
  assert.equal(accountState(evidence).sync, "error");
  assert.deepEqual(accountState(evidence).coverage, {
    complete: 1,
    total: 4,
  });
  assert.equal(accountState({ ...evidence, latest: null }).sync, "waiting");
  assert.equal(
    accountState({
      ...evidence,
      latest: { phase: "cancelled", status: "cancelled" },
    }).sync,
    "cancelled",
  );
  assert.equal(
    accountState({
      ...evidence,
      syncEnabled: false,
    }).paused,
    true,
  );
});

await test("wizard errors expose actionable issues without accepting arbitrary codes or provider text", () => {
  for (const [code, issue] of [
    ["UPSTREAM_AUTH", "credentials"],
    ["PLUGGY_ACCOUNT_NOT_CONFIGURED", "credentials"],
    ["CONNECT_RATE_LIMIT", "rate"],
    ["MEU_PLUGGY_REQUIRED", "connector"],
    ["UPSTREAM_TIMEOUT", "unavailable"],
    ["UPSTREAM_NETWORK", "unavailable"],
    ["UPSTREAM_UNAVAILABLE", "unavailable"],
    ["UPSTREAM_ERROR", "unavailable"],
    ["toString", "unknown"],
    ["__proto__", "unknown"],
    ["private upstream body", "unknown"],
  ] as const) {
    assert.equal(
      wizardIssue(Object.assign(new Error("private upstream body"), { code })),
      issue,
    );
  }
  assert.equal(wizardIssue(new Error("CONNECT_RATE_LIMIT")), "rate");
  assert.equal(
    wizardIssue(
      Object.assign(new Error("UPSTREAM_AUTH"), { code: "UNKNOWN_CODE" }),
    ),
    "unknown",
  );
});

await test("the backend decides sync outcome and polling without turning partial coverage into completion", () => {
  const state: WizardState = {
    connected: true,
    coverage: { complete: 1, total: 2 },
    credentials: true,
    paused: false,
    sync: "completed",
  };
  for (const [sync, paused, total, complete, outcome, interval] of [
    ["error", true, 2, 2, "failed", null],
    ["cancelled", true, 2, 2, "cancelled", null],
    ["completed", true, 2, 2, "paused", null],
    ["completed", false, 2, 1, "partial", null],
    ["completed", false, 0, 0, "partial", null],
    ["completed", false, 2, 2, "complete", null],
    ["working", true, 2, 1, "preparing", null],
    ["working", false, 2, 1, "preparing", 5000],
    ["waiting", false, 2, 1, "preparing", null],
  ] as const) {
    const panel = accountPanel({
      ...state,
      coverage: { complete, total },
      paused,
      sync,
    });
    assert.equal(panel.sync, outcome);
    assert.equal(panel.polling?.intervalMs ?? null, interval);
  }
  assert.deepEqual(accountPanel({ ...state, sync: "working" }).polling, {
    intervalMs: 5000,
    retryIntervalMs: 30_000,
  });
  assert.equal(accountPanel(state).initialStep, 2);
  const disconnected = accountPanel({
    ...state,
    connected: false,
    sync: "waiting",
  });
  assert.equal(disconnected.initialStep, 1);
  assert.equal(disconnected.polling, null);
});

await test("the backend diagnostic allowlist excludes private fields and retains actual partial coverage", () => {
  const state = {
    connected: true,
    coverage: { complete: 1, private: "synthetic-private-coverage", total: 4 },
    credentials: false,
    csrf: "synthetic-private-csrf",
    itemId: "synthetic-private-item",
    origin: "https://synthetic-private.test",
    paused: false,
    sourceMessage: "synthetic-private-message",
    sync: "error" as const,
  };
  const { diagnostic, connectorId } = accountPanel(state).support;
  assert.equal(diagnostic.credentials, false);
  assert.equal(diagnostic.coverage.complete, 1);
  assert.equal(connectorId, 200);
  assert.ok(!JSON.stringify(diagnostic).includes("synthetic-private"));
});
