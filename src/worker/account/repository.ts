import { z } from "zod/v4";

import { ResourceSchema } from "#domain/enums.ts";
import { tryCatch } from "#shared/result.ts";
import type { Bindings } from "#worker/bindings.ts";
import { hash, statement } from "#worker/database.ts";
import { authorizedItems } from "#worker/finance/repository.ts";

export async function assertPluggyApplication(
  db: D1Database,
  clientId: string,
) {
  const configured = z
    .object({ client_id_hash: z.string().nullable() })
    .parse(
      await statement(
        db,
        "SELECT client_id_hash FROM settings WHERE id=1",
      ).first(),
    );
  const fingerprint = await hash(clientId);
  if (configured.client_id_hash && configured.client_id_hash !== fingerprint)
    throw new Error("APPLICATION_CHANGE_REQUIRES_MIGRATION");
  return fingerprint;
}

export function connectionStore(db: D1Database) {
  return {
    async itemAccess(itemId: string) {
      const count = z.coerce
        .number()
        .parse(
          await statement(db, "SELECT COUNT(*) AS n FROM items").first("n"),
        );
      return {
        count,
        exists: Boolean(
          await statement(
            db,
            "SELECT id FROM items WHERE id=?",
            itemId,
          ).first(),
        ),
      };
    },
    async connect(itemId: string, clientId: string, now: string) {
      await db.batch([
        statement(
          db,
          "UPDATE settings SET client_id_hash=?,sync_enabled=1,next_sync_at=?,connected_at=? WHERE id=1",
          await hash(clientId),
          now,
          now,
        ),
        statement(
          db,
          "INSERT INTO items(id,resources,enabled) VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET enabled=1",
          itemId,
          JSON.stringify(ResourceSchema.options),
        ),
      ]);
    },
  };
}

export async function readPortalStatus(db: D1Database) {
  const config = z
    .object({ sync_enabled: z.number(), connected_at: z.string() })
    .parse(
      await statement(
        db,
        "SELECT sync_enabled,connected_at FROM settings WHERE id=1",
      ).first(),
    );
  const latest = z
    .object({ status: z.string(), phase: z.string(), updated_at: z.string() })
    .nullable()
    .parse(
      await statement(
        db,
        "SELECT status,phase,updated_at FROM operations WHERE kind IN ('sync','reconcile') AND created_at>=? ORDER BY created_at DESC LIMIT 1",
        config.connected_at,
      ).first(),
    );
  const items = z
    .array(z.object({ id: z.string() }))
    .parse(
      (
        await statement(
          db,
          "SELECT id FROM items WHERE enabled=1 ORDER BY id",
        ).all()
      ).results,
    );
  const coverage = z
    .object({ total: z.number(), complete: z.number().nullable() })
    .parse(
      await statement(
        db,
        "SELECT COUNT(*) AS total,SUM(CASE WHEN status IN ('available','empty') AND bootstrap_complete=1 THEN 1 ELSE 0 END) AS complete FROM coverage",
      ).first(),
    );
  return { config, latest, items, coverage };
}

export async function installationReadiness(env: Bindings) {
  const checks = {
    database: Boolean(env.DB),
    workflow: Boolean(env.FINANCE),
    oauth: Boolean(env.OAUTH_KV),
  };
  if (!checks.database) return { ...checks, migrations: false };
  const schema = await tryCatch(
    env.DB.batch([
      env.DB.prepare(
        "SELECT id,csrf,expires,auth_version FROM portal_sessions LIMIT 0",
      ),
      env.DB.prepare("SELECT id,attempts,expires FROM login_attempts LIMIT 0"),
      env.DB.prepare(
        "SELECT id,sync_enabled,next_sync_at,manual_sync_after,reconcile_after,client_id_hash,connected_at FROM settings LIMIT 0",
      ),
      env.DB.prepare("SELECT status,bootstrap_complete FROM coverage LIMIT 0"),
    ]),
  );
  return {
    ...checks,
    migrations: !schema.error && schema.data.every((result) => result.success),
  };
}

export function createAccountRepository(env: Bindings) {
  return {
    connection: connectionStore(env.DB),
    status: () => readPortalStatus(env.DB),
    authorizeItems: (ids: string[]) => authorizedItems(env.DB, ids),
    async pause() {
      await statement(
        env.DB,
        "UPDATE settings SET sync_enabled=0 WHERE id=1",
      ).run();
    },
    async resume(now: string) {
      await statement(
        env.DB,
        "UPDATE settings SET sync_enabled=1,next_sync_at=? WHERE id=1 AND sync_enabled=0",
        now,
      ).run();
    },
    async requestSync(now: Date) {
      const result = await statement(
        env.DB,
        "UPDATE settings SET next_sync_at=?,manual_sync_after=? WHERE id=1 AND sync_enabled=1 AND manual_sync_after<=? AND next_sync_at>?",
        now.toISOString(),
        new Date(now.getTime() + 900000).toISOString(),
        now.toISOString(),
        now.toISOString(),
      ).run();
      return result.meta.changes === 1;
    },
  };
}
