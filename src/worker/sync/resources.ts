import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  type OperationInput,
  OperationKind,
  OperationPhase,
  OperationStatus,
} from "#contracts/operation.types.ts";
import {
  AccountType,
  CoverageStatus,
  Resource,
  TransactionStatus,
} from "#domain/enums.ts";
import { DEFINITIONS } from "#domain/finance-model.ts";
import { itemInfo, productState } from "#domain/provider-state.ts";
import type { EntityPreparer } from "#worker/composition.ts";
import { database } from "#worker/database.ts";
import { authorizedItems } from "#worker/finance/repository.ts";
import type { rulesFor } from "#worker/finance/rules.repository.ts";
import * as tables from "#worker/schema.ts";
import { publishResolved } from "#worker/sync/events.ts";
import type { Operation } from "#worker/sync/operation-storage.ts";
import { publishPage } from "#worker/sync/publication.ts";
import { finish, stillWorking } from "#worker/sync/repository.ts";
import type { FinancialSource, Steps } from "#worker/sync/service.ts";

const resourceOrder: Resource[] = [
  Resource.connections,
  Resource.consents,
  Resource.resources,
  Resource.connectors,
  Resource.categories,
  Resource.accounts,
  Resource.investments,
  Resource.loans,
  Resource.identity,
  Resource.transactions,
  Resource.bills,
  Resource.investment_transactions,
  Resource.statements,
];
type ResourceSyncInput = {
  db: D1Database;
  op: Operation;
  input: OperationInput;
  items: Pick<typeof tables.items.$inferSelect, "id" | "resources">[];
  engine: Awaited<ReturnType<typeof rulesFor>>;
  prepare: EntityPreparer;
  step: Steps;
  provider: Pick<FinancialSource, "page" | "ids">;
};

export async function synchronizeResources({
  db,
  op,
  input,
  items,
  engine,
  prepare,
  step,
  provider,
}: ResourceSyncInput) {
  for (const item of items) {
    const allowed = item.resources;
    for (const resource of resourceOrder) {
      if (!allowed.includes(resource)) {
        continue;
      }
      if (
        await synchronizeItemResource(db, {
          op,
          input,
          item,
          resource,
          engine,
          prepare,
          step,
          provider,
        })
      ) {
        return true;
      }
    }
  }
  return resolvePendingTransactions(db, {
    op,
    items,
    engine,
    prepare,
    step,
    provider,
  });
}

