import { desc, and, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { NORMALIZER } from "#domain/entity.ts";
import { LegacyRulesSchema } from "#domain/rules/convert-rules.ts";
import { compileRules, RulesSchema } from "#domain/rules/rules.ts";
import { parseJson } from "#shared/json.ts";
import { hash, database, preparedStatement } from "#worker/database.ts";
import * as tables from "#worker/schema.ts";

const StoredRulesSchema = z.union([RulesSchema, LegacyRulesSchema]);

export async function saveRules(
  db: D1Database,
  input: unknown,
  activate = false,
) {
  const { document } = compileRules(input),
    id = await hash({ document, normalizer: NORMALIZER });
  const statements = [
    preparedStatement(
      db,
      database(db)
        .insert(tables.rule_sets)
        .values({
          id: id,
          document: JSON.stringify(document),
          normalizer: NORMALIZER,
          created_at: new Date().toISOString(),
        })
        .onConflictDoNothing(),
    ),
  ];
  for (const g of document.groups)
    statements.push(
      preparedStatement(
        db,
        database(db)
          .insert(tables.category_groups)
          .values({
            revision: id,
            id: g.id,
            name: g.name,
          })
          .onConflictDoNothing(),
      ),
    );
  for (const c of document.categories) {
    statements.push(
      preparedStatement(
        db,
        database(db)
          .insert(tables.categories)
          .values({
            revision: id,
            id: c.id,
            group_id: c.group_id,
            name: c.name,
          })
          .onConflictDoNothing(),
      ),
    );
    for (const alias of [c.name, ...c.aliases])
      statements.push(
        preparedStatement(
          db,
          database(db)
            .insert(tables.aliases)
            .values({
              revision: id,
              alias: alias,
              category_id: c.id,
            })
            .onConflictDoNothing(),
        ),
      );
  }
  for (const [r, rule] of document.rules.entries())
    statements.push(
      preparedStatement(
        db,
        database(db)
          .insert(tables.rules)
          .values({
            revision: id,
            id: rule.id,
            position: r,
            priority: rule.priority,
            stage: rule.event.type,
            active: Number(rule.is_active),
            definition: JSON.stringify(rule),
          })
          .onConflictDoNothing(),
      ),
    );
  // Batches may be repeated; the active pointer is changed only after all catalog rows exist.
  for (let i = 0; i < statements.length; i += 80)
    await db.batch(statements.slice(i, i + 80));
  await preparedStatement(
    db,
    database(db)
      .update(tables.rule_sets)
      .set({ ready: 1 })
      .where(eq(tables.rule_sets.id, id)),
  ).run();
  if (activate)
    await preparedStatement(
      db,
      database(db)
        .update(tables.settings)
        .set({ active_rules: id })
        .where(eq(tables.settings.id, 1)),
    ).run();
  return { id, rules: document.rules.length, activated: activate };
}

async function ruleRevision(db: D1Database, revision: string) {
  return z.object({ document: z.string(), normalizer: z.string() }).parse(
    await preparedStatement(
      db,
      database(db)
        .select({
          document: tables.rule_sets.document,
          normalizer: tables.rule_sets.normalizer,
        })
        .from(tables.rule_sets)
        .where(
          and(eq(tables.rule_sets.id, revision), eq(tables.rule_sets.ready, 1)),
        ),
    ).first(),
  );
}

export async function readRules(db: D1Database, revision: string) {
  const row = await ruleRevision(db, revision);
  return StoredRulesSchema.parse(parseJson(row.document));
}

export async function rulesFor(db: D1Database, revision: string) {
  const row = await ruleRevision(db, revision);
  const document = StoredRulesSchema.parse(parseJson(row.document));
  if (document.version === 1)
    throw new Error("RULES_V1_REQUIRES_EXPLICIT_CONVERSION_AND_ACTIVATION");
  if (row.normalizer !== NORMALIZER)
    throw new Error("NORMALIZER_VERSION_REQUIRES_EXPLICIT_UPGRADE");
  return compileRules(document);
}

export async function listRules(db: D1Database) {
  return (
    await preparedStatement(
      db,
      database(db)
        .select({
          id: tables.rule_sets.id,
          created_at: tables.rule_sets.created_at,
          normalizer: tables.rule_sets.normalizer,
        })
        .from(tables.rule_sets)
        .orderBy(desc(tables.rule_sets.created_at)),
    ).all()
  ).results;
}
export async function activateRules(db: D1Database, revision: string) {
  await rulesFor(db, revision);
  await preparedStatement(
    db,
    database(db)
      .update(tables.settings)
      .set({ active_rules: revision })
      .where(eq(tables.settings.id, 1)),
  ).run();
  return { activated: revision, historicalReclassification: false };
}
