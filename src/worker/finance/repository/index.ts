import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";

import type {
  AggregateQuery,
  Metric,
  RunStatus,
  TransactionFilter,
} from "../../../domain";
import { connectionPartial, MetricDefinition } from "../../../domain";
import { database, required } from "../../database";
import {
  connections as c,
  settings,
  sync_runs,
  transactions as t,
} from "../../schema";
import type { FinancialRepository } from "../entity";

const transactionFields = {
  accountId: t.accountId,
  amountMinor: t.amountMinor,
  category: t.category,
  currency: t.currency,
  date: t.date,
  description: t.description,
  direction: t.direction,
  id: t.id,
  status: t.status,
};
function accountMembership(filter: TransactionFilter = {}, bank = false) {
  const condition = and(
    filter.connectionIds && inArray(c.id, filter.connectionIds),
    bank ? sql`json_extract(account.value,'$.type')='BANK'` : undefined,
  );
  return sql`${t.accountId} IN (SELECT account.key FROM ${c}, json_each(${c.accounts}) AS account ${condition ? sql`WHERE ${condition}` : sql``})`;
}
function selectedAccounts(ids: string[]) {
  return sql`SELECT value FROM json_each(${JSON.stringify(ids)})`;
}
function amountComparison(bound: string, minimum: boolean) {
  const value = BigInt(bound).toString();
  const magnitude = value.replace("-", "");
  const absolute = sql<string>`replace(${t.amountMinor},'-','')`;
  const greater = sql`(length(${absolute})>${magnitude.length} OR (length(${absolute})=${magnitude.length} AND ${absolute}>=${magnitude}))`;
  const smaller = sql`(length(${absolute})<${magnitude.length} OR (length(${absolute})=${magnitude.length} AND ${absolute}<=${magnitude}))`;
  if (value.startsWith("-")) {
    return minimum
      ? sql`(${t.amountMinor} NOT LIKE '-%' OR (${t.amountMinor} LIKE '-%' AND ${smaller}))`
      : sql`(${t.amountMinor} LIKE '-%' AND ${greater})`;
  }
  return minimum
    ? sql`(${t.amountMinor} NOT LIKE '-%' AND ${greater})`
    : sql`(${t.amountMinor} LIKE '-%' OR (${t.amountMinor} NOT LIKE '-%' AND ${smaller}))`;
}
function filterWhere(filter: TransactionFilter = {}) {
  return and(
    filter.connectionIds && accountMembership(filter),
    filter.accountIds &&
      sql`${t.accountId} IN (${selectedAccounts(filter.accountIds)})`,
    filter.from === undefined ? undefined : sql`${t.date}>=${filter.from}`,
    filter.to === undefined ? undefined : sql`${t.date}<=${filter.to}`,
    filter.currency === undefined ? undefined : eq(t.currency, filter.currency),
    filter.direction === undefined
      ? undefined
      : eq(t.direction, filter.direction),
    filter.status === undefined ? undefined : eq(t.status, filter.status),
    filter.category === undefined ? undefined : eq(t.category, filter.category),
    filter.description === undefined
      ? undefined
      : sql`instr(lower(${t.description}),lower(${filter.description}))>0`,
    filter.minAmountMinor === undefined
      ? undefined
      : amountComparison(filter.minAmountMinor, true),
    filter.maxAmountMinor === undefined
      ? undefined
      : amountComparison(filter.maxAmountMinor, false),
  );
}
const moneyTotal = (value: SQL<string | null>) => {
  const limb = (offset: number) =>
    sql<string>`CAST(coalesce(sum(CASE WHEN ${value} LIKE '-%' THEN -1 ELSE 1 END * CAST(substr(substr('000000000000000000000000000000'||replace(${value},'-',''),-30),${offset + 1},3) AS INTEGER)),0) AS TEXT)`.as(
      `amount_${offset}`,
    );
  return {
    a: limb(0),
    b: limb(3),
    c: limb(6),
    d: limb(9),
    e: limb(12),
    f: limb(15),
    g: limb(18),
    h: limb(21),
    i: limb(24),
    j: limb(27),
  };
};
function total(value: Record<keyof ReturnType<typeof moneyTotal>, string>) {
  return [
    value.a,
    value.b,
    value.c,
    value.d,
    value.e,
    value.f,
    value.g,
    value.h,
    value.i,
    value.j,
  ]
    .reduce((sum, part) => sum * 1000n + BigInt(part), 0n)
    .toString();
}
function assertRevision(before: number, after: number, expected?: number) {
  if (before !== after || (expected !== undefined && before !== expected)) {
    throw new Error("RESTART_REQUIRED");
  }
}
export function createFinancialRepository(
  binding: D1Database,
): FinancialRepository {
  const db = database(binding);
  const revision = () =>
    db
      .select({ revision: settings.revision })
      .from(settings)
      .where(eq(settings.id, 1));
  const qualityConnections = (filter: TransactionFilter = {}) =>
    db
      .select({
        accounts: c.accounts,
        id: c.id,
        importStatus: sql<RunStatus | null>`(SELECT ${sync_runs.status} FROM ${sync_runs} WHERE ${sync_runs.connectionId}=${c.id} ORDER BY ${sync_runs.createdAt} DESC LIMIT 1)`,
        lastAdmittedAt: c.lastAdmittedAt,
        lastSuccessAt: c.lastSuccessAt,
      })
      .from(c)
      .where(
        and(
          filter.connectionIds && inArray(c.id, filter.connectionIds),
          filter.accountIds &&
            sql`EXISTS(SELECT 1 FROM json_each(${c.accounts}) AS account WHERE account.key IN (${selectedAccounts(filter.accountIds)}))`,
        ),
      );
  function partial(rows: Awaited<ReturnType<typeof qualityConnections>>) {
    return !rows.length || rows.some(connectionPartial);
  }
  return {
    async aggregate(input, referenceDay) {
      const absolute = sql<string | null>`replace(${t.amountMinor},'-','')`;
      const eligible =
        input.metric === "count"
          ? undefined
          : and(eq(t.status, "POSTED"), sql`${t.date}<=${referenceDay}`);
      const metricFilters: Record<Metric, SQL | undefined> = {
        cash_flow: accountMembership(input.filter, true),
        count: undefined,
        credits: eq(t.direction, "CREDIT"),
        debits: eq(t.direction, "DEBIT"),
      };
      const metricFilter = metricFilters[input.metric];
      let amount: SQL<string | null> = absolute;
      if (input.metric === "cash_flow") {
        amount = sql<
          string | null
        >`CASE WHEN ${t.direction}='DEBIT' AND ${absolute}<>'0' THEN '-'||${absolute} ELSE ${absolute} END`;
      }
      const groupings: Record<
        NonNullable<AggregateQuery["groupBy"]>,
        SQL<string | null>
      > = {
        account: sql`${t.accountId}`,
        category: sql`${t.category}`,
        month: sql`substr(${t.date},1,7)`,
      };
      const group = input.groupBy
        ? groupings[input.groupBy]
        : sql<string | null>`NULL`;
      const [before, groups, connectionQuality, afterRevision] = await db.batch(
        [
          revision(),
          db
            .select({
              amount: moneyTotal(amount),
              amountCount:
                sql<string>`CAST(count(${t.amountMinor}) AS TEXT)`.as(
                  "amount_count",
                ),
              count: sql<string>`CAST(count(*) AS TEXT)`.as("count"),
              currency: t.currency,
              group: group.as("group_value"),
              unknownAmountCount:
                sql<string>`CAST(sum(CASE WHEN ${t.amountMinor} IS NULL THEN 1 ELSE 0 END) AS TEXT)`.as(
                  "unknown_amount_count",
                ),
            })
            .from(t)
            .where(and(filterWhere(input.filter), eligible, metricFilter))
            .groupBy(t.currency, group)
            .orderBy(t.currency, group),
          qualityConnections(input.filter),
          revision(),
        ],
      );
      const version = required(before[0]).revision;
      assertRevision(version, required(afterRevision[0]).revision);
      return {
        definition: MetricDefinition[input.metric],
        groups: groups.map((row) => ({
          count: row.count,
          currency: row.currency,
          group: row.group,
          totalMinor:
            input.metric !== "count" && BigInt(row.amountCount) > 0n
              ? total(row.amount)
              : null,
          unknownAmountCount: row.unknownAmountCount,
        })),
        metric: input.metric,
        partial:
          partial(connectionQuality) ||
          groups.some((row) => BigInt(row.unknownAmountCount) > 0n),
        referenceDay,
        revision: version,
      };
    },
    async query(input, scope, referenceDay) {
      if (input.cursor && input.cursor.scope !== scope) {
        throw new Error("CURSOR_SCOPE_MISMATCH");
      }
      const { cursor } = input;
      const after = cursor
        ? sql`(${t.date},${t.accountId},${t.id})<(${cursor.date},${cursor.accountId},${cursor.id})`
        : undefined;
      const [before, rows, connectionQuality, afterRevision] = await db.batch([
        revision(),
        db
          .select(transactionFields)
          .from(t)
          .where(and(filterWhere(input.filter), after))
          .orderBy(desc(t.date), desc(t.accountId), desc(t.id))
          .limit(input.limit + 1),
        qualityConnections(input.filter),
        revision(),
      ]);
      const version = required(before[0]).revision;
      assertRevision(
        version,
        required(afterRevision[0]).revision,
        cursor?.revision,
      );
      const records = rows.slice(0, input.limit);
      const last = records.at(-1);
      return {
        cursor:
          rows.length > input.limit && last
            ? {
                accountId: last.accountId,
                date: last.date,
                id: last.id,
                revision: version,
                scope,
              }
            : null,
        partial: partial(connectionQuality),
        records,
        referenceDay,
        revision: version,
      };
    },
  };
}