async function synchronizeItemResource(
  db: D1Database,
  {
    op,
    input,
    item,
    resource,
    engine,
    prepare,
    step,
    provider,
  }: Omit<ResourceSyncInput, "db" | "items"> & {
    item: ResourceSyncInput["items"][number];
    resource: Resource;
  },
) {
  const id = op.id;
  const def = DEFINITIONS[resource];
  if (await recordUnavailableResource(db, item.id, resource, step)) {
    return false;
  }
  const parents = def.parent
    ? await database(db)
        .select()
        .from(tables.entities)
        .where(
          and(
            eq(tables.entities.item_id, item.id),
            eq(tables.entities.resource, def.parent),
            eq(tables.entities.deleted, 0),
          ),
        )
        .orderBy(asc(tables.entities.id))
        .all()
    : [null];
  for (const parent of parents) {
    if (
      resource === Resource.bills &&
      parent &&
      parent.normalized.type !== AccountType.CREDIT
    ) {
      continue;
    }
    const parentId = parent?.id ?? "";
    // Revisit investment movements only for a changed/new parent or reconciliation.
    if (
      resource === Resource.investment_transactions &&
      input.kind === OperationKind.sync &&
      (await investmentParentUnchanged(db, {
        itemId: item.id,
        parentId,
        signature: parent?.relevant_hash ?? null,
      }))
    ) {
      continue;
    }
    await step.do(`checkpoint-${item.id}-${resource}-${parentId}`, async () => {
      const coverage =
        (await database(db)
          .select({
            bootstrap_complete: tables.coverage.bootstrap_complete,
            confirmed_created_at: tables.coverage.confirmed_created_at,
          })
          .from(tables.coverage)
          .where(
            and(
              eq(tables.coverage.item_id, item.id),
              eq(tables.coverage.resource, resource),
              eq(tables.coverage.parent_id, parentId),
            ),
          )
          .get()) ?? null;
      const floor =
        resource === Resource.transactions &&
        input.kind === OperationKind.sync &&
        coverage?.bootstrap_complete
          ? coverage.confirmed_created_at
          : null;
      if (
        resource === Resource.transactions &&
        input.kind === OperationKind.sync &&
        coverage?.bootstrap_complete &&
        !floor
      ) {
        throw new Error("CREATION_CHECKPOINT_MISSING_RECONCILE_REQUIRED");
      }
      await database(db)
        .insert(tables.coverage)
        .values({
          item_id: item.id,
          resource: resource,
          parent_id: parentId,
          status: CoverageStatus.partial,
        })
        .onConflictDoUpdate({
          target: [
            tables.coverage.item_id,
            tables.coverage.resource,
            tables.coverage.parent_id,
          ],
          set: { status: CoverageStatus.partial },
        })
        .run();
      await database(db)
        .insert(tables.checkpoints)
        .values({
          operation_id: id,
          item_id: item.id,
          resource: resource,
          parent_id: parentId,
          creation_floor: floor,
          maximum_created_at: floor,
        })
        .onConflictDoNothing()
        .run();
      return { phase: OperationPhase.checkpoint };
    });
    for (let pageIndex = 0; ; pageIndex++) {
      const name = `page-${item.id}-${resource}-${parentId}-${pageIndex}`;
      const result = await step.do(name, async () => {
        return publishPage({
          db,
          op,
          name,
          resource,
          item,
          parentId,
          parent,
          engine,
          prepare,
          provider,
        });
      });
      if (result.cancelled) {
        await finish(db, op, OperationStatus.cancelled);
        return true;
      }
      if (result.done) {
        break;
      }
      await step.sleep(`pause-${name}`, "1 second");
    }
  }

  return false;
}

async function investmentParentUnchanged(
  db: D1Database,
  {
    itemId,
    parentId,
    signature,
  }: { itemId: string; parentId: string; signature: string | null },
) {
  const previous = await database(db)
    .select({ parent_signature: tables.coverage.parent_signature })
    .from(tables.coverage)
    .where(
      and(
        eq(tables.coverage.item_id, itemId),
        eq(tables.coverage.resource, Resource.investment_transactions),
        eq(tables.coverage.parent_id, parentId),
        eq(tables.coverage.bootstrap_complete, 1),
      ),
    )
    .get();
  return previous?.parent_signature === signature;
}

async function recordUnavailableResource(
  db: D1Database,
  itemId: string,
  resource: Resource,
  step: Steps,
) {
  if (resource === Resource.connections) {
    return false;
  }
  const source = await database(db)
    .select({ source: tables.entities.source })
    .from(tables.entities)
    .where(
      and(
        eq(tables.entities.item_id, itemId),
        eq(tables.entities.resource, Resource.connections),
      ),
    )
    .get()
    .then((row) => row?.source ?? null);
  if (!source) {
    return false;
  }
  const info = itemInfo(source);
  const consents = await database(db)
    .select({ normalized: tables.entities.normalized })
    .from(tables.entities)
    .where(
      and(
        eq(tables.entities.item_id, itemId),
        eq(tables.entities.resource, Resource.consents),
        eq(tables.entities.deleted, 0),
      ),
    )
    .all();
  const availability = productState(
    resource,
    info,
    consents.map((x) => x.normalized),
    Date.now(),
  );
  if (!availability) {
    return false;
  }
  await step.do(`availability-${itemId}-${resource}`, async () => {
    await database(db)
      .insert(tables.coverage)
      .values({
        item_id: itemId,
        resource: resource,
        parent_id: "",
        status: availability,
      })
      .onConflictDoUpdate({
        target: [
          tables.coverage.item_id,
          tables.coverage.resource,
          tables.coverage.parent_id,
        ],
        set: { status: sql`excluded.status` },
      })
      .run();
    return { availability };
  });
  return true;
}

