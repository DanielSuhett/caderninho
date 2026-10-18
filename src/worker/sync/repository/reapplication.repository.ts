import { and, eq, exists, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { OperationKind, OperationStatus } from "../../../contracts";
import { assertIdempotency, Resource, TagOrigin } from "../../../domain";
import { hash } from "../../../shared";
import { database, required } from "../../database";
import {
  compileFilter,
  derivedStatements,
  rulesFor,
} from "../../finance/repository";
import {
  derived,
  effective_entities,
  entities,
  local_receipts,
  local_runs,
  locks,
  operations,
  settings,
  tags,
} from "../../schema";
import type { ReapplicationRepository } from "../entity";
import { getOperation, startOperation } from "./dispatch.repository";
import { createExecutionRepository } from "./execution.repository";

export function createReapplicationRepository(
  db: D1Database,
): ReapplicationRepository {
  const orm = database(db);
  return {
    acquire: (id) => createExecutionRepository(db).acquire(id),
    async begin(input) {
      const selection = {
        itemIds: input.itemIds,
        kind: OperationKind.reapply,
        ...(input.filter && { filter: input.filter }),
      };
      const operation = input.continuation
        ? await getOperation(db, input.continuation.operationId)
        : await startOperation(db, input.requestKey, selection, "local");
      assertIdempotency({
        actual: await hash(selection),
        expected: operation.input_hash,
      });
      if (
        operation.execution_mode !== "local" ||
        operation.request_key !== input.requestKey
      ) {
        throw new Error("REAPPLICATION_SELECTION_CONFLICT");
      }
      const config = required(
        await orm.select().from(settings).where(eq(settings.id, 1)).get(),
      );
      await orm
        .insert(local_runs)
        .values({
          active_rules: config.active_rules,
          expected_revision: config.revision,
          operation_id: operation.id,
        })
        .onConflictDoNothing()
        .run();
      const state = required(
        await orm
          .select()
          .from(local_runs)
          .where(eq(local_runs.operation_id, operation.id))
          .get(),
      );
      return {
        activeRules: state.active_rules,
        after: state.after_identity,
        batch: input.continuation?.batch ?? 0,
        expectedRevision: state.expected_revision,
        operation,
      };
    },
    async commit(run, changes, result, after) {
      const publications = await Promise.all(
        changes.map(async (change) => {
          const { identity } = change;
          const predicate = and(
            eq(derived.item_id, identity.itemId),
            eq(derived.resource, identity.resource),
            eq(derived.parent_id, identity.parentId),
            eq(derived.id, identity.id),
          );
          const current = await orm
            .select()
            .from(derived)
            .where(predicate)
            .get();
          if (
            !current ||
            current.rules_revision !== run.operation.rules_revision
          ) {
            return change;
          }
          const currentTags = await orm
            .select({ key: tags.key, value: tags.value })
            .from(tags)
            .where(
              and(
                eq(tags.item_id, identity.itemId),
                eq(tags.resource, identity.resource),
                eq(tags.parent_id, identity.parentId),
                eq(tags.id, identity.id),
                eq(tags.origin, TagOrigin.derived),
              ),
            );
          const previous = {
            category: current.category,
            category_group_id: current.group_id,
            category_id: current.category_id,
            description: current.description,
            evidence: current.evidence,
            ignored: !!current.ignored,
            tags: Object.fromEntries(
              currentTags.map((tag) => [tag.key, tag.value]),
            ),
          };
          const { category_group: _group, ...expected } = change.derived;
          return (await hash(previous)) === (await hash(expected))
            ? null
            : change;
        }),
      );
      const changed = publications.filter((change) => !!change);
      const edits: BatchItem<"sqlite">[] = [
        // Failed revision/batch/lock checks violate CHECK and roll the entire batch back.
        orm
          .update(local_runs)
          .set({
            expected_revision: sql`CASE WHEN
          (${orm.select({ revision: settings.revision }).from(settings).where(eq(settings.id, 1))})=${run.expectedRevision}
          AND (${orm.select({ active: settings.active_rules }).from(settings).where(eq(settings.id, 1))}) IS ${run.activeRules}
          AND ${run.activeRules} IS ${run.operation.rules_revision}
          AND ${local_runs.next_batch}=${run.batch}
          AND ${exists(
            orm
              .select({ id: operations.id })
              .from(operations)
              .where(
                and(
                  eq(operations.id, run.operation.id),
                  eq(operations.cancel_requested, 0),
                ),
              ),
          )}
          AND ${exists(
            orm
              .select({ id: locks.operation_id })
              .from(locks)
              .where(
                and(eq(locks.id, 1), eq(locks.operation_id, run.operation.id)),
              ),
          )}
          THEN ${run.expectedRevision} ELSE -1 END`,
          })
          .where(eq(local_runs.operation_id, run.operation.id)),
      ];
      for (const change of changed) {
        edits.push(
          ...derivedStatements(db, {
            ...change,
            rulesRevision: run.operation.rules_revision,
          }),
        );
      }
      edits.push(
        orm
          .update(settings)
          .set({
            revision: sql`${settings.revision}+1`,
          })
          .where(and(eq(settings.id, 1), sql`${!!changed.length}`)),
        orm
          .update(local_runs)
          .set({
            after_identity: after,
            expected_revision: run.expectedRevision + Number(!!changed.length),
            next_batch: run.batch + 1,
          })
          .where(eq(local_runs.operation_id, run.operation.id)),
        orm
          .update(operations)
          .set({
            phase: result.status === "completed" ? "completed" : "reapply",
            progress: { classified: result.totalProcessed },
            result: {
              content: [{ text: JSON.stringify(result), type: "text" }],
              isError: false,
            },
            status:
              result.status === "completed"
                ? OperationStatus.completed
                : OperationStatus.working,
            updated_at: new Date().toISOString(),
          })
          .where(eq(operations.id, run.operation.id)),
        orm
          .insert(local_receipts)
          .values({ batch: run.batch, operation_id: run.operation.id, result }),
      );
      const [first, ...rest] = edits;
      if (first) {
        await orm.batch([first, ...rest]);
      }
    },
    async receipt(id, batch) {
      return (
        (
          await orm
            .select()
            .from(local_receipts)
            .where(
              and(
                eq(local_receipts.operation_id, id),
                eq(local_receipts.batch, batch),
              ),
            )
            .get()
        )?.result ?? null
      );
    },
    async release(id) {
      await orm
        .delete(locks)
        .where(and(eq(locks.id, 1), eq(locks.operation_id, id)));
    },
    rules: (revision) => rulesFor(db, revision),
    async select(run) {
      if (run.operation.cancel_requested) {
        throw new Error("REAPPLICATION_CANCELLED");
      }
      const { input } = run.operation;
      return await orm
        .select({ entity: entities })
        .from(entities)
        .innerJoin(
          effective_entities,
          and(
            eq(entities.item_id, effective_entities.item_id),
            eq(entities.resource, effective_entities.resource),
            eq(entities.parent_id, effective_entities.parent_id),
            eq(entities.id, effective_entities.id),
          ),
        )
        .where(
          and(
            eq(entities.resource, Resource.transactions),
            eq(entities.deleted, 0),
            inArray(entities.item_id, input.itemIds),
            input.filter
              ? compileFilter(db, input.filter, run.operation.reference_day)
              : undefined,
            run.after.length
              ? sql`(${entities.item_id},${entities.resource},${entities.parent_id},${entities.id}) > (${run.after[0]},${run.after[1]},${run.after[2]},${run.after[3]})`
              : undefined,
          ),
        )
        .orderBy(
          entities.item_id,
          entities.resource,
          entities.parent_id,
          entities.id,
        )
        .limit(6)
        .then((rows) => rows.map((row) => row.entity));
    },
  };
}
