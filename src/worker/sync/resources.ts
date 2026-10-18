import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import type { OperationInput } from "#contracts/operation.ts";
import { type Resource, ResourceSchema } from "#domain/enums.ts";
import { DEFINITIONS } from "#domain/finance-model.ts";
import { itemInfo, productState } from "#domain/provider-state.ts";
import { FinanceRecordSchema } from "#domain/schemas.ts";
import { parseJson } from "#shared/json.ts";
import {
  database,
  preparedStatement,
  rows,
  statement,
} from "#worker/database.ts";
import { StoredSchema } from "#worker/finance/entities.repository.ts";
import { authorizedItems } from "#worker/finance/repository.ts";
import type { rulesFor } from "#worker/finance/rules.repository.ts";
import * as tables from "#worker/schema.ts";
import { publishResolved } from "#worker/sync/events.ts";
import type { Operation } from "#worker/sync/operation-storage.ts";
import { publishPage } from "#worker/sync/publication.ts";
import { finish, stillWorking } from "#worker/sync/repository.ts";
import type { FinancialSource, Steps } from "#worker/sync/service.ts";

const resourceOrder: Resource[] = [
  "connections",
  "consents",
  "resources",
  "connectors",
  "categories",
  "accounts",
  "investments",
  "loans",
  "identity",
  "transactions",
  "bills",
  "investment_transactions",
  "statements",
];
export async function synchronizeResources({
  db,
  op,
  input,
  items,
  engine,
  step,
  provider,
}: {
  db: D1Database;
  op: Operation;
  input: OperationInput;
  items: { id: string; resources: string }[];
  engine: Awaited<ReturnType<typeof rulesFor>>;
  step: Steps;
  provider: Pick<FinancialSource, "page" | "ids">;
}) {
  const id = op.id;
  for (const item of items) {
    const allowed = z.array(ResourceSchema).parse(parseJson(item.resources));
    for (const resource of resourceOrder) {
      if (!allowed.includes(resource)) continue;
      const def = DEFINITIONS[resource];
      if (resource !== "connections") {
        const source = await preparedStatement(
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
        ).first("source");
        if (source) {
          const info = itemInfo(
            (await import("#domain/schemas.ts")).ProviderRecordSchema.parse(
              parseJson(z.string().parse(source)),
            ),
          );
          const consents = await rows(
            preparedStatement(
              db,
              database(db)
                .select({ normalized: tables.entities.normalized })
                .from(tables.entities)
                .where(
                  and(
                    eq(tables.entities.item_id, item.id),
                    eq(tables.entities.resource, "consents"),
                    eq(tables.entities.deleted, 0),
                  ),
                ),
            ),
            z.object({ normalized: z.string() }),
          );
          const availability = productState(
            resource,
            info,
            consents.map((x) =>
              FinanceRecordSchema.parse(parseJson(x.normalized)),
            ),
            Date.now(),
          );
          if (availability) {
            await step.do(`availability-${item.id}-${resource}`, async () => {
              await preparedStatement(
                db,
                database(db)
                  .insert(tables.coverage)
                  .values({
                    item_id: item.id,
                    resource: resource,
                    parent_id: "",
                    status: availability,
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
              return { availability };
            });
            continue;
          }
        }
      }
      const parents = def.parent
        ? await rows(
            preparedStatement(
              db,
              database(db)
                .select()
                .from(tables.entities)
                .where(
                  and(
                    eq(tables.entities.item_id, item.id),
                    eq(tables.entities.resource, def.parent),
                    eq(tables.entities.deleted, 0),
                  ),
                )
                .orderBy(asc(tables.entities.id)),
            ),
            StoredSchema,
          )
        : [null];
      for (const parent of parents) {
        if (
          resource === "bills" &&
          parent &&
          FinanceRecordSchema.parse(parseJson(parent.normalized)).type !==
            "CREDIT"
        )
          continue;
        const parentId = parent?.id ?? "";
        // Investment movements expose only page/pageSize, no CDC. Revisit a
        // changed parent, a new parent, or explicit reconciliation, never
        // routinely rescan unchanged investment history.
        const parentSignature = parent?.relevant_hash ?? null;
        if (resource === "investment_transactions" && input.kind === "sync") {
          const previous = await preparedStatement(
            db,
            database(db)
              .select({ parent_signature: tables.coverage.parent_signature })
              .from(tables.coverage)
              .where(
                and(
                  eq(tables.coverage.item_id, item.id),
                  eq(tables.coverage.resource, resource),
                  eq(tables.coverage.parent_id, parentId),
                  eq(tables.coverage.bootstrap_complete, 1),
                ),
              ),
          ).first();
          if (previous && previous.parent_signature === parentSignature)
            continue;
        }
        await step.do(
          `checkpoint-${item.id}-${resource}-${parentId}`,
          async () => {
            const coverage = z
              .object({
                bootstrap_complete: z.number(),
                confirmed_created_at: z.string().nullable(),
              })
              .nullable()
              .parse(
                await preparedStatement(
                  db,
                  database(db)
                    .select({
                      bootstrap_complete: tables.coverage.bootstrap_complete,
                      confirmed_created_at:
                        tables.coverage.confirmed_created_at,
                    })
                    .from(tables.coverage)
                    .where(
                      and(
                        eq(tables.coverage.item_id, item.id),
                        eq(tables.coverage.resource, resource),
                        eq(tables.coverage.parent_id, parentId),
                      ),
                    ),
                ).first(),
              );
            const floor =
              resource === "transactions" &&
              input.kind === "sync" &&
              coverage?.bootstrap_complete
                ? coverage.confirmed_created_at
                : null;
            if (
              resource === "transactions" &&
              input.kind === "sync" &&
              coverage?.bootstrap_complete &&
              !floor
            )
              throw new Error("CREATION_CHECKPOINT_MISSING_RECONCILE_REQUIRED");
            await preparedStatement(
              db,
              database(db)
                .insert(tables.coverage)
                .values({
                  item_id: item.id,
                  resource: resource,
                  parent_id: parentId,
                  status: "partial",
                })
                .onConflictDoUpdate({
                  target: [
                    tables.coverage.item_id,
                    tables.coverage.resource,
                    tables.coverage.parent_id,
                  ],
                  set: { status: "partial" },
                }),
            ).run();
            await preparedStatement(
              db,
              database(db)
                .insert(tables.checkpoints)
                .values({
                  operation_id: id,
                  item_id: item.id,
                  resource: resource,
                  parent_id: parentId,
                  creation_floor: floor,
                  maximum_created_at: floor,
                })
                .onConflictDoNothing(),
            ).run();
            return { phase: "checkpoint" };
          },
        );
        for (let pageIndex = 0; ; pageIndex++) {
          const name = `page-${item.id}-${resource}-${parentId}-${pageIndex}`;
          const result = await step.do(name, async () => {
            return publishPage({
              db,
              op,
              name,
              resource,
              item,
              parentId,
              parent,
              engine,
              provider,
            });
          });
          if (result.cancelled) {
            await finish(db, op, "cancelled");
            return true;
          }
          if (result.done) break;
          await step.sleep(`pause-${name}`, "1 second");
        }
      }
    }
  }
  // Freeze the indexed pending set; one durable step per bounded account batch.
  await step.do("select-pending", async () => {
    await statement(
      db,
      `INSERT OR IGNORE INTO operation_targets SELECT ?,item_id,resource,parent_id,id,0 FROM entities WHERE item_id IN (${items.map(() => "?").join(",")}) AND resource='transactions' AND status='PENDING' AND deleted=0`,
      id,
      ...items.map((x) => x.id),
    ).run();
    return { phase: "pending-selected" };
  });
  for (let batch = 0; ; batch++) {
    const outcome = await step.do(`pending-${batch}`, async () => {
      const committed = await preparedStatement(
        db,
        database(db)
          .select({ progress: tables.page_commits.progress })
          .from(tables.page_commits)
          .where(
            and(
              eq(tables.page_commits.operation_id, id),
              eq(tables.page_commits.step_key, `pending-${batch}`),
            ),
          ),
      ).first("progress");
      if (committed)
        return z
          .object({ done: z.boolean(), cancelled: z.boolean() })
          .parse(parseJson(z.string().parse(committed)));
      if ((await stillWorking(db, id)).cancel_requested)
        return { done: true, cancelled: true };
      const selected = await rows(
        preparedStatement(
          db,
          database(db)
            .select({
              item_id: tables.operation_targets.item_id,
              parent_id: tables.operation_targets.parent_id,
              id: tables.operation_targets.id,
            })
            .from(tables.operation_targets)
            .where(
              and(
                eq(tables.operation_targets.operation_id, id),
                eq(tables.operation_targets.processed, 0),
              ),
            )
            .orderBy(
              asc(tables.operation_targets.item_id),
              asc(tables.operation_targets.parent_id),
              asc(tables.operation_targets.id),
            )
            .limit(20),
        ),
        z.object({
          item_id: z.string(),
          parent_id: z.string(),
          id: z.string(),
        }),
      );
      const first = selected[0];
      if (!first) return { done: true, cancelled: false };
      const group = selected.filter(
          (x) => x.item_id === first.item_id && x.parent_id === first.parent_id,
        ),
        ids = group.map((x) => x.id);
      await authorizedItems(db, [first.item_id]);
      const records = await provider.ids(first.parent_id, ids);
      await publishResolved(
        db,
        op,
        engine,
        first.item_id,
        first.parent_id,
        ids,
        records,
        [
          preparedStatement(
            db,
            database(db)
              .insert(tables.page_commits)
              .values({
                operation_id: id,
                step_key: `pending-${batch}`,
                progress: JSON.stringify({ done: false, cancelled: false }),
              }),
          ),
          ...ids.map((tx) =>
            preparedStatement(
              db,
              database(db)
                .update(tables.operation_targets)
                .set({ processed: 1 })
                .where(
                  and(
                    eq(tables.operation_targets.operation_id, id),
                    eq(tables.operation_targets.item_id, first.item_id),
                    eq(tables.operation_targets.parent_id, first.parent_id),
                    eq(tables.operation_targets.id, tx),
                  ),
                ),
            ),
          ),
        ],
      );
      return { done: false, cancelled: false };
    });
    if (outcome.cancelled) {
      await finish(db, op, "cancelled");
      return true;
    }
    if (outcome.done) break;
    await step.sleep(`pending-pause-${batch}`, "1 second");
  }

  return false;
}