async function resolvePendingTransactions(
  db: D1Database,
  {
    op,
    items,
    engine,
    prepare,
    step,
    provider,
  }: Omit<ResourceSyncInput, "db" | "input">,
) {
  const id = op.id;
  // Freeze the indexed pending set; one durable step per bounded account batch.
  await step.do("select-pending", async () => {
    await database(db)
      .insert(tables.operation_targets)
      .select(
        database(db)
          .select({
            operation_id: sql<string>`${id}`.as("operation_id"),
            item_id: tables.entities.item_id,
            resource: tables.entities.resource,
            parent_id: tables.entities.parent_id,
            id: tables.entities.id,
            processed: sql<number>`0`.as("processed"),
          })
          .from(tables.entities)
          .where(
            and(
              inArray(
                tables.entities.item_id,
                items.map((x) => x.id),
              ),
              eq(tables.entities.resource, Resource.transactions),
              eq(tables.entities.status, TransactionStatus.PENDING),
              eq(tables.entities.deleted, 0),
            ),
          ),
      )
      .onConflictDoNothing()
      .run();
    return { phase: OperationPhase.pending_selected };
  });
  for (let batch = 0; ; batch++) {
    const outcome = await step.do(`pending-${batch}`, async () => {
      const committed = await database(db)
        .select({ progress: tables.page_commits.progress })
        .from(tables.page_commits)
        .where(
          and(
            eq(tables.page_commits.operation_id, id),
            eq(tables.page_commits.step_key, `pending-${batch}`),
          ),
        )
        .get()
        .then((row) => row?.progress ?? null);
      if (committed) {
        return committed;
      }
      if ((await stillWorking(db, id)).cancel_requested) {
        return { done: true, cancelled: true };
      }
      const selected = await database(db)
        .select({
          item_id: tables.operation_targets.item_id,
          parent_id: tables.operation_targets.parent_id,
          id: tables.operation_targets.id,
        })
        .from(tables.operation_targets)
        .where(
          and(
            eq(tables.operation_targets.operation_id, id),
            eq(tables.operation_targets.processed, 0),
          ),
        )
        .orderBy(
          asc(tables.operation_targets.item_id),
          asc(tables.operation_targets.parent_id),
          asc(tables.operation_targets.id),
        )
        .limit(20)
        .all();
      const first = selected[0];
      if (!first) {
        return { done: true, cancelled: false };
      }
      const group = selected.filter(
          (x) => x.item_id === first.item_id && x.parent_id === first.parent_id,
        ),
        ids = group.map((x) => x.id);
      await authorizedItems(db, [first.item_id]);
      const records = await provider.ids(first.parent_id, ids);
      await publishResolved(db, {
        operation: op,
        engine: engine,
        prepare,
        item: first.item_id,
        account: first.parent_id,
        ids: ids,
        records: records,
        checkpoint: [
          database(db)
            .insert(tables.page_commits)
            .values({
              operation_id: id,
              step_key: `pending-${batch}`,
              progress: { done: false, cancelled: false },
            }),
          ...ids.map((tx) =>
            database(db)
              .update(tables.operation_targets)
              .set({ processed: 1 })
              .where(
                and(
                  eq(tables.operation_targets.operation_id, id),
                  eq(tables.operation_targets.item_id, first.item_id),
                  eq(tables.operation_targets.parent_id, first.parent_id),
                  eq(tables.operation_targets.id, tx),
                ),
              ),
          ),
        ],
      });
      return { done: false, cancelled: false };
    });
    if (outcome.cancelled) {
      await finish(db, op, OperationStatus.cancelled);
      return true;
    }
    if (outcome.done) {
      break;
    }
    await step.sleep(`pending-pause-${batch}`, "1 second");
  }

  return false;
}
