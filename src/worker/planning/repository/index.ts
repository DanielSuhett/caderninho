import { eq, gt, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { connectionPartial } from "../../../domain";
import { database, required } from "../../database";
import {
  connectionOwners,
  connections,
  people,
  planningAccountDetails,
  planningAccounts,
  planningBillPayments,
  planningBills,
  planningCards,
  planningCategories,
  planningContributions,
  planningEdits,
  planningGoals,
  planningInstallments,
  planningInvestments,
  planningLoans,
  planningNotifications,
  planningReceipts,
  planningRecurrences,
  planningRevision,
  planningRules,
  planningSchedules,
  planningSpaces,
  planningTags,
  planningTransactionDetails,
  transactions,
} from "../../schema";
import type { PlanningRepository } from "../entity";

function changedRows<T extends { id: string }>(before: T[], after: T[]) {
  const old = new Map(before.map((row) => [row.id, JSON.stringify(row)]));
  const current = new Set(after.map((row) => row.id));
  return {
    deleted: [...old.keys()].filter((id) => !current.has(id)),
    upserts: after.filter((row) => old.get(row.id) !== JSON.stringify(row)),
  };
}
export function createPlanningRepository(
  binding: D1Database,
): PlanningRepository {
  const db = database(binding);
  async function revision() {
    return required(await db.select().from(planningRevision).get()).revision;
  }
  return {
    async commit(input) {
      const writes: BatchItem<"sqlite">[] = [
        db
          .update(planningRevision)
          .set({
            revision: sql`CASE WHEN revision=${input.before.revision} THEN revision+1 ELSE -1 END`,
          })
          .where(eq(planningRevision.id, 1)),
        db.insert(planningReceipts).values({
          createdAt: input.now,
          digest: input.digest,
          id: input.key,
          result: input.result,
        }),
      ];
      {
        const changes = changedRows(
          input.before.state.spaces,
          input.state.spaces,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningSpaces)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningSpaces.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db.delete(planningSpaces).where(eq(planningSpaces.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.accounts,
          input.state.accounts,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningAccounts)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningAccounts.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db.delete(planningAccounts).where(eq(planningAccounts.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.cards,
          input.state.cards,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningCards)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningCards.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db.delete(planningCards).where(eq(planningCards.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.edits,
          input.state.edits,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningEdits)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningEdits.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db.delete(planningEdits).where(eq(planningEdits.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.categories,
          input.state.categories,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningCategories)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningCategories.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db.delete(planningCategories).where(eq(planningCategories.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(input.before.state.tags, input.state.tags);
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningTags)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningTags.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db.delete(planningTags).where(eq(planningTags.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.rules,
          input.state.rules,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningRules)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningRules.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db.delete(planningRules).where(eq(planningRules.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.recurrences,
          input.state.recurrences,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningRecurrences)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningRecurrences.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db
              .delete(planningRecurrences)
              .where(eq(planningRecurrences.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.installments,
          input.state.installments,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningInstallments)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningInstallments.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db
              .delete(planningInstallments)
              .where(eq(planningInstallments.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.goals,
          input.state.goals,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningGoals)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningGoals.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db.delete(planningGoals).where(eq(planningGoals.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.contributions,
          input.state.contributions,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningContributions)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningContributions.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db
              .delete(planningContributions)
              .where(eq(planningContributions.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.investments,
          input.state.investments,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningInvestments)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningInvestments.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db
              .delete(planningInvestments)
              .where(eq(planningInvestments.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.loans,
          input.state.loans,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningLoans)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningLoans.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db.delete(planningLoans).where(eq(planningLoans.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.schedules,
          input.state.schedules,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningSchedules)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningSchedules.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db.delete(planningSchedules).where(eq(planningSchedules.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.billPayments,
          input.state.billPayments,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningBillPayments)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningBillPayments.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db
              .delete(planningBillPayments)
              .where(eq(planningBillPayments.id, id)),
          ),
        );
      }
      {
        const changes = changedRows(
          input.before.state.notifications,
          input.state.notifications,
        );
        writes.push(
          ...changes.upserts.map((row) =>
            db
              .insert(planningNotifications)
              .values({ data: row, id: row.id })
              .onConflictDoUpdate({
                set: { data: row },
                target: planningNotifications.id,
              }),
          ),
          ...changes.deleted.map((id) =>
            db
              .delete(planningNotifications)
              .where(eq(planningNotifications.id, id)),
          ),
        );
      }
      await db.batch([required(writes[0]), ...writes.slice(1)]);
    },
    async read() {
      const [
        version,
        origins,
        spaces,
        accounts,
        cards,
        edits,
        categories,
        tags,
        rules,
        recurrences,
        installments,
        goals,
        contributions,
        investments,
        loans,
        schedules,
        billPayments,
        notifications,
        bills,
        accountDetails,
        transactionDetails,
        persons,
        owners,
      ] = await db.batch([
        db.select().from(planningRevision),
        db.select().from(connections),
        db.select().from(planningSpaces),
        db.select().from(planningAccounts),
        db.select().from(planningCards),
        db.select().from(planningEdits),
        db.select().from(planningCategories),
        db.select().from(planningTags),
        db.select().from(planningRules),
        db.select().from(planningRecurrences),
        db.select().from(planningInstallments),
        db.select().from(planningGoals),
        db.select().from(planningContributions),
        db.select().from(planningInvestments),
        db.select().from(planningLoans),
        db.select().from(planningSchedules),
        db.select().from(planningBillPayments),
        db.select().from(planningNotifications),
        db.select().from(planningBills),
        db.select().from(planningAccountDetails),
        db.select().from(planningTransactionDetails),
        db.select().from(people),
        db.select().from(connectionOwners),
      ]);
      return {
        accountDetails: accountDetails.map((r) => r.data),
        accounts: origins.flatMap((c) =>
          Object.entries(c.accounts).map(([id, a]) => ({
            ...a,
            connectionId: c.id,
            hidden: false,
            id,
            manual: false,
            personId:
              owners.find((o) => o.connectionId === c.id)?.personId ?? "self",
            personName:
              persons.find(
                (p) =>
                  p.id ===
                  (owners.find((o) => o.connectionId === c.id)?.personId ??
                    "self"),
              )?.name ?? "Eu",
            profileId:
              owners.find((o) => o.connectionId === c.id)?.profileId ??
              "default",
            spaceId: "personal",
          })),
        ),
        bills: bills.map((r) => r.data),
        owners,
        partial: !origins.length || origins.some(connectionPartial),
        people: persons,
        revision: required(version[0]).revision,
        state: {
          accounts: accounts.map((r) => r.data),
          billPayments: billPayments.map((r) => r.data),
          cards: cards.map((r) => r.data),
          categories: categories.map((r) => r.data),
          contributions: contributions.map((r) => r.data),
          edits: edits.map((r) => r.data),
          goals: goals.map((r) => r.data),
          installments: installments.map((r) => r.data),
          investments: investments.map((r) => r.data),
          loans: loans.map((r) => r.data),
          notifications: notifications.map((r) => r.data),
          recurrences: recurrences.map((r) => r.data),
          rules: rules.map((r) => r.data),
          schedules: schedules.map((r) => r.data),
          spaces: spaces.map((r) => r.data),
          tags: tags.map((r) => r.data),
        },
        transactionDetails: transactionDetails.map((r) => r.data),
      };
    },
    receipt(key) {
      return db
        .select()
        .from(planningReceipts)
        .where(eq(planningReceipts.id, key))
        .get();
    },
    revision,
    async *transactions(ids) {
      if (ids) {
        if (ids.length) {
          yield await db
            .select()
            .from(transactions)
            .where(inArray(transactions.id, ids));
        }
        return;
      }
      async function* pages(
        after?: string,
      ): AsyncGenerator<import("../../../domain").TransactionProjection[]> {
        const rows = await db
          .select()
          .from(transactions)
          .where(after === undefined ? undefined : gt(transactions.id, after))
          .orderBy(transactions.id)
          .limit(500);
        if (!rows.length) {
          return;
        }
        yield rows;
        yield* pages(required(rows.at(-1)).id);
      }
      yield* pages();
    },
  };
}
