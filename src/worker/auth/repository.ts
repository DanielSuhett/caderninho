import { z } from "zod/v4";

import type { ClientAccessSchema } from "#contracts/portal-contract.ts";
import type { Bindings } from "#worker/bindings.ts";
import { hash, statement } from "#worker/database.ts";

export const GrantMetadataSchema = z.object({
  receiptId: z.uuid(),
  name: z.string(),
});
export type ClientAccess = z.infer<typeof ClientAccessSchema>;
export async function clientAccess(
  env: Bindings,
  principal: string,
  cursor?: string,
) {
  const grants = await env.OAUTH_PROVIDER.listUserGrants(
    oauthSubject(principal),
    {
      limit: 20,
      ...(cursor === undefined ? {} : { cursor }),
    },
  );
  const rows = await statement(
    env.DB,
    "SELECT id,client_id,received_at FROM mcp_receipts WHERE principal=?",
    principal,
  ).all();
  const receipts = z
    .array(
      z.object({
        id: z.string(),
        client_id: z.string(),
        received_at: z.string(),
      }),
    )
    .parse(rows.results);
  return {
    clients: grants.items.map((grant): ClientAccess => {
      const metadata = GrantMetadataSchema.safeParse(grant.metadata);
      return {
        id: grant.id,
        clientId: grant.clientId,
        name: metadata.success
          ? metadata.data.name
          : "Cliente autorizado anteriormente",
        createdAt: grant.createdAt,
        receivedAt: metadata.success
          ? (receipts.find(
              (row) =>
                row.id === metadata.data.receiptId &&
                row.client_id === grant.clientId,
            )?.received_at ?? null)
          : null,
      };
    }),
    ...(grants.cursor === undefined ? {} : { cursor: grants.cursor }),
  };
}
export async function recordMcpReceipt(
  env: Bindings,
  principal: string,
  receiptId: string,
  clientId: string,
) {
  await statement(
    env.DB,
    "INSERT INTO mcp_receipts(id,principal,client_id,received_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING",
    receiptId,
    principal,
    clientId,
    new Date().toISOString(),
  ).run();
}

// Provider token subjects cannot contain ':'. Financial principals remain unchanged.
export function oauthSubject(principal: string) {
  return (
    "p_" +
    btoa(principal)
      .replaceAll("=", "")
      .replaceAll("+", "-")
      .replaceAll("/", "_")
  );
}

export const SessionSchema = z.object({
  principal: z.string(),
  csrf: z.string(),
  expires: z.number(),
  auth_version: z.string().default(""),
});

export type PortalSession = z.infer<typeof SessionSchema>;

export function createAuthRepository(env: Bindings) {
  const db = env.DB;
  return {
    async session(id: string, now: number) {
      const row = await statement(
        db,
        "SELECT principal,csrf,expires,auth_version FROM portal_sessions WHERE id=? AND expires>?",
        await hash(id),
        now,
      ).first();
      return row ? SessionSchema.parse(row) : null;
    },
    async saveSession(input: {
      id: string;
      principal: string;
      csrf: string;
      expires: number;
      version: string;
      prior?: string;
    }) {
      const batch = [
        statement(
          db,
          "INSERT INTO principals(id) VALUES(?) ON CONFLICT(id) DO NOTHING",
          input.principal,
        ),
        statement(
          db,
          "INSERT INTO portal_sessions(id,principal,csrf,expires,auth_version) VALUES(?,?,?,?,?)",
          await hash(input.id),
          input.principal,
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
    async saveLogin(
      state: string,
      browser: string,
      verifier: string,
      expires: number,
    ) {
      await statement(
        db,
        "INSERT INTO portal_logins(id,browser_hash,verifier,expires) VALUES(?,?,?,?)",
        await hash(state),
        await hash(browser),
        verifier,
        expires,
      ).run();
    },
    async consumeLogin(state: string, browser: string, now: number) {
      const row = await statement(
        db,
        "DELETE FROM portal_logins WHERE id=? AND browser_hash=? AND expires>? RETURNING verifier",
        await hash(state),
        await hash(browser),
        now,
      ).first();
      return row ? z.object({ verifier: z.string() }).parse(row) : null;
    },
    async revokeSession(id: string) {
      await statement(
        db,
        "DELETE FROM portal_sessions WHERE id=?",
        await hash(id),
      ).run();
    },
    async principalExists(principal: string) {
      return Boolean(
        await statement(
          db,
          "SELECT id FROM principals WHERE id=?",
          principal,
        ).first(),
      );
    },
  };
}

export async function compactAccess(db: D1Database) {
  await db.batch([
    statement(db, "DELETE FROM portal_sessions WHERE expires<=?", Date.now()),
    statement(db, "DELETE FROM portal_logins WHERE expires<=?", Date.now()),
    statement(db, "DELETE FROM login_attempts WHERE expires<=?", Date.now()),
    statement(
      db,
      "DELETE FROM mcp_receipts WHERE received_at<?",
      new Date(Date.now() - 90 * 86400000).toISOString(),
    ),
  ]);
}
