import { asc, and, eq, sql, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { z } from "zod/v4";

import {
  type MigrationRequest,
  type WebhookEvent,
  type OperationInput,
  OperationInputSchema,
} from "#contracts/operation.ts";
import { localDay } from "#domain/exact.ts";
import { EMPTY_RULES } from "#domain/rules/rules.ts";
import { JsonValueSchema, parseJson } from "#shared/json.ts";
import {
  database,
  preparedStatement,
  hash,
  rows,
  statement,
} from "#worker/database.ts";
import { authorizedItems } from "#worker/finance/repository.ts";
import { saveRules, rulesFor } from "#worker/finance/rules.repository.ts";
import * as tables from "#worker/schema.ts";
import { resolveEvent } from "#worker/sync/events.ts";
import { migrateLegacy } from "#worker/sync/migration.ts";
import {
  type Operation,
  OperationSchema,
  ProgressSchema,
} from "#worker/sync/operation-storage.ts";
import { reapplyRules } from "#worker/sync/reapplication.ts";
import { synchronizeResources } from "#worker/sync/resources.ts";
import type {
  SchedulingStore,
  SynchronizationSession,
} from "#worker/sync/service.ts";

const JsonObjectSchema = z.record(z.string(), JsonValueSchema);

export async function startOperation(
  db: D1Database,
  requestKey: string,
  input: OperationInput,
) {
  input = OperationInputSchema.parse(input);
  const fingerprint = await hash(input);
  await authorizedItems(db, input.itemIds);
  const prior = await preparedStatement(
    db,
    database(db)
      .select()
      .from(tables.operations)
      .where(eq(tables.operations.request_key, requestKey)),
  ).first();
  if (prior) {
    const op = OperationSchema.parse(prior);
    if (op.input_hash !== fingerprint) throw new Error("IDEMPOTENCY_CONFLICT");
    return op;
  }
  let revision = await preparedStatement(
    db,
    database(db)
      .select({ active_rules: tables.settings.active_rules })
      .from(tables.settings)
      .where(eq(tables.settings.id, 1)),
  ).first("active_rules");
  if (!revision) {
    const initial = await saveRules(db, EMPTY_RULES, false);
    await preparedStatement(
      db,
      database(db)
        .update(tables.settings)
        .set({
          active_rules: sql`COALESCE(${tables.settings.active_rules}, ${initial.id})`,
        })
        .where(eq(tables.settings.id, 1)),
    ).run();
    revision = await preparedStatement(
      db,
      database(db)
        .select({ active_rules: tables.settings.active_rules })
        .from(tables.settings)
        .where(eq(tables.settings.id, 1)),
    ).first("active_rules");
  }
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  await preparedStatement(
    db,
    database(db)
      .insert(tables.operations)
      .values({
        id: id,
        request_key: requestKey,
        kind: input.kind,
        input: JSON.stringify(input),
        input_hash: fingerprint,
        rules_revision: z.string().parse(revision),
        reference_day: localDay(new Date(now)),
        created_at: now,
        updated_at: now,
      })
      .onConflictDoNothing(),
  ).run();
  const op = OperationSchema.parse(
    await preparedStatement(
      db,
      database(db)
        .select()
        .from(tables.operations)
        .where(eq(tables.operations.request_key, requestKey)),
    ).first(),
  );
  if (op.input_hash !== fingerprint) throw new Error("IDEMPOTENCY_CONFLICT");
  return op;
}

export async function operationState(db: D1Database, id: string) {
  const op = await getOperation(db, id);
  return {
    id: op.id,
    status: op.status,
    createdAt: op.created_at,
    updatedAt: op.updated_at,
    summary: op.phase + " " + op.progress,
    ...(op.status === "completed"
      ? { result: JsonObjectSchema.parse(parseJson(op.result ?? "{}")) }
      : {}),
    ...(op.status === "failed"
      ? { error: JsonObjectSchema.parse(parseJson(op.error ?? "{}")) }
      : {}),
  };
}

export async function getOperation(db: D1Database, id: string) {
  const op = OperationSchema.parse(
    await preparedStatement(
      db,
      database(db)
        .select()
        .from(tables.operations)
        .where(eq(tables.operations.id, id)),
    ).first(),
  );
  await authorizedItems(
    db,
    OperationInputSchema.parse(parseJson(op.input)).itemIds,
  );
  return op;
}

export async function stillWorking(db: D1Database, id: string) {
  return OperationSchema.parse(
    await preparedStatement(
      db,
      database(db)
        .select()
        .from(tables.operations)
        .where(eq(tables.operations.id, id)),
    ).first(),
  );
}
export async function finish(
  db: D1Database,
  op: Operation,
  status: "completed" | "cancelled",
  isError = false,
) {
  await db.batch([
    preparedStatement(
      db,
      database(db)
        .update(tables.operations)
        .set({
          status: status,
          phase: isError ? "error" : status,
          result: JSON.stringify({
            content: [
              {
                type: "text",
                text: isError
                  ? "Processing failed; committed data preserved. Consult coverage and retry reconciliation."
                  : "Processing finished.",
              },
            ],
            isError,
          }),
          updated_at: new Date().toISOString(),
        })
        .where(
          and(
            eq(tables.operations.id, op.id),
            eq(tables.operations.status, "working"),
          ),
        ),
    ),
    preparedStatement(
      db,
      database(db)
        .delete(tables.locks)
        .where(
          and(eq(tables.locks.id, 1), eq(tables.locks.operation_id, op.id)),
        ),
    ),
  ]);
}

export function schedulingStore(db: D1Database): SchedulingStore {
  return {
    async due(now) {
      return z
        .object({ next_sync_at: z.string(), reconcile_after: z.string() })
        .nullable()
        .parse(
          await statement(
            db,
            "SELECT next_sync_at,reconcile_after FROM settings WHERE id=1 AND sync_enabled=1 AND next_sync_at<=? AND NOT EXISTS(SELECT 1 FROM operations WHERE status='working')",
            now,
          ).first(),
        );
    },
    async enqueue(account, kind, next, reconcileAfter) {
      const items = await authorizedItems(db);
      if (!items.length) return null;
      const active = await statement(
        db,
        "SELECT id FROM operations WHERE status='working' LIMIT 1",
      ).first();
      if (active) return null;
      const op = await startOperation(db, "scheduled:" + account.next_sync_at, {
        kind,
        itemIds: items.map((item) => item.id),
      });
      // The durable operation and outbox exist before the next schedule advances.
      await statement(
        db,
        "UPDATE settings SET next_sync_at=?,reconcile_after=? WHERE id=1 AND next_sync_at=?",
        next,
        reconcileAfter,
        account.next_sync_at,
      ).run();
      return op;
    },
  };
}

// Bounded operational compaction only. Financial rows, rules, event IDs and task
// status/idempotency keys remain. Never delete an active executor checkpoint.
export async function compactOperations(db: D1Database, now = new Date()) {
  const before = new Date(now.getTime() - 30 * 86400000).toISOString();
  await db.batch([
    statement(
      db,
      "DELETE FROM checkpoints WHERE rowid IN (SELECT c.rowid FROM checkpoints c JOIN operations o ON o.id=c.operation_id WHERE o.status!='working' AND o.updated_at<? LIMIT 200)",
      before,
    ),
    statement(
      db,
      "UPDATE operations SET input=json_remove(input,'$.migration') WHERE id IN (SELECT id FROM operations WHERE status!='working' AND updated_at<? AND json_type(input,'$.migration') IS NOT NULL LIMIT 200)",
      before,
    ),
    statement(
      db,
      "DELETE FROM page_commits WHERE rowid IN (SELECT p.rowid FROM page_commits p JOIN operations o ON o.id=p.operation_id WHERE o.status!='working' AND o.updated_at<? LIMIT 200)",
      before,
    ),
    statement(
      db,
      "DELETE FROM operation_targets WHERE rowid IN (SELECT t.rowid FROM operation_targets t JOIN operations o ON o.id=t.operation_id WHERE o.status!='working' AND o.updated_at<? LIMIT 200)",
      before,
    ),
    statement(
      db,
      "UPDATE inbox SET payload='{}' WHERE event_id IN (SELECT event_id FROM inbox WHERE processed_at<? AND payload!='{}' LIMIT 200)",
      before,
    ),
  ]);
}

export async function openSynchronization(
  db: D1Database,
  id: string,
): Promise<SynchronizationSession> {
  const op = await stillWorking(db, id);
  const input = OperationInputSchema.parse(parseJson(op.input));
  const engine = await rulesFor(db, op.rules_revision);
  return {
    operation: {
      id: op.id,
      status: op.status,
      kind: input.kind,
    },
    cancelled: async () =>
      Boolean((await stillWorking(db, id)).cancel_requested),
    acquire: async () => {
      await preparedStatement(
        db,
        database(db)
          .insert(tables.locks)
          .values({ id: 1, operation_id: id })
          .onConflictDoNothing(),
      ).run();
      return (
        (await preparedStatement(
          db,
          database(db)
            .select({ operation_id: tables.locks.operation_id })
            .from(tables.locks)
            .where(eq(tables.locks.id, 1)),
        ).first("operation_id")) === id
      );
    },
    mature: async () => {
      await authorizedItems(db, input.itemIds);
      await db.batch([
        preparedStatement(
          db,
          database(db)
            .update(tables.entities)
            .set({ eligible: 1 })
            .where(
              and(
                inArray(tables.entities.item_id, input.itemIds),
                eq(tables.entities.eligible, 0),
                eq(tables.entities.deleted, 0),
                lte(tables.entities.transaction_date, op.reference_day),
                or(
                  isNull(tables.entities.status),
                  ne(tables.entities.status, "PENDING"),
                ),
              ),
            ),
        ),
        preparedStatement(
          db,
          database(db)
            .update(tables.settings)
            .set({ revision: sql`${tables.settings.revision} + 1` })
            .where(and(eq(tables.settings.id, 1), sql`changes() > 0`)),
        ),
      ]);
      return { phase: "matured" };
    },
    migrate: async (step) => {
      if (input.kind !== "migration")
        throw new Error("OPERATION_KIND_MISMATCH");
      const items = await authorizedItems(db, input.itemIds);
      await migrateLegacy({ db, op, input, items, engine, step });
    },
    reapply: async (step) => {
      if (input.kind !== "reapply") throw new Error("OPERATION_KIND_MISMATCH");
      const items = await authorizedItems(db, input.itemIds);
      return reapplyRules({ db, op, input, items, engine, step });
    },
    resolveEvent: async (provider, step) => {
      if (input.kind !== "webhook") throw new Error("OPERATION_KIND_MISMATCH");
      await authorizedItems(db, input.itemIds);
      return resolveEvent(db, op, provider, engine, input.eventId, step);
    },
    synchronize: async (provider, step) => {
      const items = await authorizedItems(db, input.itemIds);
      return synchronizeResources({
        db,
        op,
        input,
        items,
        engine,
        provider,
        step,
      });
    },
    hasErrors: async () =>
      ProgressSchema.parse(parseJson((await stillWorking(db, id)).progress))
        .errors > 0,
    finish: (status, isError = false) => finish(db, op, status, isError),
  };
}

export function createSyncRepository(db: D1Database) {
  return {
    async markDispatched(id: string) {
      await preparedStatement(
        db,
        database(db)
          .update(tables.operations)
          .set({ dispatched: 1 })
          .where(eq(tables.operations.id, id)),
      ).run();
    },
    async needsDispatch(id: string) {
      return Boolean(
        await preparedStatement(
          db,
          database(db)
            .select({ id: tables.operations.id })
            .from(tables.operations)
            .where(
              and(
                eq(tables.operations.id, id),
                eq(tables.operations.status, "working"),
                eq(tables.operations.dispatched, 0),
              ),
            ),
        ).first(),
      );
    },
    async operations(dispatched: boolean) {
      return rows(
        preparedStatement(
          db,
          database(db)
            .select({
              id: tables.operations.id,
              status: tables.operations.status,
            })
            .from(tables.operations)
            .where(
              and(
                eq(tables.operations.dispatched, Number(dispatched)),
                eq(tables.operations.status, "working"),
              ),
            )
            .orderBy(
              asc(
                dispatched
                  ? tables.operations.updated_at
                  : tables.operations.created_at,
              ),
            )
            .limit(100),
        ),
        OperationSchema.pick({ id: true, status: true }),
      );
    },
    async inbox() {
      return rows(
        preparedStatement(
          db,
          database(db)
            .select({
              event_id: tables.inbox.event_id,
              item_id: tables.inbox.item_id,
            })
            .from(tables.inbox)
            .where(isNull(tables.inbox.operation_id))
            .limit(100),
        ),
        z.object({
          event_id: z.string(),
          item_id: z.string(),
        }),
      );
    },
    async linkEvent(eventId: string, id: string) {
      await preparedStatement(
        db,
        database(db)
          .update(tables.inbox)
          .set({ operation_id: id })
          .where(
            and(
              eq(tables.inbox.event_id, eventId),
              isNull(tables.inbox.operation_id),
            ),
          ),
      ).run();
    },
    start: (key: string, input: OperationInput) =>
      startOperation(db, key, input),
    async finish(
      id: string,
      status: "completed" | "cancelled",
      error: boolean,
    ) {
      await finish(db, await stillWorking(db, id), status, error);
    },
    async cancel(id: string) {
      await getOperation(db, id);
      await preparedStatement(
        db,
        database(db)
          .update(tables.operations)
          .set({ cancel_requested: 1 })
          .where(
            and(
              eq(tables.operations.id, id),
              eq(tables.operations.status, "working"),
            ),
          ),
      ).run();
    },
    async acceptWebhook(event: WebhookEvent, receivedAt: string) {
      const item = await statement(
        db,
        "SELECT id FROM items WHERE id=? AND enabled=1 AND EXISTS(SELECT 1 FROM json_each(items.resources) WHERE value='transactions')",
        event.itemId,
      ).first();
      if (!item) return false;
      // Commit the receipt before ACK; cron recovers every undispatched receipt.
      const written = await preparedStatement(
        db,
        database(db)
          .insert(tables.inbox)
          .values({
            event_id: event.eventId,
            item_id: event.itemId,
            account_id: event.accountId,
            event: event.event,
            payload: JSON.stringify(event),
            received_at: receivedAt,
          })
          .onConflictDoNothing(),
      ).run();
      if (!written.success) throw new Error("INBOX_NOT_DURABLE");
      return true;
    },
    async migrationOverlaps(input: MigrationRequest) {
      const [item] = await authorizedItems(db, [input.itemId]);
      if (!item) throw new Error("ITEM_NOT_AUTHORIZED");
      const allowed = z.array(z.string()).parse(JSON.parse(item.resources));
      let overlaps = 0;
      for (const row of input.rows) {
        if (!allowed.includes(row.resource))
          throw new Error("RESOURCE_NOT_AUTHORIZED");
        const existing = await preparedStatement(
          db,
          database(db)
            .select({ normalized: tables.entities.normalized })
            .from(tables.entities)
            .where(
              and(
                eq(tables.entities.item_id, input.itemId),
                eq(tables.entities.resource, row.resource),
                eq(tables.entities.parent_id, row.parentId),
                eq(tables.entities.id, row.record.id),
              ),
            ),
        ).first("normalized");
        if (
          existing &&
          (await hash(JSON.parse(z.string().parse(existing)))) !==
            (await hash(row.record))
        )
          overlaps++;
      }
      return overlaps;
    },
    fingerprint: hash,
  };
}
