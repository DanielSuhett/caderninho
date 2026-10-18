import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import { OperationKind } from "../../../contracts";
import { tryCatch } from "../../../shared";
import { database } from "../../database";
import {
  coverage,
  items,
  local_runs,
  login_attempts,
  operations,
  portal_sessions,
  settings,
} from "../../schema";
import type { AccountRepository } from "../entity";

function connectionStore(binding: D1Database) {
  const db = database(binding);
  return {
    async connect(itemId: string, now: string) {
      await db.batch([
        db.insert(items).values({ id: itemId }).onConflictDoNothing(),
        db
          .update(settings)
          .set({
            connected_at: sql`CASE WHEN ${settings.connected_at}='1970-01-01T00:00:00.000Z' THEN ${now} ELSE ${settings.connected_at} END`,
            next_sync_at: now,
            sync_enabled: sql`CASE WHEN ${settings.connected_at}='1970-01-01T00:00:00.000Z' THEN 1 ELSE ${settings.sync_enabled} END`,
          })
          .where(and(eq(settings.id, 1), sql`changes()>0`)),
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
        dispatched: operations.dispatched,
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
  const connected = await db.select().from(items).orderBy(items.id);
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
    localApplications: await db
      .select({
        batch: local_runs.next_batch,
        operationId: operations.id,
        totalProcessed: sql<number>`COALESCE(json_extract(${operations.progress},'$.classified'),0)`,
      })
      .from(operations)
      .innerJoin(local_runs, eq(local_runs.operation_id, operations.id))
      .where(
        and(
          eq(operations.status, "working"),
          eq(operations.execution_mode, "local"),
          eq(operations.phase, "reapply"),
        ),
      )
      .limit(10),
  };
}
const missingSchemaPattern = /no such (?:table|column):/;

function missingSchema(error: Error) {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (missingSchemaPattern.test(current.message)) {
      return true;
    }
    if (!(current.cause instanceof Error)) {
      return false;
    }
    current = current.cause;
  }
  return false;
}

export async function migrationsReady(
  binding: D1Database,
  onFailure?: (error: Error) => void,
) {
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
  if (error && !missingSchema(error)) {
    onFailure?.(error);
  }
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
        .where(and(eq(settings.id, 1), eq(settings.sync_enabled, 1)));
    },
    async requestSync(now: Date) {
      const eligible = await db
        .select({ id: items.id })
        .from(items)
        .where(
          and(
            or(
              isNull(items.next_import_at),
              lte(items.next_import_at, now.toISOString()),
            ),
            notExists(
              db
                .select({ id: operations.id })
                .from(operations)
                .where(
                  and(
                    eq(operations.id, items.cycle_id),
                    eq(operations.status, "working"),
                  ),
                ),
            ),
          ),
        )
        .limit(1)
        .get();
      if (!eligible) {
        return false;
      }
      const result = await db
        .update(settings)
        .set({ next_sync_at: now.toISOString() })
        .where(and(eq(settings.id, 1), eq(settings.sync_enabled, 1)))
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
