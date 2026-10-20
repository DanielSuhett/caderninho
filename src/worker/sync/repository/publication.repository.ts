import { and, eq, ne, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { database } from "../../database";
import { accounts, transactions } from "../../schema";
import type { Publication } from "../entity";

type Database = ReturnType<typeof database>;
function accountWrites(db: Database, input: Publication) {
  const { run, now } = input;
  const edits: BatchItem<"sqlite">[] = [];
  if (input.accounts) {
    for (const account of input.accounts) {
      const value = {
        ...account,
        collectionStatus: "collecting" as const,
        error: null,
        lastAttemptAt: now,
        lastSeenRun: run.id,
        observedAt: now,
        observedFrom: null,
        observedTo: null,
      };
      edits.push(
        db
          .insert(accounts)
          .values(value)
          .onConflictDoUpdate({
            set: value,
            target: [accounts.connectionId, accounts.id],
          }),
      );
    }
    edits.push(
      db
        .update(accounts)
        .set({
          collectionStatus: "unavailable",
          error: "ACCOUNT_NOT_AVAILABLE",
        })
        .where(
          and(
            eq(accounts.connectionId, run.connectionId),
            ne(accounts.lastSeenRun, run.id),
          ),
        ),
    );
  }

  return edits;
}

function transactionWrites(db: Database, input: Publication) {
  const edits: BatchItem<"sqlite">[] = [];
  for (const tx of input.transactions ?? []) {
    edits.push(
      db
        .insert(transactions)
        .values(tx)
        .onConflictDoUpdate({
          set: tx,
          target: [
            transactions.connectionId,
            transactions.accountId,
            transactions.id,
          ],
        }),
    );
  }

  return edits;
}

function coverageWrites(db: Database, input: Publication) {
  const { run, now } = input;
  const edits: BatchItem<"sqlite">[] = [];
  const dates = input.transactions?.map((row) => row.date).sort();
  if (dates?.length && run.checkpoint.accountId) {
    const [first] = dates;
    const last = dates.at(-1);
    if (first && last) {
      edits.push(
        db
          .update(accounts)
          .set({
            observedFrom: sql`CASE WHEN observed_from IS NULL OR observed_from>${first} THEN ${first} ELSE observed_from END`,
            observedTo: sql`CASE WHEN observed_to IS NULL OR observed_to<${last} THEN ${last} ELSE observed_to END`,
          })
          .where(
            and(
              eq(accounts.connectionId, run.connectionId),
              eq(accounts.id, run.checkpoint.accountId),
            ),
          ),
      );
    }
  }
  if (input.completeAccountId) {
    edits.push(
      db
        .update(accounts)
        .set({
          collectionStatus: "complete",
          error: null,
          lastCompletedFrom: accounts.observedFrom,
          lastCompletedTo: accounts.observedTo,
          lastSuccessAt: now,
        })
        .where(
          and(
            eq(accounts.connectionId, run.connectionId),
            eq(accounts.id, input.completeAccountId),
          ),
        ),
    );
  }

  return edits;
}
export function publicationData(db: Database, input: Publication) {
  return [
    ...accountWrites(db, input),
    ...transactionWrites(db, input),
    ...coverageWrites(db, input),
  ];
}
