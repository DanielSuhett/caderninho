import { and, desc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { NORMALIZER } from "@/domain/finance.entity";
import {
  compileStoredRules,
  compileValidatedRules,
  type Rules,
} from "@/domain/rules";
import { hash } from "@/shared/crypto";

import { database, required } from "../database";
import {
  aliases as aliasesTable,
  categories as categoriesTable,
  category_groups as categoryGroupsTable,
  rule_sets as ruleSetsTable,
  rules as rulesTable,
  settings as settingsTable,
} from "../schema";

export async function saveRules(
  db: D1Database,
  document: Rules,
  activate = false,
) {
  compileValidatedRules(document);
  const id = await hash({ document, normalizer: NORMALIZER });
  const statements: BatchItem<"sqlite">[] = [
    database(db)
      .insert(ruleSetsTable)
      .values({
        created_at: new Date().toISOString(),
        document,
        id,
        normalizer: NORMALIZER,
      })
      .onConflictDoNothing(),
  ];
  for (const g of document.groups) {
    statements.push(
      database(db)
        .insert(categoryGroupsTable)
        .values({
          id: g.id,
          name: g.name,
          revision: id,
        })
        .onConflictDoNothing(),
    );
  }
  for (const c of document.categories) {
    statements.push(
      database(db)
        .insert(categoriesTable)
        .values({
          group_id: c.group_id,
          id: c.id,
          name: c.name,
          revision: id,
        })
        .onConflictDoNothing(),
    );
    for (const alias of [c.name, ...c.aliases]) {
      statements.push(
        database(db)
          .insert(aliasesTable)
          .values({
            alias,
            category_id: c.id,
            revision: id,
          })
          .onConflictDoNothing(),
      );
    }
  }
  for (const [r, rule] of document.rules.entries()) {
    statements.push(
      database(db)
        .insert(rulesTable)
        .values({
          active: Number(rule.is_active),
          definition: rule,
          id: rule.id,
          position: r,
          priority: rule.priority,
          revision: id,
          stage: rule.event.type,
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
    .update(ruleSetsTable)
    .set({ ready: 1 })
    .where(eq(ruleSetsTable.id, id))
    .run();
  if (activate) {
    await database(db)
      .update(settingsTable)
      .set({ active_rules: id })
      .where(eq(settingsTable.id, 1))
      .run();
  }
  return { activated: activate, id, rules: document.rules.length };
}

async function ruleRevision(db: D1Database, revision: string) {
  return required(
    await database(db)
      .select({
        document: ruleSetsTable.document,
        normalizer: ruleSetsTable.normalizer,
      })
      .from(ruleSetsTable)
      .where(and(eq(ruleSetsTable.id, revision), eq(ruleSetsTable.ready, 1)))
      .get(),
  );
}

export async function readRules(db: D1Database, revision: string) {
  const row = await ruleRevision(db, revision);
  return row.document;
}

export async function rulesFor(db: D1Database, revision: string) {
  const row = await ruleRevision(db, revision);
  return compileStoredRules(row);
}

export async function listRules(db: D1Database) {
  return await database(db)
    .select({
      created_at: ruleSetsTable.created_at,
      id: ruleSetsTable.id,
      normalizer: ruleSetsTable.normalizer,
    })
    .from(ruleSetsTable)
    .orderBy(desc(ruleSetsTable.created_at))
    .all();
}
export async function activateRules(db: D1Database, revision: string) {
  await rulesFor(db, revision);
  await database(db)
    .update(settingsTable)
    .set({ active_rules: revision })
    .where(eq(settingsTable.id, 1))
    .run();
  return { activated: revision, historicalReclassification: false };
}
