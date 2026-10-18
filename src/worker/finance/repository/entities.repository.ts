import { and, eq, getViewSelectedFields, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Identity } from "../../../contracts";
import { CorrectionField, type RecordChange, TagOrigin } from "../../../domain";
import type { Derived } from "../../../domain/rules";
import { database } from "../../database";
import {
  categories as categoriesTable,
  derived as derivedTable,
  effective_entities as effectiveEntitiesTable,
  entities as entitiesTable,
  overrides as overridesTable,
  settings as settingsTable,
  tags as tagsTable,
} from "../../schema";
import type {
  EntityMutation,
  EntityObservation,
  EntityPublication,
  EntityReader,
} from "../entity";
import {
  moneyKey,
  serializedEntity,
  temporalEligibility,
} from "./queries.repository";

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
      .insert(derivedTable)
      .values({
        category: derived.category,
        category_id: derived.category_id,
        description: derived.description,
        evidence: derived.evidence,
        group_id: derived.category_group_id,
        id: identity.id,
        ignored: Number(derived.ignored),
        item_id: identity.itemId,
        parent_id: identity.parentId,
        resource: identity.resource,
        rules_revision: rulesRevision,
      })
      .onConflictDoUpdate({
        set: {
          category: sql`excluded.category`,
          category_id: sql`excluded.category_id`,
          description: sql`excluded.description`,
          evidence: sql`excluded.evidence`,
          group_id: sql`excluded.group_id`,
          ignored: sql`excluded.ignored`,
          rules_revision: sql`excluded.rules_revision`,
        },
        target: [
          derivedTable.item_id,
          derivedTable.resource,
          derivedTable.parent_id,
          derivedTable.id,
        ],
      }),
    database(db)
      .delete(tagsTable)
      .where(
        and(
          eq(tagsTable.item_id, identity.itemId),
          eq(tagsTable.resource, identity.resource),
          eq(tagsTable.parent_id, identity.parentId),
          eq(tagsTable.id, identity.id),
          eq(tagsTable.origin, TagOrigin.derived),
        ),
      ),
  ];
  for (const [tag, value] of Object.entries(derived.tags)) {
    out.push(
      database(db).insert(tagsTable).values({
        id: identity.id,
        item_id: identity.itemId,
        key: tag,
        origin: TagOrigin.derived,
        parent_id: identity.parentId,
        resource: identity.resource,
        value,
      }),
    );
  }
  return out;
}

export function entityReader(db: D1Database): EntityReader {
  return { read: (identity) => entityPersistence(db).read(identity) };
}

export function entityStatements(db: D1Database, mutation: EntityMutation) {
  const persistence = entityPersistence(db);
  return mutation.kind === "observe"
    ? persistence.observe(mutation.value)
    : persistence.save(mutation.value);
}

function entityPersistence(db: D1Database) {
  return {
    observe: ({
      identity,
      source,
      operationId,
      observedAt,
    }: EntityObservation) => [
      database(db)
        .update(entitiesTable)
        .set({
          observed_at: observedAt,
          seen_operation: operationId,
          source,
          source_updated_at: source.updatedAt ?? null,
        })
        .where(entityIdentity(identity)),
    ],
    read: (identity: Identity) =>
      database(db)
        .select({
          deleted: entitiesTable.deleted,
          relevant_hash: entitiesTable.relevant_hash,
          seen_operation: entitiesTable.seen_operation,
        })
        .from(entitiesTable)
        .where(entityIdentity(identity))
        .get(),
    save(input: EntityPublication) {
      const value = entityValues(input);
      // Preserve first_seen_at when a source identity is updated.
      const { first_seen_at: _firstSeen, ...updated } = value;
      const statements: BatchItem<"sqlite">[] = [
        database(db)
          .insert(entitiesTable)
          .values(value)
          .onConflictDoUpdate({
            set: updated,
            target: [
              entitiesTable.item_id,
              entitiesTable.resource,
              entitiesTable.parent_id,
              entitiesTable.id,
            ],
          }),
      ];
      if (input.derived) {
        statements.push(
          ...derivedStatements(db, {
            derived: input.derived,
            identity: input.identity,
            rulesRevision: input.rulesRevision,
          }),
        );
      }
      return statements;
    },
  };
}

function entityIdentity(identity: Identity) {
  return and(
    eq(entitiesTable.item_id, identity.itemId),
    eq(entitiesTable.resource, identity.resource),
    eq(entitiesTable.parent_id, identity.parentId),
    eq(entitiesTable.id, identity.id),
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
}: EntityPublication): typeof entitiesTable.$inferInsert {
  const { record, amountText, date, eligible } = projection;
  return {
    account_type: projection.accountType,
    amount_digits:
      amountText === null
        ? null
        : amountText.replace("-", "").padStart(30, "0"),
    amount_key: amountText === null ? null : moneyKey(amountText),
    amount_minor: amountText,
    amount_sign: amountText?.startsWith("-") ? -1 : 1,
    currency: projection.currency,
    deleted: 0,
    direction: projection.direction,
    eligible: Number(eligible),
    first_seen_at: observedAt,
    id: identity.id,
    item_id: identity.itemId,
    normalized: record,
    normalizer,
    observed_at: observedAt,
    original_category: projection.category,
    original_description: projection.description,
    parent_id: identity.parentId,
    relevant_hash: digest,
    resource: identity.resource,
    seen_operation: operationId,
    source,
    source_created_at: source.createdAt ?? null,
    source_updated_at: source.updatedAt ?? null,
    status: projection.status,
    transaction_date: date,
  };
}

