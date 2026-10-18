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
} from "@/contracts/operation.types";
import { localDay } from "@/domain/exact";
import {
  assertIdempotency,
  assertOperationInput,
} from "@/domain/operation.entity";
import { EMPTY_RULES } from "@/domain/rules";
import { hash } from "@/shared/crypto";
import { connectedItems } from "@/worker/finance/repository";
import { saveRules } from "@/worker/finance/rules.repository";

import { database, required } from "../database";
import * as tables from "../schema";
import type { Operation, SchedulingStore, SyncRepository } from "./entity";

export async function startOperation(
  db: D1Database,
  requestKey: string,
  input: OperationInput,
) {
  assertOperationInput(input);
  const fingerprint = await hash(input);
  const prior = await database(db)
    .select()
    .from(tables.operations)
    .where(eq(tables.operations.request_key, requestKey))
    .get();
  if (prior) {
    const op = prior;
    assertIdempotency({ expected: op.input_hash, actual: fingerprint });
    return op;
  }
  let revision = await database(db)
    .select({ active_rules: tables.settings.active_rules })
    .from(tables.settings)
    .where(eq(tables.settings.id, 1))
    .get()
    .then((row) => row?.active_rules ?? null);
  if (!revision) {
    const initial = await saveRules(db, EMPTY_RULES, false);
    await database(db)
      .update(tables.settings)
      .set({
        active_rules: sql`COALESCE(${tables.settings.active_rules}, ${initial.id})`,
      })
      .where(eq(tables.settings.id, 1))
      .run();
    revision = await database(db)
      .select({ active_rules: tables.settings.active_rules })
      .from(tables.settings)
      .where(eq(tables.settings.id, 1))
      .get()
      .then((row) => row?.active_rules ?? null);
  }
  const id = crypto.randomUUID(),
    now = new Date().toISOString();
  await database(db)
    .insert(tables.operations)
    .values({
      id: id,
      request_key: requestKey,
      kind: input.kind,
      input: input,
      input_hash: fingerprint,
      rules_revision: required(revision ?? undefined),
      reference_day: localDay(new Date(now)),
      created_at: now,
      updated_at: now,
    })
    .onConflictDoNothing()
    .run();
  const op = required(
    await database(db)
      .select()
      .from(tables.operations)
      .where(eq(tables.operations.request_key, requestKey))
      .get(),
  );
  assertIdempotency({ expected: op.input_hash, actual: fingerprint });
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
    .from(tables.operations)
    .where(inArray(tables.operations.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => required(byId.get(id)));
  return ordered.map(operationSummary);
}

function operationSummary(op: Operation) {
  return {
    id: op.id,
    status: op.status,
    createdAt: op.created_at,
    updatedAt: op.updated_at,
    summary: `${op.phase} ${JSON.stringify(op.progress)}`,
    ...(op.status === OperationStatus.completed && { result: op.result ?? {} }),
    ...(op.status === OperationStatus.failed && { error: op.error ?? {} }),
  };
}

export async function getOperation(db: D1Database, id: string) {
  const op = required(
    await database(db)
      .select()
      .from(tables.operations)
      .where(eq(tables.operations.id, id))
      .get(),
  );
  return op;
}

export async function stillWorking(db: D1Database, id: string) {
  return required(
    await database(db)
      .select()
      .from(tables.operations)
      .where(eq(tables.operations.id, id))
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
      .update(tables.operations)
      .set({
        status: status,
        phase: isError ? OperationPhase.error : status,
        result: {
          content: [
            {
              type: "text",
              text: isError
                ? "Processing failed; committed data preserved. Consult coverage and retry reconciliation."
                : "Processing finished.",
            },
          ],
          isError,
        },
        updated_at: new Date().toISOString(),
      })
      .where(
        and(
          eq(tables.operations.id, op.id),
          eq(tables.operations.status, OperationStatus.working),
        ),
      ),
    database(db)
      .delete(tables.locks)
      .where(and(eq(tables.locks.id, 1), eq(tables.locks.operation_id, op.id))),
  ]);
}

