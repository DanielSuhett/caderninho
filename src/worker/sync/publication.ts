import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { OperationInputSchema } from "#contracts/operation.ts";
import type { Resource } from "#domain/enums.ts";
import { parseJson } from "#shared/json.ts";
import { tryCatch } from "#shared/result.ts";
import {
  database,
  preparedStatement,
  hash,
  statement,
} from "#worker/database.ts";
import { prepareEntity } from "#worker/finance/entities.repository.ts";
import { authorizedItems } from "#worker/finance/repository.ts";
import type { rulesFor } from "#worker/finance/rules.repository.ts";
import * as tables from "#worker/schema.ts";
import {
  ProgressSchema,
  CheckpointSchema,
  OperationSchema,
  type Operation,
} from "#worker/sync/operation-storage.ts";
import type { FinancialSource } from "#worker/sync/service.ts";

async function stillWorking(db: D1Database, id: string) {
  return OperationSchema.parse(
    await preparedStatement(
      db,
      database(db)
        .select()
        .from(tables.operations)
        .where(eq(tables.operations.id, id)),
    ).first(),
  );
}
export async function publishPage({
  db,
  op,
  name,
  resource,
  item,
  parentId,
  parent,
  engine,
  provider,
}: {
  db: D1Database;
  op: Operation;
  name: string;
  resource: Resource;
  item: { id: string };
  parentId: string;
  parent: { normalized: string; relevant_hash: string } | null;
  engine: Awaited<ReturnType<typeof rulesFor>>;
  provider: Pick<FinancialSource, "page">;
}) {
  const id = op.id;
  const input = OperationInputSchema.parse(parseJson(op.input));
  const parentSignature = parent?.relevant_hash ?? null;
  const committed = await preparedStatement(
    db,
    database(db)
      .select({ progress: tables.page_commits.progress })
      .from(tables.page_commits)
      .where(
        and(
          eq(tables.page_commits.operation_id, id),
          eq(tables.page_commits.step_key, name),
        ),
      ),
  ).first("progress");
  if (committed)
    return z
      .object({ done: z.boolean(), cancelled: z.boolean() })
      .parse(parseJson(z.string().parse(committed)));
  if ((await stillWorking(db, id)).cancel_requested)
    return { done: true, cancelled: true };
  await authorizedItems(db, [item.id]);
  const cp = CheckpointSchema.parse(
    await preparedStatement(
      db,
      database(db)
        .select()
        .from(tables.checkpoints)
        .where(
          and(
            eq(tables.checkpoints.operation_id, id),
            eq(tables.checkpoints.item_id, item.id),
            eq(tables.checkpoints.resource, resource),
            eq(tables.checkpoints.parent_id, parentId),
          ),
        ),
    ).first(),
  );
  if (cp.done) return { done: true, cancelled: false };
  let connectorId: string | undefined;
  if (resource === "connectors") {
    const connection = z.string().parse(
      await preparedStatement(
        db,
        database(db)
          .select({ source: tables.entities.source })
          .from(tables.entities)
          .where(
            and(
              eq(tables.entities.item_id, item.id),
              eq(tables.entities.resource, "connections"),
            ),
          ),
      ).first("source"),
    );
    connectorId = String(
      z
        .object({
          connector: z.object({ id: z.union([z.string(), z.number()]) }),
        })
        .parse(parseJson(connection)).connector.id,
    );
  }
  const fetched = await tryCatch(
    provider.page(
      resource,
      item.id,
      parentId,
      cp.cursor,
      cp.creation_floor,
      connectorId,
    ),
  );
  if (fetched.error) {
    const code =
      "code" in fetched.error ? String(fetched.error.code) : "UPSTREAM_ERROR";
    const state =
      code === "UPSTREAM_FORBIDDEN"
        ? "not_authorized"
        : code === "UPSTREAM_NOT_FOUND"
          ? "unavailable"
          : "partial";
    await preparedStatement(
      db,
      database(db)
        .insert(tables.coverage)
        .values({
          item_id: item.id,
          resource: resource,
          parent_id: parentId,
          status: state,
        })
        .onConflictDoUpdate({
          target: [
            tables.coverage.item_id,
            tables.coverage.resource,
            tables.coverage.parent_id,
          ],
          set: { status: sql`excluded.status` },
        }),
    ).run();
    if (state === "not_authorized" || state === "unavailable") {
      await statement(
        db,
        "UPDATE operations SET progress=json_set(progress,'$.errors',COALESCE(json_extract(progress,'$.errors'),0)+1) WHERE id=?",
        id,
      ).run();
      return { done: true, cancelled: false };
    }
    throw fetched.error;
  }
  const page = fetched.data;
  if (cp.expected_total !== null && page.total !== cp.expected_total)
    throw new Error("SOURCE_TOTAL_CHANGED_RECONCILE_REQUIRED");
  let collected = cp.collected;
  if (
    page.next &&
    (await statement(
      db,
      "SELECT step_key FROM page_commits WHERE operation_id=? AND json_extract(progress,'$.nextCursor')=? AND json_extract(progress,'$.resource')=? AND json_extract(progress,'$.parent')=? AND json_extract(progress,'$.item')=?",
      id,
      page.next,
      resource,
      parentId,
      item.id,
    ).first())
  )
    throw new Error("CURSOR_LOOP");
  let maximum = cp.maximum_created_at;
  const edits: D1PreparedStatement[] = [];
  const progress = ProgressSchema.parse(
    parseJson((await stillWorking(db, id)).progress),
  );
  progress.pages++;
  progress.received += page.records.length;
  const identities = new Map<string, string>();
  for (const record of page.records) {
    const recordId = z
      .string()
      .parse(resource === "resources" ? record.resourceId : String(record.id));
    const contentHash = await hash(record);
    const duplicate = identities.get(recordId);
    if (duplicate) {
      if (duplicate !== contentHash)
        throw new Error("DUPLICATE_SOURCE_ID_CHANGED_IN_PAGE");
      progress.duplicates++;
      continue;
    }
    identities.set(recordId, contentHash);
    const prepared = await prepareEntity(
      db,
      {
        itemId: item.id,
        resource,
        parentId,
        id: recordId,
      },
      record,
      parent ? parseJson(parent.normalized) : null,
      op,
      engine,
    );
    if (!prepared.seenInOperation) collected++;
    edits.push(...prepared.statements);
    if (prepared.state === "new") progress.new++;
    else if (prepared.state === "changed") progress.changed++;
    else progress.unchanged++;
    progress.classified += prepared.classified;
    if (resource === "transactions") {
      const created = z.iso.datetime().nullish().parse(record.createdAt);
      if (created) {
        const canonical = new Date(created).toISOString();
        if (!maximum || canonical > maximum) maximum = canonical;
      }
    }
  }
  if (!page.next && page.total !== undefined && collected !== page.total)
    throw new Error("SOURCE_PAGE_COUNT_INCOMPLETE");
  // Empty initial accounts still get a creation watermark fixed at operation
  // start. It is inclusive and only advanced after complete pagination.
  if (resource === "transactions" && !maximum && !page.next)
    maximum = op.created_at;
  if (!page.next) progress.resources++;
  edits.push(
    preparedStatement(
      db,
      database(db)
        .update(tables.checkpoints)
        .set({
          cursor: page.next,
          maximum_created_at: maximum,
          page: sql`${tables.checkpoints.page} + 1`,
          done: Number(page.next === null),
          expected_total: page.total ?? null,
          collected: collected,
        })
        .where(
          and(
            eq(tables.checkpoints.operation_id, id),
            eq(tables.checkpoints.item_id, item.id),
            eq(tables.checkpoints.resource, resource),
            eq(tables.checkpoints.parent_id, parentId),
          ),
        ),
    ),
  );
  if (
    !page.next &&
    (input.kind === "reconcile" ||
      !["transactions", "investment_transactions"].includes(resource))
  )
    edits.push(
      preparedStatement(
        db,
        database(db)
          .update(tables.entities)
          .set({ deleted: 1 })
          .where(
            and(
              eq(tables.entities.item_id, item.id),
              eq(tables.entities.resource, resource),
              eq(tables.entities.parent_id, parentId),
              ne(tables.entities.normalizer, "legacy-projection-v1"),
              sql`COALESCE(${tables.entities.seen_operation}, '') != ${id}`,
            ),
          ),
      ),
    );
  const coverageState = page.next
    ? "partial"
    : page.records.length || cp.page
      ? "available"
      : "empty";
  edits.push(
    statement(
      db,
      "INSERT INTO coverage(item_id,resource,parent_id,status,bootstrap_complete,confirmed_created_at,observed_at,parent_signature) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(item_id,resource,parent_id) DO UPDATE SET status=excluded.status,bootstrap_complete=MAX(coverage.bootstrap_complete,excluded.bootstrap_complete),confirmed_created_at=CASE WHEN excluded.bootstrap_complete=1 THEN excluded.confirmed_created_at ELSE coverage.confirmed_created_at END,observed_at=excluded.observed_at,parent_signature=CASE WHEN excluded.bootstrap_complete=1 THEN excluded.parent_signature ELSE coverage.parent_signature END",
      item.id,
      resource,
      parentId,
      coverageState,
      Number(!page.next),
      maximum,
      new Date().toISOString(),
      parentSignature,
    ),
  );
  const outcome = { done: !page.next, cancelled: false };
  edits.push(
    preparedStatement(
      db,
      database(db)
        .update(tables.operations)
        .set({
          progress: JSON.stringify(progress),
          phase: resource,
          updated_at: new Date().toISOString(),
        })
        .where(eq(tables.operations.id, id)),
    ),
    preparedStatement(
      db,
      database(db)
        .update(tables.settings)
        .set({ revision: sql`${tables.settings.revision} + 1` })
        .where(eq(tables.settings.id, 1)),
    ),
    preparedStatement(
      db,
      database(db)
        .insert(tables.page_commits)
        .values({
          operation_id: id,
          step_key: name,
          progress: JSON.stringify({
            ...outcome,
            nextCursor: page.next,
            resource,
            parent: parentId,
            item: item.id,
          }),
        }),
    ),
  );
  await db.batch(edits);
  return outcome;
}
