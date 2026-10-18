import { z } from "zod/v4";

import { ResourceSchema } from "#domain/enums.ts";
import { tryCatch } from "#shared/result.ts";
import type { ConnectionStore } from "#worker/account/service.ts";
import { installationChecks as checksFor } from "#worker/auth/service.ts";
import type { Bindings } from "#worker/bindings.ts";
import { hash, statement } from "#worker/database.ts";
import { authorizedItems } from "#worker/finance/repository.ts";
import { credentialsFor, sealCredentials } from "#worker/pluggy/credentials.ts";

export function connectionStore(
  env: Bindings,
  principal: string,
): ConnectionStore {
  const credentialStatement = async (
    credentials: { clientId: string; clientSecret: string },
    now: string,
    connected: boolean,
  ) =>
    statement(
      env.DB,
      connected
        ? "INSERT INTO pluggy_credentials(principal,client_id_hash,envelope,enabled,next_sync_at,updated_at) VALUES(?,?,?,1,?,?) ON CONFLICT(principal) DO UPDATE SET client_id_hash=excluded.client_id_hash,envelope=excluded.envelope,enabled=1,next_sync_at=excluded.next_sync_at,updated_at=excluded.updated_at"
        : "INSERT INTO pluggy_credentials(principal,client_id_hash,envelope,enabled,next_sync_at,updated_at) VALUES(?,?,?,0,?,?) ON CONFLICT(principal) DO UPDATE SET client_id_hash=excluded.client_id_hash,envelope=excluded.envelope,updated_at=excluded.updated_at",
      principal,
      await hash(credentials.clientId),
      await sealCredentials(env.CREDENTIAL_KEY, principal, {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
      }),
      now,
      now,
    );
  return {
    async currentClientId() {
      const previous = await statement(
        env.DB,
        "SELECT envelope FROM pluggy_credentials WHERE principal=?",
        principal,
      ).first();
      return previous
        ? (await credentialsFor(env, principal, false)).clientId
        : null;
    },
    async itemAccess(itemId) {
      const count = z.coerce
        .number()
        .parse(
          await statement(
            env.DB,
            "SELECT COUNT(*) AS n FROM items WHERE principal=?",
            principal,
          ).first("n"),
        );
      const existing = await statement(
        env.DB,
        "SELECT id FROM items WHERE principal=? AND id=?",
        principal,
        itemId,
      ).first();
      return { count, exists: Boolean(existing) };
    },
    async saveCredentials(credentials, now) {
      await (await credentialStatement(credentials, now, false)).run();
    },
    async connect(connection, now) {
      await env.DB.batch([
        statement(
          env.DB,
          "INSERT INTO items(principal,id,resources,enabled) VALUES(?,?,?,1) ON CONFLICT(principal,id) DO UPDATE SET enabled=1",
          principal,
          connection.itemId,
          JSON.stringify(ResourceSchema.options),
        ),
        await credentialStatement(connection, now, true),
      ]);
    },
  };
}

export async function readPortalStatus(db: D1Database, principal: string) {
  const config = await statement(
    db,
    "SELECT enabled,next_sync_at,updated_at FROM pluggy_credentials WHERE principal=?",
    principal,
  ).first();
  const latest = await statement(
    db,
    "SELECT status,phase,updated_at FROM operations WHERE principal=? ORDER BY created_at DESC LIMIT 1",
    principal,
  ).first();
  const items = await statement(
    db,
    "SELECT id FROM items WHERE principal=? AND enabled=1 ORDER BY id LIMIT 10",
    principal,
  ).all();
  return {
    config: z
      .object({
        enabled: z.number(),
        next_sync_at: z.string(),
        updated_at: z.string(),
      })
      .nullable()
      .parse(config),
    latest: z
      .object({ status: z.string(), phase: z.string(), updated_at: z.string() })
      .nullable()
      .parse(latest),
    items: z.array(z.object({ id: z.string() })).parse(items.results),
  };
}

