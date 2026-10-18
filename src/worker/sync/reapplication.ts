import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { OperationInput } from "#contracts/operation.ts";
import { txContext } from "#domain/rules/rules.ts";
import { parseJson } from "#shared/json.ts";
import {
  database,
  preparedStatement,
  rows,
  statement,
} from "#worker/database.ts";
import {
  derivedStatements,
  StoredSchema,
} from "#worker/finance/entities.repository.ts";
import {
  compileFilter,
  authorizedItems,
  requireResource,
} from "#worker/finance/repository.ts";
import type { rulesFor } from "#worker/finance/rules.repository.ts";
import * as tables from "#worker/schema.ts";
import {
  ProgressSchema,
  type Operation,
} from "#worker/sync/operation-storage.ts";
import { finish, stillWorking } from "#worker/sync/repository.ts";
import type { Steps } from "#worker/sync/service.ts";

type Flow = {
  db: D1Database;
  op: Operation;
  input: Extract<OperationInput, { kind: "reapply" }>;
  items: { id: string; resources: string }[];
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
  for (const item of items)
    await requireResource(db, op.principal, item.id, "transactions");
  const filter = input.filter
    ? compileFilter(input.filter)
    : { sql: "1", params: [] };
  await step.do("select-reapply", async () => {
    await statement(
      db,
      `INSERT OR IGNORE INTO operation_targets(operation_id,item_id,resource,parent_id,id) SELECT ?,e.item_id,e.resource,e.parent_id,e.id FROM effective_entities e WHERE e.principal=? AND e.resource='transactions' AND e.deleted=0 AND e.item_id IN (${input.itemIds.map(() => "?").join(",")}) AND (${filter.sql})`,
      id,
      op.principal,
      ...input.itemIds,
      ...filter.params,
    ).run();
    return { phase: "selected" };
  });
  for (let batch = 0; ; batch++) {
    const result = await step.do(`reapply-${batch}`, async () => {
      const key = `reapply-${batch}`;
      const saved = await preparedStatement(
        db,
        database(db)
          .select({ progress: tables.page_commits.progress })
          .from(tables.page_commits)
          .where(
            and(
              eq(tables.page_commits.operation_id, id),
              eq(tables.page_commits.step_key, key),
            ),
          ),
      ).first("progress");
      if (saved)
        return z
          .object({ done: z.boolean(), cancelled: z.boolean() })
          .parse(parseJson(z.string().parse(saved)));
      if ((await stillWorking(db, id)).cancel_requested)
        return { done: true, cancelled: true };
      await authorizedItems(db, op.principal, input.itemIds);
      const selected = await rows(
        statement(
          db,
          "SELECT e.* FROM entities e JOIN operation_targets t ON t.item_id=e.item_id AND t.resource=e.resource AND t.parent_id=e.parent_id AND t.id=e.id WHERE e.principal=? AND t.operation_id=? AND t.processed=0 ORDER BY t.item_id,t.parent_id,t.id LIMIT 20",
          op.principal,
          id,
        ),
        StoredSchema,
      );
      const edits = (
        await Promise.all(
          selected.map(async (r) => [
            ...derivedStatements(
              db,
              {
                principal: op.principal,
                itemId: r.item_id,
                resource: r.resource,
                parentId: r.parent_id,
                id: r.id,
              },
              op.rules_revision,
              await engine.evaluate(txContext(parseJson(r.normalized))),
            ),
            preparedStatement(
              db,
              database(db)
                .update(tables.operation_targets)
                .set({ processed: 1 })
                .where(
                  and(
                    eq(tables.operation_targets.operation_id, id),
                    eq(tables.operation_targets.item_id, r.item_id),
                    eq(tables.operation_targets.resource, r.resource),
                    eq(tables.operation_targets.parent_id, r.parent_id),
                    eq(tables.operation_targets.id, r.id),
                  ),
                ),
            ),
          ]),
        )
      ).flat();
      const progress = ProgressSchema.parse(
        parseJson((await stillWorking(db, id)).progress),
      );
      progress.classified += selected.length;
      progress.received += selected.length;
      const outcome = { done: selected.length < 20, cancelled: false };
      await db.batch([
        ...edits,
        preparedStatement(
          db,
          database(db)
            .update(tables.principals)
            .set({ revision: sql`${tables.principals.revision} + 1` })
            .where(eq(tables.principals.id, op.principal)),
        ),
        preparedStatement(
          db,
          database(db)
            .update(tables.operations)
            .set({
              progress: JSON.stringify(progress),
              phase: "reapply",
              updated_at: new Date().toISOString(),
            })
            .where(eq(tables.operations.id, id)),
        ),
        preparedStatement(
          db,
          database(db)
            .insert(tables.page_commits)
            .values({
              operation_id: id,
              step_key: key,
              progress: JSON.stringify(outcome),
            }),
        ),
      ]);
      return outcome;
    });
    if (result.cancelled) {
      await finish(db, op, "cancelled");
      return true;
    }
    if (result.done) break;
  }

  return false;
}
