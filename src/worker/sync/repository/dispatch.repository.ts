import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  notExists,
  sql,
} from "drizzle-orm";

import {
  type FinishedOperationStatus,
  type MigrationRequest,
  type OperationInput,
  OperationPhase,
  OperationStatus,
  type WebhookEvent,
} from "../../../contracts";
import {
  assertIdempotency,
  assertOperationInput,
  localDay,
} from "../../../domain";
import { EMPTY_RULES } from "../../../domain/rules";
import { hash } from "../../../shared";
import { database, required } from "../../database";
import { connectedItems, saveRules } from "../../finance/repository";
import {
  checkpoints as checkpointsTable,
  entities as entitiesTable,
  inbox as inboxTable,
  items as itemsTable,
  locks as locksTable,
  operations as operationsTable,
  operation_targets as operationTargetsTable,
  page_commits as pageCommitsTable,
  settings as settingsTable,
} from "../../schema";
import type { Operation, SchedulingStore, SyncRepository } from "../entity";

export async function startOperation(
  db: D1Database,
  requestKey: string,
  input: OperationInput,
) {
  assertOperationInput(input);
  const fingerprint = await hash(input);
  const prior = await database(db)
    .select()
    .from(operationsTable)
    .where(eq(operationsTable.request_key, requestKey))
    .get();
  if (prior) {
    const op = prior;
    assertIdempotency({ actual: fingerprint, expected: op.input_hash });
    return op;
  }
  let revision = await database(db)
    .select({ active_rules: settingsTable.active_rules })
    .from(settingsTable)
    .where(eq(settingsTable.id, 1))
    .get()
    .then((row) => row?.active_rules ?? null);
  if (!revision) {
    const initial = await saveRules(db, EMPTY_RULES, false);
    await database(db)
      .update(settingsTable)
      .set({
        active_rules: sql`COALESCE(${settingsTable.active_rules}, ${initial.id})`,
      })
      .where(eq(settingsTable.id, 1))
      .run();
    revision = await database(db)
      .select({ active_rules: settingsTable.active_rules })
      .from(settingsTable)
      .where(eq(settingsTable.id, 1))
      .get()
      .then((row) => row?.active_rules ?? null);
  }
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  await database(db)
    .insert(operationsTable)
    .values({
      created_at: now,
      id,
      input,
      input_hash: fingerprint,
      kind: input.kind,
      reference_day: localDay(new Date(now)),
      request_key: requestKey,
      rules_revision: required(revision ?? undefined),
      updated_at: now,
    })
    .onConflictDoNothing()
    .run();
  const op = required(
    await database(db)
      .select()
      .from(operationsTable)
      .where(eq(operationsTable.request_key, requestKey))
      .get(),
  );
  assertIdempotency({ actual: fingerprint, expected: op.input_hash });
  return op;
}

export async function operationState(db: D1Database, id: string) {
  return operationSummary(await getOperation(db, id));
}

