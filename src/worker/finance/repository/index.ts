import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";

import type {
  AggregateQuery,
  Metric,
  TransactionFilter,
  TransactionQuery,
} from "../../../domain";
import { connectionPartial, MetricDefinition } from "../../../domain";
import { hash } from "../../../shared";
import { database } from "../../database";
import {
  connections as c,
  connectionOwners as owners,
  transactions as t,
} from "../../schema";
import type { FinancialRepository } from "../entity";

const transactionFields = {
  accountId: t.accountId,
  amountMinor: t.amountMinor,
  category: t.category,
  classification: t.classification,
  currency: t.currency,
  date: t.date,
  description: t.description,
  direction: t.direction,
  id: t.id,
  identification: t.identification,
  status: t.status,
};
function ownerMembership(filter: TransactionFilter) {
  return filter.personId || filter.profileId
    ? sql`${c.id} IN (SELECT ${owners.connectionId} FROM ${owners} WHERE ${and(filter.personId ? eq(owners.personId, filter.personId) : undefined, filter.profileId ? eq(owners.profileId, filter.profileId) : undefined)})`
    : undefined;
}
function accountMembership(filter: TransactionFilter = {}, bank = false) {
  const condition = and(
    filter.connectionIds && inArray(c.id, filter.connectionIds),
    ownerMembership(filter),
    bank ? sql`json_extract(account.value,'$.type')='BANK'` : undefined,
  );
  return sql`${t.accountId} IN (SELECT account.key FROM ${c}, json_each(${c.accounts}) AS account ${condition ? sql`WHERE ${condition}` : sql``})`;
}
function selectedAccounts(ids: string[]) {
  const [id] = ids;
  if (ids.length === 1 && id !== undefined) {
    return eq(t.accountId, id);
  }
  return sql`${t.accountId} IN (SELECT value FROM json_each(${JSON.stringify(ids)}))`;
}
function descriptionContains(value: string) {
  const letters = new Map<string, string>();
  const characters = Array.from(value, (character) => {
    const lower = character.toLowerCase();
    const upper = character.toUpperCase();
    if (lower !== upper && lower.length === 1 && upper.length === 1) {
      if (upper.charCodeAt(0) > 127) {
        letters.set(upper, lower);
      }
      return lower;
    }
    return character;
  });
  const needle = characters.join("");
  if (!letters.size) {
    return sql`instr(lower(${t.description}),${needle})>0`;
  }
  // D1 limits LIKE/GLOB patterns to 50 bytes. Fold the query's Unicode pairs
  // in SQL, then search literally; neither text length nor wildcards grow a pattern.
  if (letters.size <= 32) {
    let folded: SQL = sql`lower(${t.description})`;
    for (const [upper, lower] of letters) {
      folded = sql`replace(${folded},${upper},${lower})`;
    }
    return sql`instr(${folded},${needle})>0`;
  }
  // Unusual inputs with many alphabets use two parameters instead of exceeding
  // D1's 100 bound parameters or nesting one expression per Unicode pair.
  return sql`EXISTS (
    WITH RECURSIVE folded(value,position) AS (
      SELECT lower(${t.description}),0
      UNION ALL
      SELECT replace(folded.value,json_extract(letter.value,'$[0]'),json_extract(letter.value,'$[1]')),folded.position+1
      FROM folded JOIN json_each(${JSON.stringify([...letters])}) AS letter ON letter.key=folded.position
    )
    SELECT 1 FROM folded WHERE position=${letters.size} AND instr(value,${needle})>0
  )`;
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
    filter.connectionIds || filter.personId || filter.profileId
      ? accountMembership(filter)
      : undefined,
    filter.accountIds && selectedAccounts(filter.accountIds),
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
      : descriptionContains(filter.description),
    filter.minAmountMinor === undefined
      ? undefined
      : amountComparison(filter.minAmountMinor, true),
    filter.maxAmountMinor === undefined
      ? undefined
      : amountComparison(filter.maxAmountMinor, false),
  );
}
function cursorWhere({ cursor, filter }: TransactionQuery) {
  if (!cursor) {
    return;
  }
  if (
    filter?.accountIds?.length === 1 &&
    filter.accountIds[0] === cursor.accountId
  ) {
    // The account is constant. Match the remaining (date,id) index suffix
    // so pages with the same date do not rescan earlier transaction IDs.
    return sql`(${t.date},${t.id})<(${cursor.date},${cursor.id})`;
  }
  return sql`(${t.date},${t.accountId},${t.id})<(${cursor.date},${cursor.accountId},${cursor.id})`;
}
const moneyTotal = (value: SQL<string | null>) => {
  // Five limbs preserve 30 digits. Each term is at most 999999; even one row
  // per byte of D1's 10 GB limit cannot overflow SQLite's signed 64-bit SUM.
  const limb = (offset: number) =>
    sql<string>`CAST(coalesce(sum(CASE WHEN ${value} LIKE '-%' THEN -1 ELSE 1 END * CAST(substr(substr('000000000000000000000000000000'||replace(${value},'-',''),-30),${offset + 1},6) AS INTEGER)),0) AS TEXT)`.as(
      `amount_${offset}`,
    );
  return {
    a: limb(0),
    b: limb(6),
    c: limb(12),
    d: limb(18),
    e: limb(24),
  };
};
function total(value: Record<keyof ReturnType<typeof moneyTotal>, string>) {
  return [value.a, value.b, value.c, value.d, value.e]
    .reduce((sum, part) => sum * 1_000_000n + BigInt(part), 0n)
    .toString();
}
export function createFinancialRepository(
  binding: D1Database,
): FinancialRepository {
  const db = database(binding);
  const qualityConnections = () =>
    db
      .select({
        accounts: c.accounts,
        id: c.id,
        importAdmittedAt: c.importAdmittedAt,
        importId: c.importId,
        importSequence: c.importSequence,
        importStatus: c.importStatus,
        lastSuccessAt: c.lastSuccessAt,
        owner: sql<string>`coalesce(${owners.personId},'self')`,
        profile: sql<string>`coalesce(${owners.profileId},'default')`,
      })
      .from(c)
      .leftJoin(owners, eq(owners.connectionId, c.id))
      .orderBy(c.id);
  function selectedQuality(
    rows: Awaited<ReturnType<typeof qualityConnections>>,
    filter: TransactionFilter = {},
  ) {
    if (
      filter.connectionIds?.some((id) => !rows.some((row) => row.id === id)) ||
      filter.accountIds?.some(
        (id) => !rows.some((row) => Object.hasOwn(row.accounts, id)),
      )
    ) {
      throw new Error("NOT_FOUND");
    }
    return rows.filter(
      (row) =>
        (!filter.connectionIds || filter.connectionIds.includes(row.id)) &&
        (!filter.personId || row.owner === filter.personId) &&
        (!filter.profileId || row.profile === filter.profileId) &&
        (!filter.accountIds ||
          filter.accountIds.some((id) => Object.hasOwn(row.accounts, id))),
    );
  }
  function partial(rows: Awaited<ReturnType<typeof qualityConnections>>) {
    return !rows.length || rows.some(connectionPartial);
  }
  function oldestSuccess(rows: Awaited<ReturnType<typeof qualityConnections>>) {
    let oldest: string | null = null;
    for (const row of rows) {
      if (!row.lastSuccessAt) {
        return null;
      }
      if (!oldest || row.lastSuccessAt < oldest) {
        oldest = row.lastSuccessAt;
      }
    }
    return oldest;
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
      const [groups, catalog] = await db.batch([
        db
          .select({
            ...(input.metric !== "count" && { amount: moneyTotal(amount) }),
            amountCount: sql<string>`CAST(count(${t.amountMinor}) AS TEXT)`.as(
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
          .groupBy(t.currency, ...(input.groupBy ? [group] : []))
          .orderBy(t.currency, ...(input.groupBy ? [group] : [])),
        qualityConnections(),
      ]);
      const connectionQuality = selectedQuality(catalog, input.filter);
      return {
        definition: MetricDefinition[input.metric],
        groups: groups.map((row) => ({
          count: row.count,
          currency: row.currency,
          group: row.group,
          totalMinor:
            row.amount && BigInt(row.amountCount) > 0n
              ? total(row.amount)
              : null,
          unknownAmountCount: row.unknownAmountCount,
        })),
        metric: input.metric,
        oldestLastSuccessAt: oldestSuccess(connectionQuality),
        partial:
          partial(connectionQuality) ||
          groups.some((row) => BigInt(row.unknownAmountCount) > 0n),
        referenceDay,
      };
    },
    async query(input, scope, referenceDay) {
      if (input.cursor && input.cursor.scope !== scope) {
        throw new Error("CURSOR_SCOPE_MISMATCH");
      }
      const { cursor } = input;
      const { to, ...withoutTo } = input.filter ?? {};
      // The cursor already enforces this upper bound. Keeping both can make
      // SQLite seek only by date and rescan earlier pages with the same date.
      const filter =
        cursor && to !== undefined && cursor.date <= to
          ? withoutTo
          : input.filter;
      const [rows, catalog] = await db.batch([
        db
          .select(transactionFields)
          .from(t)
          .where(and(filterWhere(filter), cursorWhere(input)))
          .orderBy(desc(t.date), desc(t.accountId), desc(t.id))
          .limit(input.limit + 1),
        qualityConnections(),
      ]);
      const connectionQuality = selectedQuality(catalog, input.filter);
      const hasMore = rows.length > input.limit;
      // Account changes commit with importSequence in the same batch. Hash the
      // revision rather than the catalog, and only when pagination needs it.
      const state =
        cursor || hasMore
          ? await hash({
              connections: connectionQuality.map(
                ({ accounts: _accounts, ...revision }) => revision,
              ),
              referenceDay,
            })
          : undefined;
      if (cursor && cursor.state !== state) {
        throw new Error("RESTART_REQUIRED");
      }
      const records = rows.slice(0, input.limit);
      const last = records.at(-1);
      return {
        cursor:
          hasMore && last && state
            ? {
                accountId: last.accountId,
                date: last.date,
                id: last.id,
                scope,
                state,
              }
            : null,
        oldestLastSuccessAt: oldestSuccess(connectionQuality),
        partial: partial(connectionQuality),
        records,
        referenceDay,
      };
    },
  };
}
