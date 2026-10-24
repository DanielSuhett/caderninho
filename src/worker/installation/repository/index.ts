import { and, eq, exists, getTableColumns, inArray, sql } from "drizzle-orm";

import { connectionPartial, IMPORT_INTERVAL } from "../../../domain";
import { database } from "../../database";
import {
  connectionOwners,
  connections,
  people,
  pluggyProfiles,
  transactions,
} from "../../schema";
import type { InstallationRepository } from "../entity";
export function createInstallationRepository(
  binding: D1Database,
): InstallationRepository {
  const db = database(binding);
  return {
    async register(id, profileId = "default") {
      const profile = await db
        .select()
        .from(pluggyProfiles)
        .where(eq(pluggyProfiles.id, profileId))
        .get();
      if (!profile?.enabled) {
        throw new Error("NOT_FOUND");
      }
      await db.batch([
        db.insert(connections).values({ id }).onConflictDoNothing(),
        db
          .update(connectionOwners)
          .set({ personId: profile.personId, profileId })
          .where(
            and(
              eq(connectionOwners.connectionId, id),
              eq(connectionOwners.profileId, "default"),
              sql`${profileId}<>'default'`,
            ),
          ),
      ]);
    },
    async state(selection = {}) {
      const items = await db
        .select({
          ...getTableColumns(connections),
          hasTransactions: sql<boolean>`${exists(
            db
              .select({ id: transactions.id })
              .from(transactions)
              .where(
                inArray(
                  transactions.accountId,
                  sql`(SELECT key FROM json_each(${connections.accounts}))`,
                ),
              ),
          )}`.mapWith(Boolean),
        })
        .from(connections)
        .where(
          selection.connectionIds &&
            inArray(connections.id, selection.connectionIds),
        )
        .orderBy(connections.id);
      if (
        selection.connectionIds?.some(
          (id) => !items.some((row) => row.id === id),
        )
      ) {
        throw new Error("NOT_FOUND");
      }
      const owners = await db.select().from(connectionOwners);
      const profiles = await db.select().from(pluggyProfiles);
      const persons = await db.select().from(people);
      return {
        connections: items.map((row) => ({
          accounts: row.accounts,
          hasTransactions: row.hasTransactions,
          id: row.id,
          importCheckpoint: row.importCheckpoint
            ? {
                accountId: row.importCheckpoint.accountId,
                phase: row.importCheckpoint.phase,
              }
            : null,
          importError: row.importError,
          importStatus: row.importStatus,
          lastSuccessAt: row.lastSuccessAt,
          nextEligibleAt: row.importAdmittedAt
            ? new Date(
                Date.parse(row.importAdmittedAt) + IMPORT_INTERVAL,
              ).toISOString()
            : null,
          partial: connectionPartial(row),
          personId:
            owners.find((o) => o.connectionId === row.id)?.personId ?? "self",
          personName:
            persons.find(
              (p) =>
                p.id ===
                owners.find((o) => o.connectionId === row.id)?.personId,
            )?.name ?? "Eu",
          profileId:
            owners.find((o) => o.connectionId === row.id)?.profileId ??
            "default",
          profileName:
            profiles.find(
              (p) =>
                p.id ===
                owners.find((o) => o.connectionId === row.id)?.profileId,
            )?.name ?? "Pluggy principal",
        })),
      };
    },
  };
}
