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
    async connect(itemId: string, now: string) {
      await db.batch([
        db
          .update(settings)
          .set({
            sync_enabled: 1,
            next_sync_at: now,
            connected_at: now,
          })
          .where(eq(settings.id, 1)),
        db.insert(items).values({ id: itemId }).onConflictDoNothing(),
      ]);
    },
  };
}
export async function readPortalStatus(binding: D1Database) {
  const db = database(binding);
  const config = await db
    .select({
      sync_enabled: settings.sync_enabled,
      connected_at: settings.connected_at,
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
        status: operations.status,
        phase: operations.phase,
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
      total: count(),
      complete: sql<
        number | null
      >`sum(case when ${coverage.status} in ('available','empty') and ${coverage.bootstrap_complete}=1 then 1 else 0 end)`,
    })
    .from(coverage)
    .get();
  return {
    config,
    latest,
    items: connected,
    coverage: totals ?? { total: 0, complete: null },
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
          status: coverage.status,
          bootstrap_complete: coverage.bootstrap_complete,
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
    status: () => readPortalStatus(binding),
    async pause() {
      await db
        .update(settings)
        .set({ sync_enabled: 0 })
        .where(eq(settings.id, 1));
    },
    async resume(now: string) {
      await db
        .update(settings)
        .set({ sync_enabled: 1, next_sync_at: now })
        .where(and(eq(settings.id, 1), eq(settings.sync_enabled, 0)));
    },
    async requestSync(now: Date) {
      const result = await db
        .update(settings)
        .set({
          next_sync_at: now.toISOString(),
          manual_sync_after: new Date(
            now.getTime() + SYNC_POLICY.manualIntervalMs,
          ).toISOString(),
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
  };
}
