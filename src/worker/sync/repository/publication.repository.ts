import { eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { AccountMap, AccountMetadata } from "../../../domain";
import { type database, required } from "../../database";
import {
  connections,
  planningAccountDetails,
  planningBills,
  planningCards,
  planningInstallments,
  planningInvestments,
  planningLoans,
  planningTransactionDetails,
  transactions,
} from "../../schema";
import type { Publication } from "../entity";

type Database = ReturnType<typeof database>;
export async function publicationData(db: Database, input: Publication) {
  const { run, now } = input;
  const edits: BatchItem<"sqlite">[] = [];
  edits.push(...productMetadata(db, input));
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
    edits.push(...transactionMetadata(db, transaction));

    edits.push(
      db.insert(transactions).values(transaction).onConflictDoUpdate({
        set: transaction,
        target: transactions.id,
      }),
    );
  }
  return edits;
}

function productMetadata(db: Database, input: Publication) {
  const edits: BatchItem<"sqlite">[] = [];
  for (const account of input.accounts ?? []) {
    if (account.details) {
      edits.push(
        db
          .insert(planningAccountDetails)
          .values({ data: account.details, id: account.id })
          .onConflictDoUpdate({
            set: { data: account.details },
            target: planningAccountDetails.id,
          }),
      );
    }
  }
  if (input.products?.kind === "bills") {
    for (const bill of input.products.records) {
      edits.push(
        db
          .insert(planningBills)
          .values({ data: bill, id: bill.id })
          .onConflictDoUpdate({
            set: { data: bill },
            target: planningBills.id,
          }),
      );
    }
  }
  if (input.products?.kind === "investments") {
    for (const row of input.products.records) {
      const data = row;
      edits.push(
        db
          .insert(planningInvestments)
          .values({ data, id: row.id })
          .onConflictDoUpdate({
            set: {
              data: sql`json_set(${JSON.stringify(data)},'$.included',json(CASE WHEN json_extract(${planningInvestments.data},'$.included') THEN 'true' ELSE 'false' END),'$.spaceId',json_extract(${planningInvestments.data},'$.spaceId'))`,
            },
            target: planningInvestments.id,
          }),
      );
    }
  }
  if (input.products?.kind === "loans") {
    for (const row of input.products.records) {
      const data = row;
      edits.push(
        db
          .insert(planningLoans)
          .values({ data, id: row.id })
          .onConflictDoUpdate({
            set: {
              data: sql`json_set(${JSON.stringify(data)},'$.hidden',json(CASE WHEN json_extract(${planningLoans.data},'$.hidden') THEN 'true' ELSE 'false' END),'$.spaceId',json_extract(${planningLoans.data},'$.spaceId'))`,
            },
            target: planningLoans.id,
          }),
      );
    }
  }

  return edits;
}

function transactionMetadata(
  db: Database,
  transaction: import("../../../domain").TransactionProjection,
) {
  const edits: BatchItem<"sqlite">[] = [];
  if (transaction.details) {
    edits.push(
      db
        .insert(planningTransactionDetails)
        .values({ data: transaction.details, id: transaction.id })
        .onConflictDoUpdate({
          set: { data: transaction.details },
          target: planningTransactionDetails.id,
        }),
    );
    const number = transaction.details.cardNumber;
    if (number) {
      const id = `${transaction.accountId}:${number}`;
      edits.push(
        db
          .insert(planningCards)
          .values({
            data: {
              accountId: transaction.accountId,
              deleted: false,
              hidden: false,
              id,
              name: number,
              number,
            },
            id,
          })
          .onConflictDoNothing(),
      );
    }
    const current = transaction.details.installmentNumber;
    const total = transaction.details.totalInstallments;
    if (
      current &&
      total &&
      current <= total &&
      transaction.amountMinor !== null
    ) {
      const id = `detected:${transaction.id}`;
      const data = {
        accountId: transaction.accountId,
        amountMinor: transaction.amountMinor.replace("-", ""),
        categoryId: null,
        completed: false,
        currency: transaction.currency,
        current,
        id,
        manual: false,
        name: transaction.description,
        spaceId: "personal",
        startDate: transaction.date,
        total,
        transactionIds: [transaction.id],
      };
      edits.push(
        db
          .insert(planningInstallments)
          .values({ data, id })
          .onConflictDoUpdate({
            set: {
              data: sql`json_set(${JSON.stringify(data)},'$.name',json_extract(${planningInstallments.data},'$.name'),'$.categoryId',json_extract(${planningInstallments.data},'$.categoryId'),'$.completed',json(CASE WHEN json_extract(${planningInstallments.data},'$.completed') THEN 'true' ELSE 'false' END),'$.spaceId',json_extract(${planningInstallments.data},'$.spaceId'))`,
            },
            target: planningInstallments.id,
          }),
      );
    }
  }

  return edits;
}
