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
} from "#contracts/finance.types.ts";
import type { Aggregate, Query } from "#contracts/queries.types.ts";
import {
  Availability,
  FaultCode,
  Resource,
  TagOrigin,
  TransactionStatus,
} from "#domain/enums.ts";
import { assertMinor } from "#domain/exact.ts";
import { Field, type Filter, FilterOperator } from "#domain/filter.types.ts";
import { metricsFor } from "#domain/finance-model.ts";
import { database, hash } from "#worker/database.ts";
import * as tables from "#worker/schema.ts";

const e = tables.effective_entities;
const effectiveColumns = getViewSelectedFields(e);
const t = alias(tables.tags, "t"),
  m = alias(tables.tags, "m");
const columns = {
  date: e.transaction_date,
  account: e.parent_id,
  item: e.item_id,
  currency: e.currency,
  direction: e.direction,
  "original.category": e.original_category,
  "effective.category": e.effective_category,
  "effective.group": e.group_id,
  "original.description": e.original_description,
  "effective.description": e.effective_description,
  amountMinor: e.amount_key,
  status: e.status,
  eligible: e.eligible,
  ignored: e.ignored,
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
    parameters++;
    if (f.op === FilterOperator.contains) {
      if (!f.field.endsWith("description")) {
        throw new Error("contains only supports description");
      }
      return gt(sql<number>`instr(${columns[f.field]}, ${value})`, 0);
    }
    return { eq, ne, gte, lte }[f.op](columns[f.field], value);
  }
  return walk(filter, 0);
}

function filterValue(filter: Extract<Filter, { field: string }>) {
  if (filter.field === Field.amountMinor) {
    if (typeof filter.value !== "string") {
      throw new Error("Invalid amount filter");
    }
    assertMinor(filter.value);
    return moneyKey(filter.value);
  }
  return typeof filter.value === "boolean"
    ? Number(filter.value)
    : filter.value;
}

export async function authorizedItems(db: D1Database, ids?: string[]) {
  const all = await database(db)
    .select()
    .from(tables.items)
    .where(eq(tables.items.enabled, 1));
  if (ids?.some((id) => !all.some((item) => item.id === id))) {
    throw new Error(FaultCode.ITEM_NOT_AUTHORIZED);
  }
  return ids ? all.filter((item) => ids.includes(item.id)) : all;
}
export async function requireResource(
  db: D1Database,
  itemId: string,
  resource: Resource,
) {
  const [item] = await authorizedItems(db, [itemId]);
  if (!item) {
    throw new Error(FaultCode.ITEM_NOT_AUTHORIZED);
  }
  if (!item.resources.includes(resource)) {
    throw new Error("RESOURCE_NOT_AUTHORIZED");
  }
}

function authorizedEntity(db: D1Database) {
  return exists(
    database(db)
      .select({ one: sql`1` })
      .from(tables.items)
      .where(
        and(
          eq(tables.items.id, e.item_id),
          eq(tables.items.enabled, 1),
          exists(
            database(db)
              .select({ one: sql`1` })
              .from(sql`json_each(${tables.items.resources})`)
              .where(eq(sql`value`, e.resource)),
          ),
        ),
      ),
  );
}
async function coverageFor(db: D1Database, resource: Resource) {
  const items = (await authorizedItems(db)).filter((item) =>
    item.resources.includes(resource),
  );
  if (!items.length) {
    return [];
  }
  const found = await database(db)
    .select({
      itemId: tables.coverage.item_id,
      coverage: {
        resource: tables.coverage.resource,
        parent_id: tables.coverage.parent_id,
        status: tables.coverage.status,
        bootstrap_complete: tables.coverage.bootstrap_complete,
        observed_at: tables.coverage.observed_at,
      },
    })
    .from(tables.coverage)
    .where(
      and(
        inArray(
          tables.coverage.item_id,
          items.map((item) => item.id),
        ),
        eq(tables.coverage.resource, resource),
      ),
    );
  const byItem = new Map<string, (typeof found)[number]["coverage"][]>();
  for (const row of found) {
    const coverage = byItem.get(row.itemId) ?? [];
    coverage.push(row.coverage);
    byItem.set(row.itemId, coverage);
  }
  return items.map((item) => ({
    itemId: item.id,
    coverage: byItem.get(item.id) ?? [
      {
        resource,
        status: Availability.not_synced,
        bootstrap_complete: 0,
      },
    ],
  }));
}
export async function revision(db: D1Database) {
  const row = await database(db)
    .select({ revision: tables.settings.revision })
    .from(tables.settings)
    .where(eq(tables.settings.id, 1))
    .get();
  if (!row) {
    throw new Error("SETTINGS_MISSING");
  }
  return row.revision;
}

// Public tools historically expose these JSON columns as strings.
export function serializedEntity<
  T extends {
    source: typeof tables.entities.$inferSelect.source;
    normalized: typeof tables.entities.$inferSelect.normalized;
    evidence: typeof tables.derived.$inferSelect.evidence | null;
  },
>(row: T) {
  return {
    ...row,
    source: JSON.stringify(row.source),
    normalized: JSON.stringify(row.normalized),
    evidence: row.evidence ? JSON.stringify(row.evidence) : null,
  };
}

