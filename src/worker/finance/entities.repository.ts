import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { OperationInputSchema } from "#contracts/operation.ts";
import type { Identity } from "#contracts/queries.ts";
import { projectEntity, NORMALIZER } from "#domain/entity.ts";
import { ResourceSchema } from "#domain/enums.ts";
import providerFields from "#domain/provider-fields.json" with { type: "json" };
import type { RecordChange } from "#domain/record-correction.ts";
import {
  type Derived,
  type compileRules,
  txContext,
} from "#domain/rules/rules.ts";
import { FinanceRecordSchema, ProviderRecordSchema } from "#domain/schemas.ts";
import { parseJson } from "#shared/json.ts";
import { database, preparedStatement, hash } from "#worker/database.ts";
import { moneyKey, requireResource } from "#worker/finance/repository.ts";
import * as tables from "#worker/schema.ts";
import type { Operation } from "#worker/sync/operation-storage.ts";

export const StoredSchema = z
  .object({
    principal: z.string(),
    item_id: z.string(),
    resource: ResourceSchema,
    parent_id: z.string(),
    id: z.string(),
    source: z.string(),
    normalized: z.string(),
    relevant_hash: z.string(),
    deleted: z.number(),
    source_created_at: z.string().nullable(),
    transaction_date: z.string().nullable(),
  })
  .loose();

// The public explanation retains all D1 columns and source JSON verbatim. Parse
// storage scalars here rather than exporting unknown rows to application code.
const ExplanationSchema = z.object({
  tags: z.array(
    z.object({ key: z.string(), value: z.string(), origin: z.string() }),
  ),
  record: z
    .record(z.string(), z.union([z.string(), z.number(), z.null()]))
    .nullable(),
  overrides: z.array(z.object({ field: z.string(), value: z.string() })),
});

export function derivedStatements(
  db: D1Database,
  i: Identity,
  revision: string,
  d: Derived,
) {
  const out = [
    preparedStatement(
      db,
      database(db)
        .insert(tables.derived)
        .values({
          principal: i.principal,
          item_id: i.itemId,
          resource: i.resource,
          parent_id: i.parentId,
          id: i.id,
          rules_revision: revision,
          category: d.category,
          category_id: d.category_id,
          group_id: d.category_group_id,
          description: d.description,
          ignored: Number(d.ignored),
          evidence: JSON.stringify(d.evidence),
        })
        .onConflictDoUpdate({
          target: [
            tables.derived.principal,
            tables.derived.item_id,
            tables.derived.resource,
            tables.derived.parent_id,
            tables.derived.id,
          ],
          set: {
            rules_revision: sql`excluded.rules_revision`,
            category: sql`excluded.category`,
            category_id: sql`excluded.category_id`,
            group_id: sql`excluded.group_id`,
            description: sql`excluded.description`,
            ignored: sql`excluded.ignored`,
            evidence: sql`excluded.evidence`,
          },
        }),
    ),
    preparedStatement(
      db,
      database(db)
        .delete(tables.tags)
        .where(
          and(
            eq(tables.tags.principal, i.principal),
            eq(tables.tags.item_id, i.itemId),
            eq(tables.tags.resource, i.resource),
            eq(tables.tags.parent_id, i.parentId),
            eq(tables.tags.id, i.id),
            eq(tables.tags.origin, "derived"),
          ),
        ),
    ),
  ];
  for (const [tag, value] of Object.entries(d.tags))
    out.push(
      preparedStatement(
        db,
        database(db).insert(tables.tags).values({
          principal: i.principal,
          item_id: i.itemId,
          resource: i.resource,
          parent_id: i.parentId,
          id: i.id,
          key: tag,
          value: value,
          origin: "derived",
        }),
      ),
    );
  return out;
}

