import assert from "node:assert/strict";
import test from "node:test";

import { wizardIssue } from "#worker/account/errors.ts";
import { wizardState } from "#worker/account/service.ts";

await test("financial failure overrides transport completion and setup never equates partial coverage to complete", () => {
  const evidence = {
    config: { sync_enabled: 1, connected_at: "today" },
    items: [{ id: "synthetic-item" }],
    coverage: { total: 4, complete: 1 },
    latest: { status: "completed" as const, phase: "error", updated_at: "now" },
  };
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
  for (const code of [
    "UPSTREAM_TIMEOUT",
    "UPSTREAM_NETWORK",
    "UPSTREAM_UNAVAILABLE",
    "UPSTREAM_ERROR",
  ]) {
    assert.equal(
      wizardIssue(Object.assign(new Error("private upstream body"), { code })),
      "unavailable",
    );
  }
});
