import { eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { AccountMap, AccountMetadata } from "../../../domain";
import { type database, required } from "../../database";
import { connections, transactions } from "../../schema";
import type { Publication } from "../entity";

type Database = ReturnType<typeof database>;
const sourceValues = {
  accountId: sql`excluded.account_id`,
  amountMinor: sql`excluded.amount_minor`,
  category: sql`excluded.category`,
  currency: sql`excluded.currency`,
  date: sql`excluded.date`,
  description: sql`excluded.description`,
  direction: sql`excluded.direction`,
  status: sql`excluded.status`,
};
const sourceChanged = sql`
  ${transactions.accountId} IS NOT excluded.account_id OR
  ${transactions.amountMinor} IS NOT excluded.amount_minor OR
  ${transactions.category} IS NOT excluded.category OR
  ${transactions.currency} IS NOT excluded.currency OR
  ${transactions.date} IS NOT excluded.date OR
  ${transactions.description} IS NOT excluded.description OR
  ${transactions.direction} IS NOT excluded.direction OR
  ${transactions.status} IS NOT excluded.status`;
const sourceUpdate = {
  set: sourceValues,
  setWhere: sourceChanged,
  target: transactions.id,
};
export async function publicationData(db: Database, input: Publication) {
  const { run, now } = input;
  const edits: BatchItem<"sqlite">[] = [];
  if (input.accounts) {
    const prior = required(
      await db
        .select({ accounts: connections.accounts })
        .from(connections)
        .where(eq(connections.id, run.connectionId))
        .get(),
    ).accounts;
    const observed: AccountMap = Object.fromEntries(
      input.accounts.map((account) => {
        const previous = prior[account.id];
        let { balanceMinor } = account;
        let balanceObservedAt: string | null = now;
        if (balanceMinor === null) {
          balanceMinor =
            previous?.currency === account.currency
              ? previous.balanceMinor
              : null;
          balanceObservedAt =
            previous?.currency === account.currency
              ? previous.balanceObservedAt
              : null;
        }
        const metadata: AccountMetadata = {
          balanceMinor,
          balanceObservedAt,
          currency: account.currency,
          name: account.name,
          type: account.type,
        };
        return [account.id, metadata];
      }),
    );
    edits.push(
      db
        .update(connections)
        .set({ accounts: { ...prior, ...observed } })
        .where(eq(connections.id, run.connectionId)),
    );
  }
  const records = input.transactions ?? [];
  if (!records.length) {
    return edits;
  }
  const json = JSON.stringify(records);
  // At most three UTF-8 bytes per UTF-16 code unit: keep the JSON parameter
  // below D1's 2 MB string limit. Very large descriptions keep scalar bindings.
  if (json.length > 500_000) {
    for (const record of records) {
      edits.push(
        db.insert(transactions).values(record).onConflictDoUpdate(sourceUpdate),
      );
    }
    return edits;
  }
  edits.push(
    db
      .insert(transactions)
      .select(
        db
          .select({
            accountId: sql<string>`json_extract(value,'$.accountId')`.as(
              "account_id",
            ),
            amountMinor: sql<
              string | null
            >`json_extract(value,'$.amountMinor')`.as("amount_minor"),
            category: sql<string | null>`json_extract(value,'$.category')`.as(
              "category",
            ),
            currency: sql<string>`json_extract(value,'$.currency')`.as(
              "currency",
            ),
            date: sql<string>`json_extract(value,'$.date')`.as("date"),
            description: sql<string>`json_extract(value,'$.description')`.as(
              "description",
            ),
            direction: sql<string>`json_extract(value,'$.direction')`.as(
              "direction",
            ),
            id: sql<string>`json_extract(value,'$.id')`.as("id"),
            status: sql<string>`json_extract(value,'$.status')`.as("status"),
          })
          .from(sql`json_each(${json})`)
          .where(sql`true`),
      )
      .onConflictDoUpdate(sourceUpdate),
  );
  return edits;
}
