import {
  and,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  getViewSelectedFields,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  notExists,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import type {
  PreviewInput,
  SubscriptionInput,
} from "@/contracts/finance.types";
import type { Aggregate, Query } from "@/contracts/queries.types";
import {
  Availability,
  Resource,
  TagOrigin,
  TransactionStatus,
} from "@/domain/enums";
import { metricFor } from "@/domain/finance-model";
import {
  assertCursorScope,
  assertReadRevision,
  type Filter,
  FilterOperandKind,
  FilterOperator,
  filterOperand,
} from "@/domain/query.entity";
import { hash } from "@/shared/crypto";

import { database } from "../database";
import {
  coverage as coverageTable,
  type derived as derivedTable,
  effective_entities as e,
  type entities as entitiesTable,
  inbox as inboxTable,
  items as itemsTable,
  operations as o,
  settings as settingsTable,
  tags as tagsTable,
} from "../schema";

const jsonFieldPattern = /^[a-zA-Z0-9_.]+$/;

const effectiveColumns = getViewSelectedFields(e);
const t = alias(tagsTable, "t"),
  m = alias(tagsTable, "m");
const columns = {
  account: e.parent_id,
  amountMinor: e.amount_key,
  currency: e.currency,
  date: e.transaction_date,
  direction: e.direction,
  "effective.category": e.effective_category,
  "effective.description": e.effective_description,
  "effective.group": e.group_id,
  eligible: e.eligible,
  ignored: e.ignored,
  item: e.item_id,
  "original.category": e.original_category,
  "original.description": e.original_description,
  status: e.status,
};

export function moneyKey(s: string) {
  const n = BigInt(s),
    abs = (n < 0n ? -n : n).toString().padStart(30, "0");
  return n < 0n
    ? "0" +
        abs
          .split("")
          .map((c) => String(9 - Number(c)))
          .join("")
    : `1${abs}`;
}

function matchingTags(db: ReturnType<typeof database>) {
  return and(
    eq(t.item_id, e.item_id),
    eq(t.resource, e.resource),
    eq(t.parent_id, e.parent_id),
    eq(t.id, e.id),
    or(
      eq(t.origin, TagOrigin.manual),
      notExists(
        db
          .select({ one: sql`1` })
          .from(m)
          .where(
            and(
              eq(m.item_id, t.item_id),
              eq(m.resource, t.resource),
              eq(m.parent_id, t.parent_id),
              eq(m.id, t.id),
              eq(m.key, t.key),
              eq(m.origin, TagOrigin.manual),
            ),
          ),
      ),
    ),
  );
}

export function compileFilter(db: D1Database, filter: Filter): SQL {
  let parameters = 0;
  function walk(f: Filter, depth: number): SQL {
    if (depth > 12 || parameters > 80) {
      throw new Error("Filter complexity limit");
    }
    if ("and" in f) {
      return sql`${and(...f.and.map((x) => walk(x, depth + 1)))}`;
    }
    if ("or" in f) {
      return sql`${or(...f.or.map((x) => walk(x, depth + 1)))}`;
    }
    if ("tag" in f) {
      parameters += 2;
      return exists(
        database(db)
          .select({ one: sql`1` })
          .from(t)
          .where(
            and(
              matchingTags(database(db)),
              eq(t.key, f.tag),
              eq(t.value, f.value),
            ),
          ),
      );
    }
    const value = filterValue(f);
    parameters += 1;
    if (f.op === FilterOperator.contains) {
      return gt(sql<number>`instr(${columns[f.field]}, ${value})`, 0);
    }
    return { eq, gte, lte, ne }[f.op](columns[f.field], value);
  }
  return walk(filter, 0);
}

function filterValue(filter: Extract<Filter, { field: string }>) {
  const operand = filterOperand(filter);
  if (operand.kind === FilterOperandKind.amount) {
    return moneyKey(operand.value);
  }
  return typeof operand.value === "boolean"
    ? Number(operand.value)
    : operand.value;
}

export async function connectedItems(db: D1Database, ids?: string[]) {
  return await database(db)
    .select()
    .from(itemsTable)
    .where(ids ? inArray(itemsTable.id, ids) : undefined);
}
async function coverageFor(db: D1Database, resource: Resource) {
  const items = await connectedItems(db);
  if (!items.length) {
    return [];
  }
  const found = await database(db)
    .select({
      coverage: {
        bootstrap_complete: coverageTable.bootstrap_complete,
        observed_at: coverageTable.observed_at,
        parent_id: coverageTable.parent_id,
        resource: coverageTable.resource,
        status: coverageTable.status,
      },
      itemId: coverageTable.item_id,
    })
    .from(coverageTable)
    .where(
      and(
        inArray(
          coverageTable.item_id,
          items.map((item) => item.id),
        ),
        eq(coverageTable.resource, resource),
      ),
    );
  const byItem = new Map<string, (typeof found)[number]["coverage"][]>();
  for (const row of found) {
    const coverage = byItem.get(row.itemId) ?? [];
    coverage.push(row.coverage);
    byItem.set(row.itemId, coverage);
  }
  return items.map((item) => ({
    coverage: byItem.get(item.id) ?? [
      {
        bootstrap_complete: 0,
        resource,
        status: Availability.not_synced,
      },
    ],
    itemId: item.id,
  }));
}
export async function revision(db: D1Database) {
  const row = await database(db)
    .select({ revision: settingsTable.revision })
    .from(settingsTable)
    .where(eq(settingsTable.id, 1))
    .get();
  if (!row) {
    throw new Error("SETTINGS_MISSING");
  }
  return row.revision;
}

// Public tools historically expose these JSON columns as strings.
export function serializedEntity<
  T extends {
    source: typeof entitiesTable.$inferSelect.source;
    normalized: typeof entitiesTable.$inferSelect.normalized;
    evidence: typeof derivedTable.$inferSelect.evidence | null;
  },
>(row: T) {
  return {
    ...row,
    evidence: row.evidence ? JSON.stringify(row.evidence) : null,
    normalized: JSON.stringify(row.normalized),
    source: JSON.stringify(row.source),
  };
}

export async function queryEntities(
  db: D1Database,
  input: Omit<Partial<Query>, "cursor"> & { cursor?: Query["cursor"] | null },
) {
  const args = { limit: 50, resource: Resource.transactions, ...input };
  const scope = await hash({
    filter: args.filter ?? null,
    resource: args.resource,
  });
  if (args.cursor) {
    assertCursorScope({ actual: args.cursor.scope, expected: scope });
  }
  const before = await revision(db);
  if (args.cursor) {
    assertReadRevision({ actual: args.cursor.revision, expected: before });
  }
  const tags = database(db)
    .select({ value: sql<string>`json_group_object(${t.key}, ${t.value})` })
    .from(t)
    .where(matchingTags(database(db)));
  const result = await database(db)
    .select({ ...effectiveColumns, effective_tags: sql<string>`(${tags})` })
    .from(e)
    .where(
      and(
        eq(e.resource, args.resource),
        eq(e.deleted, 0),
        args.filter ? compileFilter(db, args.filter) : undefined,
      ),
    )
    .orderBy(e.item_id, e.parent_id, e.id)
    .limit(args.limit + 1)
    .offset(args.cursor?.offset ?? 0);
  const coverage = await coverageFor(db, args.resource);
  assertReadRevision({ actual: await revision(db), expected: before });
  return {
    coverage,
    cursor:
      result.length > args.limit
        ? {
            offset: (args.cursor?.offset ?? 0) + args.limit,
            revision: before,
            scope,
          }
        : null,
    records: result.slice(0, args.limit).map(serializedEntity),
    revision: before,
  };
}

export async function aggregateEntities(
  db: D1Database,
  input: Partial<Aggregate>,
) {
  const args = { resource: Resource.transactions, ...input };
  const before = await revision(db),
    definition = metricFor({ metric: args.metric, resource: args.resource });
  const field = definition?.field;
  if (field && !jsonFieldPattern.test(field)) {
    throw new Error("INVALID_METRIC_FIELD");
  }
  const measure = field
    ? sql<string | null>`json_extract(${e.normalized}, ${`$."${field}"`})`
    : e.amount_minor;
  const selected = database(db)
    .$with("selected")
    .as(
      database(db)
        .select({
          currency: e.currency,
          measure: sql<string | null>`${measure}`.as("measure"),
        })
        .from(e)
        .where(
          and(
            eq(e.resource, args.resource),
            eq(e.deleted, 0),
            args.filter ? compileFilter(db, args.filter) : undefined,
            definition?.temporal === "flow" ? eq(e.eligible, 1) : undefined,
            definition?.temporal === "flow" &&
              args.resource === Resource.transactions
              ? eq(e.status, TransactionStatus.POSTED)
              : undefined,
            definition ? eq(e.ignored, 0) : undefined,
          ),
        ),
    );
  // Sum signed three-digit integer limbs; never cross a floating-point sum.
  const limb = (i: number) =>
    sql<
      string | null
    >`cast(sum(case when substr(${selected.measure},1,1)='-' then -1 else 1 end * cast(substr(substr('000000000000000000000000000000'||ltrim(${selected.measure},'-'),-30),${i * 3 + 1},3) as integer)) as text)`;
  const result = await database(db)
    .with(selected)
    .select({
      count: sql<string>`cast(count(*) as text)`,
      currency: selected.currency,
      known: sql<string>`cast(count(${selected.measure}) as text)`,
      limb0: limb(0),
      limb1: limb(1),
      limb2: limb(2),
      limb3: limb(3),
      limb4: limb(4),
      limb5: limb(5),
      limb6: limb(6),
      limb7: limb(7),
      limb8: limb(8),
      limb9: limb(9),
    })
    .from(selected)
    .groupBy(selected.currency);
  const coverage = await coverageFor(db, args.resource);
  assertReadRevision({ actual: await revision(db), expected: before });
  return {
    coverage,
    definition: definition ?? null,
    groups: result.map((r) => {
      if (BigInt(r.count) > 9000000000000n) {
        throw new Error("EXACT_AGGREGATE_LIMIT");
      }
      let total = 0n;
      for (const part of [
        r.limb0,
        r.limb1,
        r.limb2,
        r.limb3,
        r.limb4,
        r.limb5,
        r.limb6,
        r.limb7,
        r.limb8,
        r.limb9,
      ]) {
        total = total * 1000n + BigInt(part ?? "0");
      }
      return {
        count: r.count,
        currency: r.currency,
        known: r.known,
        partial: r.count !== r.known,
        totalMinor:
          args.metric === "count" || r.known === "0" ? null : total.toString(),
      };
    }),
    metric: args.metric ?? "source_amount",
    revision: before,
  };
}

export async function readStatus(db: D1Database) {
  const operations = await database(db)
    .select({
      created_at: o.created_at,
      dispatched: o.dispatched,
      id: o.id,
      phase: o.phase,
      progress: o.progress,
      status: o.status,
    })
    .from(o)
    .orderBy(desc(o.created_at))
    .limit(50);
  return {
    backlog: await database(db)
      .select({ pending: count() })
      .from(inboxTable)
      .where(isNull(inboxTable.processed_at))
      .get(),
    coverage: await database(db)
      .select(getTableColumns(coverageTable))
      .from(coverageTable),
    items: await connectedItems(db),
    limitation:
      "Webhooks can be lost; eventId is not a sequence. Explicit reconciliation is required for known or suspected gaps.",
    operations: operations.map((op) => ({
      ...op,
      progress: JSON.stringify(op.progress),
    })),
  };
}
export async function previewSelection(
  db: D1Database,
  a: PreviewInput,
  before: number,
) {
  const predicate = and(
    eq(e.resource, Resource.transactions),
    eq(e.deleted, 0),
    inArray(e.item_id, a.itemIds),
    a.filter ? compileFilter(db, a.filter) : undefined,
  );
  const total = await database(db)
    .select({ count: count() })
    .from(e)
    .where(predicate)
    .get();
  const sample = await database(db)
    .select({
      effective_category: e.effective_category,
      effective_description: e.effective_description,
      id: e.id,
      normalized: e.normalized,
    })
    .from(e)
    .where(predicate)
    .orderBy(e.item_id, e.parent_id, e.id)
    .limit(a.limit);
  return {
    before,
    sample,
    total: total?.count ?? 0,
  };
}
export async function subscriptionRecords(
  db: D1Database,
  a: SubscriptionInput,
) {
  const before = await revision(db);
  const selected = await database(db)
    .select({
      effective_category: e.effective_category,
      effective_description: e.effective_description,
      normalized: e.normalized,
    })
    .from(e)
    .where(
      and(
        eq(e.resource, Resource.transactions),
        eq(e.deleted, 0),
        eq(e.ignored, 0),
        gte(e.transaction_date, a.from),
        lte(e.transaction_date, a.to),
        eq(e.currency, a.currency),
      ),
    )
    .limit(10_001);
  if (selected.length > 10_000) {
    throw new Error("ANALYSIS_LIMIT_NARROW_PERIOD");
  }
  return {
    before,
    records: selected.map((r) => ({
      ...r.normalized,
      category: r.effective_category,
      description: r.effective_description,
    })),
  };
}
