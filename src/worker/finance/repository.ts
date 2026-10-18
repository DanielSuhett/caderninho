import { and, eq, sql, getTableColumns, isNull } from "drizzle-orm";
import { z } from "zod/v4";

import type { PreviewInput, SubscriptionInput } from "#contracts/finance.ts";
import {
  AggregateSchema,
  QuerySchema,
  FilterSchema,
  type Filter,
  type FieldSchema,
} from "#contracts/queries.ts";
import { assertMinor } from "#domain/exact.ts";
import { metricsFor } from "#domain/finance-model.ts";
import { FinanceRecordSchema } from "#domain/schemas.ts";
import { parseJson } from "#shared/json.ts";
import {
  rows,
  database,
  preparedStatement,
  hash,
  statement,
} from "#worker/database.ts";
import * as tables from "#worker/schema.ts";

export const ItemSchema = z.object({
  id: z.string(),
  resources: z.string(),
  enabled: z.number(),
});

const columns: Record<z.infer<typeof FieldSchema>, string> = {
  date: "transaction_date",
  account: "parent_id",
  item: "item_id",
  currency: "currency",
  direction: "direction",
  "original.category": "original_category",
  "effective.category": "effective_category",
  "effective.group": "group_id",
  "original.description": "original_description",
  "effective.description": "effective_description",
  amountMinor: "amount_key",
  status: "status",
  eligible: "eligible",
  ignored: "ignored",
};
export function moneyKey(s: string) {
  assertMinor(s);
  const n = BigInt(s),
    abs = (n < 0n ? -n : n).toString().padStart(30, "0");
  return n < 0n
    ? "0" +
        abs
          .split("")
          .map((c) => String(9 - Number(c)))
          .join("")
    : "1" + abs;
}
export function compileFilter(input: unknown) {
  const filter = FilterSchema.parse(input),
    params: (string | number)[] = [];
  function walk(f: Filter, depth: number): string {
    if (depth > 12 || params.length > 80)
      throw new Error("Filter complexity limit");
    if ("and" in f)
      return "(" + f.and.map((x) => walk(x, depth + 1)).join(" AND ") + ")";
    if ("or" in f)
      return "(" + f.or.map((x) => walk(x, depth + 1)).join(" OR ") + ")";
    if ("tag" in f) {
      params.push(f.tag, f.value);
      return `EXISTS(SELECT 1 FROM tags t WHERE t.item_id=e.item_id AND t.resource=e.resource AND t.parent_id=e.parent_id AND t.id=e.id AND t.key=? AND t.value=? AND (t.origin='manual' OR NOT EXISTS(SELECT 1 FROM tags m WHERE m.item_id=t.item_id AND m.resource=t.resource AND m.parent_id=t.parent_id AND m.id=t.id AND m.key=t.key AND m.origin='manual')))`;
    }
    let value: string | number =
      typeof f.value === "boolean" ? Number(f.value) : f.value;
    if (f.field === "amountMinor") value = moneyKey(z.string().parse(f.value));
    if (f.op === "contains") {
      if (!f.field.endsWith("description"))
        throw new Error("contains only supports description");
      params.push(value);
      return `instr(e.${columns[f.field]},?)>0`;
    }
    params.push(value);
    const ops = { eq: "=", ne: "!=", gte: ">=", lte: "<=" };
    return `e.${columns[f.field]} ${ops[f.op]} ?`;
  }
  return { sql: walk(filter, 0), params };
}

export async function authorizedItems(db: D1Database, ids?: string[]) {
  const all = await rows(
    preparedStatement(
      db,
      database(db)
        .select({
          id: tables.items.id,
          resources: tables.items.resources,
          enabled: tables.items.enabled,
        })
        .from(tables.items)
        .where(eq(tables.items.enabled, 1)),
    ),
    ItemSchema,
  );
  if (ids?.some((id) => !all.some((item) => item.id === id)))
    throw new Error("ITEM_NOT_AUTHORIZED");
  return ids ? all.filter((item) => ids.includes(item.id)) : all;
}

export async function requireResource(
  db: D1Database,
  itemId: string,
  resource: string,
) {
  const [item] = await authorizedItems(db, [itemId]);
  if (!item) throw new Error("ITEM_NOT_AUTHORIZED");
  if (!z.array(z.string()).parse(parseJson(item.resources)).includes(resource))
    throw new Error("RESOURCE_NOT_AUTHORIZED");
}

