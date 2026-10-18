import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { OperationPhase } from "@/contracts/operation.types";
import { Resource, TransactionStatus } from "@/domain/enums";
import {
  derivedStatements,
  entityStatements,
} from "@/worker/finance/entities.repository";
import { compileFilter, connectedItems } from "@/worker/finance/repository";
import { rulesFor } from "@/worker/finance/rules.repository";

import { database, required } from "../database";
import * as tables from "../schema";
import type { CollectionIdentity, ExecutionRepository } from "./entity";
import { finish, stillWorking } from "./repository";

function collectionWhere(identity: CollectionIdentity) {
  return and(
    eq(tables.checkpoints.operation_id, identity.operationId),
    eq(tables.checkpoints.item_id, identity.itemId),
    eq(tables.checkpoints.resource, identity.resource),
    eq(tables.checkpoints.parent_id, identity.parentId),
  );
}

// Every publication commits data, derived values, progress and its replay receipt
// together. No source call or rule evaluation runs inside this adapter.
export function createExecutionRepository(db: D1Database): ExecutionRepository {
  const orm = database(db);
  return {
    read: (id) => stillWorking(db, id),
    items: (ids) => connectedItems(db, ids),
    rules: (revision) => rulesFor(db, revision),
    finish: (op, status, error) => finish(db, op, status, error),
    async acquire(id) {
      await orm
        .insert(tables.locks)
        .values({ id: 1, operation_id: id })
        .onConflictDoNothing()
        .run();
      const lock = await orm
        .select({ operation_id: tables.locks.operation_id })
        .from(tables.locks)
        .where(eq(tables.locks.id, 1))
        .get();
      return lock?.operation_id === id;
    },
    async mature(op) {
      await orm.batch([
        orm
          .update(tables.entities)
          .set({ eligible: 1 })
          .where(
            and(
              inArray(tables.entities.item_id, op.input.itemIds),
              eq(tables.entities.eligible, 0),
              eq(tables.entities.deleted, 0),
              lte(tables.entities.transaction_date, op.reference_day),
              or(
                isNull(tables.entities.status),
                ne(tables.entities.status, TransactionStatus.PENDING),
              ),
            ),
          ),
        orm
          .update(tables.settings)
          .set({ revision: sql`${tables.settings.revision} + 1` })
          .where(and(eq(tables.settings.id, 1), sql`changes() > 0`)),
      ]);
    },
    async receipt(operationId, key) {
      const row = await orm
        .select({ progress: tables.page_commits.progress })
        .from(tables.page_commits)
        .where(
          and(
            eq(tables.page_commits.operation_id, operationId),
            eq(tables.page_commits.step_key, key),
          ),
        )
        .get();
      return row?.progress ?? null;
    },
    async checkpoint(identity) {
      return required(
        await orm
          .select()
          .from(tables.checkpoints)
          .where(collectionWhere(identity))
          .get(),
      );
    },
    async connectionSource(itemId) {
      const row = await orm
        .select({ source: tables.entities.source })
        .from(tables.entities)
        .where(
          and(
            eq(tables.entities.item_id, itemId),
            eq(tables.entities.resource, Resource.connections),
          ),
        )
        .get();
      return row?.source ?? null;
    },
    async parents(itemId, resource) {
      return orm
        .select()
        .from(tables.entities)
        .where(
          and(
            eq(tables.entities.item_id, itemId),
            eq(tables.entities.resource, resource),
            eq(tables.entities.deleted, 0),
          ),
        )
        .orderBy(asc(tables.entities.id))
        .all();
    },
    async coverage(itemId, resource, parentId) {
      return (
        (await orm
          .select({
            bootstrap_complete: tables.coverage.bootstrap_complete,
            confirmed_created_at: tables.coverage.confirmed_created_at,
            parent_signature: tables.coverage.parent_signature,
          })
          .from(tables.coverage)
          .where(
            and(
              eq(tables.coverage.item_id, itemId),
              eq(tables.coverage.resource, resource),
              eq(tables.coverage.parent_id, parentId),
            ),
          )
          .get()) ?? null
      );
    },
    async setCoverage(itemId, resource, status) {
      await orm
        .insert(tables.coverage)
        .values({ item_id: itemId, resource, parent_id: "", status })
        .onConflictDoUpdate({
          target: [
            tables.coverage.item_id,
            tables.coverage.resource,
            tables.coverage.parent_id,
          ],
          set: { status: sql`excluded.status` },
        })
        .run();
    },
    async sourceFailure(identity, status, countError) {
      await orm
        .insert(tables.coverage)
        .values({
          item_id: identity.itemId,
          resource: identity.resource,
          parent_id: identity.parentId,
          status,
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
      if (countError) {
        await orm
          .update(tables.operations)
          .set({
            progress: sql`json_set(${tables.operations.progress}, '$.errors', coalesce(json_extract(${tables.operations.progress}, '$.errors'),0)+1)`,
          })
          .where(eq(tables.operations.id, identity.operationId))
          .run();
      }
    },
    async createCheckpoint(identity, floor) {
      await orm
        .insert(tables.coverage)
        .values({
          item_id: identity.itemId,
          resource: identity.resource,
          parent_id: identity.parentId,
          status: "partial",
        })
        .onConflictDoUpdate({
          target: [
            tables.coverage.item_id,
            tables.coverage.resource,
            tables.coverage.parent_id,
          ],
          set: { status: "partial" },
        })
        .run();
      await orm
        .insert(tables.checkpoints)
        .values({
          operation_id: identity.operationId,
          item_id: identity.itemId,
          resource: identity.resource,
          parent_id: identity.parentId,
          creation_floor: floor,
          maximum_created_at: floor,
        })
        .onConflictDoNothing()
        .run();
    },
    async continuationUsed(identity, next) {
      return !!(await orm
        .select({ step_key: tables.page_commits.step_key })
        .from(tables.page_commits)
        .where(
          and(
            eq(tables.page_commits.operation_id, identity.operationId),
            eq(
              sql`json_extract(${tables.page_commits.progress}, '$.nextCursor')`,
              next,
            ),
            eq(
              sql`json_extract(${tables.page_commits.progress}, '$.resource')`,
              identity.resource,
            ),
            eq(
              sql`json_extract(${tables.page_commits.progress}, '$.parent')`,
              identity.parentId,
            ),
            eq(
              sql`json_extract(${tables.page_commits.progress}, '$.item')`,
              identity.itemId,
            ),
          ),
        )
        .get());
    },
    async eventCursorUsed(operationId, next) {
      return !!(await orm
        .select({ one: sql`1` })
        .from(tables.page_commits)
        .where(
          and(
            eq(tables.page_commits.operation_id, operationId),
            eq(
              sql`json_extract(${tables.page_commits.progress}, '$.next')`,
              next,
            ),
          ),
        )
        .get());
    },
    async commitPage({
      identity,
      key,
      prepared,
      progress,
      page,
      maximum,
      collected,
      parentSignature,
      deleteMissing,
      coverageStatus,
    }) {
      const edits: BatchItem<"sqlite">[] = prepared.flatMap((entry) =>
        entityStatements(db, entry.mutation),
      );
      edits.push(
        orm
          .update(tables.checkpoints)
          .set({
            cursor: page.next,
            maximum_created_at: maximum,
            page: sql`${tables.checkpoints.page} + 1`,
            done: Number(page.next === null),
            expected_total: page.total ?? null,
            collected,
          })
          .where(collectionWhere(identity)),
      );
      if (deleteMissing) {
        edits.push(
          orm
            .update(tables.entities)
            .set({ deleted: 1 })
            .where(
              and(
                eq(tables.entities.item_id, identity.itemId),
                eq(tables.entities.resource, identity.resource),
                eq(tables.entities.parent_id, identity.parentId),
                ne(tables.entities.normalizer, "legacy-projection-v1"),
                sql`COALESCE(${tables.entities.seen_operation}, '') != ${identity.operationId}`,
              ),
            ),
        );
      }
      edits.push(
        orm
          .insert(tables.coverage)
          .values({
            item_id: identity.itemId,
            resource: identity.resource,
            parent_id: identity.parentId,
            status: coverageStatus,
            bootstrap_complete: Number(!page.next),
            confirmed_created_at: maximum,
            observed_at: new Date().toISOString(),
            parent_signature: parentSignature,
          })
          .onConflictDoUpdate({
            target: [
              tables.coverage.item_id,
              tables.coverage.resource,
              tables.coverage.parent_id,
            ],
            set: {
              status: sql`excluded.status`,
              bootstrap_complete: sql`max(${tables.coverage.bootstrap_complete},excluded.bootstrap_complete)`,
              confirmed_created_at: sql`case when excluded.bootstrap_complete=1 then excluded.confirmed_created_at else ${tables.coverage.confirmed_created_at} end`,
              observed_at: sql`excluded.observed_at`,
              parent_signature: sql`case when excluded.bootstrap_complete=1 then excluded.parent_signature else ${tables.coverage.parent_signature} end`,
            },
          }),
        orm
          .update(tables.operations)
          .set({
            progress,
            phase: identity.resource,
            updated_at: new Date().toISOString(),
          })
          .where(eq(tables.operations.id, identity.operationId)),
        orm
          .update(tables.settings)
          .set({ revision: sql`${tables.settings.revision} + 1` })
          .where(eq(tables.settings.id, 1)),
        orm.insert(tables.page_commits).values({
          operation_id: identity.operationId,
          step_key: key,
          progress: {
            done: !page.next,
            cancelled: false,
            nextCursor: page.next,
            resource: identity.resource,
            parent: identity.parentId,
            item: identity.itemId,
          },
        }),
      );
      const [first, ...rest] = edits;
      if (first) {
        await orm.batch([first, ...rest]);
      }
    },
    async event(id) {
      return required(
        await orm
          .select()
          .from(tables.inbox)
          .where(eq(tables.inbox.event_id, id))
          .get(),
      );
    },
    async completeEvent(id) {
      await orm
        .update(tables.inbox)
        .set({ processed_at: new Date().toISOString() })
        .where(eq(tables.inbox.event_id, id))
        .run();
    },
    async account(itemId, accountId) {
      const row = await orm
        .select({ normalized: tables.entities.normalized })
        .from(tables.entities)
        .where(
          and(
            eq(tables.entities.item_id, itemId),
            eq(tables.entities.resource, Resource.accounts),
            eq(tables.entities.id, accountId),
          ),
        )
        .get();
      return row?.normalized ?? null;
    },
    async commitResolved({
      operationId,
      itemId,
      accountId,
      prepared,
      missingIds,
      progress,
      receipt,
    }) {
      const edits: BatchItem<"sqlite">[] = [];
      if (receipt) {
        edits.push(
          orm.insert(tables.page_commits).values({
            operation_id: operationId,
            step_key: receipt.key,
            progress: receipt.outcome,
          }),
        );
        for (const id of receipt.processedIds ?? []) {
          edits.push(
            orm
              .update(tables.operation_targets)
              .set({ processed: 1 })
              .where(
                and(
                  eq(tables.operation_targets.operation_id, operationId),
                  eq(tables.operation_targets.item_id, itemId),
                  eq(tables.operation_targets.parent_id, accountId),
                  eq(tables.operation_targets.id, id),
                ),
              ),
          );
        }
      }
      edits.push(
        ...prepared.flatMap((entry) => entityStatements(db, entry.mutation)),
        orm
          .update(tables.operations)
          .set({
            progress,
            phase: OperationPhase.resolve_changes,
            updated_at: new Date().toISOString(),
          })
          .where(eq(tables.operations.id, operationId)),
      );
      for (const id of missingIds) {
        edits.push(
          orm
            .update(tables.entities)
            .set({ deleted: 1 })
            .where(
              and(
                eq(tables.entities.item_id, itemId),
                eq(tables.entities.resource, Resource.transactions),
                eq(tables.entities.parent_id, accountId),
                eq(tables.entities.id, id),
              ),
            ),
        );
      }
      const [first, ...rest] = [
        ...edits,
        orm
          .update(tables.settings)
          .set({ revision: sql`${tables.settings.revision} + 1` })
          .where(eq(tables.settings.id, 1)),
      ];
      await orm.batch([first, ...rest]);
    },
    async selectPending(operationId, itemIds) {
      await orm
        .insert(tables.operation_targets)
        .select(
          orm
            .select({
              operation_id: sql<string>`${operationId}`.as("operation_id"),
              item_id: tables.entities.item_id,
              resource: tables.entities.resource,
              parent_id: tables.entities.parent_id,
              id: tables.entities.id,
              processed: sql<number>`0`.as("processed"),
            })
            .from(tables.entities)
            .where(
              and(
                inArray(tables.entities.item_id, itemIds),
                eq(tables.entities.resource, Resource.transactions),
                eq(tables.entities.status, TransactionStatus.PENDING),
                eq(tables.entities.deleted, 0),
              ),
            ),
        )
        .onConflictDoNothing()
        .run();
    },
    async pending(operationId) {
      return orm
        .select({
          item_id: tables.operation_targets.item_id,
          parent_id: tables.operation_targets.parent_id,
          id: tables.operation_targets.id,
        })
        .from(tables.operation_targets)
        .where(
          and(
            eq(tables.operation_targets.operation_id, operationId),
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
    },
    async selectReapplication(op) {
      const filter = op.input.filter
        ? compileFilter(db, op.input.filter)
        : undefined;
      await orm
        .insert(tables.operation_targets)
        .select(
          orm
            .select({
              operation_id: sql<string>`${op.id}`.as("operation_id"),
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
                inArray(tables.effective_entities.item_id, op.input.itemIds),
                filter,
              ),
            ),
        )
        .onConflictDoNothing()
        .run();
    },
    async reapplicationTargets(operationId) {
      return orm
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
            eq(tables.operation_targets.operation_id, operationId),
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
    },
    async commitReapplication({ op, key, changes, progress, outcome }) {
      const edits: BatchItem<"sqlite">[] = [];
      for (const { identity, derived } of changes) {
        edits.push(
          ...derivedStatements(db, {
            identity,
            derived,
            rulesRevision: op.rules_revision,
          }),
          orm
            .update(tables.operation_targets)
            .set({ processed: 1 })
            .where(
              and(
                eq(tables.operation_targets.operation_id, op.id),
                eq(tables.operation_targets.item_id, identity.itemId),
                eq(tables.operation_targets.resource, identity.resource),
                eq(tables.operation_targets.parent_id, identity.parentId),
                eq(tables.operation_targets.id, identity.id),
              ),
            ),
        );
      }
      const [first, ...rest] = [
        ...edits,
        orm
          .update(tables.settings)
          .set({ revision: sql`${tables.settings.revision} + 1` })
          .where(eq(tables.settings.id, 1)),
        orm
          .update(tables.operations)
          .set({
            progress,
            phase: OperationPhase.reapply,
            updated_at: new Date().toISOString(),
          })
          .where(eq(tables.operations.id, op.id)),
        orm
          .insert(tables.page_commits)
          .values({ operation_id: op.id, step_key: key, progress: outcome }),
      ];
      await orm.batch([first, ...rest]);
    },
    async imported(sourceKey, digest) {
      return !!(await orm
        .select({ found: sql`1` })
        .from(tables.migration_imports)
        .where(
          and(
            eq(tables.migration_imports.source_key, sourceKey),
            eq(tables.migration_imports.source_hash, digest),
          ),
        )
        .get());
    },
    async current(identity) {
      const row = await orm
        .select({ normalized: tables.entities.normalized })
        .from(tables.entities)
        .where(
          and(
            eq(tables.entities.item_id, identity.itemId),
            eq(tables.entities.resource, identity.resource),
            eq(tables.entities.parent_id, identity.parentId),
            eq(tables.entities.id, identity.id),
          ),
        )
        .get();
      return row?.normalized ?? null;
    },
    async commitMigration(rows) {
      const edits: BatchItem<"sqlite">[] = [];
      for (const row of rows) {
        edits.push(
          ...entityStatements(db, row.prepared.mutation),
          orm
            .insert(tables.migration_imports)
            .values({
              source_key: row.sourceKey,
              source_hash: row.digest,
              imported_at: new Date().toISOString(),
            })
            .onConflictDoNothing(),
        );
      }
      if (edits.length) {
        const [first, ...rest] = [
          ...edits,
          orm
            .update(tables.settings)
            .set({ revision: sql`${tables.settings.revision} + 1` })
            .where(eq(tables.settings.id, 1)),
        ];
        await orm.batch([first, ...rest]);
      }
    },
  };
}
