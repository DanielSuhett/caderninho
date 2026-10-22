import { desc, gte, isNotNull, lt, sql } from "drizzle-orm";

import { database } from "../../database";
import { mcpAudit } from "../../schema";

const counters = {
  cancelled: sql<number>`coalesce(sum(case when ${mcpAudit.outcome}='cancelled' then 1 else 0 end),0)`,
  durationMs: sql<number>`coalesce(sum(${mcpAudit.durationMs}),0)`,
  errors: sql<number>`coalesce(sum(case when ${mcpAudit.outcome}='failed' then 1 else 0 end),0)`,
  inputBytes: sql<number>`coalesce(sum(${mcpAudit.inputBytes}),0)`,
  outputBytes: sql<number>`coalesce(sum(${mcpAudit.outputBytes}),0)`,
  requests: sql<number>`count(*)`,
  toolCalls: sql<number>`coalesce(sum(case when ${mcpAudit.tool} is not null then 1 else 0 end),0)`,
};
export function createAuditRepository(binding: D1Database) {
  const db = database(binding);
  return {
    async record(row: typeof mcpAudit.$inferInsert) {
      const cutoff = new Date(
        Date.parse(row.startedAt) - 30 * 86_400_000,
      ).toISOString();
      await db.batch([
        db.insert(mcpAudit).values(row),
        db.delete(mcpAudit).where(lt(mcpAudit.startedAt, cutoff)),
      ]);
    },
    async report(days: number, now: Date) {
      const since = new Date(now.getTime() - days * 86_400_000).toISOString();
      const scope = gte(mcpAudit.startedAt, since);
      const day = sql<string>`substr(${mcpAudit.startedAt},1,10)`;
      const [totals, daily, models, clients, recent] = await db.batch([
        db.select(counters).from(mcpAudit).where(scope),
        db
          .select({ ...counters, day })
          .from(mcpAudit)
          .where(scope)
          .groupBy(day)
          .orderBy(day),
        db
          .select({ ...counters, model: mcpAudit.model })
          .from(mcpAudit)
          .where(sql`${scope} AND ${isNotNull(mcpAudit.tool)}`)
          .groupBy(mcpAudit.model)
          .orderBy(desc(counters.requests))
          .limit(100),
        db
          .select({
            ...counters,
            clientId: mcpAudit.clientId,
            lastSeen: sql<string>`max(${mcpAudit.startedAt})`,
          })
          .from(mcpAudit)
          .where(scope)
          .groupBy(mcpAudit.clientId)
          .orderBy(desc(counters.requests))
          .limit(100),
        db
          .select()
          .from(mcpAudit)
          .where(scope)
          .orderBy(desc(mcpAudit.startedAt), desc(mcpAudit.id))
          .limit(50),
      ]);
      return { clients, daily, days, models, recent, since, totals: totals[0] };
    },
  };
}
