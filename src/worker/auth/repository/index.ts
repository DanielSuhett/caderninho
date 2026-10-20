import { and, eq, gt, inArray, lte } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { hash } from "../../../shared";
import { database } from "../../database";
import { portal_sessions } from "../../schema";
import type { AuthRepository } from "../entity";

export function createAuthRepository(binding: D1Database): AuthRepository {
  const db = database(binding);
  return {
    compact: () => compactAccess(binding),
    async revokeSession(id: string) {
      await db
        .delete(portal_sessions)
        .where(eq(portal_sessions.id, await hash(id)));
    },
    async saveSession(input: {
      id: string;
      csrf: string;
      expires: number;
      version: string;
      prior?: string;
    }) {
      const insert = db.insert(portal_sessions).values({
        auth_version: input.version,
        csrf: input.csrf,
        expires: input.expires,
        id: await hash(input.id),
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
    async session(id: string, now: number) {
      return (
        (await db
          .select({
            auth_version: portal_sessions.auth_version,
            csrf: portal_sessions.csrf,
            expires: portal_sessions.expires,
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
  };
}
export async function compactAccess(binding: D1Database) {
  const db = database(binding),
    now = Date.now();
  await db.batch([
    db
      .delete(portal_sessions)
      .where(
        inArray(
          portal_sessions.id,
          db
            .select({ id: portal_sessions.id })
            .from(portal_sessions)
            .where(lte(portal_sessions.expires, now))
            .orderBy(portal_sessions.expires)
            .limit(200),
        ),
      ),
  ]);
}
