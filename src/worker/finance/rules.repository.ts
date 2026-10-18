import { and, desc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { NORMALIZER } from "#domain/entity.ts";
import { compileValidatedRules, type Rules } from "#domain/rules/rules.ts";
import { database, hash, required } from "#worker/database.ts";
import * as tables from "#worker/schema.ts";

export async function saveRules(
  db: D1Database,
  document: Rules,
  activate = false,
) {
  compileValidatedRules(document);
  const id = await hash({ document, normalizer: NORMALIZER });
  const statements: BatchItem<"sqlite">[] = [
    database(db)
      .insert(tables.rule_sets)
      .values({
        id: id,
        document: document,
        normalizer: NORMALIZER,
        created_at: new Date().toISOString(),
      })
      .onConflictDoNothing(),
  ];
  for (const g of document.groups) {
    statements.push(
      database(db)
        .insert(tables.category_groups)
        .values({
          revision: id,
          id: g.id,
          name: g.name,
        })
        .onConflictDoNothing(),
    );
  }
  for (const c of document.categories) {
    statements.push(
      database(db)
        .insert(tables.categories)
        .values({
          revision: id,
          id: c.id,
          group_id: c.group_id,
          name: c.name,
        })
        .onConflictDoNothing(),
    );
    for (const alias of [c.name, ...c.aliases]) {
      statements.push(
        database(db)
          .insert(tables.aliases)
          .values({
            revision: id,
            alias: alias,
            category_id: c.id,
          })
          .onConflictDoNothing(),
      );
    }
  }
  for (const [r, rule] of document.rules.entries()) {
    statements.push(
      database(db)
        .insert(tables.rules)
        .values({
          revision: id,
          id: rule.id,
          position: r,
          priority: rule.priority,
          stage: rule.event.type,
          active: Number(rule.is_active),
          definition: rule,
        })
        .onConflictDoNothing(),
    );
  }
  // Batches may be repeated; the active pointer is changed only after all catalog rows exist.
  for (let i = 0; i < statements.length; i += 80) {
    const [first, ...rest] = statements.slice(i, i + 80);
    if (first) {
      await database(db).batch([first, ...rest]);
    }
  }
  await database(db)
    .update(tables.rule_sets)
    .set({ ready: 1 })
    .where(eq(tables.rule_sets.id, id))
    .run();
  if (activate) {
    await database(db)
      .update(tables.settings)
      .set({ active_rules: id })
      .where(eq(tables.settings.id, 1))
      .run();
  }
  return { id, rules: document.rules.length, activated: activate };
}

async function ruleRevision(db: D1Database, revision: string) {
  return required(
    await database(db)
      .select({
        document: tables.rule_sets.document,
        normalizer: tables.rule_sets.normalizer,
      })
      .from(tables.rule_sets)
      .where(
        and(eq(tables.rule_sets.id, revision), eq(tables.rule_sets.ready, 1)),
      )
      .get(),
  );
}

export async function readRules(db: D1Database, revision: string) {
  const row = await ruleRevision(db, revision);
  return row.document;
}

export async function rulesFor(db: D1Database, revision: string) {
  const row = await ruleRevision(db, revision);
  const document = row.document;
  if (document.version === 1) {
    throw new Error("RULES_V1_REQUIRES_EXPLICIT_CONVERSION_AND_ACTIVATION");
  }
  if (row.normalizer !== NORMALIZER) {
    throw new Error("NORMALIZER_VERSION_REQUIRES_EXPLICIT_UPGRADE");
  }
  return compileValidatedRules(document);
}

export async function listRules(db: D1Database) {
  return database(db)
    .select({
      id: tables.rule_sets.id,
      created_at: tables.rule_sets.created_at,
      normalizer: tables.rule_sets.normalizer,
    })
    .from(tables.rule_sets)
    .orderBy(desc(tables.rule_sets.created_at))
    .all();
}
export async function activateRules(db: D1Database, revision: string) {
  await rulesFor(db, revision);
  await database(db)
    .update(tables.settings)
    .set({ active_rules: revision })
    .where(eq(tables.settings.id, 1))
    .run();
  return { activated: revision, historicalReclassification: false };
}
