import {
  and,
  eq,
  exists,
  inArray,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import {
  type OperationInput,
  OperationKind,
  OperationStatus,
} from "../../../contracts";
import {
  AdmissionStatus,
  assertIdempotency,
  assertOperationInput,
  type ItemAdmission,
  localDay,
  SYNC_POLICY,
} from "../../../domain";
import { hash } from "../../../shared";
import { database } from "../../database";
import { items, operations, settings } from "../../schema";
import type { AdmissionResult, Progress } from "../entity";
import { activeRules } from "./dispatch.repository";

function eligible(db: D1Database, now: string) {
  return and(
    or(isNull(items.next_import_at), lte(items.next_import_at, now)),
    notExists(
      database(db)
        .select({ id: operations.id })
        .from(operations)
        .where(
          and(
            eq(operations.id, items.cycle_id),
            eq(operations.status, OperationStatus.working),
          ),
        ),
    ),
    // Legacy active operations may predate the per-Item pointer.
    notExists(
      database(db)
        .select({ id: operations.id })
        .from(operations)
        .where(
          and(
            eq(operations.status, OperationStatus.working),
            inArray(operations.kind, [
              OperationKind.sync,
              OperationKind.reconcile,
              OperationKind.webhook,
            ]),
            sql`EXISTS (SELECT 1 FROM json_each(${operations.input}, '$.itemIds') WHERE value=${items.id})`,
          ),
        ),
    ),
  );
}

export async function admitOperation(
  db: D1Database,
  requestKey: string,
  input: OperationInput,
  now: Date,
): Promise<AdmissionResult> {
  assertOperationInput(input);
  if (
    input.kind !== OperationKind.sync &&
    input.kind !== OperationKind.reconcile
  ) {
    throw new Error("INGESTION_KIND_REQUIRED");
  }
  const orm = database(db);
  const fingerprint = await hash(input);
  const prior = await orm
    .select()
    .from(operations)
    .where(eq(operations.request_key, requestKey))
    .get();
  if (prior) {
    assertIdempotency({ actual: fingerprint, expected: prior.input_hash });
    return {
      items: await admissionStates(db, input.itemIds, now),
      operation: prior,
    };
  }
  const stamp = now.toISOString();
  // A reconcile request during cooldown records one bounded intention.
  if (input.kind === OperationKind.reconcile) {
    await orm
      .update(items)
      .set({ notice_generation: sql`${items.notice_generation}+1` })
      .where(
        and(
          inArray(items.id, input.itemIds),
          lte(items.notice_generation, items.notice_claimed),
        ),
      );
    if (input.renormalize) {
      await orm
        .update(items)
        .set({ renormalize_generation: items.notice_generation })
        .where(
          and(
            inArray(items.id, input.itemIds),
            sql`${items.renormalize_generation}<${items.notice_generation}`,
          ),
        );
    }
  }
  const config = await orm
    .select()
    .from(settings)
    .where(eq(settings.id, 1))
    .get();
  if (!config?.sync_enabled) {
    return {
      items: await admissionStates(db, input.itemIds, now),
      operation: null,
    };
  }
  const selected = await orm
    .select()
    .from(items)
    .where(and(inArray(items.id, input.itemIds), eligible(db, stamp)));
  if (!selected.length) {
    return {
      items: await admissionStates(db, input.itemIds, now),
      operation: null,
    };
  }
  const revision = await activeRules(db);
  const id = crypto.randomUUID();
  const ids = selected.map((item) => item.id);
  const kind = selected.some(
    (item) => item.notice_generation > item.notice_consumed,
  )
    ? OperationKind.reconcile
    : input.kind;
  const effectiveInput = {
    ...input,
    itemIds: ids,
    kind,
    ...(selected.some(
      (item) => item.renormalize_generation > item.notice_consumed,
    ) && { renormalize: true }),
  };
  const candidate = orm
    .select({
      cancel_requested: sql<number>`0`.as("cancel_requested"),
      compacted: sql<number>`0`.as("compacted"),
      created_at: sql<string>`${stamp}`.as("created_at"),
      dispatched: sql<number>`0`.as("dispatched"),
      error: sql<null>`NULL`.as("error"),
      execution_mode: sql<"durable">`'durable'`.as("execution_mode"),
      id: sql<string>`${id}`.as("id"),
      input: sql<OperationInput>`${JSON.stringify(effectiveInput)}`.as("input"),
      input_hash: sql<string>`${fingerprint}`.as("input_hash"),
      kind: sql<OperationInput["kind"]>`${kind}`.as("kind"),
      phase: sql<"queued">`'queued'`.as("phase"),
      progress: sql<Partial<Progress>>`'{}'`.as("progress"),
      reference_day: sql<string>`${localDay(now)}`.as("reference_day"),
      request_key: sql<string>`${requestKey}`.as("request_key"),
      result: sql<null>`NULL`.as("result"),
      rules_revision: sql<string>`${revision}`.as("rules_revision"),
      status: sql<"working">`'working'`.as("status"),
      updated_at: sql<string>`${stamp}`.as("updated_at"),
    })
    .from(settings)
    .where(
      and(
        eq(settings.id, 1),
        eq(settings.sync_enabled, 1),
        sql`(
    ${orm
      .select({ n: sql<number>`count(*)` })
      .from(items)
      .where(
        and(
          inArray(items.id, ids),
          eligible(db, stamp),
          or(
            ...selected.map((item) =>
              and(
                eq(items.id, item.id),
                eq(items.notice_generation, item.notice_generation),
                eq(items.renormalize_generation, item.renormalize_generation),
              ),
            ),
          ),
        ),
      )}
  ) = ${ids.length}`,
      ),
    );
  await orm.batch([
    orm.insert(operations).select(candidate).onConflictDoNothing(),
    orm
      .update(items)
      .set({
        cycle_id: id,
        last_admitted_at: stamp,
        next_import_at: new Date(
          now.getTime() + SYNC_POLICY.intervalMs,
        ).toISOString(),
        notice_claimed: items.notice_generation,
      })
      .where(
        and(
          inArray(items.id, ids),
          exists(
            orm
              .select({ id: operations.id })
              .from(operations)
              .where(eq(operations.id, id)),
          ),
        ),
      ),
  ]);
  const operation = await orm
    .select()
    .from(operations)
    .where(eq(operations.request_key, requestKey))
    .get();
  if (!operation) {
    // Another admission won the atomic condition. Recompute only the remaining Items.
    return admitOperation(db, requestKey, input, now);
  }
  assertIdempotency({ actual: fingerprint, expected: operation.input_hash });
  return {
    items: (await admissionStates(db, input.itemIds, now)).map((item) =>
      item.operationId === id
        ? { ...item, status: AdmissionStatus.started }
        : item,
    ),
    operation,
  };
}

export async function admissionStates(
  db: D1Database,
  ids: string[],
  now: Date,
): Promise<ItemAdmission[]> {
  const orm = database(db);
  const config = await orm
    .select({ enabled: settings.sync_enabled })
    .from(settings)
    .where(eq(settings.id, 1))
    .get();
  const rows = await orm
    .select({ item: items, status: operations.status })
    .from(items)
    .leftJoin(operations, eq(operations.id, items.cycle_id))
    .where(inArray(items.id, ids));
  return rows.map(({ item, status }) => ({
    itemId: item.id,
    nextEligibleAt: item.next_import_at,
    operationId: item.cycle_id,
    status:
      status === OperationStatus.working
        ? AdmissionStatus.working
        : admissionStatus(!!config?.enabled, item.next_import_at, now),
  }));
}

function admissionStatus(enabled: boolean, next: string | null, now: Date) {
  if (!enabled) {
    return AdmissionStatus.paused;
  }
  return next && next > now.toISOString()
    ? AdmissionStatus.cooldown
    : AdmissionStatus.eligible;
}