export async function coverageFor(db: D1Database, resource: string) {
  const items = await authorizedItems(db),
    result = [];
  for (const item of items) {
    if (
      !z.array(z.string()).parse(parseJson(item.resources)).includes(resource)
    )
      continue;
    const found = await preparedStatement(
      db,
      database(db)
        .select({
          resource: tables.coverage.resource,
          parent_id: tables.coverage.parent_id,
          status: tables.coverage.status,
          bootstrap_complete: tables.coverage.bootstrap_complete,
          observed_at: tables.coverage.observed_at,
        })
        .from(tables.coverage)
        .where(
          and(
            eq(tables.coverage.item_id, item.id),
            eq(tables.coverage.resource, resource),
          ),
        ),
    ).all();
    result.push({
      itemId: item.id,
      coverage: found.results.length
        ? found.results
        : [{ resource, status: "not_synced", bootstrap_complete: 0 }],
    });
  }
  return result;
}

export async function revision(db: D1Database) {
  return z
    .number()
    .parse(
      await preparedStatement(
        db,
        database(db)
          .select({ revision: tables.settings.revision })
          .from(tables.settings)
          .where(eq(tables.settings.id, 1)),
      ).first("revision"),
    );
}

export async function queryEntities(db: D1Database, input: unknown) {
  const args = QuerySchema.parse(input);
  const scope = await hash({
    resource: args.resource,
    filter: args.filter ?? null,
  });
  if (args.cursor && args.cursor.scope !== scope)
    throw new Error("CURSOR_SCOPE_MISMATCH");
  const before = await revision(db);
  if (args.cursor && args.cursor.revision !== before)
    throw new Error("RESTART_REQUIRED");
  const f = args.filter ? compileFilter(args.filter) : { sql: "1", params: [] };
  const predicate = `e.resource=? AND e.deleted=0 AND EXISTS(SELECT 1 FROM items i WHERE i.id=e.item_id AND i.enabled=1 AND EXISTS(SELECT 1 FROM json_each(i.resources) r WHERE r.value=e.resource)) AND (${f.sql})`;
  const result = await statement(
    db,
    `SELECT e.*,(SELECT json_group_object(t.key,t.value) FROM tags t WHERE t.item_id=e.item_id AND t.resource=e.resource AND t.parent_id=e.parent_id AND t.id=e.id AND (t.origin='manual' OR NOT EXISTS(SELECT 1 FROM tags m WHERE m.item_id=t.item_id AND m.resource=t.resource AND m.parent_id=t.parent_id AND m.id=t.id AND m.key=t.key AND m.origin='manual'))) AS effective_tags FROM effective_entities e WHERE ${predicate} ORDER BY item_id,parent_id,id LIMIT ? OFFSET ?`,
    args.resource,
    ...f.params,
    args.limit + 1,
    args.cursor?.offset ?? 0,
  ).all();
  const coverage = await coverageFor(db, args.resource);
  if ((await revision(db)) !== before) throw new Error("RESTART_REQUIRED");
  return {
    revision: before,
    coverage,
    records: result.results.slice(0, args.limit),
    cursor:
      result.results.length > args.limit
        ? {
            revision: before,
            offset: (args.cursor?.offset ?? 0) + args.limit,
            scope,
          }
        : null,
  };
}

export async function aggregateEntities(db: D1Database, input: unknown) {
  const args = AggregateSchema.parse(input),
    before = await revision(db);
  const f = args.filter ? compileFilter(args.filter) : { sql: "1", params: [] };
  const definition = args.metric
    ? metricsFor(args.resource)[args.metric]
    : undefined;
  if (args.metric && !definition) throw new Error("UNKNOWN_METRIC");
  const field = definition?.field;
  if (field && !/^[a-zA-Z0-9_.]+$/.test(field))
    throw new Error("INVALID_METRIC_FIELD");
  const measure = field
    ? `json_extract(e.normalized,'$."${field}"')`
    : "e.amount_minor";
  const temporal =
    definition?.temporal === "flow"
      ? " AND e.eligible=1" +
        (args.resource === "transactions" ? " AND e.status='POSTED'" : "")
      : "";
  // SQL sums 3-digit limbs, cast TEXT before crossing the binding. No floating sum.
  const limbs = Array.from(
    { length: 10 },
    (_, i) =>
      `CAST(SUM(CASE WHEN substr(measure,1,1)='-' THEN -1 ELSE 1 END * CAST(substr(substr('000000000000000000000000000000'||ltrim(measure,'-'),-30),${i * 3 + 1},3) AS INTEGER)) AS TEXT) AS limb${i}`,
  );
  const result = await statement(
    db,
    `WITH selected AS (SELECT e.currency,${measure} AS measure FROM effective_entities e WHERE e.resource=? AND e.deleted=0 AND EXISTS(SELECT 1 FROM items i WHERE i.id=e.item_id AND i.enabled=1 AND EXISTS(SELECT 1 FROM json_each(i.resources) r WHERE r.value=e.resource)) AND (${f.sql})${temporal}${definition ? " AND e.ignored=0" : ""}) SELECT currency,CAST(COUNT(*) AS TEXT) AS count,CAST(COUNT(measure) AS TEXT) AS known,${limbs.join(",")} FROM selected GROUP BY currency`,
    args.resource,
    ...f.params,
  ).all();
  const coverage = await coverageFor(db, args.resource);
  if ((await revision(db)) !== before) throw new Error("RESTART_REQUIRED");
  return {
    revision: before,
    coverage,
    metric: args.metric ?? "source_amount",
    definition: definition ?? null,
    groups: result.results.map((row) => {
      const r = z
        .record(z.string(), z.union([z.string(), z.null()]))
        .parse(row);
      if (BigInt(r.count ?? "0") > 9000000000000n)
        throw new Error("EXACT_AGGREGATE_LIMIT");
      let total = 0n;
      for (let i = 0; i < 10; i++)
        total = total * 1000n + BigInt(r[`limb${i}`] ?? "0");
      return {
        currency: r.currency,
        count: r.count,
        known: r.known,
        totalMinor:
          args.metric === "count"
            ? null
            : r.known === "0"
              ? null
              : total.toString(),
        partial: r.count !== r.known,
      };
    }),
  };
}

