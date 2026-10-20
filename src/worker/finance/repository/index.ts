import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";

import type {
  AggregateQuery,
  Metric,
  TransactionFilter,
} from "../../../domain";
import { MetricDefinition } from "../../../domain";
import { database, required } from "../../database";
import {
  accounts as a,
  connections as c,
  settings,
  sync_runs,
  transactions as t,
} from "../../schema";
import type { FinancialRepository } from "../entity";

const joinAccount = and(
  eq(a.connectionId, t.connectionId),
  eq(a.id, t.accountId),
);
const accountFields = {
  balanceMinor: a.balanceMinor,
  collectionStatus: a.collectionStatus,
  connectionId: a.connectionId,
  currency: a.currency,
  error: a.error,
  id: a.id,
  lastAttemptAt: a.lastAttemptAt,
  lastCompletedFrom: a.lastCompletedFrom,
  lastCompletedTo: a.lastCompletedTo,
  lastSuccessAt: a.lastSuccessAt,
  name: a.name,
  observedAt: a.observedAt,
  observedFrom: a.observedFrom,
  observedTo: a.observedTo,
  sourceUpdatedAt: a.sourceUpdatedAt,
  type: a.type,
};
const transactionFields = {
  accountId: t.accountId,
  amountMinor: t.amountMinor,
  category: t.category,
  connectionId: t.connectionId,
  currency: t.currency,
  date: t.date,
  description: t.description,
  direction: t.direction,
  id: t.id,
  status: t.status,
};
function accountWhere(filter: TransactionFilter = {}) {
  return and(
    filter.connectionIds && inArray(a.connectionId, filter.connectionIds),
    filter.accounts &&
      sql`EXISTS(SELECT 1 FROM json_each(${JSON.stringify(filter.accounts)}) AS selected WHERE json_extract(selected.value,'$.connectionId')=${a.connectionId} AND json_extract(selected.value,'$.accountId')=${a.id})`,
  );
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
    filter.connectionIds && inArray(t.connectionId, filter.connectionIds),
    filter.accounts &&
      sql`EXISTS(SELECT 1 FROM json_each(${JSON.stringify(filter.accounts)}) AS selected WHERE json_extract(selected.value,'$.connectionId')=${t.connectionId} AND json_extract(selected.value,'$.accountId')=${t.accountId})`,
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
  const qualityAccounts = (filter?: TransactionFilter) =>
    db.select(accountFields).from(a).where(accountWhere(filter));
  const qualityConnections = (filter: TransactionFilter = {}) =>
    db
      .select({
        active: sql<number>`EXISTS(SELECT 1 FROM ${sync_runs} WHERE ${sync_runs.connectionId}=${c.id} AND ${sync_runs.status} IN ('pending','running'))`,
        id: c.id,
        lastAdmittedAt: c.lastAdmittedAt,
        lastSuccessAt: c.lastSuccessAt,
      })
      .from(c)
      .where(
        and(
          filter.connectionIds && inArray(c.id, filter.connectionIds),
          filter.accounts &&
            sql`${c.id} IN (SELECT json_extract(value,'$.connectionId') FROM json_each(${JSON.stringify(filter.accounts)}))`,
        ),
      );
  function partial(
    rows: { collectionStatus: string }[],
    connections: {
      lastSuccessAt: string | null;
      lastAdmittedAt: string | null;
      active: number;
    }[],
  ) {
    return (
      !connections.length ||
      connections.some(
        (row) =>
          !!row.active ||
          !row.lastSuccessAt ||
          !!(row.lastAdmittedAt && row.lastAdmittedAt > row.lastSuccessAt),
      ) ||
      rows.some((row) => row.collectionStatus !== "complete")
    );
  }
  return {
    accounts: (ids) =>
      db
        .select(accountFields)
        .from(a)
        .where(ids ? inArray(a.connectionId, ids) : undefined)
        .orderBy(a.connectionId, a.id),
    async aggregate(input, referenceDay) {
      const absolute = sql<string | null>`replace(${t.amountMinor},'-','')`;
      const eligible =
        input.metric === "count"
          ? undefined
          : and(eq(t.status, "POSTED"), sql`${t.date}<=${referenceDay}`);
      const metricFilters: Record<Metric, SQL | undefined> = {
        cash_flow: eq(a.type, "BANK"),
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
        account: sql`json_array(${t.connectionId},${t.accountId})`,
        category: sql`${t.category}`,
        month: sql`substr(${t.date},1,7)`,
      };
      const group = input.groupBy
        ? groupings[input.groupBy]
        : sql<string | null>`NULL`;
      const [before, groups, quality, connectionQuality, afterRevision] =
        await db.batch([
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
            .innerJoin(a, joinAccount)
            .where(and(filterWhere(input.filter), eligible, metricFilter))
            .groupBy(t.currency, group)
            .orderBy(t.currency, group),
          qualityAccounts(input.filter),
          qualityConnections(input.filter),
          revision(),
        ]);
      const version = required(before[0]).revision;
      assertRevision(version, required(afterRevision[0]).revision);
      return {
        accounts: quality,
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
          partial(quality, connectionQuality) ||
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
        ? sql`(${t.date},${t.connectionId},${t.accountId},${t.id})<(${cursor.date},${cursor.connectionId},${cursor.accountId},${cursor.id})`
        : undefined;
      const [before, rows, quality, connectionQuality, afterRevision] =
        await db.batch([
          revision(),
          db
            .select(transactionFields)
            .from(t)
            .where(and(filterWhere(input.filter), after))
            .orderBy(
              desc(t.date),
              desc(t.connectionId),
              desc(t.accountId),
              desc(t.id),
            )
            .limit(input.limit + 1),
          qualityAccounts(input.filter),
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
        accounts: quality,
        cursor:
          rows.length > input.limit && last
            ? {
                accountId: last.accountId,
                connectionId: last.connectionId,
                date: last.date,
                id: last.id,
                revision: version,
                scope,
              }
            : null,
        partial: partial(quality, connectionQuality),
        records,
        referenceDay,
        revision: version,
      };
    },
  };
}
