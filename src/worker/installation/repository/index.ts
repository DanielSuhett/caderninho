import { and, desc, eq, inArray, notExists, sql } from "drizzle-orm";

import { tryCatch } from "../../../shared";
import { database, required } from "../../database";
import { accounts, connections, settings, sync_runs } from "../../schema";
import type { InstallationRepository } from "../entity";
export function createInstallationRepository(
  binding: D1Database,
): InstallationRepository {
  const db = database(binding);
  return {
    enable(enabled) {
      return db
        .update(settings)
        .set({ syncEnabled: Number(enabled) })
        .where(eq(settings.id, 1))
        .run()
        .then(() => undefined);
    },
    async register(connection, now) {
      const registration = db
        .insert(connections)
        .values({
          id: connection.id,
          name: connection.connector?.name ?? "Meu Pluggy",
          observedAt: now,
          status: connection.status ?? "unknown",
        })
        .onConflictDoUpdate({
          set: {
            name: connection.connector?.name ?? "Meu Pluggy",
            observedAt: now,
            status: connection.status ?? "unknown",
          },
          target: connections.id,
        });
      const { data: _data, error } = await tryCatch(() =>
        db.batch([
          db
            .update(settings)
            .set({ revision: sql`${settings.revision}+1` })
            .where(
              and(
                eq(settings.id, 1),
                notExists(
                  db
                    .select({ id: connections.id })
                    .from(connections)
                    .where(eq(connections.id, connection.id)),
                ),
              ),
            ),
          registration,
        ]),
      );
      if (!error) {
        return;
      }
      if (error.message.startsWith("D1_ERROR: ITEM_LIMIT: SQLITE_CONSTRAINT")) {
        throw new Error("ITEM_LIMIT");
      }
      throw error;
    },
    async state(selection = {}) {
      const [config, items, accountRows, runs] = await db.batch([
        db
          .select({ enabled: settings.syncEnabled })
          .from(settings)
          .where(eq(settings.id, 1)),
        db
          .select()
          .from(connections)
          .where(
            selection.connectionIds &&
              inArray(connections.id, selection.connectionIds),
          )
          .orderBy(connections.id),
        db
          .select({
            balanceMinor: accounts.balanceMinor,
            collectionStatus: accounts.collectionStatus,
            connectionId: accounts.connectionId,
            currency: accounts.currency,
            error: accounts.error,
            id: accounts.id,
            lastAttemptAt: accounts.lastAttemptAt,
            lastCompletedFrom: accounts.lastCompletedFrom,
            lastCompletedTo: accounts.lastCompletedTo,
            lastSuccessAt: accounts.lastSuccessAt,
            name: accounts.name,
            observedAt: accounts.observedAt,
            observedFrom: accounts.observedFrom,
            observedTo: accounts.observedTo,
            sourceUpdatedAt: accounts.sourceUpdatedAt,
            type: accounts.type,
          })
          .from(accounts)
          .where(
            selection.connectionIds &&
              inArray(accounts.connectionId, selection.connectionIds),
          )
          .orderBy(accounts.connectionId, accounts.id),
        db
          .select({
            connectionId: sync_runs.connectionId,
            createdAt: sync_runs.createdAt,
            error: sync_runs.error,
            id: sync_runs.id,
            records: sync_runs.records,
            status: sync_runs.status,
            updatedAt: sync_runs.updatedAt,
          })
          .from(sync_runs)
          .where(
            and(
              selection.connectionIds &&
                inArray(sync_runs.connectionId, selection.connectionIds),
              selection.runIds && inArray(sync_runs.id, selection.runIds),
            ),
          )
          .orderBy(
            sql`CASE WHEN status IN ('pending','running') THEN 0 ELSE 1 END`,
            desc(sync_runs.createdAt),
          )
          .limit(50),
      ]);
      return {
        accounts: accountRows,
        connections: items,
        enabled: !!required(config[0]).enabled,
        runs,
      };
    },
  };
}