export async function readStatus(db: D1Database) {
  return {
    items: await authorizedItems(db),
    coverage: (
      await preparedStatement(
        db,
        database(db)
          .select(getTableColumns(tables.coverage))
          .from(tables.coverage)
          .innerJoin(tables.items, eq(tables.items.id, tables.coverage.item_id))
          .where(eq(tables.items.enabled, 1)),
      ).all()
    ).results,
    operations: (
      await statement(
        db,
        "SELECT o.id,o.status,o.phase,o.progress,o.created_at,o.dispatched FROM operations o WHERE NOT EXISTS(SELECT 1 FROM json_each(o.input,'$.itemIds') ids WHERE NOT EXISTS(SELECT 1 FROM items i WHERE i.id=ids.value AND i.enabled=1)) ORDER BY o.created_at DESC LIMIT 50",
      ).all()
    ).results,
    backlog: await preparedStatement(
      db,
      database(db)
        .select({ pending: sql`COUNT(*)` })
        .from(tables.inbox)
        .where(isNull(tables.inbox.processed_at)),
    ).first(),
    limitation:
      "Webhooks can be lost; eventId is not a sequence. Explicit reconciliation is required for known or suspected gaps.",
  };
}

export async function previewSelection(
  db: D1Database,
  a: PreviewInput,
  before: number,
) {
  const f = a.filter ? compileFilter(a.filter) : { sql: "1", params: [] };
  await authorizedItems(db, a.itemIds);
  const q = `FROM effective_entities e WHERE resource='transactions' AND deleted=0 AND item_id IN (${a.itemIds.map(() => "?").join(",")}) AND EXISTS(SELECT 1 FROM items i WHERE i.id=e.item_id AND i.enabled=1 AND EXISTS(SELECT 1 FROM json_each(i.resources) r WHERE r.value=e.resource)) AND (${f.sql})`;
  const total = await statement(
      db,
      "SELECT COUNT(*) AS count " + q,
      ...a.itemIds,
      ...f.params,
    ).first("count"),
    sample = await statement(
      db,
      "SELECT id,normalized,effective_category,effective_description " +
        q +
        " ORDER BY item_id,parent_id,id LIMIT ?",
      ...a.itemIds,
      ...f.params,
      a.limit,
    ).all();
  return {
    before,
    total,
    sample: sample.results.map((r) =>
      z
        .object({
          id: z.string(),
          normalized: z.string(),
          effective_category: z.string().nullable(),
          effective_description: z.string().nullable(),
        })
        .parse(r),
    ),
  };
}

export async function subscriptionRecords(
  db: D1Database,
  a: SubscriptionInput,
) {
  const before = await revision(db);
  const selected = await statement(
    db,
    "SELECT normalized,effective_description,effective_category FROM effective_entities e WHERE resource='transactions' AND deleted=0 AND ignored=0 AND transaction_date BETWEEN ? AND ? AND currency=? AND EXISTS(SELECT 1 FROM items i WHERE i.id=e.item_id AND i.enabled=1 AND EXISTS(SELECT 1 FROM json_each(i.resources) r WHERE r.value=e.resource)) LIMIT 10001",
    a.from,
    a.to,
    a.currency,
  ).all();
  if (selected.results.length > 10000)
    throw new Error("ANALYSIS_LIMIT_NARROW_PERIOD");
  const records = selected.results.map((r) => {
    const v = z
      .object({
        normalized: z.string(),
        effective_description: z.string().nullable(),
        effective_category: z.string().nullable(),
      })
      .parse(r);
    return FinanceRecordSchema.parse({
      ...FinanceRecordSchema.parse(parseJson(v.normalized)),
      description: v.effective_description,
      category: v.effective_category,
    });
  });
  return { before, records };
}
