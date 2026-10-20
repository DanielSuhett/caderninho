import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Checkpoint } from "../../../domain";
import { IMPORT_INTERVAL } from "../../../domain";
import { tryCatch } from "../../../shared";
import { database, required } from "../../database";
import { accounts, connections, settings, sync_runs } from "../../schema";
import type { Admission, SyncRepository } from "../entity";
import { publicationData } from "./publication.repository";

const active = () => inArray(sync_runs.status, ["pending", "running"]);
export function createSyncRepository(binding: D1Database): SyncRepository {
  const db = database(binding);
  return {
    async account(connectionId, id) {
      return required(
        await db
          .select()
          .from(accounts)
          .where(
            and(eq(accounts.connectionId, connectionId), eq(accounts.id, id)),
          )
          .get(),
      );
    },
    active: () =>
      db.select().from(sync_runs).where(active()).orderBy(sync_runs.createdAt),
    async admit(ids, now) {
      const selected = await db
        .select()
        .from(connections)
        .where(ids ? inArray(connections.id, ids) : undefined)
        .orderBy(connections.id);
      if (ids && new Set(ids).size !== selected.length) {
        throw new Error("NOT_FOUND");
      }
      return Promise.all(
        selected.map(async (connection): Promise<Admission> => {
          const id = crypto.randomUUID();
          const candidate = db
            .select({
              checkpoint:
                sql<Checkpoint>`'{"phase":"accounts","accountId":null,"cursor":null}'`.as(
                  "checkpoint",
                ),
              connectionId: connections.id,
              createdAt: sql<string>`${now}`.as("created_at"),
              error: sql<string | null>`NULL`.as("error"),
              id: sql<string>`${id}`.as("id"),
              lastCommitId: sql<string | null>`NULL`.as("last_commit_id"),
              lastResult: sql<null>`NULL`.as("last_result"),
              records: sql<number>`0`.as("records"),
              sequence: sql<number>`0`.as("sequence"),
              status: sql<"pending">`'pending'`.as("status"),
              updatedAt: sql<string>`${now}`.as("updated_at"),
            })
            .from(connections)
            .where(
              and(
                eq(connections.id, connection.id),
                or(
                  isNull(connections.nextImportAt),
                  lte(connections.nextImportAt, now),
                ),
                exists(
                  db
                    .select({ id: settings.id })
                    .from(settings)
                    .where(
                      and(eq(settings.id, 1), eq(settings.syncEnabled, 1)),
                    ),
                ),
              ),
            );
          await db.batch([
            db.insert(sync_runs).select(candidate).onConflictDoNothing(),
            db
              .update(connections)
              .set({
                lastAdmittedAt: now,
                nextImportAt: new Date(
                  Date.parse(now) + IMPORT_INTERVAL,
                ).toISOString(),
              })
              .where(
                and(
                  eq(connections.id, connection.id),
                  exists(
                    db
                      .select({ id: sync_runs.id })
                      .from(sync_runs)
                      .where(eq(sync_runs.id, id)),
                  ),
                ),
              ),
            db
              .update(settings)
              .set({ revision: sql`${settings.revision}+1` })
              .where(
                and(
                  eq(settings.id, 1),
                  exists(
                    db
                      .select({ id: sync_runs.id })
                      .from(sync_runs)
                      .where(eq(sync_runs.id, id)),
                  ),
                ),
              ),
          ]);
          const [runs, config, rows] = await db.batch([
            db
              .select()
              .from(sync_runs)
              .where(eq(sync_runs.connectionId, connection.id))
              .orderBy(
                sql`CASE WHEN status IN ('pending','running') THEN 0 ELSE 1 END`,
                desc(sync_runs.createdAt),
              )
              .limit(1),
            db.select().from(settings).where(eq(settings.id, 1)),
            db
              .select()
              .from(connections)
              .where(eq(connections.id, connection.id)),
          ]);
          const [run] = runs;
          const row = required(rows[0]);
          let status: Admission["status"] = "cooldown";
          if (run?.id === id) {
            status = "started";
          } else if (
            run &&
            (run.status === "pending" || run.status === "running")
          ) {
            status = "working";
          } else if (!required(config[0]).syncEnabled) {
            status = "paused";
          }
          return {
            connectionId: connection.id,
            nextEligibleAt: row.nextImportAt,
            runId: run?.id ?? null,
            status,
          };
        }),
      );
    },
    async compact(before) {
      await db.delete(sync_runs).where(
        inArray(
          sync_runs.id,
          db
            .select({ id: sync_runs.id })
            .from(sync_runs)
            .where(
              and(
                inArray(sync_runs.status, ["succeeded", "failed"]),
                lte(sync_runs.updatedAt, before),
              ),
            )
            .orderBy(sync_runs.updatedAt)
            .limit(200),
        ),
      );
    },
    async fail(id, code, now) {
      const run = await db
        .select()
        .from(sync_runs)
        .where(eq(sync_runs.id, id))
        .get();
      if (!(run && ["pending", "running"].includes(run.status))) {
        return;
      }
      await db.batch([
        db
          .update(settings)
          .set({ revision: sql`${settings.revision}+1` })
          .where(
            and(
              eq(settings.id, 1),
              exists(
                db
                  .select({ id: sync_runs.id })
                  .from(sync_runs)
                  .where(and(eq(sync_runs.id, id), active())),
              ),
            ),
          ),
        db
          .update(sync_runs)
          .set({ error: code, status: "failed", updatedAt: now })
          .where(and(eq(sync_runs.id, id), active())),
        db
          .update(accounts)
          .set({ collectionStatus: "partial", error: code })
          .where(
            and(
              eq(accounts.connectionId, run.connectionId),
              eq(accounts.lastSeenRun, id),
              eq(accounts.collectionStatus, "collecting"),
            ),
          ),
      ]);
    },
    async nextAccount(run, after) {
      return (
        (
          await db
            .select({ id: accounts.id })
            .from(accounts)
            .where(
              and(
                eq(accounts.connectionId, run.connectionId),
                eq(accounts.lastSeenRun, run.id),
                gt(accounts.id, after),
              ),
            )
            .orderBy(asc(accounts.id))
            .limit(1)
            .get()
        )?.id ?? null
      );
    },
    async publish(input) {
      const { run, now, next, done } = input;
      const commitId = `${run.id}:${run.sequence}`;
      const saved = await db
        .select()
        .from(sync_runs)
        .where(eq(sync_runs.id, run.id))
        .get();
      if (saved?.lastCommitId === commitId && saved.lastResult) {
        return saved.lastResult;
      }
      const published =
        (input.accounts?.length ?? 0) + (input.transactions?.length ?? 0);
      const result = {
        checkpoint: next,
        done,
        records: published,
        sequence: run.sequence + 1,
      };
      const expected = exists(
        db
          .select({ id: sync_runs.id })
          .from(sync_runs)
          .where(
            and(
              eq(sync_runs.id, run.id),
              eq(sync_runs.status, "running"),
              eq(sync_runs.sequence, run.sequence),
            ),
          ),
      );
      const configured = exists(
        db.select({ id: settings.id }).from(settings).where(eq(settings.id, 1)),
      );
      const edits: BatchItem<"sqlite">[] = [
        db
          .insert(settings)
          .values({
            id: 1,
            revision: sql`CASE WHEN ${and(expected, configured)} THEN 0 ELSE -1 END`,
            syncEnabled: 0,
          })
          .onConflictDoUpdate({
            set: { revision: sql`${settings.revision}+1` },
            target: settings.id,
          }),
      ];
      edits.push(...publicationData(db, input));
      edits.push(
        db
          .update(sync_runs)
          .set({
            checkpoint: next,
            lastCommitId: commitId,
            lastResult: result,
            records: sql`${sync_runs.records}+${published}`,
            sequence: result.sequence,
            status: done ? "succeeded" : "running",
            updatedAt: now,
          })
          .where(eq(sync_runs.id, run.id)),
      );
      const [first, ...rest] = edits;
      if (!first) {
        throw new Error("EMPTY_PUBLICATION");
      }
      const { data: _data, error } = await tryCatch(() =>
        db.batch([first, ...rest]),
      );
      if (error) {
        const replay = await db
          .select()
          .from(sync_runs)
          .where(eq(sync_runs.id, run.id))
          .get();
        if (replay?.lastCommitId === commitId && replay.lastResult) {
          return replay.lastResult;
        }
        if (
          !replay ||
          replay.sequence !== run.sequence ||
          replay.status !== "running"
        ) {
          throw new Error("STALE_COMMIT");
        }
        throw error;
      }
      return result;
    },
    async read(id) {
      return required(
        await db.select().from(sync_runs).where(eq(sync_runs.id, id)).get(),
      );
    },
    async start(id, now) {
      await db
        .update(sync_runs)
        .set({ status: "running", updatedAt: now })
        .where(and(eq(sync_runs.id, id), eq(sync_runs.status, "pending")));
    },
  };
}