export async function override(
  db: D1Database,
  i: Identity,
  field: Exclude<CorrectionField, typeof CorrectionField.tag>,
  value: string | null,
) {
  const exists = await database(db)
    .select({ id: entitiesTable.id })
    .from(entitiesTable)
    .where(entityIdentity(i))
    .get();
  if (!exists) {
    throw new Error("NOT_FOUND");
  }
  let overrideValue = value;
  if (field === CorrectionField.category && value !== null) {
    const category = await database(db)
      .select({
        group_id: categoriesTable.group_id,
        id: categoriesTable.id,
        name: categoriesTable.name,
        revision: categoriesTable.revision,
      })
      .from(categoriesTable)
      .innerJoin(
        settingsTable,
        and(
          eq(settingsTable.id, 1),
          eq(settingsTable.active_rules, categoriesTable.revision),
        ),
      )
      .where(eq(categoriesTable.id, value))
      .get();
    if (!category) {
      throw new Error("UNKNOWN_CATEGORY");
    }
    overrideValue = JSON.stringify(category);
  }
  const edit =
    overrideValue === null
      ? database(db)
          .delete(overridesTable)
          .where(
            and(
              eq(overridesTable.item_id, i.itemId),
              eq(overridesTable.resource, i.resource),
              eq(overridesTable.parent_id, i.parentId),
              eq(overridesTable.id, i.id),
              eq(overridesTable.field, field),
            ),
          )
      : database(db)
          .insert(overridesTable)
          .values({
            field,
            id: i.id,
            item_id: i.itemId,
            parent_id: i.parentId,
            resource: i.resource,
            updated_at: new Date().toISOString(),
            value: overrideValue,
          })
          .onConflictDoUpdate({
            set: {
              updated_at: sql`excluded.updated_at`,
              value: sql`excluded.value`,
            },
            setWhere: sql`${overridesTable.value} IS NOT excluded.value`,
            target: [
              overridesTable.item_id,
              overridesTable.resource,
              overridesTable.parent_id,
              overridesTable.id,
              overridesTable.field,
            ],
          });
  await database(db).batch([
    edit,
    database(db)
      .update(settingsTable)
      .set({ revision: sql`${settingsTable.revision} + 1` })
      .where(and(eq(settingsTable.id, 1), sql`changes()>0`)),
  ]);
}

export async function correctRecord(
  db: D1Database,
  identity: Identity,
  change: RecordChange,
) {
  const a = { ...identity, ...change };
  if (a.field === CorrectionField.tag) {
    const { key } = a;
    const edit =
      a.value === null
        ? database(db)
            .delete(tagsTable)
            .where(
              and(
                eq(tagsTable.item_id, a.itemId),
                eq(tagsTable.resource, a.resource),
                eq(tagsTable.parent_id, a.parentId),
                eq(tagsTable.id, a.id),
                eq(tagsTable.key, key),
                eq(tagsTable.origin, TagOrigin.manual),
              ),
            )
        : database(db)
            .insert(tagsTable)
            .values({
              id: a.id,
              item_id: a.itemId,
              key,
              origin: TagOrigin.manual,
              parent_id: a.parentId,
              resource: a.resource,
              value: a.value,
            })
            .onConflictDoUpdate({
              set: { value: sql`excluded.value` },
              setWhere: sql`${tagsTable.value} IS NOT excluded.value`,
              target: [
                tagsTable.item_id,
                tagsTable.resource,
                tagsTable.parent_id,
                tagsTable.id,
                tagsTable.key,
                tagsTable.origin,
              ],
            });
    await database(db).batch([
      edit,
      database(db)
        .update(settingsTable)
        .set({ revision: sql`${settingsTable.revision} + 1` })
        .where(and(eq(settingsTable.id, 1), sql`changes()>0`)),
    ]);
  } else {
    await override(db, a, a.field, a.value);
  }
  return { updated: true as const };
}

export async function explainRecord(db: D1Database, a: Identity) {
  const explanation = {
    overrides: await database(db)
      .select({
        field: overridesTable.field,
        value: overridesTable.value,
      })
      .from(overridesTable)
      .where(
        and(
          eq(overridesTable.item_id, a.itemId),
          eq(overridesTable.resource, a.resource),
          eq(overridesTable.parent_id, a.parentId),
          eq(overridesTable.id, a.id),
        ),
      )
      .all(),
    record: await database(db)
      .select({
        ...getViewSelectedFields(effectiveEntitiesTable),
        eligible: temporalEligibility(),
      })
      .from(effectiveEntitiesTable)
      .where(
        and(
          eq(effectiveEntitiesTable.item_id, a.itemId),
          eq(effectiveEntitiesTable.resource, a.resource),
          eq(effectiveEntitiesTable.parent_id, a.parentId),
          eq(effectiveEntitiesTable.id, a.id),
        ),
      )
      .get(),
    tags: await database(db)
      .select({
        key: tagsTable.key,
        origin: tagsTable.origin,
        value: tagsTable.value,
      })
      .from(tagsTable)
      .where(
        and(
          eq(tagsTable.item_id, a.itemId),
          eq(tagsTable.resource, a.resource),
          eq(tagsTable.parent_id, a.parentId),
          eq(tagsTable.id, a.id),
        ),
      )
      .all(),
  };
  return {
    ...explanation,
    record: explanation.record ? serializedEntity(explanation.record) : null,
  };
}