export async function operationStates(db: D1Database, ids: string[]) {
  if (!ids.length) {
    return [];
  }
  const rows = await database(db)
    .select()
    .from(operationsTable)
    .where(inArray(operationsTable.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => required(byId.get(id)));
  return ordered.map(operationSummary);
}

function operationSummary(op: Operation) {
  return {
    createdAt: op.created_at,
    id: op.id,
    status: op.status,
    summary: `${op.phase} ${JSON.stringify(op.progress)}`,
    updatedAt: op.updated_at,
    ...(op.status === OperationStatus.completed && { result: op.result ?? {} }),
    ...(op.status === OperationStatus.failed && { error: op.error ?? {} }),
  };
}

export async function getOperation(db: D1Database, id: string) {
  const op = required(
    await database(db)
      .select()
      .from(operationsTable)
      .where(eq(operationsTable.id, id))
      .get(),
  );
  return op;
}

export async function stillWorking(db: D1Database, id: string) {
  return required(
    await database(db)
      .select()
      .from(operationsTable)
      .where(eq(operationsTable.id, id))
      .get(),
  );
}
export async function finish(
  db: D1Database,
  op: Operation,
  status: FinishedOperationStatus,
  isError = false,
) {
  await database(db).batch([
    database(db)
      .update(operationsTable)
      .set({
        phase: isError ? OperationPhase.error : status,
        result: {
          content: [
            {
              text: isError
                ? "Processing failed; committed data preserved. Consult coverage and retry reconciliation."
                : "Processing finished.",
              type: "text",
            },
          ],
          isError,
        },
        status,
        updated_at: new Date().toISOString(),
      })
      .where(
        and(
          eq(operationsTable.id, op.id),
          eq(operationsTable.status, OperationStatus.working),
        ),
      ),
    database(db)
      .delete(locksTable)
      .where(and(eq(locksTable.id, 1), eq(locksTable.operation_id, op.id))),
  ]);
}

export function schedulingStore(db: D1Database): SchedulingStore {
  return {
    async due(now) {
      return (
        (await database(db)
          .select({
            next_sync_at: settingsTable.next_sync_at,
            reconcile_after: settingsTable.reconcile_after,
          })
          .from(settingsTable)
          .where(
            and(
              eq(settingsTable.id, 1),
              eq(settingsTable.sync_enabled, 1),
              lte(settingsTable.next_sync_at, now),
              notExists(
                database(db)
                  .select({ one: sql`1` })
                  .from(operationsTable)
                  .where(eq(operationsTable.status, OperationStatus.working)),
              ),
            ),
          )
          .get()) ?? null
      );
    },
    async enqueue(account, kind, next, reconcileAfter) {
      const items = await connectedItems(db);
      if (!items.length) {
        return null;
      }
      const active = await database(db)
        .select({ id: operationsTable.id })
        .from(operationsTable)
        .where(eq(operationsTable.status, OperationStatus.working))
        .limit(1)
        .get();
      if (active) {
        return null;
      }
      const op = await startOperation(db, `scheduled:${account.next_sync_at}`, {
        itemIds: items.map((item) => item.id),
        kind,
      });
      // The durable operation and outbox exist before the next schedule advances.
      await database(db)
        .update(settingsTable)
        .set({ next_sync_at: next, reconcile_after: reconcileAfter })
        .where(
          and(
            eq(settingsTable.id, 1),
            eq(settingsTable.next_sync_at, account.next_sync_at),
          ),
        )
        .run();
      return op;
    },
  };
}

// Bounded operational compaction only. Financial rows, rules, event IDs and task
// status/idempotency keys remain. Never delete an active executor checkpoint.
export async function compactOperations(db: D1Database, now = new Date()) {
  const before = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  await database(db).batch([
    database(db)
      .delete(checkpointsTable)
      .where(
        inArray(
          sql`rowid`,
          database(db)
            .select({ rowid: sql<number>`${checkpointsTable}.rowid` })
            .from(checkpointsTable)
            .innerJoin(
              operationsTable,
              eq(operationsTable.id, checkpointsTable.operation_id),
            )
            .where(
              and(
                ne(operationsTable.status, OperationStatus.working),
                lt(operationsTable.updated_at, before),
              ),
            )
            .limit(200),
        ),
      ),
    database(db)
      .select({ id: operationsTable.id })
      .from(operationsTable)
      .where(eq(operationsTable.status, OperationStatus.working))
      .limit(1),
    database(db)
      .delete(pageCommitsTable)
      .where(
        inArray(
          sql`rowid`,
          database(db)
            .select({ rowid: sql<number>`${pageCommitsTable}.rowid` })
            .from(pageCommitsTable)
            .innerJoin(
              operationsTable,
              eq(operationsTable.id, pageCommitsTable.operation_id),
            )
            .where(
              and(
                ne(operationsTable.status, OperationStatus.working),
                lt(operationsTable.updated_at, before),
              ),
            )
            .limit(200),
        ),
      ),
    database(db)
      .delete(operationTargetsTable)
      .where(
        inArray(
          sql`rowid`,
          database(db)
            .select({ rowid: sql<number>`${operationTargetsTable}.rowid` })
            .from(operationTargetsTable)
            .innerJoin(
              operationsTable,
              eq(operationsTable.id, operationTargetsTable.operation_id),
            )
            .where(
              and(
                ne(operationsTable.status, OperationStatus.working),
                lt(operationsTable.updated_at, before),
              ),
            )
            .limit(200),
        ),
      ),
    database(db)
      .update(inboxTable)
      .set({ payload: {} })
      .where(
        inArray(
          inboxTable.event_id,
          database(db)
            .select({ event_id: inboxTable.event_id })
            .from(inboxTable)
            .where(
              and(
                lt(inboxTable.processed_at, before),
                ne(sql`${inboxTable.payload}`, "{}"),
              ),
            )
            .limit(200),
        ),
      ),
  ]);
}

export function createSyncRepository(db: D1Database): SyncRepository {
  return {
    async acceptWebhook(event: WebhookEvent, receivedAt: string) {
      const item = await database(db)
        .select({ id: itemsTable.id })
        .from(itemsTable)
        .where(eq(itemsTable.id, event.itemId))
        .get();
      if (!item) {
        return false;
      }
      // Commit the receipt before ACK; cron recovers every undispatched receipt.
      await database(db)
        .insert(inboxTable)
        .values({
          account_id: event.accountId,
          event: event.event,
          event_id: event.eventId,
          item_id: event.itemId,
          payload: event,
          received_at: receivedAt,
        })
        .onConflictDoNothing()
        .run();
      return true;
    },
    async cancel(id: string) {
      await getOperation(db, id);
      await database(db)
        .update(operationsTable)
        .set({ cancel_requested: 1 })
        .where(
          and(
            eq(operationsTable.id, id),
            eq(operationsTable.status, OperationStatus.working),
          ),
        )
        .run();
    },
    compact: () => compactOperations(db),
    fingerprint: hash,
    async finish(id: string, status: FinishedOperationStatus, error: boolean) {
      await finish(db, await stillWorking(db, id), status, error);
    },
    async inbox() {
      return await database(db)
        .select({
          event_id: inboxTable.event_id,
          item_id: inboxTable.item_id,
        })
        .from(inboxTable)
        .where(isNull(inboxTable.operation_id))
        .limit(100)
        .all();
    },
    async linkEvent(eventId: string, id: string) {
      await database(db)
        .update(inboxTable)
        .set({ operation_id: id })
        .where(
          and(
            eq(inboxTable.event_id, eventId),
            isNull(inboxTable.operation_id),
          ),
        )
        .run();
    },
    async markDispatched(id: string) {
      await database(db)
        .update(operationsTable)
        .set({ dispatched: 1 })
        .where(eq(operationsTable.id, id))
        .run();
    },
    async migrationOverlaps(input: MigrationRequest) {
      let overlaps = 0;
      await input.rows.reduce(async (previous, row) => {
        await previous;
        const existing = await database(db)
          .select({ normalized: entitiesTable.normalized })
          .from(entitiesTable)
          .where(
            and(
              eq(entitiesTable.item_id, input.itemId),
              eq(entitiesTable.resource, row.resource),
              eq(entitiesTable.parent_id, row.parentId),
              eq(entitiesTable.id, row.record.id),
            ),
          )
          .get()
          .then((stored) => stored?.normalized ?? null);
        if (existing && (await hash(existing)) !== (await hash(row.record))) {
          overlaps += 1;
        }
      }, Promise.resolve());
      return overlaps;
    },
    async needsDispatch(id: string) {
      return Boolean(
        await database(db)
          .select({ id: operationsTable.id })
          .from(operationsTable)
          .where(
            and(
              eq(operationsTable.id, id),
              eq(operationsTable.status, OperationStatus.working),
              eq(operationsTable.dispatched, 0),
            ),
          )
          .get(),
      );
    },
    async operations(dispatched: boolean) {
      return await database(db)
        .select({
          id: operationsTable.id,
          status: operationsTable.status,
        })
        .from(operationsTable)
        .where(
          and(
            eq(operationsTable.dispatched, Number(dispatched)),
            eq(operationsTable.status, OperationStatus.working),
          ),
        )
        .orderBy(
          asc(
            dispatched
              ? operationsTable.updated_at
              : operationsTable.created_at,
          ),
        )
        .limit(100)
        .all();
    },
    read: (id) => getOperation(db, id),
    start: (key: string, input: OperationInput) =>
      startOperation(db, key, input),
    state: (id) => operationState(db, id),
    states: (ids) => operationStates(db, ids),
  };
}
