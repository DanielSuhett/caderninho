import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { AccountMap, AccountMetadata } from "../../../domain";
import { type database, required } from "../../database";
import { connections, transactions } from "../../schema";
import type { Publication } from "../entity";

type Database = ReturnType<typeof database>;
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
  for (const transaction of input.transactions ?? []) {
    edits.push(
      db.insert(transactions).values(transaction).onConflictDoUpdate({
        set: transaction,
        target: transactions.id,
      }),
    );
  }
  return edits;
}
