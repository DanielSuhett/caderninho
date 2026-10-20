import { inArray } from "drizzle-orm";

import { connectionPartial, IMPORT_INTERVAL } from "../../../domain";
import { tryCatch } from "../../../shared";
import { database } from "../../database";
import { connections } from "../../schema";
import type { InstallationRepository } from "../entity";
export function createInstallationRepository(
  binding: D1Database,
): InstallationRepository {
  const db = database(binding);
  return {
    async register(connection) {
      const { data: _data, error } = await tryCatch(() =>
        db
          .insert(connections)
          .values({ id: connection.id })
          .onConflictDoNothing()
          .run(),
      );
      if (!error) {
        return;
      }
      const cause = error.cause instanceof Error ? error.cause : error;
      if (cause.message.startsWith("D1_ERROR: ITEM_LIMIT: SQLITE_CONSTRAINT")) {
        throw new Error("ITEM_LIMIT");
      }
      throw error;
    },
    async state(selection = {}) {
      const items = await db
        .select()
        .from(connections)
        .where(
          selection.connectionIds &&
            inArray(connections.id, selection.connectionIds),
        )
        .orderBy(connections.id);
      return {
        connections: items.map((row) => ({
          accounts: row.accounts,
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
        })),
      };
    },
  };
}
