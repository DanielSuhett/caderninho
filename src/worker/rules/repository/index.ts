import { and, desc, eq, isNotNull } from "drizzle-orm";

import { database } from "../../database";
import { ruleJobChunks, ruleJobs } from "../../schema";
import type { RuleJobRepository } from "../entity";

// Pack categories travel with the job as chunk -1, outside the rule sequence.
const CATEGORIES = -1;

export function createRuleJobRepository(
  binding: D1Database,
): RuleJobRepository {
  const db = database(binding);
  return {
    async append(jobId, seq, rules) {
      await db
        .insert(ruleJobChunks)
        .values({ jobId, rules, seq })
        .onConflictDoNothing()
        .run();
    },
    async categories(jobId) {
      const row = await db
        .select({ rules: ruleJobChunks.rules })
        .from(ruleJobChunks)
        .where(
          and(
            eq(ruleJobChunks.jobId, jobId),
            eq(ruleJobChunks.seq, CATEGORIES),
          ),
        )
        .get();
      return row?.rules ?? [];
    },
    async chunk(jobId, seq) {
      const row = await db
        .select({ result: ruleJobChunks.result, rules: ruleJobChunks.rules })
        .from(ruleJobChunks)
        .where(and(eq(ruleJobChunks.jobId, jobId), eq(ruleJobChunks.seq, seq)))
        .get();
      return row ?? null;
    },
    async create(job, categories) {
      await db.batch([
        db.insert(ruleJobs).values({
          createdAt: job.createdAt,
          data: job,
          id: job.id,
          spaceId: job.spaceId,
        }),
        db
          .insert(ruleJobChunks)
          .values({ jobId: job.id, rules: categories, seq: CATEGORIES }),
      ]);
    },
    async finishChunk(jobId, seq, result) {
      await db
        .update(ruleJobChunks)
        .set({ result })
        .where(and(eq(ruleJobChunks.jobId, jobId), eq(ruleJobChunks.seq, seq)));
      const rows = await db
        .select({ result: ruleJobChunks.result })
        .from(ruleJobChunks)
        .where(
          and(eq(ruleJobChunks.jobId, jobId), isNotNull(ruleJobChunks.result)),
        )
        .orderBy(ruleJobChunks.seq);
      return rows.flatMap((row) => (row.result ? [row.result] : []));
    },
    async latest(spaceId) {
      const row = await db
        .select({ data: ruleJobs.data })
        .from(ruleJobs)
        .where(eq(ruleJobs.spaceId, spaceId))
        .orderBy(desc(ruleJobs.createdAt))
        .limit(1)
        .get();
      return row?.data ?? null;
    },
    async read(id) {
      const row = await db
        .select({ data: ruleJobs.data })
        .from(ruleJobs)
        .where(eq(ruleJobs.id, id))
        .get();
      return row?.data ?? null;
    },
    async uploaded(jobId) {
      const rows = await db
        .select({ seq: ruleJobChunks.seq })
        .from(ruleJobChunks)
        .where(eq(ruleJobChunks.jobId, jobId));
      return rows.filter((row) => row.seq !== CATEGORIES).length;
    },
    async write(job) {
      await db
        .update(ruleJobs)
        .set({ data: job })
        .where(eq(ruleJobs.id, job.id));
    },
  };
}
