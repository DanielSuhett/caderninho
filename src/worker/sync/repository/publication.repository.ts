import { eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import {
  type AccountMap,
  type AccountMetadata,
  ProductKind,
  type TransactionProjection,
} from "../../../domain";
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
const sourceValues = {
  accountId: sql`excluded.account_id`,
  amountMinor: sql`excluded.amount_minor`,
  category: sql`excluded.category`,
  currency: sql`excluded.currency`,
  date: sql`excluded.date`,
  description: sql`excluded.description`,
  direction: sql`excluded.direction`,
  identification: sql`excluded.identification`,
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
  ${transactions.identification} IS NOT excluded.identification OR
  ${transactions.status} IS NOT excluded.status`;
const sourceUpdate = {
  set: sourceValues,
  setWhere: sourceChanged,
  target: transactions.id,
};
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
          ...((account.holderKey ?? previous?.holderKey) && {
            holderKey: account.holderKey ?? previous?.holderKey,
          }),
          identity: account.identity ?? previous?.identity ?? null,
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
      edits.push(...transactionMetadata(db, record));
      edits.push(
        db.insert(transactions).values(record).onConflictDoUpdate(sourceUpdate),
      );
    }
    return edits;
  }
  edits.push(...transactionMetadataPage(db, records, json));
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
            identification: sql<
              typeof transactions.$inferInsert.identification
            >`json_extract(value,'$.identification')`.as("identification"),
            status: sql<string>`json_extract(value,'$.status')`.as("status"),
          })
          .from(sql`json_each(${json})`)
          .where(sql`true`),
      )
      .onConflictDoUpdate(sourceUpdate),
  );
  return edits;
}

function transactionMetadataPage(
  db: Database,
  records: NonNullable<Publication["transactions"]>,
  json: string,
) {
  const edits: BatchItem<"sqlite">[] = [];
  if (records.some((row) => !row.details)) {
    edits.push(
      db
        .delete(planningTransactionDetails)
        .where(sql`${planningTransactionDetails.id} IN (
        SELECT json_extract(value,'$.id') FROM json_each(${json})
        WHERE json_type(value,'$.details') IS NOT 'object'
      )`),
    );
  }
  if (!records.some((row) => row.details)) {
    return edits;
  }
  edits.push(
    db
      .insert(planningTransactionDetails)
      .select(
        db
          .select({
            data: sql<
              typeof planningTransactionDetails.$inferInsert.data
            >`json_extract(value,'$.details')`.as("data"),
            id: sql<string>`json_extract(value,'$.id')`.as("id"),
          })
          .from(sql`json_each(${json})`)
          .where(sql`json_type(value,'$.details')='object'`),
      )
      .onConflictDoUpdate({
        set: { data: sql`excluded.data` },
        setWhere: sql`${planningTransactionDetails.data} IS NOT excluded.data`,
        target: planningTransactionDetails.id,
      }),
  );
  if (records.some((row) => row.details?.cardNumber)) {
    const id = sql`json_extract(value,'$.accountId')||':'||json_extract(value,'$.details.cardNumber')`;
    edits.push(
      db
        .insert(planningCards)
        .select(
          db
            .select({
              data: sql<typeof planningCards.$inferInsert.data>`json_object(
                'accountId',json_extract(value,'$.accountId'),
                'deleted',json('false'),'hidden',json('false'),
                'id',${id},'name',json_extract(value,'$.details.cardNumber'),
                'number',json_extract(value,'$.details.cardNumber'))`.as(
                "data",
              ),
              id: sql<string>`${id}`.as("id"),
            })
            .from(sql`json_each(${json})`)
            .where(
              sql`coalesce(json_extract(value,'$.details.cardNumber'),'')<>''`,
            ),
        )
        .onConflictDoNothing(),
    );
  }
  if (
    records.some(
      (row) =>
        row.details?.installmentNumber &&
        row.details.totalInstallments &&
        row.details.installmentNumber <= row.details.totalInstallments &&
        row.amountMinor !== null,
    )
  ) {
    const id = sql`'detected:'||json_extract(value,'$.id')`;
    const merged = sql`json_set(excluded.data,
      '$.name',json_extract(${planningInstallments.data},'$.name'),
      '$.categoryId',json_extract(${planningInstallments.data},'$.categoryId'),
      '$.completed',json(CASE WHEN json_extract(${planningInstallments.data},'$.completed') THEN 'true' ELSE 'false' END),
      '$.spaceId',json_extract(${planningInstallments.data},'$.spaceId'))`;
    edits.push(
      db
        .insert(planningInstallments)
        .select(
          db
            .select({
              data: sql<
                typeof planningInstallments.$inferInsert.data
              >`json_object(
                'accountId',json_extract(value,'$.accountId'),
                'amountMinor',replace(json_extract(value,'$.amountMinor'),'-',''),
                'categoryId',NULL,'completed',json('false'),
                'currency',json_extract(value,'$.currency'),
                'current',json_extract(value,'$.details.installmentNumber'),
                'id',${id},'manual',json('false'),
                'name',json_extract(value,'$.description'),'spaceId','personal',
                'startDate',json_extract(value,'$.date'),
                'total',json_extract(value,'$.details.totalInstallments'),
                'transactionIds',json_array(json_extract(value,'$.id')))`.as(
                "data",
              ),
              id: sql<string>`${id}`.as("id"),
            })
            .from(sql`json_each(${json})`)
            .where(sql`json_extract(value,'$.details.installmentNumber')<>0
              AND json_extract(value,'$.details.totalInstallments')<>0
              AND json_extract(value,'$.details.installmentNumber')<=json_extract(value,'$.details.totalInstallments')
              AND json_extract(value,'$.amountMinor') IS NOT NULL`),
        )
        .onConflictDoUpdate({
          set: { data: merged },
          setWhere: sql`${planningInstallments.data} IS NOT ${merged}`,
          target: planningInstallments.id,
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
  if (input.products?.kind === ProductKind.bills) {
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
  if (input.products?.kind === ProductKind.investments) {
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
  if (input.products?.kind === ProductKind.loans) {
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

function transactionMetadata(db: Database, transaction: TransactionProjection) {
  const edits: BatchItem<"sqlite">[] = [];
  if (!transaction.details) {
    return [
      db
        .delete(planningTransactionDetails)
        .where(eq(planningTransactionDetails.id, transaction.id)),
    ];
  }
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

  return edits;
}
