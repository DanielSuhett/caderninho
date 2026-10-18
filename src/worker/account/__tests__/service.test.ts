import assert from "node:assert/strict";
import test from "node:test";

import { wizardIssue } from "#worker/account/errors.ts";
import { wizardState } from "#worker/account/service.ts";

await test("financial failure overrides transport completion and setup never equates partial coverage to complete", () => {
  const evidence = {
    config: { sync_enabled: 1, connected_at: "today" },
    items: [{ id: "synthetic-item" }],
    coverage: { total: 4, complete: 1 },
    latest: { status: "completed", phase: "error", updated_at: "now" },
  } satisfies Parameters<typeof wizardState>[0];
  assert.equal(wizardState(evidence, true).sync, "error");
  assert.deepEqual(wizardState(evidence, true).coverage, {
    total: 4,
    complete: 1,
  });
  assert.equal(
    wizardState({ ...evidence, latest: null }, true).sync,
    "waiting",
  );
  assert.equal(
    wizardState(
      {
        ...evidence,
        latest: { status: "cancelled", phase: "cancelled", updated_at: "now" },
      },
      true,
    ).sync,
    "cancelled",
  );
  assert.equal(
    wizardState(
      {
        ...evidence,
        config: { ...evidence.config, sync_enabled: 0 },
      },
      true,
    ).paused,
    true,
  );
});

await test("wizard errors expose actionable issues without accepting arbitrary codes or provider text", () => {
  for (const [code, issue] of [
    ["UPSTREAM_AUTH", "credentials"],
    ["PLUGGY_ACCOUNT_NOT_CONFIGURED", "credentials"],
    ["APPLICATION_CHANGE_REQUIRES_MIGRATION", "application"],
    ["CONNECT_RATE_LIMIT", "rate"],
    ["MEU_PLUGGY_REQUIRED", "connector"],
    ["ITEM_NOT_AUTHORIZED", "item"],
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
