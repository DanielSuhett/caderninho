import { z } from "zod/v4";

import type { Bindings } from "#worker/bindings.ts";
import { hash, statement } from "#worker/database.ts";

export const SessionSchema = z.object({
  csrf: z.string(),
  expires: z.number(),
  auth_version: z.string().min(1),
});

export type PortalSession = z.infer<typeof SessionSchema>;

export function createAuthRepository(env: Bindings) {
  const db = env.DB;
  return {
    async session(id: string, now: number) {
      const row = await statement(
        db,
        "SELECT csrf,expires,auth_version FROM portal_sessions WHERE id=? AND expires>?",
        await hash(id),
        now,
      ).first();
      return row ? SessionSchema.parse(row) : null;
    },
    async saveSession(input: {
      id: string;
      csrf: string;
      expires: number;
      version: string;
      prior?: string;
    }) {
      const batch = [
        statement(
          db,
          "INSERT INTO portal_sessions(id,csrf,expires,auth_version) VALUES(?,?,?,?)",
          await hash(input.id),
          input.csrf,
          input.expires,
          input.version,
        ),
      ];
      if (input.prior)
        batch.push(
          statement(
            db,
            "DELETE FROM portal_sessions WHERE id=?",
            await hash(input.prior),
          ),
        );
      await db.batch(batch);
    },
    async allowLoginAttempt(now: number) {
      // The global atomic counter cannot be bypassed with client-controlled headers.
      const row = await statement(
        db,
        `INSERT INTO login_attempts(id,attempts,expires) VALUES('admin',1,?)
      ON CONFLICT(id) DO UPDATE SET attempts=CASE WHEN expires<=? THEN 1 ELSE attempts+1 END,
      expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING attempts`,
        now + 60000,
        now,
        now,
      ).first();
      return z.object({ attempts: z.number() }).parse(row).attempts <= 10;
    },
    async revokeSession(id: string) {
      await statement(
        db,
        "DELETE FROM portal_sessions WHERE id=?",
        await hash(id),
      ).run();
    },
  };
}

export async function compactAccess(db: D1Database) {
  await db.batch([
    statement(db, "DELETE FROM portal_sessions WHERE expires<=?", Date.now()),
    statement(db, "DELETE FROM login_attempts WHERE expires<=?", Date.now()),
  ]);
}
