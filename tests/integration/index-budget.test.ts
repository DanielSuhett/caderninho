import assert from "node:assert/strict";

import { test } from "vitest";
import { z } from "zod/v4";

import { createSyncHistoryRepository } from "../../src/worker/sync/repository/history.repository";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";

const migrations = z
  .object({
    TEST_MIGRATIONS: z.array(
      z.object({ name: z.string(), queries: z.array(z.string()) }),
    ),
  })
  .parse(env).TEST_MIGRATIONS;

test("query indexes upgrade populated databases and bound history/status and tied audit scans", async () => {
  await reset();
  await applyD1Migrations(env.DB, migrations.slice(0, -1));
  await env.DB.prepare(`WITH RECURSIVE records(i) AS (
    VALUES(0) UNION ALL SELECT i+1 FROM records WHERE i<9999
  ) INSERT INTO sync_history(id,connection_id,person_id,profile_id,admitted_at,status,sequence)
    SELECT printf('run%05d',i),'c',CASE WHEN i%2=0 THEN 'self' ELSE 'other' END,
      'default','2026-10-22T00:00:00Z',CASE WHEN i%97=0 THEN 'failed' ELSE 'succeeded' END,1 FROM records`).run();
  await env.DB.prepare(`WITH RECURSIVE records(i) AS (
    VALUES(0) UNION ALL SELECT i+1 FROM records WHERE i<9999
  ) INSERT INTO mcp_audit(id,started_at,outcome,status,input_bytes,output_bytes,duration_ms)
    SELECT printf('audit%05d',i),'2026-10-22T00:00:00Z','success',200,1,1,1 FROM records`).run();
  const history =
    "SELECT * FROM sync_history WHERE status='failed' AND (admitted_at,id)<('2026-10-22T00:00:00Z','run09990') ORDER BY admitted_at DESC,id DESC LIMIT 26";
  const personal =
    "SELECT * FROM sync_history WHERE person_id='self' AND status='failed' AND (admitted_at,id)<('2026-10-22T00:00:00Z','run09990') ORDER BY admitted_at DESC,id DESC LIMIT 26";
  const audit =
    "SELECT * FROM mcp_audit WHERE started_at>='2026-10-01' ORDER BY started_at DESC,id DESC LIMIT 50";
  const queries = [history, personal, audit];
  const before = await env.DB.batch(
    queries.map((query) => env.DB.prepare(query)),
  );
  await applyD1Migrations(env.DB, migrations.slice(-1));
  const after = await env.DB.batch(
    queries.map((query) => env.DB.prepare(query)),
  );
  for (const [i, result] of after.entries()) {
    const prior = before[i];
    assert.ok(prior);
    assert.deepEqual(result.results, prior.results);
    assert.ok(result.meta.rows_read < prior.meta.rows_read);
    assert.ok(result.meta.rows_read <= (i === 1 ? 110 : 51));
  }
  const repository = createSyncHistoryRepository(env.DB);
  const first = await repository.query({ limit: 25 });
  assert.ok(first.cursor);
  const next = await repository.query({ cursor: first.cursor, limit: 25 });
  assert.equal(first.records[0]?.id, "run09999");
  assert.equal(next.records[0]?.id, "run09974");
  assert.equal(
    new Set([...first.records, ...next.records].map((row) => row.id)).size,
    50,
  );
  assert.equal(
    await env.DB.prepare("SELECT count(*) AS n FROM sync_history").first("n"),
    10_000,
  );
  assert.equal(
    await env.DB.prepare("SELECT count(*) AS n FROM mcp_audit").first("n"),
    10_000,
  );
});