export async function queryEntities(
  db: D1Database,
  input: Omit<Partial<Query>, "cursor"> & { cursor?: Query["cursor"] | null },
) {
  const args = { resource: Resource.transactions, limit: 50, ...input };
  const scope = await hash({
    resource: args.resource,
    filter: args.filter ?? null,
  });
  if (args.cursor && args.cursor.scope !== scope) {
    throw new Error("CURSOR_SCOPE_MISMATCH");
  }
  const before = await revision(db);
  if (args.cursor && args.cursor.revision !== before) {
    throw new Error("RESTART_REQUIRED");
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
        authorizedEntity(db),
        args.filter ? compileFilter(db, args.filter) : undefined,
      ),
    )
    .orderBy(e.item_id, e.parent_id, e.id)
    .limit(args.limit + 1)
    .offset(args.cursor?.offset ?? 0);
  const coverage = await coverageFor(db, args.resource);
  if ((await revision(db)) !== before) {
    throw new Error("RESTART_REQUIRED");
  }
  return {
    revision: before,
    coverage,
    records: result.slice(0, args.limit).map(serializedEntity),
    cursor:
      result.length > args.limit
        ? {
            revision: before,
            offset: (args.cursor?.offset ?? 0) + args.limit,
            scope,
          }
        : null,
  };
}

export async function aggregateEntities(
  db: D1Database,
  input: Partial<Aggregate>,
) {
  const args = { resource: Resource.transactions, ...input };
  const before = await revision(db),
    definition = args.metric
      ? metricsFor(args.resource)[args.metric]
      : undefined;
  if (args.metric && !definition) {
    throw new Error("UNKNOWN_METRIC");
  }
  const field = definition?.field;
  if (field && !/^[a-zA-Z0-9_.]+$/.test(field)) {
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
            authorizedEntity(db),
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
      currency: selected.currency,
      count: sql<string>`cast(count(*) as text)`,
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
  if ((await revision(db)) !== before) {
    throw new Error("RESTART_REQUIRED");
  }
  return {
    revision: before,
    coverage,
    metric: args.metric ?? "source_amount",
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
        currency: r.currency,
        count: r.count,
        known: r.known,
        totalMinor:
          args.metric === "count" || r.known === "0" ? null : total.toString(),
        partial: r.count !== r.known,
      };
    }),
  };
}

export async function readStatus(db: D1Database) {
  const o = tables.operations;
  const operations = await database(db)
    .select({
      id: o.id,
      status: o.status,
      phase: o.phase,
      progress: o.progress,
      created_at: o.created_at,
      dispatched: o.dispatched,
    })
    .from(o)
    .where(
      notExists(
        database(db)
          .select({ one: sql`1` })
          .from(sql`json_each(${o.input}, '$.itemIds') as ids`)
          .where(
            notExists(
              database(db)
                .select({ one: sql`1` })
                .from(tables.items)
                .where(
                  and(
                    eq(tables.items.id, sql`ids.value`),
                    eq(tables.items.enabled, 1),
                  ),
                ),
            ),
          ),
      ),
    )
    .orderBy(desc(o.created_at))
    .limit(50);
  return {
    items: (await authorizedItems(db)).map((item) => ({
      ...item,
      resources: JSON.stringify(item.resources),
    })),
    coverage: await database(db)
      .select(getTableColumns(tables.coverage))
      .from(tables.coverage)
      .innerJoin(tables.items, eq(tables.items.id, tables.coverage.item_id))
      .where(eq(tables.items.enabled, 1)),
    operations: operations.map((op) => ({
      ...op,
      progress: JSON.stringify(op.progress),
    })),
    backlog: await database(db)
      .select({ pending: count() })
      .from(tables.inbox)
      .where(isNull(tables.inbox.processed_at))
      .get(),
    limitation:
      "Webhooks can be lost; eventId is not a sequence. Explicit reconciliation is required for known or suspected gaps.",
  };
}
export async function previewSelection(
  db: D1Database,
  a: PreviewInput,
  before: number,
) {
  await authorizedItems(db, a.itemIds);
  const predicate = and(
    eq(e.resource, Resource.transactions),
    eq(e.deleted, 0),
    inArray(e.item_id, a.itemIds),
    authorizedEntity(db),
    a.filter ? compileFilter(db, a.filter) : undefined,
  );
  const total = await database(db)
    .select({ count: count() })
    .from(e)
    .where(predicate)
    .get();
  const sample = await database(db)
    .select({
      id: e.id,
      normalized: e.normalized,
      effective_category: e.effective_category,
      effective_description: e.effective_description,
    })
    .from(e)
    .where(predicate)
    .orderBy(e.item_id, e.parent_id, e.id)
    .limit(a.limit);
  return {
    before,
    total: total?.count ?? 0,
    sample,
  };
}
export async function subscriptionRecords(
  db: D1Database,
  a: SubscriptionInput,
) {
  const before = await revision(db);
  const selected = await database(db)
    .select({
      normalized: e.normalized,
      effective_description: e.effective_description,
      effective_category: e.effective_category,
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
        authorizedEntity(db),
      ),
    )
    .limit(10001);
  if (selected.length > 10000) {
    throw new Error("ANALYSIS_LIMIT_NARROW_PERIOD");
  }
  return {
    before,
    records: selected.map((r) => ({
      ...r.normalized,
      description: r.effective_description,
      category: r.effective_category,
    })),
  };
}
