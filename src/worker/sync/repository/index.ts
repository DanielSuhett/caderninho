import { and, eq, exists, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { IMPORT_INTERVAL } from "../../../domain";
import { tryCatch } from "../../../shared";
import { database, required } from "../../database";
import { connectionOwners, connections, pluggyProfiles } from "../../schema";
import type { Admission, SyncRepository, SyncRun } from "../entity";
import { publicationData } from "./publication.repository";

const profileEnabled = (connectionId: string) =>
  sql<number>`EXISTS(SELECT 1 FROM ${connectionOwners} JOIN ${pluggyProfiles} ON ${pluggyProfiles.id}=${connectionOwners.profileId} WHERE ${connectionOwners.connectionId}=${connectionId} AND ${pluggyProfiles.enabled}=1)`;
const active = () => inArray(connections.importStatus, ["pending", "running"]);
const runFields = {
  id: connections.id,
  importAdmittedAt: connections.importAdmittedAt,
  importCheckpoint: connections.importCheckpoint,
  importId: connections.importId,
  importSequence: connections.importSequence,
  importStatus: connections.importStatus,
};
function current(
  row:
    | Pick<typeof connections.$inferSelect, keyof typeof runFields>
    | undefined,
): SyncRun {
  if (
    !(
      row?.importId &&
      row.importCheckpoint &&
      row.importStatus &&
      row.importAdmittedAt
    )
  ) {
    throw new Error("STALE_COMMIT");
  }
  return {
    admittedAt: row.importAdmittedAt,
    checkpoint: row.importCheckpoint,
    connectionId: row.id,
    id: row.importId,
    sequence: row.importSequence,
    status: row.importStatus,
  };
}
function replay(saved: SyncRun, expected: SyncRun) {
  if (saved.id !== expected.id) {
    throw new Error("STALE_COMMIT");
  }
  if (saved.sequence === expected.sequence + 1) {
    return {
      checkpoint: saved.checkpoint,
      done: saved.status === "succeeded" || saved.status === "failed",
      sequence: saved.sequence,
    };
  }
  if (saved.sequence !== expected.sequence || saved.status !== "running") {
    throw new Error("STALE_COMMIT");
  }
  return null;
}
export function createSyncRepository(binding: D1Database): SyncRepository {
  const db = database(binding);
  const read = async (id: string, connectionId?: string) =>
    current(
      await db
        .select(runFields)
        .from(connections)
        .where(
          and(
            eq(connections.importId, id),
            connectionId === undefined
              ? undefined
              : eq(connections.id, connectionId),
          ),
        )
        .get(),
    );
  return {
    async active() {
      return (
        await db
          .select(runFields)
          .from(connections)
          .where(active())
          .orderBy(connections.id)
      ).map(current);
    },
    async admit(ids, now, initialOnly = false) {
      const selected = await db
        .select({ id: connections.id })
        .from(connections)
        .where(ids && inArray(connections.id, ids))
        .orderBy(connections.id);
      if (ids && new Set(ids).size !== selected.length) {
        throw new Error("NOT_FOUND");
      }
      const cutoff = new Date(Date.parse(now) - IMPORT_INTERVAL).toISOString();
      return Promise.all(
        selected.map(async ({ id: connectionId }): Promise<Admission> => {
          const id = crypto.randomUUID();
          const [, rows, profiles] = await db.batch([
            db
              .update(connections)
              .set({
                importAdmittedAt: new Date(now).toISOString(),
                importCheckpoint: {
                  accountId: null,
                  cursor: null,
                  phase: "accounts",
                },
                importError: null,
                importId: id,
                importSequence: 0,
                importStatus: "pending",
              })
              .where(
                and(
                  eq(connections.id, connectionId),
                  profileEnabled(connectionId),
                  initialOnly
                    ? isNull(connections.importAdmittedAt)
                    : undefined,
                  or(
                    isNull(connections.importStatus),
                    inArray(connections.importStatus, ["failed", "succeeded"]),
                  ),
                  or(
                    isNull(connections.importAdmittedAt),
                    lte(connections.importAdmittedAt, cutoff),
                  ),
                ),
              ),
            db
              .select({
                importAdmittedAt: connections.importAdmittedAt,
                importId: connections.importId,
                importStatus: connections.importStatus,
              })
              .from(connections)
              .where(eq(connections.id, connectionId)),
            db
              .select({ enabled: profileEnabled(connectionId) })
              .from(connections)
              .where(eq(connections.id, connectionId)),
          ]);
          const row = required(rows[0]);
          let status: Admission["status"] = "cooldown";
          if (!required(profiles[0]).enabled) {
            status = "paused";
          } else if (row.importId === id) {
            status = "started";
          } else if (
            row.importStatus === "pending" ||
            row.importStatus === "running"
          ) {
            status = "working";
          }
          return {
            connectionId,
            importId: row.importId,
            nextEligibleAt: row.importAdmittedAt
              ? new Date(
                  Date.parse(row.importAdmittedAt) + IMPORT_INTERVAL,
                ).toISOString()
              : null,
            status,
          };
        }),
      );
    },
    async connectionAccounts(connectionId) {
      return required(
        await db
          .select({ accounts: connections.accounts })
          .from(connections)
          .where(eq(connections.id, connectionId))
          .get(),
      ).accounts;
    },
    async fail(id, code) {
      await db
        .update(connections)
        .set({ importError: code, importStatus: "failed" })
        .where(and(eq(connections.importId, id), active()));
    },
    async publish(input) {
      const { run, now, next, done } = input;
      const saved = replay(await read(run.id, run.connectionId), run);
      if (saved) {
        return saved;
      }
      const result = { checkpoint: next, done, sequence: run.sequence + 1 };
      const expected = exists(
        db
          .select({ id: connections.id })
          .from(connections)
          .where(
            and(
              eq(connections.id, run.connectionId),
              eq(connections.importId, run.id),
              eq(connections.importStatus, "running"),
              eq(connections.importSequence, run.sequence),
            ),
          ),
      );
      // A missing/replaced/stale connection fails its own CHECK, aborting every write.
      const sequence = sql<number>`CASE WHEN ${expected} THEN ${result.sequence} ELSE -1 END`;
      const guard = db
        .insert(connections)
        .values({ id: run.connectionId, importSequence: sequence })
        .onConflictDoUpdate({
          set: { importSequence: sequence },
          target: connections.id,
        });
      const data = await publicationData(db, input);
      const terminalStatus = input.error ? "failed" : "succeeded";
      const { data: _data, error } = await tryCatch(() =>
        db.batch([
          guard,
          ...data,
          db
            .update(connections)
            .set({
              importCheckpoint: next,
              importError: input.error ?? null,
              importStatus: done ? terminalStatus : "running",
              ...(done && !input.error && { lastSuccessAt: now }),
            })
            .where(eq(connections.id, run.connectionId)),
        ]),
      );
      if (error) {
        const committed = replay(await read(run.id, run.connectionId), run);
        if (committed) {
          return committed;
        }
        throw error;
      }
      return result;
    },
    read,
    async start(id) {
      await db
        .update(connections)
        .set({ importStatus: "running" })
        .where(
          and(
            eq(connections.importId, id),
            eq(connections.importStatus, "pending"),
          ),
        );
    },
  };
}