export async function prepareEntity(
  db: D1Database,
  i: Identity,
  rawInput: unknown,
  parentInput: unknown,
  operation: Operation,
  engine: ReturnType<typeof compileRules>,
  legacyProjection?: z.infer<typeof FinanceRecordSchema>,
) {
  const raw = ProviderRecordSchema.parse(rawInput),
    parent = parentInput ? FinanceRecordSchema.parse(parentInput) : undefined;
  if (String(raw.id ?? raw.resourceId) !== i.id)
    throw new Error("SOURCE_ID_MISMATCH");
  // Provider fields actually consumed by normalization/rules define derived identity.
  // Timestamps and running balance can change without changing a transaction's meaning.
  let relevant: Record<string, unknown> = { ...raw };
  if (i.resource === "transactions") {
    relevant = {};
    for (const path of [
      ...Object.keys(providerFields.transactions),
      "operationType",
      "paymentData.receiver.documentNumber.value",
      "paymentData.payer.documentNumber.value",
    ]) {
      if (["updatedAt", "createdAt", "balance"].includes(path)) continue;
      let value: unknown = raw;
      for (const segment of path.split(".")) {
        const parsed = z.record(z.string(), z.unknown()).safeParse(value);
        value = parsed.success ? parsed.data[segment] : undefined;
      }
      if (value !== undefined) relevant[path] = value;
    }
    if (legacyProjection) relevant.legacyProjection = legacyProjection;
  }
  delete relevant.updatedAt;
  delete relevant.createdAt;
  const digest = await hash({
    source: relevant,
    parent:
      i.resource === "transactions"
        ? {
            id: parent?.id,
            type: parent?.type,
            name: parent?.name,
            ownerDocument: parent?.ownerDocument,
          }
        : null,
  });
  const old = await preparedStatement(
    db,
    database(db)
      .select({
        relevant_hash: tables.entities.relevant_hash,
        deleted: tables.entities.deleted,
        seen_operation: tables.entities.seen_operation,
      })
      .from(tables.entities)
      .where(
        and(
          eq(tables.entities.principal, i.principal),
          eq(tables.entities.item_id, i.itemId),
          eq(tables.entities.resource, i.resource),
          eq(tables.entities.parent_id, i.parentId),
          eq(tables.entities.id, i.id),
        ),
      ),
  ).first();
  const previous = z
    .object({
      relevant_hash: z.string(),
      deleted: z.number(),
      seen_operation: z.string().nullable(),
    })
    .nullable()
    .parse(old);
  const now = new Date().toISOString();
  const forced =
    OperationInputSchema.parse(parseJson(operation.input)).renormalize === true;
  if (!forced && previous?.relevant_hash === digest && previous.deleted === 0)
    return {
      statements: [
        preparedStatement(
          db,
          database(db)
            .update(tables.entities)
            .set({
              source: JSON.stringify(raw),
              source_updated_at:
                z.string().nullish().parse(raw.updatedAt) ?? null,
              observed_at: now,
              seen_operation: operation.id,
            })
            .where(
              and(
                eq(tables.entities.principal, i.principal),
                eq(tables.entities.item_id, i.itemId),
                eq(tables.entities.resource, i.resource),
                eq(tables.entities.parent_id, i.parentId),
                eq(tables.entities.id, i.id),
              ),
            ),
        ),
      ],
      seenInOperation: previous.seen_operation === operation.id,
      state: "unchanged",
      classified: 0,
    };
  const projection = projectEntity({
    resource: i.resource,
    raw,
    parent,
    referenceDay: operation.reference_day,
    ...(legacyProjection === undefined ? {} : { legacyProjection }),
  });
  const { record, amountText, date, eligible } = projection;
  const value = {
    principal: i.principal,
    item_id: i.itemId,
    resource: i.resource,
    parent_id: i.parentId,
    id: i.id,
    source: JSON.stringify(raw),
    normalized: JSON.stringify(record),
    relevant_hash: digest,
    normalizer: legacyProjection ? "legacy-projection-v1" : NORMALIZER,
    source_created_at: z.string().nullish().parse(raw.createdAt) ?? null,
    source_updated_at: z.string().nullish().parse(raw.updatedAt) ?? null,
    first_seen_at: now,
    observed_at: now,
    transaction_date: date,
    currency: projection.currency,
    amount_minor: amountText,
    amount_key: amountText === null ? null : moneyKey(amountText),
    amount_digits:
      amountText === null
        ? null
        : amountText.replace("-", "").padStart(30, "0"),
    amount_sign: amountText?.startsWith("-") ? -1 : 1,
    account_type: projection.accountType,
    direction: projection.direction,
    status: projection.status,
    original_category: projection.category,
    original_description: projection.description,
    eligible,
    deleted: 0,
    seen_operation: operation.id,
  };
  // Preserve first_seen_at when a source identity is updated.
  const { first_seen_at: _firstSeen, ...updated } = value;
  const statements = [
    preparedStatement(
      db,
      database(db)
        .insert(tables.entities)
        .values(value)
        .onConflictDoUpdate({
          target: [
            tables.entities.principal,
            tables.entities.item_id,
            tables.entities.resource,
            tables.entities.parent_id,
            tables.entities.id,
          ],
          set: updated,
        }),
    ),
  ];
  if (i.resource === "transactions")
    statements.push(
      ...derivedStatements(
        db,
        i,
        operation.rules_revision,
        await engine.evaluate(txContext(record)),
      ),
    );
  return {
    statements,
    seenInOperation: previous?.seen_operation === operation.id,
    state: previous ? "changed" : "new",
    classified: Number(i.resource === "transactions"),
  };
}

