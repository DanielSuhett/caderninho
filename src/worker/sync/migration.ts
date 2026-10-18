import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { OperationInput } from "#contracts/operation.ts";
import { database, hash } from "#worker/database.ts";
import { prepareEntity } from "#worker/finance/entities.repository.ts";
import type { rulesFor } from "#worker/finance/rules.repository.ts";
import * as tables from "#worker/schema.ts";
import type { Operation } from "#worker/sync/operation-storage.ts";
import { finish, stillWorking } from "#worker/sync/repository.ts";
import type { Steps } from "#worker/sync/service.ts";

type Flow = {
  db: D1Database;
  op: Operation;
  input: Extract<OperationInput, { kind: "migration" }>;
  items: Pick<typeof tables.items.$inferSelect, "id" | "resources">[];
  engine: Awaited<ReturnType<typeof rulesFor>>;
  step: Steps;
};
export async function migrateLegacy({
  db,
  op,
  input,
  items,
  engine,
  step,
}: Flow) {
  const id = op.id;
  await step.do("import-legacy", async () => {
    if ((await stillWorking(db, id)).cancel_requested) {
      await finish(db, op, "cancelled");
      return { cancelled: true };
    }
    const itemId = input.itemIds[0];
    const item = items[0];
    if (!itemId || !item) {
      throw new Error("ITEM_NOT_AUTHORIZED");
    }
    const edits: BatchItem<"sqlite">[] = [];
    for (const row of input.migration) {
      const identity = {
        itemId,
        resource: row.resource,
        parentId: row.parentId,
        id: row.record.id,
      };
      const allowed = item.resources;
      if (!allowed.includes(row.resource)) {
        throw new Error("RESOURCE_NOT_AUTHORIZED");
      }
      const digest = await hash(row);
      if (
        await database(db)
          .select({ found: sql`1` })
          .from(tables.migration_imports)
          .where(
            and(
              eq(tables.migration_imports.source_key, row.sourceKey),
              eq(tables.migration_imports.source_hash, digest),
            ),
          )
          .get()
      ) {
        continue;
      }
      if (
        await keepCurrentMigrationRecord(db, {
          itemId,
          row,
          policy: input.migrationPolicy,
        })
      ) {
        continue;
      }
      const prepared = await prepareEntity(db, {
        identity: identity,
        source: {
          id: row.record.id,
          resourceId: row.record.id,
          legacyProjection: row.record,
          legacySourceKey: row.sourceKey,
        },
        parent: null,
        operation: op,
        engine: engine,
        legacyProjection: row.record,
      });
      edits.push(
        ...prepared.statements,
        database(db)
          .insert(tables.migration_imports)
          .values({
            source_key: row.sourceKey,
            source_hash: digest,
            imported_at: new Date().toISOString(),
          })
          .onConflictDoNothing(),
      );
    }
    if (edits.length) {
      const [first, ...rest] = [
        ...edits,
        database(db)
          .update(tables.settings)
          .set({ revision: sql`${tables.settings.revision} + 1` })
          .where(eq(tables.settings.id, 1)),
      ];
      await database(db).batch([first, ...rest]);
    }
    return { imported: input.migration.length };
  });
}

async function keepCurrentMigrationRecord(
  db: D1Database,
  {
    itemId,
    row,
    policy,
  }: {
    itemId: string;
    row: Flow["input"]["migration"][number];
    policy: Flow["input"]["migrationPolicy"];
  },
) {
  const existing = await database(db)
    .select({
      normalized: tables.entities.normalized,
      observed_at: tables.entities.observed_at,
    })
    .from(tables.entities)
    .where(
      and(
        eq(tables.entities.item_id, itemId),
        eq(tables.entities.resource, row.resource),
        eq(tables.entities.parent_id, row.parentId),
        eq(tables.entities.id, row.record.id),
      ),
    )
    .get();
  if (
    !existing ||
    (await hash(existing.normalized)) === (await hash(row.record))
  ) {
    return false;
  }
  if (!policy || policy === "refuse-conflicts") {
    throw new Error("MIGRATION_OVERLAP_REQUIRES_POLICY");
  }
  return policy === "keep-current";
}
