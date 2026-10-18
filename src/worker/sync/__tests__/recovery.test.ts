import assert from "node:assert/strict";
import test from "node:test";

import type { SyncRepository } from "../entity";
import { createSyncService } from "../service";

function unused(): never {
  throw new Error("UNEXPECTED_SYNTHETIC_CALL");
}

test("recovery reports unavailable status without finishing or losing pending dispatch", async () => {
  const dispatched: string[] = [];
  const notices: { error: Error; operationId?: string; phase: string }[] = [];
  const repository: SyncRepository = {
    acceptWebhook: unused,
    admit: unused,
    cancel: unused,
    claim: () => Promise.resolve(true),
    compact: unused,
    fingerprint: unused,
    finish: unused,
    markDispatched(id) {
      dispatched.push(id);
      return Promise.resolve();
    },
    migrationOverlaps: unused,
    needsDispatch: () => Promise.resolve(true),
    operations(sent) {
      return Promise.resolve([
        {
          id: sent ? "existing-operation" : "pending-operation",
          status: "working",
        },
      ]);
    },
    read: unused,
    start: unused,
    state: unused,
    states: unused,
  };
  const failure = new Error("synthetic-private-upstream-text");
  const service = createSyncService(
    repository,
    {
      create: () => Promise.resolve(),
      status: () => Promise.reject(failure),
    },
    () => new Date("2026-10-18T12:00:00Z"),
    (notice) => notices.push(notice),
  );
  await service.recover();
  assert.deepEqual(dispatched, ["pending-operation"]);
  assert.deepEqual(notices, [
    { error: failure, operationId: "existing-operation", phase: "status" },
  ]);
});
