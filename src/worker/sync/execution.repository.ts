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
import {
  checkpoints as checkpointsTable,
  coverage as coverageTable,
  effective_entities as effectiveEntitiesTable,
  entities as entitiesTable,
  inbox as inboxTable,
  locks as locksTable,
  migration_imports as migrationImportsTable,
  operations as operationsTable,
  operation_targets as operationTargetsTable,
  page_commits as pageCommitsTable,
  settings as settingsTable,
} from "../schema";
import type { CollectionIdentity, ExecutionRepository } from "./entity";
import { finish, stillWorking } from "./repository";

function collectionWhere(identity: CollectionIdentity) {
  return and(
    eq(checkpointsTable.operation_id, identity.operationId),
    eq(checkpointsTable.item_id, identity.itemId),
    eq(checkpointsTable.resource, identity.resource),
    eq(checkpointsTable.parent_id, identity.parentId),
  );
}

// Every publication commits data, derived values, progress and its replay receipt
// together. No source call or rule evaluation runs inside this adapter.
export function createExecutionRepository(db: D1Database): ExecutionRepository {
  const orm = database(db);
  return {
    async account(itemId, accountId) {
      const row = await orm
        .select({ normalized: entitiesTable.normalized })
        .from(entitiesTable)
        .where(
          and(
            eq(entitiesTable.item_id, itemId),
            eq(entitiesTable.resource, Resource.accounts),
            eq(entitiesTable.id, accountId),
          ),
        )
        .get();
      return row?.normalized ?? null;
    },
    async acquire(id) {
      await orm
        .insert(locksTable)
        .values({ id: 1, operation_id: id })
        .onConflictDoNothing()
        .run();
      const lock = await orm
        .select({ operation_id: locksTable.operation_id })
        .from(locksTable)
        .where(eq(locksTable.id, 1))
        .get();
      return lock?.operation_id === id;
    },
    async checkpoint(identity) {
      return required(
        await orm
          .select()
          .from(checkpointsTable)
          .where(collectionWhere(identity))
          .get(),
      );
    },
    async commitMigration(rows) {
      const edits: BatchItem<"sqlite">[] = [];
      for (const row of rows) {
        edits.push(
          ...entityStatements(db, row.prepared.mutation),
          orm
            .insert(migrationImportsTable)
            .values({
              imported_at: new Date().toISOString(),
              source_hash: row.digest,
              source_key: row.sourceKey,
            })
            .onConflictDoNothing(),
        );
      }
      if (edits.length) {
        const [first, ...rest] = [
          ...edits,
          orm
            .update(settingsTable)
            .set({ revision: sql`${settingsTable.revision} + 1` })
            .where(eq(settingsTable.id, 1)),
        ];
        await orm.batch([first, ...rest]);
      }
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
          .update(checkpointsTable)
          .set({
            collected,
            cursor: page.next,
            done: Number(page.next === null),
            expected_total: page.total ?? null,
            maximum_created_at: maximum,
            page: sql`${checkpointsTable.page} + 1`,
          })
          .where(collectionWhere(identity)),
      );
      if (deleteMissing) {
        edits.push(
          orm
            .update(entitiesTable)
            .set({ deleted: 1 })
            .where(
              and(
                eq(entitiesTable.item_id, identity.itemId),
                eq(entitiesTable.resource, identity.resource),
                eq(entitiesTable.parent_id, identity.parentId),
                ne(entitiesTable.normalizer, "legacy-projection-v1"),
                sql`COALESCE(${entitiesTable.seen_operation}, '') != ${identity.operationId}`,
              ),
            ),
        );
      }
      edits.push(
        orm
          .insert(coverageTable)
          .values({
            bootstrap_complete: Number(!page.next),
            confirmed_created_at: maximum,
            item_id: identity.itemId,
            observed_at: new Date().toISOString(),
            parent_id: identity.parentId,
            parent_signature: parentSignature,
            resource: identity.resource,
            status: coverageStatus,
          })
          .onConflictDoUpdate({
            set: {
              bootstrap_complete: sql`max(${coverageTable.bootstrap_complete},excluded.bootstrap_complete)`,
              confirmed_created_at: sql`case when excluded.bootstrap_complete=1 then excluded.confirmed_created_at else ${coverageTable.confirmed_created_at} end`,
              observed_at: sql`excluded.observed_at`,
              parent_signature: sql`case when excluded.bootstrap_complete=1 then excluded.parent_signature else ${coverageTable.parent_signature} end`,
              status: sql`excluded.status`,
            },
            target: [
              coverageTable.item_id,
              coverageTable.resource,
              coverageTable.parent_id,
            ],
          }),
        orm
          .update(operationsTable)
          .set({
            phase: identity.resource,
            progress,
            updated_at: new Date().toISOString(),
          })
          .where(eq(operationsTable.id, identity.operationId)),
        orm
          .update(settingsTable)
          .set({ revision: sql`${settingsTable.revision} + 1` })
          .where(eq(settingsTable.id, 1)),
        orm.insert(pageCommitsTable).values({
          operation_id: identity.operationId,
          progress: {
            cancelled: false,
            done: !page.next,
            item: identity.itemId,
            nextCursor: page.next,
            parent: identity.parentId,
            resource: identity.resource,
          },
          step_key: key,
        }),
      );
      const [first, ...rest] = edits;
      if (first) {
        await orm.batch([first, ...rest]);
      }
    },
    async commitReapplication({ op, key, changes, progress, outcome }) {
      const edits: BatchItem<"sqlite">[] = [];
      for (const { identity, derived } of changes) {
        edits.push(
          ...derivedStatements(db, {
            derived,
            identity,
            rulesRevision: op.rules_revision,
          }),
          orm
            .update(operationTargetsTable)
            .set({ processed: 1 })
            .where(
              and(
                eq(operationTargetsTable.operation_id, op.id),
                eq(operationTargetsTable.item_id, identity.itemId),
                eq(operationTargetsTable.resource, identity.resource),
                eq(operationTargetsTable.parent_id, identity.parentId),
                eq(operationTargetsTable.id, identity.id),
              ),
            ),
        );
      }
      const [first, ...rest] = [
        ...edits,
        orm
          .update(settingsTable)
          .set({ revision: sql`${settingsTable.revision} + 1` })
          .where(eq(settingsTable.id, 1)),
        orm
          .update(operationsTable)
          .set({
            phase: OperationPhase.reapply,
            progress,
            updated_at: new Date().toISOString(),
          })
          .where(eq(operationsTable.id, op.id)),
        orm
          .insert(pageCommitsTable)
          .values({ operation_id: op.id, progress: outcome, step_key: key }),
      ];
      await orm.batch([first, ...rest]);
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
          orm.insert(pageCommitsTable).values({
            operation_id: operationId,
            progress: receipt.outcome,
            step_key: receipt.key,
          }),
        );
        for (const id of receipt.processedIds ?? []) {
          edits.push(
            orm
              .update(operationTargetsTable)
              .set({ processed: 1 })
              .where(
                and(
                  eq(operationTargetsTable.operation_id, operationId),
                  eq(operationTargetsTable.item_id, itemId),
                  eq(operationTargetsTable.parent_id, accountId),
                  eq(operationTargetsTable.id, id),
                ),
              ),
          );
        }
      }
      edits.push(
        ...prepared.flatMap((entry) => entityStatements(db, entry.mutation)),
        orm
          .update(operationsTable)
          .set({
            phase: OperationPhase.resolve_changes,
            progress,
            updated_at: new Date().toISOString(),
          })
          .where(eq(operationsTable.id, operationId)),
      );
      for (const id of missingIds) {
        edits.push(
          orm
            .update(entitiesTable)
            .set({ deleted: 1 })
            .where(
              and(
                eq(entitiesTable.item_id, itemId),
                eq(entitiesTable.resource, Resource.transactions),
                eq(entitiesTable.parent_id, accountId),
                eq(entitiesTable.id, id),
              ),
            ),
        );
      }
      const [first, ...rest] = [
        ...edits,
        orm
          .update(settingsTable)
          .set({ revision: sql`${settingsTable.revision} + 1` })
          .where(eq(settingsTable.id, 1)),
      ];
      await orm.batch([first, ...rest]);
    },
    async completeEvent(id) {
      await orm
        .update(inboxTable)
        .set({ processed_at: new Date().toISOString() })
        .where(eq(inboxTable.event_id, id))
        .run();
    },
    async connectionSource(itemId) {
      const row = await orm
        .select({ source: entitiesTable.source })
        .from(entitiesTable)
        .where(
          and(
            eq(entitiesTable.item_id, itemId),
            eq(entitiesTable.resource, Resource.connections),
          ),
        )
        .get();
      return row?.source ?? null;
    },
    async continuationUsed(identity, next) {
      return !!(await orm
        .select({ step_key: pageCommitsTable.step_key })
        .from(pageCommitsTable)
        .where(
          and(
            eq(pageCommitsTable.operation_id, identity.operationId),
            eq(
              sql`json_extract(${pageCommitsTable.progress}, '$.nextCursor')`,
              next,
            ),
            eq(
              sql`json_extract(${pageCommitsTable.progress}, '$.resource')`,
              identity.resource,
            ),
            eq(
              sql`json_extract(${pageCommitsTable.progress}, '$.parent')`,
              identity.parentId,
            ),
            eq(
              sql`json_extract(${pageCommitsTable.progress}, '$.item')`,
              identity.itemId,
            ),
          ),
        )
        .get());
    },
    async coverage(itemId, resource, parentId) {
      return (
        (await orm
          .select({
            bootstrap_complete: coverageTable.bootstrap_complete,
            confirmed_created_at: coverageTable.confirmed_created_at,
            parent_signature: coverageTable.parent_signature,
          })
          .from(coverageTable)
          .where(
            and(
              eq(coverageTable.item_id, itemId),
              eq(coverageTable.resource, resource),
              eq(coverageTable.parent_id, parentId),
            ),
          )
          .get()) ?? null
      );
    },
    async createCheckpoint(identity, floor) {
      await orm
        .insert(coverageTable)
        .values({
          item_id: identity.itemId,
          parent_id: identity.parentId,
          resource: identity.resource,
          status: "partial",
        })
        .onConflictDoUpdate({
          set: { status: "partial" },
          target: [
            coverageTable.item_id,
            coverageTable.resource,
            coverageTable.parent_id,
          ],
        })
        .run();
      await orm
        .insert(checkpointsTable)
        .values({
          creation_floor: floor,
          item_id: identity.itemId,
          maximum_created_at: floor,
          operation_id: identity.operationId,
          parent_id: identity.parentId,
          resource: identity.resource,
        })
        .onConflictDoNothing()
        .run();
    },
    async current(identity) {
      const row = await orm
        .select({ normalized: entitiesTable.normalized })
        .from(entitiesTable)
        .where(
          and(
            eq(entitiesTable.item_id, identity.itemId),
            eq(entitiesTable.resource, identity.resource),
            eq(entitiesTable.parent_id, identity.parentId),
            eq(entitiesTable.id, identity.id),
          ),
        )
        .get();
      return row?.normalized ?? null;
    },
    async event(id) {
      return required(
        await orm
          .select()
          .from(inboxTable)
          .where(eq(inboxTable.event_id, id))
          .get(),
      );
    },
    async eventCursorUsed(operationId, next) {
      return !!(await orm
        .select({ one: sql`1` })
        .from(pageCommitsTable)
        .where(
          and(
            eq(pageCommitsTable.operation_id, operationId),
            eq(sql`json_extract(${pageCommitsTable.progress}, '$.next')`, next),
          ),
        )
        .get());
    },
    finish: (op, status, error) => finish(db, op, status, error),
    async imported(sourceKey, digest) {
      return !!(await orm
        .select({ found: sql`1` })
        .from(migrationImportsTable)
        .where(
          and(
            eq(migrationImportsTable.source_key, sourceKey),
            eq(migrationImportsTable.source_hash, digest),
          ),
        )
        .get());
    },
    items: (ids) => connectedItems(db, ids),
    async mature(op) {
      await orm.batch([
        orm
          .update(entitiesTable)
          .set({ eligible: 1 })
          .where(
            and(
              inArray(entitiesTable.item_id, op.input.itemIds),
              eq(entitiesTable.eligible, 0),
              eq(entitiesTable.deleted, 0),
              lte(entitiesTable.transaction_date, op.reference_day),
              or(
                isNull(entitiesTable.status),
                ne(entitiesTable.status, TransactionStatus.PENDING),
              ),
            ),
          ),
        orm
          .update(settingsTable)
          .set({ revision: sql`${settingsTable.revision} + 1` })
          .where(and(eq(settingsTable.id, 1), sql`changes() > 0`)),
      ]);
    },
    async parents(itemId, resource) {
      return await orm
        .select()
        .from(entitiesTable)
        .where(
          and(
            eq(entitiesTable.item_id, itemId),
            eq(entitiesTable.resource, resource),
            eq(entitiesTable.deleted, 0),
          ),
        )
        .orderBy(asc(entitiesTable.id))
        .all();
    },
    async pending(operationId) {
      return await orm
        .select({
          id: operationTargetsTable.id,
          item_id: operationTargetsTable.item_id,
          parent_id: operationTargetsTable.parent_id,
        })
        .from(operationTargetsTable)
        .where(
          and(
            eq(operationTargetsTable.operation_id, operationId),
            eq(operationTargetsTable.processed, 0),
          ),
        )
        .orderBy(
          asc(operationTargetsTable.item_id),
          asc(operationTargetsTable.parent_id),
          asc(operationTargetsTable.id),
        )
        .limit(20)
        .all();
    },
    read: (id) => stillWorking(db, id),
    async reapplicationTargets(operationId) {
      return await orm
        .select(getTableColumns(entitiesTable))
        .from(entitiesTable)
        .innerJoin(
          operationTargetsTable,
          and(
            eq(operationTargetsTable.item_id, entitiesTable.item_id),
            eq(operationTargetsTable.resource, entitiesTable.resource),
            eq(operationTargetsTable.parent_id, entitiesTable.parent_id),
            eq(operationTargetsTable.id, entitiesTable.id),
          ),
        )
        .where(
          and(
            eq(operationTargetsTable.operation_id, operationId),
            eq(operationTargetsTable.processed, 0),
          ),
        )
        .orderBy(
          operationTargetsTable.item_id,
          operationTargetsTable.parent_id,
          operationTargetsTable.id,
        )
        .limit(20)
        .all();
    },
    async receipt(operationId, key) {
      const row = await orm
        .select({ progress: pageCommitsTable.progress })
        .from(pageCommitsTable)
        .where(
          and(
            eq(pageCommitsTable.operation_id, operationId),
            eq(pageCommitsTable.step_key, key),
          ),
        )
        .get();
      return row?.progress ?? null;
    },
    rules: (revision) => rulesFor(db, revision),
    async selectPending(operationId, itemIds) {
      await orm
        .insert(operationTargetsTable)
        .select(
          orm
            .select({
              id: entitiesTable.id,
              item_id: entitiesTable.item_id,
              operation_id: sql<string>`${operationId}`.as("operation_id"),
              parent_id: entitiesTable.parent_id,
              processed: sql<number>`0`.as("processed"),
              resource: entitiesTable.resource,
            })
            .from(entitiesTable)
            .where(
              and(
                inArray(entitiesTable.item_id, itemIds),
                eq(entitiesTable.resource, Resource.transactions),
                eq(entitiesTable.status, TransactionStatus.PENDING),
                eq(entitiesTable.deleted, 0),
              ),
            ),
        )
        .onConflictDoNothing()
        .run();
    },
    async selectReapplication(op) {
      const filter = op.input.filter
        ? compileFilter(db, op.input.filter)
        : undefined;
      await orm
        .insert(operationTargetsTable)
        .select(
          orm
            .select({
              id: effectiveEntitiesTable.id,
              item_id: effectiveEntitiesTable.item_id,
              operation_id: sql<string>`${op.id}`.as("operation_id"),
              parent_id: effectiveEntitiesTable.parent_id,
              processed: sql<number>`0`.as("processed"),
              resource: effectiveEntitiesTable.resource,
            })
            .from(effectiveEntitiesTable)
            .where(
              and(
                eq(effectiveEntitiesTable.resource, Resource.transactions),
                eq(effectiveEntitiesTable.deleted, 0),
                inArray(effectiveEntitiesTable.item_id, op.input.itemIds),
                filter,
              ),
            ),
        )
        .onConflictDoNothing()
        .run();
    },
    async setCoverage(itemId, resource, status) {
      await orm
        .insert(coverageTable)
        .values({ item_id: itemId, parent_id: "", resource, status })
        .onConflictDoUpdate({
          set: { status: sql`excluded.status` },
          target: [
            coverageTable.item_id,
            coverageTable.resource,
            coverageTable.parent_id,
          ],
        })
        .run();
    },
    async sourceFailure(identity, status, countError) {
      await orm
        .insert(coverageTable)
        .values({
          item_id: identity.itemId,
          parent_id: identity.parentId,
          resource: identity.resource,
          status,
        })
        .onConflictDoUpdate({
          set: { status: sql`excluded.status` },
          target: [
            coverageTable.item_id,
            coverageTable.resource,
            coverageTable.parent_id,
          ],
        })
        .run();
      if (countError) {
        await orm
          .update(operationsTable)
          .set({
            progress: sql`json_set(${operationsTable.progress}, '$.errors', coalesce(json_extract(${operationsTable.progress}, '$.errors'),0)+1)`,
          })
          .where(eq(operationsTable.id, identity.operationId))
          .run();
      }
    },
  };
}
