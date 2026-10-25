import { and, desc, eq, sql } from "drizzle-orm";

import {
  SyncHistoryCursorSchema,
  type SyncHistorySelection,
} from "../../../contracts";
import { database } from "../../database";
import { people, pluggyProfiles, syncHistory } from "../../schema";

export function createSyncHistoryRepository(binding: D1Database) {
  const db = database(binding);
  return {
    async query(input: SyncHistorySelection) {
      const before = input.cursor
        ? SyncHistoryCursorSchema.parse(JSON.parse(input.cursor))
        : null;
      const rows = await db
        .select({
          admittedAt: syncHistory.admittedAt,
          connectionId: syncHistory.connectionId,
          error: syncHistory.error,
          finishedAt: syncHistory.finishedAt,
          id: syncHistory.id,
          personId: syncHistory.personId,
          personName: sql<string>`coalesce(${people.name},'Pessoa indisponível')`,
          phase: syncHistory.phase,
          profileId: syncHistory.profileId,
          profileName: sql<string>`coalesce(${pluggyProfiles.name},'Perfil indisponível')`,
          sequence: syncHistory.sequence,
          status: syncHistory.status,
        })
        .from(syncHistory)
        .leftJoin(people, eq(people.id, syncHistory.personId))
        .leftJoin(pluggyProfiles, eq(pluggyProfiles.id, syncHistory.profileId))
        .where(
          and(
            input.connectionId
              ? eq(syncHistory.connectionId, input.connectionId)
              : undefined,
            input.personId
              ? eq(syncHistory.personId, input.personId)
              : undefined,
            input.status ? eq(syncHistory.status, input.status) : undefined,
            before
              ? sql`(${syncHistory.admittedAt},${syncHistory.id})<(${before.admittedAt},${before.id})`
              : undefined,
          ),
        )
        .orderBy(desc(syncHistory.admittedAt), desc(syncHistory.id))
        .limit(input.limit + 1);
      const records = rows.slice(0, input.limit);
      const last = records.at(-1);
      return {
        cursor:
          rows.length > input.limit && last
            ? JSON.stringify({ admittedAt: last.admittedAt, id: last.id })
            : null,
        records,
      };
    },
  };
}
