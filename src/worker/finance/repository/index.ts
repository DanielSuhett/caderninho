import type { SQL } from "drizzle-orm";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import type {
  AggregateQuery,
  Metric,
  TransactionFilter,
} from "../../../domain";
import { Classification, MetricDefinition } from "../../../domain";
import { database, required } from "../../database";
import {
  accounts as a,
  connections as c,
  settings,
  sync_runs,
  transactions as t,
} from "../../schema";
import type { FinancialRepository, TransactionView } from "../entity";

const category = sql<
  string | null
>`coalesce(${t.categoryOverride},${t.category})`;
const description = sql<string>`coalesce(${t.descriptionOverride},${t.description})`;
const ignored = sql<number>`coalesce(${t.ignoredOverride},0)`;
const presence = sql<
  "observed" | "not_observed"
>`CASE WHEN ${a.lastCompletedRun}=${t.lastSeenRun} THEN 'observed' ELSE 'not_observed' END`;
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
  categoryOverride: t.categoryOverride,
  classification: t.classification,
  connectionId: t.connectionId,
  correctedAt: t.correctedAt,
  currency: t.currency,
  date: t.date,
  description: t.description,
  descriptionOverride: t.descriptionOverride,
  direction: t.direction,
  effectiveCategory: category,
  effectiveDescription: description,
  evidence: t.evidence,
  id: t.id,
  ignored,
  ignoredOverride: t.ignoredOverride,
  observedAt: t.observedAt,
  presence,
  sourceUpdatedAt: t.sourceUpdatedAt,
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
function presenceWhere(value: "observed" | "not_observed") {
  return value === "observed"
    ? eq(t.lastSeenRun, a.lastCompletedRun)
    : or(isNull(a.lastCompletedRun), ne(t.lastSeenRun, a.lastCompletedRun));
}
function filterWhere(filter: TransactionFilter = {}) {
  return and(
    accountWhere(filter),
    filter.from === undefined ? undefined : sql`${t.date}>=${filter.from}`,
    filter.to === undefined ? undefined : sql`${t.date}<=${filter.to}`,
    filter.currency === undefined ? undefined : eq(t.currency, filter.currency),
    filter.direction === undefined
      ? undefined
      : eq(t.direction, filter.direction),
    filter.status === undefined ? undefined : eq(t.status, filter.status),
    filter.category === undefined
      ? undefined
      : sql`${category}=${filter.category}`,
    filter.description === undefined
      ? undefined
      : sql`instr(lower(${description}),lower(${filter.description}))>0`,
    filter.ignored === undefined
      ? undefined
      : sql`${ignored}=${Number(filter.ignored)}`,
    filter.presence === undefined ? undefined : presenceWhere(filter.presence),
    filter.minAmountMinor === undefined
      ? undefined
      : amountComparison(filter.minAmountMinor, true),
    filter.maxAmountMinor === undefined
      ? undefined
      : amountComparison(filter.maxAmountMinor, false),
  );
}
const moneyTotal = (value: SQL<string | null>, prefix: string) => {
  const limb = (offset: number) =>
    sql<string>`CAST(coalesce(sum(CASE WHEN ${value} LIKE '-%' THEN -1 ELSE 1 END * CAST(substr(substr('000000000000000000000000000000'||replace(${value},'-',''),-30),${offset + 1},3) AS INTEGER)),0) AS TEXT)`.as(
      `${prefix}_${offset}`,
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
function publicTransaction(
  row: Omit<TransactionView, "ignored" | "ignoredOverride"> & {
    ignored: number;
    ignoredOverride: number | null;
  },
): TransactionView {
  return {
    ...row,
    ignored: !!row.ignored,
    ignoredOverride:
      row.ignoredOverride === null ? null : !!row.ignoredOverride,
  };
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
          : and(
              eq(t.status, "POSTED"),
              sql`${t.date}<=${referenceDay}`,
              sql`${ignored}=0`,
            );
      const metricFilters: Record<Metric, SQL | undefined> = {
        cash_flow: eq(a.type, "BANK"),
        count: undefined,
        credits: eq(t.direction, "CREDIT"),
        debits: eq(t.direction, "DEBIT"),
        known_spending: eq(t.direction, "DEBIT"),
      };
      const metricFilter = metricFilters[input.metric];
      let amount: SQL<string | null> = absolute;
      if (input.metric === "cash_flow") {
        amount = sql<
          string | null
        >`CASE WHEN ${t.direction}='DEBIT' AND ${absolute}<>'0' THEN '-'||${absolute} ELSE ${absolute} END`;
      }
      if (input.metric === "known_spending") {
        amount = sql<
          string | null
        >`CASE WHEN ${t.classification}=${Classification.consumption_evidence} THEN ${absolute} ELSE NULL END`;
      }
      const known = sql<
        string | null
      >`CASE WHEN ${presence}='observed' THEN ${amount} ELSE NULL END`;
      const uncertain = sql<
        string | null
      >`CASE WHEN ${presence}='observed' AND ${t.direction}='DEBIT' AND ${t.classification} IN ('unknown','transfer_uncertain','bill_payment_category','patrimonial_category') THEN ${absolute} ELSE NULL END`;
      const groupings: Record<
        NonNullable<AggregateQuery["groupBy"]>,
        SQL<string | null>
      > = {
        account: sql`json_array(${t.connectionId},${t.accountId})`,
        category,
        month: sql`substr(${t.date},1,7)`,
      };
      const group = input.groupBy
        ? groupings[input.groupBy]
        : sql<string | null>`NULL`;
      const knownCount =
        input.metric === "count"
          ? sql<string>`CAST(sum(CASE WHEN ${presence}='observed' THEN 1 ELSE 0 END) AS TEXT)`
          : sql<string>`CAST(sum(CASE WHEN ${known} IS NOT NULL THEN 1 ELSE 0 END) AS TEXT)`;
      const [before, groups, quality, connectionQuality, afterRevision] =
        await db.batch([
          revision(),
          db
            .select({
              amount: moneyTotal(known, "amount"),
              count: sql<string>`CAST(count(*) AS TEXT)`.as("count"),
              currency: t.currency,
              group: group.as("group_value"),
              known: knownCount.as("known"),
              uncertain: moneyTotal(uncertain, "uncertain"),
              uncertainCount: sql<string>`CAST(count(${uncertain}) AS TEXT)`.as(
                "uncertain_count",
              ),
              unconfirmed:
                sql<string>`CAST(sum(CASE WHEN ${presence}<>'observed' OR ${t.amountMinor} IS NULL THEN 1 ELSE 0 END) AS TEXT)`.as(
                  "unconfirmed",
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
          known: row.known,
          totalMinor:
            input.metric !== "count" && BigInt(row.known) > 0n
              ? total(row.amount)
              : null,
          unclassifiedDebitMinor:
            input.metric === "known_spending" && BigInt(row.uncertainCount) > 0n
              ? total(row.uncertain)
              : null,
          unconfirmed: row.unconfirmed,
        })),
        metric: input.metric,
        partial:
          partial(quality, connectionQuality) ||
          groups.some(
            (row) =>
              BigInt(row.unconfirmed) > 0n ||
              (input.metric === "known_spending" &&
                BigInt(row.uncertainCount) > 0n),
          ),
        referenceDay,
        revision: version,
      };
    },
    async correct(input, now) {
      const { patch } = input;
      const changes = {
        ...(patch.category !== undefined && {
          categoryOverride: patch.category,
        }),
        ...(patch.description !== undefined && {
          descriptionOverride: patch.description,
        }),
        ...(patch.ignored !== undefined && {
          ignoredOverride:
            patch.ignored === null ? null : Number(patch.ignored),
        }),
        correctedAt: now,
      };
      const identity = and(
        eq(t.connectionId, input.connectionId),
        eq(t.accountId, input.accountId),
        eq(t.id, input.id),
      );
      const changed = or(
        patch.category === undefined
          ? undefined
          : sql`${t.categoryOverride} IS NOT ${patch.category}`,
        patch.description === undefined
          ? undefined
          : sql`${t.descriptionOverride} IS NOT ${patch.description}`,
        patch.ignored === undefined
          ? undefined
          : sql`${t.ignoredOverride} IS NOT ${patch.ignored === null ? null : Number(patch.ignored)}`,
      );
      const [_edit, _revision, rows] = await db.batch([
        db.update(t).set(changes).where(and(identity, changed)),
        db
          .update(settings)
          .set({ revision: sql`${settings.revision}+1` })
          .where(and(eq(settings.id, 1), sql`changes()>0`)),
        db
          .select(transactionFields)
          .from(t)
          .innerJoin(a, joinAccount)
          .where(identity),
      ]);
      const [row] = rows;
      if (!row) {
        throw new Error("NOT_FOUND");
      }
      return publicTransaction(row);
    },
    async query(input, scope, referenceDay) {
      if (input.cursor && input.cursor.scope !== scope) {
        throw new Error("CURSOR_SCOPE_MISMATCH");
      }
      const { cursor } = input;
      const after = cursor
        ? sql`(${t.date},${t.connectionId},${t.accountId},${t.id})<(${cursor.date},${cursor.connectionId},${cursor.accountId},${cursor.id})`
        : undefined;
      const [
        before,
        rows,
        quality,
        connectionQuality,
        uncertain,
        afterRevision,
      ] = await db.batch([
        revision(),
        db
          .select(transactionFields)
          .from(t)
          .innerJoin(a, joinAccount)
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
        db
          .select({ count: count() })
          .from(t)
          .innerJoin(a, joinAccount)
          .where(and(filterWhere(input.filter), eq(presence, "not_observed"))),
        revision(),
      ]);
      const version = required(before[0]).revision;
      assertRevision(
        version,
        required(afterRevision[0]).revision,
        cursor?.revision,
      );
      const records = rows.slice(0, input.limit).map(publicTransaction);
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
        partial: partial(quality, connectionQuality) || !!uncertain[0]?.count,
        records,
        referenceDay,
        revision: version,
      };
    },
  };
}
