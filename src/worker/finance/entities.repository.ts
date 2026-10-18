import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Identity } from "#contracts/queries.ts";
import {
  entityFingerprint,
  NORMALIZER,
  projectEntity,
} from "#domain/entity.ts";
import type { RecordChange } from "#domain/record-correction.ts";
import {
  type compileRules,
  type Derived,
  txContext,
} from "#domain/rules/rules.ts";
import type { FinanceRecord, ProviderRecord } from "#domain/schemas.ts";
import { database, hash } from "#worker/database.ts";
import {
  moneyKey,
  requireResource,
  serializedEntity,
} from "#worker/finance/repository.ts";
import * as tables from "#worker/schema.ts";
import type { Operation } from "#worker/sync/operation-storage.ts";

export function derivedStatements(
  db: D1Database,
  i: Identity,
  revision: string,
  d: Derived,
) {
  const out: BatchItem<"sqlite">[] = [
    database(db)
      .insert(tables.derived)
      .values({
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
        evidence: d.evidence,
      })
      .onConflictDoUpdate({
        target: [
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
    database(db)
      .delete(tables.tags)
      .where(
        and(
          eq(tables.tags.item_id, i.itemId),
          eq(tables.tags.resource, i.resource),
          eq(tables.tags.parent_id, i.parentId),
          eq(tables.tags.id, i.id),
          eq(tables.tags.origin, "derived"),
        ),
      ),
  ];
  for (const [tag, value] of Object.entries(d.tags)) {
    out.push(
      database(db).insert(tables.tags).values({
        item_id: i.itemId,
        resource: i.resource,
        parent_id: i.parentId,
        id: i.id,
        key: tag,
        value: value,
        origin: "derived",
      }),
    );
  }
  return out;
}

interface EntityInput {
  identity: Identity;
  source: ProviderRecord;
  parent: FinanceRecord | null | undefined;
  operation: Pick<
    Operation,
    "id" | "input" | "reference_day" | "rules_revision"
  >;
  engine: ReturnType<typeof compileRules>;
  legacyProjection?: FinanceRecord;
}

export async function prepareEntity(
  db: D1Database,
  {
    identity: i,
    source: raw,
    parent: parentInput,
    operation,
    engine,
    legacyProjection,
  }: EntityInput,
) {
  const parent = parentInput ?? undefined;
  if (String(raw.id ?? raw.resourceId) !== i.id) {
    throw new Error("SOURCE_ID_MISMATCH");
  }
  const digest = await hash(
    entityFingerprint({ resource: i.resource, raw, parent, legacyProjection }),
  );
  const previous = await database(db)
    .select({
      relevant_hash: tables.entities.relevant_hash,
      deleted: tables.entities.deleted,
      seen_operation: tables.entities.seen_operation,
    })
    .from(tables.entities)
    .where(
      and(
        eq(tables.entities.item_id, i.itemId),
        eq(tables.entities.resource, i.resource),
        eq(tables.entities.parent_id, i.parentId),
        eq(tables.entities.id, i.id),
      ),
    )
    .get();
  const now = new Date().toISOString();
  const forced = operation.input.renormalize === true;
  if (!forced && previous?.relevant_hash === digest && previous.deleted === 0) {
    return {
      statements: [
        database(db)
          .update(tables.entities)
          .set({
            source: raw,
            source_updated_at: raw.updatedAt ?? null,
            observed_at: now,
            seen_operation: operation.id,
          })
          .where(
            and(
              eq(tables.entities.item_id, i.itemId),
              eq(tables.entities.resource, i.resource),
              eq(tables.entities.parent_id, i.parentId),
              eq(tables.entities.id, i.id),
            ),
          ),
      ],
      seenInOperation: previous.seen_operation === operation.id,
      state: "unchanged",
      classified: 0,
    };
  }
  const projection = projectEntity({
    resource: i.resource,
    raw,
    parent,
    referenceDay: operation.reference_day,
    ...(legacyProjection === undefined ? {} : { legacyProjection }),
  });
  const value = entityValues({
    identity: i,
    source: raw,
    operation,
    projection,
    legacyProjection,
    digest,
    now,
  });
  // Preserve first_seen_at when a source identity is updated.
  const { first_seen_at: _firstSeen, ...updated } = value;
  const statements: BatchItem<"sqlite">[] = [
    database(db)
      .insert(tables.entities)
      .values(value)
      .onConflictDoUpdate({
        target: [
          tables.entities.item_id,
          tables.entities.resource,
          tables.entities.parent_id,
          tables.entities.id,
        ],
        set: updated,
      }),
  ];
  if (i.resource === "transactions") {
    statements.push(
      ...derivedStatements(
        db,
        i,
        operation.rules_revision,
        await engine.evaluate(txContext(projection.record)),
      ),
    );
  }
  return {
    statements,
    seenInOperation: previous?.seen_operation === operation.id,
    state: previous ? "changed" : "new",
    classified: Number(i.resource === "transactions"),
  };
}

function entityValues({
  identity: i,
  source: raw,
  operation,
  projection,
  legacyProjection,
  digest,
  now,
}: Omit<EntityInput, "parent" | "engine" | "legacyProjection"> & {
  projection: ReturnType<typeof projectEntity>;
  legacyProjection: FinanceRecord | undefined;
  digest: string;
  now: string;
}) {
  const { record, amountText, date, eligible } = projection;
  return {
    item_id: i.itemId,
    resource: i.resource,
    parent_id: i.parentId,
    id: i.id,
    source: raw,
    normalized: record,
    relevant_hash: digest,
    normalizer: legacyProjection ? "legacy-projection-v1" : NORMALIZER,
    source_created_at: raw.createdAt ?? null,
    source_updated_at: raw.updatedAt ?? null,
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
}

export async function override(
  db: D1Database,
  i: Identity,
  field: "category" | "description" | "ignored",
  value: string | null,
) {
  await requireResource(db, i.itemId, i.resource);
  const exists = await database(db)
    .select({ id: tables.entities.id })
    .from(tables.entities)
    .where(
      and(
        eq(tables.entities.item_id, i.itemId),
        eq(tables.entities.resource, i.resource),
        eq(tables.entities.parent_id, i.parentId),
        eq(tables.entities.id, i.id),
      ),
    )
    .get();
  if (!exists) {
    throw new Error("NOT_FOUND");
  }
  if (field === "ignored" && value !== null && !["0", "1"].includes(value)) {
    throw new Error("ignored requires 0 or 1");
  }
  if (field === "category" && value !== null) {
    const category = await database(db)
      .select({
        id: tables.categories.id,
        name: tables.categories.name,
        group_id: tables.categories.group_id,
        revision: tables.categories.revision,
      })
      .from(tables.categories)
      .innerJoin(
        tables.settings,
        and(
          eq(tables.settings.id, 1),
          eq(tables.settings.active_rules, tables.categories.revision),
        ),
      )
      .where(eq(tables.categories.id, value))
      .get();
    if (!category) {
      throw new Error("UNKNOWN_CATEGORY");
    }
    value = JSON.stringify(category);
  }
  const edit =
    value === null
      ? database(db)
          .delete(tables.overrides)
          .where(
            and(
              eq(tables.overrides.item_id, i.itemId),
              eq(tables.overrides.resource, i.resource),
              eq(tables.overrides.parent_id, i.parentId),
              eq(tables.overrides.id, i.id),
              eq(tables.overrides.field, field),
            ),
          )
      : database(db)
          .insert(tables.overrides)
          .values({
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
          });
  await database(db).batch([
    edit,
    database(db)
      .update(tables.settings)
      .set({ revision: sql`${tables.settings.revision} + 1` })
      .where(eq(tables.settings.id, 1)),
  ]);
}

export async function correctRecord(
  db: D1Database,
  identity: Identity,
  change: RecordChange,
) {
  const a = { ...identity, ...change };
  if (a.field === "tag") {
    await requireResource(db, a.itemId, a.resource);
    const key = a.key;
    const edit =
      a.value === null
        ? database(db)
            .delete(tables.tags)
            .where(
              and(
                eq(tables.tags.item_id, a.itemId),
                eq(tables.tags.resource, a.resource),
                eq(tables.tags.parent_id, a.parentId),
                eq(tables.tags.id, a.id),
                eq(tables.tags.key, key),
                eq(tables.tags.origin, "manual"),
              ),
            )
        : database(db)
            .insert(tables.tags)
            .values({
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
                tables.tags.item_id,
                tables.tags.resource,
                tables.tags.parent_id,
                tables.tags.id,
                tables.tags.key,
                tables.tags.origin,
              ],
              set: { value: sql`excluded.value` },
            });
    await database(db).batch([
      edit,
      database(db)
        .update(tables.settings)
        .set({ revision: sql`${tables.settings.revision} + 1` })
        .where(eq(tables.settings.id, 1)),
    ]);
  } else {
    await override(db, a, a.field, a.value);
  }
  return { updated: true as const };
}

export async function explainRecord(db: D1Database, a: Identity) {
  await requireResource(db, a.itemId, a.resource);
  const explanation = {
    tags: await database(db)
      .select({
        key: tables.tags.key,
        value: tables.tags.value,
        origin: tables.tags.origin,
      })
      .from(tables.tags)
      .where(
        and(
          eq(tables.tags.item_id, a.itemId),
          eq(tables.tags.resource, a.resource),
          eq(tables.tags.parent_id, a.parentId),
          eq(tables.tags.id, a.id),
        ),
      )
      .all(),
    record: await database(db)
      .select()
      .from(tables.effective_entities)
      .where(
        and(
          eq(tables.effective_entities.item_id, a.itemId),
          eq(tables.effective_entities.resource, a.resource),
          eq(tables.effective_entities.parent_id, a.parentId),
          eq(tables.effective_entities.id, a.id),
        ),
      )
      .get(),
    overrides: await database(db)
      .select({
        field: tables.overrides.field,
        value: tables.overrides.value,
      })
      .from(tables.overrides)
      .where(
        and(
          eq(tables.overrides.item_id, a.itemId),
          eq(tables.overrides.resource, a.resource),
          eq(tables.overrides.parent_id, a.parentId),
          eq(tables.overrides.id, a.id),
        ),
      )
      .all(),
  };
  return {
    ...explanation,
    record: explanation.record ? serializedEntity(explanation.record) : null,
  };
}

export async function authorizeAccount(
  db: D1Database,
  a: { itemId: string; accountId: string },
) {
  await requireResource(db, a.itemId, "accounts");
  if (
    !(await database(db)
      .select({ id: tables.entities.id })
      .from(tables.entities)
      .where(
        and(
          eq(tables.entities.item_id, a.itemId),
          eq(tables.entities.resource, "accounts"),
          eq(tables.entities.id, a.accountId),
        ),
      )
      .get())
  ) {
    throw new Error("ACCOUNT_NOT_AUTHORIZED");
  }
}
