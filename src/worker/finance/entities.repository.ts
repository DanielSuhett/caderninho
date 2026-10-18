import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Identity } from "#contracts/queries.types.ts";
import type { projectEntity } from "#domain/entity.ts";
import { Resource, TagOrigin } from "#domain/enums.ts";
import type { ProviderRecord } from "#domain/provider.types.ts";
import {
  CorrectionField,
  type RecordChange,
} from "#domain/record-correction.types.ts";
import type { Derived } from "#domain/rules/rules.types.ts";
import { database } from "#worker/database.ts";
import {
  moneyKey,
  requireResource,
  serializedEntity,
} from "#worker/finance/repository.ts";
import * as tables from "#worker/schema.ts";

export function derivedStatements(
  db: D1Database,
  {
    identity,
    rulesRevision,
    derived,
  }: {
    identity: Identity;
    rulesRevision: string;
    derived: Derived;
  },
) {
  const out: BatchItem<"sqlite">[] = [
    database(db)
      .insert(tables.derived)
      .values({
        item_id: identity.itemId,
        resource: identity.resource,
        parent_id: identity.parentId,
        id: identity.id,
        rules_revision: rulesRevision,
        category: derived.category,
        category_id: derived.category_id,
        group_id: derived.category_group_id,
        description: derived.description,
        ignored: Number(derived.ignored),
        evidence: derived.evidence,
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
          eq(tables.tags.item_id, identity.itemId),
          eq(tables.tags.resource, identity.resource),
          eq(tables.tags.parent_id, identity.parentId),
          eq(tables.tags.id, identity.id),
          eq(tables.tags.origin, TagOrigin.derived),
        ),
      ),
  ];
  for (const [tag, value] of Object.entries(derived.tags)) {
    out.push(
      database(db).insert(tables.tags).values({
        item_id: identity.itemId,
        resource: identity.resource,
        parent_id: identity.parentId,
        id: identity.id,
        key: tag,
        value: value,
        origin: TagOrigin.derived,
      }),
    );
  }
  return out;
}

interface EntityObservation {
  identity: Identity;
  source: ProviderRecord;
  operationId: string;
  observedAt: string;
}

interface EntityPublication extends EntityObservation {
  projection: ReturnType<typeof projectEntity>;
  digest: string;
  normalizer: string;
  rulesRevision: string;
  derived: Derived | undefined;
}

export function entityPersistence(db: D1Database) {
  return {
    read: (identity: Identity) =>
      database(db)
        .select({
          relevant_hash: tables.entities.relevant_hash,
          deleted: tables.entities.deleted,
          seen_operation: tables.entities.seen_operation,
        })
        .from(tables.entities)
        .where(entityIdentity(identity))
        .get(),
    observe: ({
      identity,
      source,
      operationId,
      observedAt,
    }: EntityObservation) => [
      database(db)
        .update(tables.entities)
        .set({
          source,
          source_updated_at: source.updatedAt ?? null,
          observed_at: observedAt,
          seen_operation: operationId,
        })
        .where(entityIdentity(identity)),
    ],
    save(input: EntityPublication) {
      const value = entityValues(input);
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
      if (input.derived) {
        statements.push(
          ...derivedStatements(db, {
            identity: input.identity,
            rulesRevision: input.rulesRevision,
            derived: input.derived,
          }),
        );
      }
      return statements;
    },
  };
}

function entityIdentity(identity: Identity) {
  return and(
    eq(tables.entities.item_id, identity.itemId),
    eq(tables.entities.resource, identity.resource),
    eq(tables.entities.parent_id, identity.parentId),
    eq(tables.entities.id, identity.id),
  );
}

function entityValues({
  identity,
  source,
  operationId,
  observedAt,
  projection,
  normalizer,
  digest,
}: EntityPublication): typeof tables.entities.$inferInsert {
  const { record, amountText, date, eligible } = projection;
  return {
    item_id: identity.itemId,
    resource: identity.resource,
    parent_id: identity.parentId,
    id: identity.id,
    source,
    normalized: record,
    relevant_hash: digest,
    normalizer,
    source_created_at: source.createdAt ?? null,
    source_updated_at: source.updatedAt ?? null,
    first_seen_at: observedAt,
    observed_at: observedAt,
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
    eligible: Number(eligible),
    deleted: 0,
    seen_operation: operationId,
  };
}

export async function override(
  db: D1Database,
  i: Identity,
  field: Exclude<CorrectionField, typeof CorrectionField.tag>,
  value: string | null,
) {
  await requireResource(db, i.itemId, i.resource);
  const exists = await database(db)
    .select({ id: tables.entities.id })
    .from(tables.entities)
    .where(entityIdentity(i))
    .get();
  if (!exists) {
    throw new Error("NOT_FOUND");
  }
  if (field === CorrectionField.category && value !== null) {
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
  if (a.field === CorrectionField.tag) {
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
                eq(tables.tags.origin, TagOrigin.manual),
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
              origin: TagOrigin.manual,
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
  await requireResource(db, a.itemId, Resource.accounts);
  if (
    !(await database(db)
      .select({ id: tables.entities.id })
      .from(tables.entities)
      .where(
        and(
          eq(tables.entities.item_id, a.itemId),
          eq(tables.entities.resource, Resource.accounts),
          eq(tables.entities.id, a.accountId),
        ),
      )
      .get())
  ) {
    throw new Error("ACCOUNT_NOT_AUTHORIZED");
  }
}
