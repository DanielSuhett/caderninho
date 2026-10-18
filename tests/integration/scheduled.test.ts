import assert from "node:assert/strict";

import { eq } from "drizzle-orm";
import { beforeEach, test } from "vitest";

import worker from "../../src/worker";
import { database } from "../../src/worker/database";
import { operations, page_commits } from "../../src/worker/schema";
import { startOperation } from "../../src/worker/sync/repository";
import { settings, testMigrations } from "./personal-fixture";
import {
  applyD1Migrations,
  createScheduledController,
  reset,
} from "cloudflare:test";
import { env } from "cloudflare:workers";

beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, testMigrations);
});

test("daily execution recovers pending dispatch and retains active receipts", async () => {
  const config = settings();
  const db = database(env.DB);
  const old = await startOperation(env.DB, "old", {
    itemIds: ["synthetic"],
    kind: "sync",
  });
  await db
    .update(operations)
    .set({ status: "completed", updated_at: "2000-01-01T00:00:00Z" })
    .where(eq(operations.id, old.id));
  await db.insert(page_commits).values({
    operation_id: old.id,
    progress: { cancelled: false, done: true },
    step_key: "old-page",
  });
  const pending = await startOperation(env.DB, "pending", {
    itemIds: ["synthetic"],
    kind: "sync",
  });
  await db.insert(page_commits).values({
    operation_id: pending.id,
    progress: { cancelled: false, done: true },
    step_key: "active-page",
  });

  await worker.scheduled(
    createScheduledController({
      scheduledTime: Date.parse("2026-10-18T12:37:00Z"),
    }),
    config,
  );
  assert.equal(
    (
      await db
        .select()
        .from(operations)
        .where(eq(operations.id, pending.id))
        .get()
    )?.dispatched,
    1,
  );

  const remaining = await db.select().from(page_commits);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]?.operation_id, pending.id);
  assert.equal((await db.select().from(operations)).length, 2);
});
