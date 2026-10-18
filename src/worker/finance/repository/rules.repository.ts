import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { NORMALIZER } from "../../../domain";
import {
  compileStoredRules,
  compileValidatedRules,
  type Rules,
} from "../../../domain/rules";
import { hash } from "../../../shared";
import { database, required } from "../../database";
import {
  aliases as aliasesTable,
  categories as categoriesTable,
  category_groups as categoryGroupsTable,
  rule_sets as ruleSetsTable,
  rules as rulesTable,
  settings as settingsTable,
} from "../../schema";

export async function saveRules(
  db: D1Database,
  document: Rules,
  activate = false,
) {
  compileValidatedRules(document);
  const id = await hash({ document, normalizer: NORMALIZER });
  const existing = await database(db)
    .select({ ready: ruleSetsTable.ready })
    .from(ruleSetsTable)
    .where(eq(ruleSetsTable.id, id))
    .get();
  if (existing?.ready) {
    if (activate) {
      await activateRules(db, id);
    }
    return { activated: activate, id, rules: document.rules.length };
  }
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
  async function writeBatch(offset: number): Promise<void> {
    const [first, ...rest] = statements.slice(offset, offset + 80);
    if (!first) {
      return;
    }
    await database(db).batch([first, ...rest]);
    return writeBatch(offset + 80);
  }
  await writeBatch(0);
  await database(db)
    .update(ruleSetsTable)
    .set({ ready: 1 })
    .where(eq(ruleSetsTable.id, id))
    .run();
  if (activate) {
    await database(db)
      .update(settingsTable)
      .set({ active_rules: id })
      .where(
        and(
          eq(settingsTable.id, 1),
          or(
            isNull(settingsTable.active_rules),
            ne(settingsTable.active_rules, id),
          ),
        ),
      )
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
    .where(
      and(
        eq(settingsTable.id, 1),
        or(
          isNull(settingsTable.active_rules),
          ne(settingsTable.active_rules, revision),
        ),
      ),
    )
    .run();
  return { activated: revision, historicalReclassification: false };
}
