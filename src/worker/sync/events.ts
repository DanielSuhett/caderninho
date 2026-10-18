import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { database, required } from "#worker/database.ts";
import { prepareEntity } from "#worker/finance/entities.repository.ts";
import { authorizedItems } from "#worker/finance/repository.ts";
import type { rulesFor } from "#worker/finance/rules.repository.ts";
import * as tables from "#worker/schema.ts";
import {
  type Operation,
  progressWithDefaults,
} from "#worker/sync/operation-storage.ts";
import { stillWorking } from "#worker/sync/repository.ts";
import type { FinancialSource, Steps } from "#worker/sync/service.ts";

export async function publishResolved(
  db: D1Database,
  {
    operation: op,
    engine,
    item,
    account,
    ids,
    records,
    checkpoint = [],
  }: {
    operation: Operation;
    engine: Awaited<ReturnType<typeof rulesFor>>;
    item: string;
    account: string;
    ids: string[];
    records: Awaited<ReturnType<FinancialSource["ids"]>>;
    checkpoint?: BatchItem<"sqlite">[];
  },
) {
  const parent = required(
    await database(db)
      .select({ normalized: tables.entities.normalized })
      .from(tables.entities)
      .where(
        and(
          eq(tables.entities.item_id, item),
          eq(tables.entities.resource, "accounts"),
          eq(tables.entities.id, account),
        ),
      )
      .get()
      .then((row) => row?.normalized ?? null),
  );
  const edits: BatchItem<"sqlite">[] = [...checkpoint];
  const progress = progressWithDefaults(
    (await stillWorking(db, op.id)).progress,
  );
  progress.pages++;
  progress.received += records.length;
  for (const record of records) {
    if (typeof record.id !== "string") {
      throw new Error("SOURCE_ID_MISSING");
    }
    const prepared = await prepareEntity(db, {
      identity: {
        itemId: item,
        resource: "transactions",
        parentId: account,
        id: record.id,
      },
      source: record,
      parent: parent,
      operation: op,
      engine: engine,
    });
    edits.push(...prepared.statements);
    if (prepared.state === "new") {
      progress.new++;
    } else if (prepared.state === "changed") {
      progress.changed++;
    } else {
      progress.unchanged++;
    }
    progress.classified += prepared.classified;
  }
  edits.push(
    database(db)
      .update(tables.operations)
      .set({
        progress: progress,
        phase: "resolve-changes",
        updated_at: new Date().toISOString(),
      })
      .where(eq(tables.operations.id, op.id)),
  );
  for (const id of ids) {
    if (!records.some((r) => r.id === id)) {
      edits.push(
        database(db)
          .update(tables.entities)
          .set({ deleted: 1 })
          .where(
            and(
              eq(tables.entities.item_id, item),
              eq(tables.entities.resource, "transactions"),
              eq(tables.entities.parent_id, account),
              eq(tables.entities.id, id),
            ),
          ),
      );
    }
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
}
export async function resolveEvent(
  db: D1Database,
  {
    operation: op,
    provider,
    engine,
    eventId,
    step,
  }: {
    operation: Operation;
    provider: Pick<FinancialSource, "page" | "ids">;
    engine: Awaited<ReturnType<typeof rulesFor>>;
    eventId: string;
    step: Steps;
  },
) {
  const e = required(
    await database(db)
      .select()
      .from(tables.inbox)
      .where(eq(tables.inbox.event_id, eventId))
      .get(),
  );
  const payload = e.payload;
  let cursor: string | null = null;
  for (let batch = 0; ; batch++) {
    const key = `event-${batch}`,
      previous = cursor;
    const result: { done: boolean; cancelled: boolean; next: string | null } =
      await step.do(key, async () => {
        const saved = await database(db)
          .select({ progress: tables.page_commits.progress })
          .from(tables.page_commits)
          .where(
            and(
              eq(tables.page_commits.operation_id, op.id),
              eq(tables.page_commits.step_key, key),
            ),
          )
          .get()
          .then((row) => row?.progress ?? null);
        if (saved) {
          return { ...saved, next: saved.next ?? null };
        }
        if ((await stillWorking(db, op.id)).cancel_requested) {
          return { done: true, cancelled: true, next: null };
        }
        await authorizedItems(db, [e.item_id]);
        const ids =
          payload.transactionIds?.slice(batch * 20, (batch + 1) * 20) ?? [];
        if (!payload.transactionIds && !payload.transactionsCreatedAtFrom) {
          throw new Error("CREATED_EVENT_WATERMARK_MISSING");
        }
        const page = payload.transactionIds
          ? { records: await provider.ids(e.account_id, ids), next: null }
          : await provider.page({
              resource: "transactions",
              item: e.item_id,
              parent: e.account_id,
              cursor: previous,
              floor: payload.transactionsCreatedAtFrom ?? null,
            });
        await assertEventCursor(db, op.id, page.next);
        const outcome = {
          done: payload.transactionIds
            ? (batch + 1) * 20 >= payload.transactionIds.length
            : !page.next,
          cancelled: false,
          next: page.next,
        };
        await publishResolved(db, {
          operation: op,
          engine: engine,
          item: e.item_id,
          account: e.account_id,
          ids: ids,
          records: page.records,
          checkpoint: [
            database(db).insert(tables.page_commits).values({
              operation_id: op.id,
              step_key: key,
              progress: outcome,
            }),
          ],
        });
        return outcome;
      });
    if (result.cancelled) {
      return true;
    }
    if (result.done) {
      break;
    }
    cursor = result.next;
    await step.sleep(`event-pause-${batch}`, "1 second");
  }
  await step.do("event-receipt-complete", async () => {
    await database(db)
      .update(tables.inbox)
      .set({ processed_at: new Date().toISOString() })
      .where(eq(tables.inbox.event_id, eventId))
      .run();
    return { phase: "event-resolved" };
  });
  return false;
}

async function assertEventCursor(
  db: D1Database,
  operationId: string,
  next: string | null,
) {
  if (!next) {
    return;
  }
  if (
    await database(db)
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
      .get()
  ) {
    throw new Error("CURSOR_LOOP");
  }
}