export function schedulingStore(db: D1Database): SchedulingStore {
  return {
    async due(now) {
      return (
        (await database(db)
          .select({
            next_sync_at: tables.settings.next_sync_at,
            reconcile_after: tables.settings.reconcile_after,
          })
          .from(tables.settings)
          .where(
            and(
              eq(tables.settings.id, 1),
              eq(tables.settings.sync_enabled, 1),
              lte(tables.settings.next_sync_at, now),
              notExists(
                database(db)
                  .select({ one: sql`1` })
                  .from(tables.operations)
                  .where(eq(tables.operations.status, OperationStatus.working)),
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
        .select({ id: tables.operations.id })
        .from(tables.operations)
        .where(eq(tables.operations.status, OperationStatus.working))
        .limit(1)
        .get();
      if (active) {
        return null;
      }
      const op = await startOperation(db, `scheduled:${account.next_sync_at}`, {
        kind,
        itemIds: items.map((item) => item.id),
      });
      // The durable operation and outbox exist before the next schedule advances.
      await database(db)
        .update(tables.settings)
        .set({ next_sync_at: next, reconcile_after: reconcileAfter })
        .where(
          and(
            eq(tables.settings.id, 1),
            eq(tables.settings.next_sync_at, account.next_sync_at),
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
  const before = new Date(now.getTime() - 30 * 86400000).toISOString();
  await database(db).batch([
    database(db)
      .delete(tables.checkpoints)
      .where(
        inArray(
          sql`rowid`,
          database(db)
            .select({ rowid: sql<number>`${tables.checkpoints}.rowid` })
            .from(tables.checkpoints)
            .innerJoin(
              tables.operations,
              eq(tables.operations.id, tables.checkpoints.operation_id),
            )
            .where(
              and(
                ne(tables.operations.status, OperationStatus.working),
                lt(tables.operations.updated_at, before),
              ),
            )
            .limit(200),
        ),
      ),
    database(db)
      .select({ id: tables.operations.id })
      .from(tables.operations)
      .where(eq(tables.operations.status, OperationStatus.working))
      .limit(1),
    database(db)
      .delete(tables.page_commits)
      .where(
        inArray(
          sql`rowid`,
          database(db)
            .select({ rowid: sql<number>`${tables.page_commits}.rowid` })
            .from(tables.page_commits)
            .innerJoin(
              tables.operations,
              eq(tables.operations.id, tables.page_commits.operation_id),
            )
            .where(
              and(
                ne(tables.operations.status, OperationStatus.working),
                lt(tables.operations.updated_at, before),
              ),
            )
            .limit(200),
        ),
      ),
    database(db)
      .delete(tables.operation_targets)
      .where(
        inArray(
          sql`rowid`,
          database(db)
            .select({ rowid: sql<number>`${tables.operation_targets}.rowid` })
            .from(tables.operation_targets)
            .innerJoin(
              tables.operations,
              eq(tables.operations.id, tables.operation_targets.operation_id),
            )
            .where(
              and(
                ne(tables.operations.status, OperationStatus.working),
                lt(tables.operations.updated_at, before),
              ),
            )
            .limit(200),
        ),
      ),
    database(db)
      .update(tables.inbox)
      .set({ payload: {} })
      .where(
        inArray(
          tables.inbox.event_id,
          database(db)
            .select({ event_id: tables.inbox.event_id })
            .from(tables.inbox)
            .where(
              and(
                lt(tables.inbox.processed_at, before),
                ne(sql`${tables.inbox.payload}`, "{}"),
              ),
            )
            .limit(200),
        ),
      ),
  ]);
}

export function createSyncRepository(db: D1Database): SyncRepository {
  return {
    read: (id) => getOperation(db, id),
    state: (id) => operationState(db, id),
    states: (ids) => operationStates(db, ids),
    compact: () => compactOperations(db),
    async markDispatched(id: string) {
      await database(db)
        .update(tables.operations)
        .set({ dispatched: 1 })
        .where(eq(tables.operations.id, id))
        .run();
    },
    async needsDispatch(id: string) {
      return Boolean(
        await database(db)
          .select({ id: tables.operations.id })
          .from(tables.operations)
          .where(
            and(
              eq(tables.operations.id, id),
              eq(tables.operations.status, OperationStatus.working),
              eq(tables.operations.dispatched, 0),
            ),
          )
          .get(),
      );
    },
    async operations(dispatched: boolean) {
      return database(db)
        .select({
          id: tables.operations.id,
          status: tables.operations.status,
        })
        .from(tables.operations)
        .where(
          and(
            eq(tables.operations.dispatched, Number(dispatched)),
            eq(tables.operations.status, OperationStatus.working),
          ),
        )
        .orderBy(
          asc(
            dispatched
              ? tables.operations.updated_at
              : tables.operations.created_at,
          ),
        )
        .limit(100)
        .all();
    },
    async inbox() {
      return database(db)
        .select({
          event_id: tables.inbox.event_id,
          item_id: tables.inbox.item_id,
        })
        .from(tables.inbox)
        .where(isNull(tables.inbox.operation_id))
        .limit(100)
        .all();
    },
    async linkEvent(eventId: string, id: string) {
      await database(db)
        .update(tables.inbox)
        .set({ operation_id: id })
        .where(
          and(
            eq(tables.inbox.event_id, eventId),
            isNull(tables.inbox.operation_id),
          ),
        )
        .run();
    },
    start: (key: string, input: OperationInput) =>
      startOperation(db, key, input),
    async finish(id: string, status: FinishedOperationStatus, error: boolean) {
      await finish(db, await stillWorking(db, id), status, error);
    },
    async cancel(id: string) {
      await getOperation(db, id);
      await database(db)
        .update(tables.operations)
        .set({ cancel_requested: 1 })
        .where(
          and(
            eq(tables.operations.id, id),
            eq(tables.operations.status, OperationStatus.working),
          ),
        )
        .run();
    },
    async acceptWebhook(event: WebhookEvent, receivedAt: string) {
      const item = await database(db)
        .select({ id: tables.items.id })
        .from(tables.items)
        .where(eq(tables.items.id, event.itemId))
        .get();
      if (!item) {
        return false;
      }
      // Commit the receipt before ACK; cron recovers every undispatched receipt.
      await database(db)
        .insert(tables.inbox)
        .values({
          event_id: event.eventId,
          item_id: event.itemId,
          account_id: event.accountId,
          event: event.event,
          payload: event,
          received_at: receivedAt,
        })
        .onConflictDoNothing()
        .run();
      return true;
    },
    async migrationOverlaps(input: MigrationRequest) {
      let overlaps = 0;
      for (const row of input.rows) {
        const existing = await database(db)
          .select({ normalized: tables.entities.normalized })
          .from(tables.entities)
          .where(
            and(
              eq(tables.entities.item_id, input.itemId),
              eq(tables.entities.resource, row.resource),
              eq(tables.entities.parent_id, row.parentId),
              eq(tables.entities.id, row.record.id),
            ),
          )
          .get()
          .then((row) => row?.normalized ?? null);
        if (existing && (await hash(existing)) !== (await hash(row.record))) {
          overlaps++;
        }
      }
      return overlaps;
    },
    fingerprint: hash,
  };
}
