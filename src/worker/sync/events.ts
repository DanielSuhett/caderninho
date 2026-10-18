import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { parseJson } from "#shared/json.ts";
import { database, preparedStatement, statement } from "#worker/database.ts";
import { prepareEntity } from "#worker/finance/entities.repository.ts";
import { authorizedItems } from "#worker/finance/repository.ts";
import type { rulesFor } from "#worker/finance/rules.repository.ts";
import * as tables from "#worker/schema.ts";
import {
  ProgressSchema,
  type Operation,
} from "#worker/sync/operation-storage.ts";
import { stillWorking } from "#worker/sync/repository.ts";
import type { FinancialSource, Steps } from "#worker/sync/service.ts";

export async function publishResolved(
  db: D1Database,
  op: Operation,
  engine: Awaited<ReturnType<typeof rulesFor>>,
  item: string,
  account: string,
  ids: string[],
  records: Awaited<ReturnType<FinancialSource["ids"]>>,
  checkpoint: D1PreparedStatement[] = [],
) {
  const parent = z.string().parse(
    await preparedStatement(
      db,
      database(db)
        .select({ normalized: tables.entities.normalized })
        .from(tables.entities)
        .where(
          and(
            eq(tables.entities.item_id, item),
            eq(tables.entities.resource, "accounts"),
            eq(tables.entities.id, account),
          ),
        ),
    ).first("normalized"),
  );
  const edits: D1PreparedStatement[] = [...checkpoint];
  const progress = ProgressSchema.parse(
    parseJson((await stillWorking(db, op.id)).progress),
  );
  progress.pages++;
  progress.received += records.length;
  for (const record of records) {
    const prepared = await prepareEntity(
      db,
      {
        itemId: item,
        resource: "transactions",
        parentId: account,
        id: z.string().parse(record.id),
      },
      record,
      parseJson(parent),
      op,
      engine,
    );
    edits.push(...prepared.statements);
    if (prepared.state === "new") progress.new++;
    else if (prepared.state === "changed") progress.changed++;
    else progress.unchanged++;
    progress.classified += prepared.classified;
  }
  edits.push(
    preparedStatement(
      db,
      database(db)
        .update(tables.operations)
        .set({
          progress: JSON.stringify(progress),
          phase: "resolve-changes",
          updated_at: new Date().toISOString(),
        })
        .where(eq(tables.operations.id, op.id)),
    ),
  );
  for (const id of ids)
    if (!records.some((r) => r.id === id))
      edits.push(
        preparedStatement(
          db,
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
        ),
      );
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
}
export async function resolveEvent(
  db: D1Database,
  op: Operation,
  provider: Pick<FinancialSource, "page" | "ids">,
  engine: Awaited<ReturnType<typeof rulesFor>>,
  eventId: string,
  step: Steps,
) {
  const e = z
    .object({
      item_id: z.string(),
      account_id: z.string(),
      payload: z.string(),
    })
    .parse(
      await preparedStatement(
        db,
        database(db)
          .select()
          .from(tables.inbox)
          .where(eq(tables.inbox.event_id, eventId)),
      ).first(),
    );
  const payload = z
    .object({
      transactionIds: z.array(z.string()).optional(),
      transactionsCreatedAtFrom: z.string().optional(),
    })
    .parse(parseJson(e.payload));
  let cursor: string | null = null;
  for (let batch = 0; ; batch++) {
    const key = `event-${batch}`,
      previous = cursor;
    const result: { done: boolean; cancelled: boolean; next: string | null } =
      await step.do(key, async () => {
        const saved = await preparedStatement(
          db,
          database(db)
            .select({ progress: tables.page_commits.progress })
            .from(tables.page_commits)
            .where(
              and(
                eq(tables.page_commits.operation_id, op.id),
                eq(tables.page_commits.step_key, key),
              ),
            ),
        ).first("progress");
        if (saved)
          return z
            .object({
              done: z.boolean(),
              cancelled: z.boolean(),
              next: z.string().nullable(),
            })
            .parse(parseJson(z.string().parse(saved)));
        if ((await stillWorking(db, op.id)).cancel_requested)
          return { done: true, cancelled: true, next: null };
        await authorizedItems(db, [e.item_id]);
        const ids =
          payload.transactionIds?.slice(batch * 20, (batch + 1) * 20) ?? [];
        if (!payload.transactionIds && !payload.transactionsCreatedAtFrom)
          throw new Error("CREATED_EVENT_WATERMARK_MISSING");
        const page = payload.transactionIds
          ? { records: await provider.ids(e.account_id, ids), next: null }
          : await provider.page(
              "transactions",
              e.item_id,
              e.account_id,
              previous,
              payload.transactionsCreatedAtFrom ?? null,
            );
        if (
          page.next &&
          (await statement(
            db,
            "SELECT 1 FROM page_commits WHERE operation_id=? AND json_extract(progress,'$.next')=?",
            op.id,
            page.next,
          ).first())
        )
          throw new Error("CURSOR_LOOP");
        const outcome = {
          done: payload.transactionIds
            ? (batch + 1) * 20 >= payload.transactionIds.length
            : !page.next,
          cancelled: false,
          next: page.next,
        };
        await publishResolved(
          db,
          op,
          engine,
          e.item_id,
          e.account_id,
          ids,
          page.records,
          [
            preparedStatement(
              db,
              database(db)
                .insert(tables.page_commits)
                .values({
                  operation_id: op.id,
                  step_key: key,
                  progress: JSON.stringify(outcome),
                }),
            ),
          ],
        );
        return outcome;
      });
    if (result.cancelled) return true;
    if (result.done) break;
    cursor = result.next;
    await step.sleep(`event-pause-${batch}`, "1 second");
  }
  await step.do("event-receipt-complete", async () => {
    await preparedStatement(
      db,
      database(db)
        .update(tables.inbox)
        .set({ processed_at: new Date().toISOString() })
        .where(eq(tables.inbox.event_id, eventId)),
    ).run();
    return { phase: "event-resolved" };
  });
  return false;
}
