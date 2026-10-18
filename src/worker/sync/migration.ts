import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { OperationInput } from "#contracts/operation.ts";
import { ResourceSchema } from "#domain/enums.ts";
import { parseJson } from "#shared/json.ts";
import { database, preparedStatement, hash } from "#worker/database.ts";
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
  items: { id: string; resources: string }[];
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
    if (!itemId || !item) throw new Error("ITEM_NOT_AUTHORIZED");
    const edits: D1PreparedStatement[] = [];
    for (const row of input.migration ?? []) {
      const identity = {
        itemId,
        resource: row.resource,
        parentId: row.parentId,
        id: row.record.id,
      };
      const allowed = z.array(ResourceSchema).parse(parseJson(item.resources));
      if (!allowed.includes(row.resource))
        throw new Error("RESOURCE_NOT_AUTHORIZED");
      const digest = await hash(row);
      if (
        await preparedStatement(
          db,
          database(db)
            .select({ found: sql`1` })
            .from(tables.migration_imports)
            .where(
              and(
                eq(tables.migration_imports.source_key, row.sourceKey),
                eq(tables.migration_imports.source_hash, digest),
              ),
            ),
        ).first()
      )
        continue;
      const existing = await preparedStatement(
        db,
        database(db)
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
          ),
      ).first();
      if (
        existing &&
        (await hash(parseJson(z.string().parse(existing.normalized)))) !==
          (await hash(row.record))
      ) {
        if (
          input.migrationPolicy === "refuse-conflicts" ||
          !input.migrationPolicy
        )
          throw new Error("MIGRATION_OVERLAP_REQUIRES_POLICY");
        if (input.migrationPolicy === "keep-current") continue;
      }
      const prepared = await prepareEntity(
        db,
        identity,
        {
          id: row.record.id,
          resourceId: row.record.id,
          legacyProjection: row.record,
          legacySourceKey: row.sourceKey,
        },
        null,
        op,
        engine,
        row.record,
      );
      edits.push(
        ...prepared.statements,
        preparedStatement(
          db,
          database(db)
            .insert(tables.migration_imports)
            .values({
              source_key: row.sourceKey,
              source_hash: digest,
              imported_at: new Date().toISOString(),
            })
            .onConflictDoNothing(),
        ),
      );
    }
    if (edits.length)
      await db.batch([
        ...edits,
        preparedStatement(
          db,
          database(db)
            .update(tables.settings)
            .set({ revision: sql`${tables.settings.revision} + 1` })
            .where(eq(tables.settings.id, 1)),
        ),
      ]);
    return { imported: input.migration?.length ?? 0 };
  });
}