export async function wizardEvidence(db: D1Database, principal: string) {
  const status = await readPortalStatus(db, principal);
  const coverage = await statement(
    db,
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('available','empty') AND bootstrap_complete=1 THEN 1 ELSE 0 END) AS complete FROM coverage WHERE principal=?",
    principal,
  ).first();
  const checked = z
    .object({ total: z.number(), complete: z.number().nullable() })
    .parse(coverage);
  // An earlier successful import cannot confirm a newly attached Item. Ignore
  // unrelated operations and imports started before the connection changed.
  const latest = z
    .object({ status: z.string(), phase: z.string() })
    .nullable()
    .parse(
      await statement(
        db,
        "SELECT status,phase FROM operations WHERE principal=? AND kind IN ('sync','reconcile') AND created_at>=? ORDER BY created_at DESC LIMIT 1",
        principal,
        status.config?.updated_at ?? "",
      ).first(),
    );
  return { status, coverage: checked, latest };
}

export function installationChecks(env: Bindings, origin: string) {
  return checksFor(
    {
      ...env,
      database: Boolean(env.DB),
      workflow: Boolean(env.FINANCE),
      oauth: Boolean(env.OAUTH_KV),
    },
    origin,
  );
}
export async function installationReadiness(
  env: Bindings,
  currentOrigin: string,
) {
  const checks = installationChecks(env, currentOrigin);
  if (!checks.database) return { ...checks, migrations: false };
  // Exercise the columns needed by login, scheduling and queries. No private rows
  // are returned; LIMIT 0 still fails if a migration has not created the schema.
  const schema = await tryCatch(
    env.DB.batch([
      env.DB.prepare("SELECT id,attempts,expires FROM login_attempts LIMIT 0"),
      env.DB.prepare(
        "SELECT id,principal,client_id,received_at FROM mcp_receipts LIMIT 0",
      ),
      env.DB.prepare(
        "SELECT id,browser_hash,verifier,expires FROM portal_logins LIMIT 0",
      ),
      env.DB.prepare(
        "SELECT id,principal,csrf,expires,auth_version FROM portal_sessions LIMIT 0",
      ),
      env.DB.prepare(
        "SELECT principal,envelope,enabled,next_sync_at,manual_sync_after,reconcile_after FROM pluggy_credentials LIMIT 0",
      ),
      env.DB.prepare(
        "SELECT principal,status,bootstrap_complete FROM coverage LIMIT 0",
      ),
    ]),
  );
  return {
    ...checks,
    migrations: !schema.error && schema.data.every((result) => result.success),
  };
}

export function createAccountRepository(env: Bindings, principal: string) {
  return {
    connection: connectionStore(env, principal),
    status: () => readPortalStatus(env.DB, principal),
    evidence: () => wizardEvidence(env.DB, principal),
    authorizeItems: (ids: string[]) => authorizedItems(env.DB, principal, ids),
    async pause() {
      await statement(
        env.DB,
        "UPDATE pluggy_credentials SET enabled=0 WHERE principal=?",
        principal,
      ).run();
    },
    async resume(now: string) {
      await statement(
        env.DB,
        "UPDATE pluggy_credentials SET enabled=1,next_sync_at=? WHERE principal=? AND enabled=0",
        now,
        principal,
      ).run();
    },
    async requestSync(now: Date) {
      // Coalesce requests until the cron can create one operation per account.
      const requested = await statement(
        env.DB,
        "UPDATE pluggy_credentials SET next_sync_at=?,manual_sync_after=? WHERE principal=? AND enabled=1 AND manual_sync_after<=? AND next_sync_at>?",
        now.toISOString(),
        new Date(now.getTime() + 900000).toISOString(),
        principal,
        now.toISOString(),
        now.toISOString(),
      ).run();
      return Boolean(requested.meta.changes);
    },
  };
}
