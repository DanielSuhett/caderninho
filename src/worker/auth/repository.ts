import { and, eq, gt, lte, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import type { Bindings } from "#worker/bindings.ts";
import { database, hash } from "#worker/database.ts";
import { login_attempts, portal_sessions } from "#worker/schema.ts";

export type PortalSession = Pick<
  typeof portal_sessions.$inferSelect,
  "csrf" | "expires" | "auth_version"
>;

export function createAuthRepository(env: Bindings) {
  const db = database(env.DB);
  return {
    async session(id: string, now: number) {
      return (
        (await db
          .select({
            csrf: portal_sessions.csrf,
            expires: portal_sessions.expires,
            auth_version: portal_sessions.auth_version,
          })
          .from(portal_sessions)
          .where(
            and(
              eq(portal_sessions.id, await hash(id)),
              gt(portal_sessions.expires, now),
            ),
          )
          .get()) ?? null
      );
    },
    async saveSession(input: {
      id: string;
      csrf: string;
      expires: number;
      version: string;
      prior?: string;
    }) {
      const insert = db.insert(portal_sessions).values({
        id: await hash(input.id),
        csrf: input.csrf,
        expires: input.expires,
        auth_version: input.version,
      });
      const rest: BatchItem<"sqlite">[] = [];
      if (input.prior) {
        rest.push(
          db
            .delete(portal_sessions)
            .where(eq(portal_sessions.id, await hash(input.prior))),
        );
      }
      await db.batch([insert, ...rest]);
    },
    async allowLoginAttempt(now: number) {
      const [row] = await db
        .insert(login_attempts)
        .values({ id: "admin", attempts: 1, expires: now + 60000 })
        .onConflictDoUpdate({
          target: login_attempts.id,
          set: {
            attempts: sql`case when ${login_attempts.expires} <= ${now} then 1 else ${login_attempts.attempts} + 1 end`,
            expires: sql`case when ${login_attempts.expires} <= ${now} then excluded.expires else ${login_attempts.expires} end`,
          },
        })
        .returning({ attempts: login_attempts.attempts });
      if (!row) {
        throw new Error("LOGIN_ATTEMPT_NOT_SAVED");
      }
      return row.attempts <= 10;
    },
    async revokeSession(id: string) {
      await db
        .delete(portal_sessions)
        .where(eq(portal_sessions.id, await hash(id)));
    },
  };
}
export async function compactAccess(binding: D1Database) {
  const db = database(binding),
    now = Date.now();
  await db.batch([
    db.delete(portal_sessions).where(lte(portal_sessions.expires, now)),
    db.delete(login_attempts).where(lte(login_attempts.expires, now)),
  ]);
}
