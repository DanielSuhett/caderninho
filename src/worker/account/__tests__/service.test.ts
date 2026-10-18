import assert from "node:assert/strict";
import test from "node:test";

import { wizardIssue } from "#worker/account/errors.ts";
import { wizardState } from "#worker/account/service.ts";

await test("financial failure overrides transport completion and setup never equates partial coverage to complete", () => {
  const evidence = {
    status: { config: { enabled: 1 }, items: [{ id: "synthetic-item" }] },
    coverage: { total: 4, complete: 1 },
    latest: { status: "completed", phase: "error" },
  };
  assert.equal(wizardState(evidence).sync, "error");
  assert.deepEqual(wizardState(evidence).coverage, { total: 4, complete: 1 });
  assert.equal(wizardState({ ...evidence, latest: null }).sync, "waiting");
  assert.equal(
    wizardState({
      ...evidence,
      latest: { status: "cancelled", phase: "cancelled" },
    }).sync,
    "cancelled",
  );
  assert.equal(
    wizardState({
      ...evidence,
      status: { ...evidence.status, config: { enabled: 0 } },
    }).paused,
    true,
  );
  for (const code of [
    "UPSTREAM_TIMEOUT",
    "UPSTREAM_NETWORK",
    "UPSTREAM_UNAVAILABLE",
    "UPSTREAM_ERROR",
  ])
    assert.equal(
      wizardIssue(Object.assign(new Error("private upstream body"), { code })),
      "unavailable",
    );
});
