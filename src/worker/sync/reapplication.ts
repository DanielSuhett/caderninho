import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import {
  type OperationInput,
  type OperationKind,
  OperationPhase,
  OperationStatus,
} from "#contracts/operation.types.ts";
import { Resource } from "#domain/enums.ts";
import { txContext } from "#domain/rules/rules.ts";
import { database } from "#worker/database.ts";
import { derivedStatements } from "#worker/finance/entities.repository.ts";
import {
  authorizedItems,
  compileFilter,
  requireResource,
} from "#worker/finance/repository.ts";
import type { rulesFor } from "#worker/finance/rules.repository.ts";
import * as tables from "#worker/schema.ts";
import {
  type Operation,
  progressWithDefaults,
} from "#worker/sync/operation-storage.ts";
import { finish, stillWorking } from "#worker/sync/repository.ts";
import type { Steps } from "#worker/sync/service.ts";

type Flow = {
  db: D1Database;
  op: Operation;
  input: Extract<OperationInput, { kind: typeof OperationKind.reapply }>;
  items: Pick<typeof tables.items.$inferSelect, "id" | "resources">[];
  engine: Awaited<ReturnType<typeof rulesFor>>;
  step: Steps;
};
export async function reapplyRules({
  db,
  op,
  input,
  items,
  engine,
  step,
}: Flow) {
  const id = op.id;
  for (const item of items) {
    await requireResource(db, item.id, Resource.transactions);
  }
  const filter = input.filter ? compileFilter(db, input.filter) : undefined;
  await step.do("select-reapply", async () => {
    await database(db)
      .insert(tables.operation_targets)
      .select(
        database(db)
          .select({
            operation_id: sql<string>`${id}`.as("operation_id"),
            item_id: tables.effective_entities.item_id,
            resource: tables.effective_entities.resource,
            parent_id: tables.effective_entities.parent_id,
            id: tables.effective_entities.id,
            processed: sql<number>`0`.as("processed"),
          })
          .from(tables.effective_entities)
          .where(
            and(
              eq(tables.effective_entities.resource, Resource.transactions),
              eq(tables.effective_entities.deleted, 0),
              inArray(tables.effective_entities.item_id, input.itemIds),
              filter,
            ),
          ),
      )
      .onConflictDoNothing()
      .run();
    return { phase: OperationPhase.selected };
  });
  for (let batch = 0; ; batch++) {
    const result = await step.do(`reapply-${batch}`, async () => {
      const key = `reapply-${batch}`;
      const saved = await database(db)
        .select({ progress: tables.page_commits.progress })
        .from(tables.page_commits)
        .where(
          and(
            eq(tables.page_commits.operation_id, id),
            eq(tables.page_commits.step_key, key),
          ),
        )
        .get()
        .then((row) => row?.progress ?? null);
      if (saved) {
        return saved;
      }
      if ((await stillWorking(db, id)).cancel_requested) {
        return { done: true, cancelled: true };
      }
      await authorizedItems(db, input.itemIds);
      const selected = await database(db)
        .select(getTableColumns(tables.entities))
        .from(tables.entities)
        .innerJoin(
          tables.operation_targets,
          and(
            eq(tables.operation_targets.item_id, tables.entities.item_id),
            eq(tables.operation_targets.resource, tables.entities.resource),
            eq(tables.operation_targets.parent_id, tables.entities.parent_id),
            eq(tables.operation_targets.id, tables.entities.id),
          ),
        )
        .where(
          and(
            eq(tables.operation_targets.operation_id, id),
            eq(tables.operation_targets.processed, 0),
          ),
        )
        .orderBy(
          tables.operation_targets.item_id,
          tables.operation_targets.parent_id,
          tables.operation_targets.id,
        )
        .limit(20)
        .all();
      const edits: BatchItem<"sqlite">[] = [];
      for (const entity of selected) {
        const derived = await engine.evaluate(txContext(entity.normalized));
        edits.push(
          ...derivedStatements(db, {
            identity: {
              itemId: entity.item_id,
              resource: entity.resource,
              parentId: entity.parent_id,
              id: entity.id,
            },
            rulesRevision: op.rules_revision,
            derived,
          }),
          database(db)
            .update(tables.operation_targets)
            .set({ processed: 1 })
            .where(
              and(
                eq(tables.operation_targets.operation_id, id),
                eq(tables.operation_targets.item_id, entity.item_id),
                eq(tables.operation_targets.resource, entity.resource),
                eq(tables.operation_targets.parent_id, entity.parent_id),
                eq(tables.operation_targets.id, entity.id),
              ),
            ),
        );
      }
      const progress = progressWithDefaults(
        (await stillWorking(db, id)).progress,
      );
      progress.classified += selected.length;
      progress.received += selected.length;
      const outcome = { done: selected.length < 20, cancelled: false };
      {
        const [first, ...rest] = [
          ...edits,
          database(db)
            .update(tables.settings)
            .set({ revision: sql`${tables.settings.revision} + 1` })
            .where(eq(tables.settings.id, 1)),
          database(db)
            .update(tables.operations)
            .set({
              progress: progress,
              phase: OperationPhase.reapply,
              updated_at: new Date().toISOString(),
            })
            .where(eq(tables.operations.id, id)),
          database(db).insert(tables.page_commits).values({
            operation_id: id,
            step_key: key,
            progress: outcome,
          }),
        ];
        await database(db).batch([first, ...rest]);
      }
      return outcome;
    });
    if (result.cancelled) {
      await finish(db, op, OperationStatus.cancelled);
      return true;
    }
    if (result.done) {
      break;
    }
  }

  return false;
}