export async function override(
  db: D1Database,
  i: Identity,
  field: "category" | "description" | "ignored",
  value: string | null,
) {
  await requireResource(db, i.principal, i.itemId, i.resource);
  const exists = await preparedStatement(
    db,
    database(db)
      .select({ id: tables.entities.id })
      .from(tables.entities)
      .where(
        and(
          eq(tables.entities.principal, i.principal),
          eq(tables.entities.item_id, i.itemId),
          eq(tables.entities.resource, i.resource),
          eq(tables.entities.parent_id, i.parentId),
          eq(tables.entities.id, i.id),
        ),
      ),
  ).first();
  if (!exists) throw new Error("NOT_FOUND");
  if (field === "ignored" && value !== null && !["0", "1"].includes(value))
    throw new Error("ignored requires 0 or 1");
  if (field === "category" && value !== null) {
    const category = await preparedStatement(
      db,
      database(db)
        .select({
          id: tables.categories.id,
          name: tables.categories.name,
          group_id: tables.categories.group_id,
          revision: tables.categories.revision,
        })
        .from(tables.categories)
        .innerJoin(
          tables.principals,
          and(
            eq(tables.principals.id, tables.categories.principal),
            eq(tables.principals.active_rules, tables.categories.revision),
          ),
        )
        .where(
          and(
            eq(tables.categories.principal, i.principal),
            eq(tables.categories.id, value),
          ),
        ),
    ).first();
    if (!category) throw new Error("UNKNOWN_CATEGORY");
    value = JSON.stringify(category);
  }
  const edit =
    value === null
      ? preparedStatement(
          db,
          database(db)
            .delete(tables.overrides)
            .where(
              and(
                eq(tables.overrides.principal, i.principal),
                eq(tables.overrides.item_id, i.itemId),
                eq(tables.overrides.resource, i.resource),
                eq(tables.overrides.parent_id, i.parentId),
                eq(tables.overrides.id, i.id),
                eq(tables.overrides.field, field),
              ),
            ),
        )
      : preparedStatement(
          db,
          database(db)
            .insert(tables.overrides)
            .values({
              principal: i.principal,
              item_id: i.itemId,
              resource: i.resource,
              parent_id: i.parentId,
              id: i.id,
              field: field,
              value: value,
              updated_at: new Date().toISOString(),
            })
            .onConflictDoUpdate({
              target: [
                tables.overrides.principal,
                tables.overrides.item_id,
                tables.overrides.resource,
                tables.overrides.parent_id,
                tables.overrides.id,
                tables.overrides.field,
              ],
              set: {
                value: sql`excluded.value`,
                updated_at: sql`excluded.updated_at`,
              },
            }),
        );
  await db.batch([
    edit,
    preparedStatement(
      db,
      database(db)
        .update(tables.principals)
        .set({ revision: sql`${tables.principals.revision} + 1` })
        .where(eq(tables.principals.id, i.principal)),
    ),
  ]);
}

