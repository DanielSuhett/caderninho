import assert from "node:assert/strict";
import { test } from "node:test";

import {
  synchronizationStatus,
  syncRecentDuration,
} from "../account/sync-status";

const now = Date.parse("2026-10-26T18:00:00Z");
test("only an actual completion in the last three minutes gets success feedback", () => {
  const updatedAt = new Date(now - 1000).toISOString();
  assert.equal(synchronizationStatus({ now, updatedAt }).state, "recent");
  assert.equal(
    synchronizationStatus({ now: now + syncRecentDuration, updatedAt }).state,
    "idle",
  );
  assert.equal(
    synchronizationStatus({
      now,
      updatedAt: new Date(now + 1000).toISOString(),
    }).state,
    "idle",
  );
  assert.equal(synchronizationStatus({ now }).state, "idle");
  assert.equal(
    synchronizationStatus({ now, updatedAt: "invalid" }).state,
    "idle",
  );
});
test("running, failed and unavailable imports never look successfully synchronized", () => {
  const updatedAt = new Date(now - 1000).toISOString();
  assert.equal(
    synchronizationStatus({ now, syncing: true, updatedAt }).state,
    "syncing",
  );
  assert.equal(
    synchronizationStatus({ failed: true, now, updatedAt }).state,
    "failed",
  );
  assert.equal(
    synchronizationStatus({ now, unavailable: true, updatedAt }).state,
    "unavailable",
  );
  assert.equal(
    synchronizationStatus({ demo: true, now, syncing: true, updatedAt }).state,
    "example",
  );
});
