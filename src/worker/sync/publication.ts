import { and, eq, ne, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Resource } from "#domain/enums.ts";
import { tryCatch } from "#shared/result.ts";
import { database, hash, required } from "#worker/database.ts";
import { prepareEntity } from "#worker/finance/entities.repository.ts";
import { authorizedItems } from "#worker/finance/repository.ts";
import type { rulesFor } from "#worker/finance/rules.repository.ts";
import * as tables from "#worker/schema.ts";
import {
  type Operation,
  progressWithDefaults,
} from "#worker/sync/operation-storage.ts";
import type { FinancialSource } from "#worker/sync/service.ts";

async function stillWorking(db: D1Database, id: string) {
  return required(
    await database(db)
      .select()
      .from(tables.operations)
      .where(eq(tables.operations.id, id))
      .get(),
  );
}
type PublicationInput = {
  db: D1Database;
  op: Operation;
  name: string;
  resource: Resource;
  item: { id: string };
  parentId: string;
  parent: Pick<
    typeof tables.entities.$inferSelect,
    "normalized" | "relevant_hash"
  > | null;
  engine: Awaited<ReturnType<typeof rulesFor>>;
  provider: Pick<FinancialSource, "page">;
};

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
}: PublicationInput) {
  const id = op.id;
  const input = op.input;
  const parentSignature = parent?.relevant_hash ?? null;
  const committed = await database(db)
    .select({ progress: tables.page_commits.progress })
    .from(tables.page_commits)
    .where(
      and(
        eq(tables.page_commits.operation_id, id),
        eq(tables.page_commits.step_key, name),
      ),
    )
    .get()
    .then((row) => row?.progress ?? null);
  if (committed) {
    return { done: committed.done, cancelled: committed.cancelled };
  }
  if ((await stillWorking(db, id)).cancel_requested) {
    return { done: true, cancelled: true };
  }
  await authorizedItems(db, [item.id]);
  const cp = required(
    await database(db)
      .select()
      .from(tables.checkpoints)
      .where(
        and(
          eq(tables.checkpoints.operation_id, id),
          eq(tables.checkpoints.item_id, item.id),
          eq(tables.checkpoints.resource, resource),
          eq(tables.checkpoints.parent_id, parentId),
        ),
      )
      .get(),
  );
  if (cp.done) {
    return { done: true, cancelled: false };
  }
  const page = await fetchSourcePage(db, {
    op,
    resource,
    item,
    parentId,
    cp,
    provider,
  });
  if (!page) {
    return { done: true, cancelled: false };
  }
  await assertPageContinuation(db, { cp, page, id, resource, parentId, item });
  const progress = progressWithDefaults((await stillWorking(db, id)).progress);
  const {
    edits,
    collected,
    maximum: observedMaximum,
  } = await preparePageRecords(db, {
    op,
    resource,
    item,
    parentId,
    parent,
    engine,
    page,
    cp,
    progress,
  });
  let maximum = observedMaximum;
  if (!page.next && page.total !== undefined && collected !== page.total) {
    throw new Error("SOURCE_PAGE_COUNT_INCOMPLETE");
  }
  // Empty initial accounts still get a creation watermark fixed at operation
  // start. It is inclusive and only advanced after complete pagination.
  if (resource === "transactions" && !maximum && !page.next) {
    maximum = op.created_at;
  }
  if (!page.next) {
    progress.resources++;
  }
  edits.push(
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
  );
  if (
    !page.next &&
    (input.kind === "reconcile" ||
      !["transactions", "investment_transactions"].includes(resource))
  ) {
    edits.push(
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
    );
  }
  edits.push(
    coverageStatement(db, {
      page,
      cp,
      item,
      resource,
      parentId,
      maximum,
      parentSignature,
    }),
  );
  const outcome = { done: !page.next, cancelled: false };
  edits.push(
    database(db)
      .update(tables.operations)
      .set({
        progress: progress,
        phase: resource,
        updated_at: new Date().toISOString(),
      })
      .where(eq(tables.operations.id, id)),
    database(db)
      .update(tables.settings)
      .set({ revision: sql`${tables.settings.revision} + 1` })
      .where(eq(tables.settings.id, 1)),
    database(db)
      .insert(tables.page_commits)
      .values({
        operation_id: id,
        step_key: name,
        progress: {
          ...outcome,
          nextCursor: page.next,
          resource,
          parent: parentId,
          item: item.id,
        },
      }),
  );
  {
    const [first, ...rest] = edits;
    if (first) {
      await database(db).batch([first, ...rest]);
    }
  }
  return outcome;
}

type Checkpoint = typeof tables.checkpoints.$inferSelect;
type SourcePage = Awaited<ReturnType<FinancialSource["page"]>>;

