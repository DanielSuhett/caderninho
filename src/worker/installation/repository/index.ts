import { and, desc, eq, inArray, notExists, sql } from "drizzle-orm";

import { connectionPartial, type RunStatus } from "../../../domain";
import { tryCatch } from "../../../shared";
import { database, required } from "../../database";
import { connections, settings, sync_runs } from "../../schema";
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
      const [config, items, runs] = await db.batch([
        db
          .select({ enabled: settings.syncEnabled })
          .from(settings)
          .where(eq(settings.id, 1)),
        db
          .select({
            accounts: connections.accounts,
            id: connections.id,
            importStatus: sql<RunStatus | null>`(SELECT ${sync_runs.status} FROM ${sync_runs} WHERE ${sync_runs.connectionId}=${connections.id} ORDER BY ${sync_runs.createdAt} DESC LIMIT 1)`,
            lastAdmittedAt: connections.lastAdmittedAt,
            lastSuccessAt: connections.lastSuccessAt,
            name: connections.name,
            nextImportAt: connections.nextImportAt,
            observedAt: connections.observedAt,
            status: connections.status,
          })
          .from(connections)
          .where(
            selection.connectionIds &&
              inArray(connections.id, selection.connectionIds),
          )
          .orderBy(connections.id),
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
        connections: items.map(({ importStatus, ...item }) => ({
          ...item,
          partial: connectionPartial({ ...item, importStatus }),
        })),
        enabled: !!required(config[0]).enabled,
        runs,
      };
    },
  };
}