export async function correctRecord(
  db: D1Database,
  identity: Identity,
  change: RecordChange,
) {
  const a = { ...identity, ...change };
  const { principal } = identity;
  if (a.field === "tag") {
    await requireResource(db, principal, a.itemId, a.resource);
    const key = a.key;
    const edit =
      a.value === null
        ? preparedStatement(
            db,
            database(db)
              .delete(tables.tags)
              .where(
                and(
                  eq(tables.tags.principal, principal),
                  eq(tables.tags.item_id, a.itemId),
                  eq(tables.tags.resource, a.resource),
                  eq(tables.tags.parent_id, a.parentId),
                  eq(tables.tags.id, a.id),
                  eq(tables.tags.key, key),
                  eq(tables.tags.origin, "manual"),
                ),
              ),
          )
        : preparedStatement(
            db,
            database(db)
              .insert(tables.tags)
              .values({
                principal: principal,
                item_id: a.itemId,
                resource: a.resource,
                parent_id: a.parentId,
                id: a.id,
                key: key,
                value: a.value,
                origin: "manual",
              })
              .onConflictDoUpdate({
                target: [
                  tables.tags.principal,
                  tables.tags.item_id,
                  tables.tags.resource,
                  tables.tags.parent_id,
                  tables.tags.id,
                  tables.tags.key,
                  tables.tags.origin,
                ],
                set: { value: sql`excluded.value` },
              }),
          );
    await db.batch([
      edit,
      preparedStatement(
        db,
        database(db)
          .update(tables.principals)
          .set({ revision: sql`${tables.principals.revision} + 1` })
          .where(eq(tables.principals.id, principal)),
      ),
    ]);
  } else await override(db, a, a.field, a.value);
  return { updated: true as const };
}

export async function explainRecord(db: D1Database, a: Identity) {
  const { principal } = a;
  await requireResource(db, principal, a.itemId, a.resource);
  return ExplanationSchema.parse({
    tags: (
      await preparedStatement(
        db,
        database(db)
          .select({
            key: tables.tags.key,
            value: tables.tags.value,
            origin: tables.tags.origin,
          })
          .from(tables.tags)
          .where(
            and(
              eq(tables.tags.principal, principal),
              eq(tables.tags.item_id, a.itemId),
              eq(tables.tags.resource, a.resource),
              eq(tables.tags.parent_id, a.parentId),
              eq(tables.tags.id, a.id),
            ),
          ),
      ).all()
    ).results,
    record: await preparedStatement(
      db,
      database(db)
        .select()
        .from(tables.effective_entities)
        .where(
          and(
            eq(tables.effective_entities.principal, principal),
            eq(tables.effective_entities.item_id, a.itemId),
            eq(tables.effective_entities.resource, a.resource),
            eq(tables.effective_entities.parent_id, a.parentId),
            eq(tables.effective_entities.id, a.id),
          ),
        ),
    ).first(),
    overrides: (
      await preparedStatement(
        db,
        database(db)
          .select({
            field: tables.overrides.field,
            value: tables.overrides.value,
          })
          .from(tables.overrides)
          .where(
            and(
              eq(tables.overrides.principal, principal),
              eq(tables.overrides.item_id, a.itemId),
              eq(tables.overrides.resource, a.resource),
              eq(tables.overrides.parent_id, a.parentId),
              eq(tables.overrides.id, a.id),
            ),
          ),
      ).all()
    ).results,
  });
}

export async function authorizeAccount(
  db: D1Database,
  principal: string,
  a: { itemId: string; accountId: string },
) {
  await requireResource(db, principal, a.itemId, "accounts");
  if (
    !(await preparedStatement(
      db,
      database(db)
        .select({ id: tables.entities.id })
        .from(tables.entities)
        .where(
          and(
            eq(tables.entities.principal, principal),
            eq(tables.entities.item_id, a.itemId),
            eq(tables.entities.resource, "accounts"),
            eq(tables.entities.id, a.accountId),
          ),
        ),
    ).first())
  )
    throw new Error("ACCOUNT_NOT_AUTHORIZED");
}