async function fetchSourcePage(
  db: D1Database,
  {
    op,
    resource,
    item,
    parentId,
    cp,
    provider,
  }: Pick<
    PublicationInput,
    "op" | "resource" | "item" | "parentId" | "provider"
  > & { cp: Checkpoint },
) {
  const id = op.id;
  let connectorId: string | undefined;
  if (resource === "connectors") {
    const connection = required(
      await database(db)
        .select({ source: tables.entities.source })
        .from(tables.entities)
        .where(
          and(
            eq(tables.entities.item_id, item.id),
            eq(tables.entities.resource, "connections"),
          ),
        )
        .get()
        .then((row) => row?.source ?? null),
    );
    if (!connection?.connector?.id) {
      throw new Error("CONNECTOR_MISSING");
    }
    connectorId = String(connection.connector.id);
  }
  const fetched = await tryCatch(
    provider.page({
      resource: resource,
      item: item.id,
      parent: parentId,
      cursor: cp.cursor,
      floor: cp.creation_floor,
      connectorId: connectorId,
    }),
  );
  if (fetched.error) {
    const code =
      "code" in fetched.error ? String(fetched.error.code) : "UPSTREAM_ERROR";
    let state = "partial";
    if (code === "UPSTREAM_FORBIDDEN") {
      state = "not_authorized";
    } else if (code === "UPSTREAM_NOT_FOUND") {
      state = "unavailable";
    }
    await database(db)
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
      })
      .run();
    if (state === "not_authorized" || state === "unavailable") {
      await database(db)
        .update(tables.operations)
        .set({
          progress: sql`json_set(${tables.operations.progress}, '$.errors', coalesce(json_extract(${tables.operations.progress}, '$.errors'),0)+1)`,
        })
        .where(eq(tables.operations.id, id))
        .run();
      return null;
    }
    throw fetched.error;
  }
  return fetched.data;
}

async function preparePageRecords(
  db: D1Database,
  {
    op,
    resource,
    item,
    parentId,
    parent,
    engine,
    page,
    cp,
    progress,
  }: Omit<PublicationInput, "db" | "name" | "provider"> & {
    page: SourcePage;
    cp: Checkpoint;
    progress: ReturnType<typeof progressWithDefaults>;
  },
) {
  let maximum = cp.maximum_created_at;
  let collected = cp.collected;
  const edits: BatchItem<"sqlite">[] = [];
  progress.pages++;
  progress.received += page.records.length;
  const identities = new Map<string, string>();
  for (const record of page.records) {
    const recordId =
      resource === "resources" ? record.resourceId : String(record.id);
    if (typeof recordId !== "string") {
      throw new Error("SOURCE_ID_MISSING");
    }
    const contentHash = await hash(record);
    const duplicate = identities.get(recordId);
    if (duplicate) {
      if (duplicate !== contentHash) {
        throw new Error("DUPLICATE_SOURCE_ID_CHANGED_IN_PAGE");
      }
      progress.duplicates++;
      continue;
    }
    identities.set(recordId, contentHash);
    const prepared = await prepareEntity(db, {
      identity: {
        itemId: item.id,
        resource,
        parentId,
        id: recordId,
      },
      source: record,
      parent: parent ? parent.normalized : null,
      operation: op,
      engine: engine,
    });
    if (!prepared.seenInOperation) {
      collected++;
    }
    edits.push(...prepared.statements);
    if (prepared.state === "new") {
      progress.new++;
    } else if (prepared.state === "changed") {
      progress.changed++;
    } else {
      progress.unchanged++;
    }
    progress.classified += prepared.classified;
    if (resource === "transactions") {
      maximum = latestCreatedAt(maximum, record.createdAt);
    }
  }

  return { edits, collected, maximum };
}

function latestCreatedAt(
  maximum: string | null,
  created: string | undefined | null,
) {
  if (!created) {
    return maximum;
  }
  const canonical = new Date(created).toISOString();
  return !maximum || canonical > maximum ? canonical : maximum;
}

async function assertPageContinuation(
  db: D1Database,
  {
    cp,
    page,
    id,
    resource,
    parentId,
    item,
  }: {
    cp: Checkpoint;
    page: SourcePage;
    id: string;
  } & Pick<PublicationInput, "resource" | "parentId" | "item">,
) {
  if (cp.expected_total !== null && page.total !== cp.expected_total) {
    throw new Error("SOURCE_TOTAL_CHANGED_RECONCILE_REQUIRED");
  }
  if (
    page.next &&
    (await database(db)
      .select({ step_key: tables.page_commits.step_key })
      .from(tables.page_commits)
      .where(
        and(
          eq(tables.page_commits.operation_id, id),
          eq(
            sql`json_extract(${tables.page_commits.progress}, '$.nextCursor')`,
            page.next,
          ),
          eq(
            sql`json_extract(${tables.page_commits.progress}, '$.resource')`,
            resource,
          ),
          eq(
            sql`json_extract(${tables.page_commits.progress}, '$.parent')`,
            parentId,
          ),
          eq(
            sql`json_extract(${tables.page_commits.progress}, '$.item')`,
            item.id,
          ),
        ),
      )
      .get())
  ) {
    throw new Error("CURSOR_LOOP");
  }
}

function coverageStatement(
  db: D1Database,
  {
    page,
    cp,
    item,
    resource,
    parentId,
    maximum,
    parentSignature,
  }: {
    page: SourcePage;
    cp: Checkpoint;
    maximum: string | null;
    parentSignature: string | null;
  } & Pick<PublicationInput, "item" | "resource" | "parentId">,
) {
  let coverageState = "empty";
  if (page.next) {
    coverageState = "partial";
  } else if (page.records.length || cp.page) {
    coverageState = "available";
  }
  return database(db)
    .insert(tables.coverage)
    .values({
      item_id: item.id,
      resource,
      parent_id: parentId,
      status: coverageState,
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
    });
}
