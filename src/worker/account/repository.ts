import { and, count, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";

import { OperationKind } from "@/contracts/operation.types";
import { SYNC_POLICY } from "@/domain/operation.entity";
import { tryCatch } from "@/shared/result";

import { database } from "../database";
import {
  coverage,
  items,
  login_attempts,
  operations,
  portal_sessions,
  settings,
} from "../schema";
import type { AccountRepository } from "./entity";

function connectionStore(binding: D1Database) {
  const db = database(binding);
  return {
    async connect(itemId: string, now: string) {
      await db.batch([
        db
          .update(settings)
          .set({
            connected_at: now,
            next_sync_at: now,
            sync_enabled: 1,
          })
          .where(eq(settings.id, 1)),
        db.insert(items).values({ id: itemId }).onConflictDoNothing(),
      ]);
    },
    async connectionCount(itemId: string) {
      const row = await db.select({ count: count() }).from(items).get();
      return {
        count: row?.count ?? 0,
        exists: Boolean(
          await db
            .select({ id: items.id })
            .from(items)
            .where(eq(items.id, itemId))
            .get(),
        ),
      };
    },
  };
}
export async function readPortalStatus(binding: D1Database) {
  const db = database(binding);
  const config = await db
    .select({
      connected_at: settings.connected_at,
      sync_enabled: settings.sync_enabled,
    })
    .from(settings)
    .where(eq(settings.id, 1))
    .get();
  if (!config) {
    throw new Error("SETTINGS_MISSING");
  }
  const latest =
    (await db
      .select({
        phase: operations.phase,
        status: operations.status,
        updated_at: operations.updated_at,
      })
      .from(operations)
      .where(
        and(
          inArray(operations.kind, [
            OperationKind.sync,
            OperationKind.reconcile,
          ]),
          gte(operations.created_at, config.connected_at),
        ),
      )
      .orderBy(desc(operations.created_at))
      .limit(1)
      .get()) ?? null;
  const connected = await db
    .select({ id: items.id })
    .from(items)
    .orderBy(items.id);
  const totals = await db
    .select({
      complete: sql<
        number | null
      >`sum(case when ${coverage.status} in ('available','empty') and ${coverage.bootstrap_complete}=1 then 1 else 0 end)`,
      total: count(),
    })
    .from(coverage)
    .get();
  return {
    config,
    coverage: totals ?? { complete: null, total: 0 },
    items: connected,
    latest,
  };
}
export async function migrationsReady(binding: D1Database) {
  const db = database(binding);
  const { data: _data, error } = await tryCatch(() =>
    db.batch([
      db.select().from(portal_sessions).limit(0),
      db.select().from(login_attempts).limit(0),
      db.select().from(settings).limit(0),
      db
        .select({
          bootstrap_complete: coverage.bootstrap_complete,
          status: coverage.status,
        })
        .from(coverage)
        .limit(0),
    ]),
  );
  return !error;
}
export function createAccountRepository(
  binding: D1Database,
): AccountRepository {
  const db = database(binding);
  return {
    connection: connectionStore(binding),
    async pause() {
      await db
        .update(settings)
        .set({ sync_enabled: 0 })
        .where(eq(settings.id, 1));
    },
    async requestSync(now: Date) {
      const result = await db
        .update(settings)
        .set({
          manual_sync_after: new Date(
            now.getTime() + SYNC_POLICY.manualIntervalMs,
          ).toISOString(),
          next_sync_at: now.toISOString(),
        })
        .where(
          and(
            eq(settings.id, 1),
            eq(settings.sync_enabled, 1),
            lte(settings.manual_sync_after, now.toISOString()),
            gt(settings.next_sync_at, now.toISOString()),
          ),
        )
        .run();
      return result.meta.changes === 1;
    },
    async resume(now: string) {
      await db
        .update(settings)
        .set({ next_sync_at: now, sync_enabled: 1 })
        .where(and(eq(settings.id, 1), eq(settings.sync_enabled, 0)));
    },
    status: () => readPortalStatus(binding),
  };
}
