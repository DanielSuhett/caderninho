import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";

import { createSyncRepository } from "../../src/worker/sync/repository";
import { createSyncHistoryRepository } from "../../src/worker/sync/repository/history.repository";
import { setup } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);

test("initial schema bounds history/status and tied audit scans with complete stable pages", async () => {
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
  const results = await env.DB.batch(
    queries.map((query) => env.DB.prepare(query)),
  );
  for (const [i, result] of results.entries()) {
    assert.equal(result.results.length, i === 2 ? 50 : 26);
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

test("late classification pages use an index range instead of rescanning previous transactions", async () => {
  await env.DB.prepare(`WITH RECURSIVE records(i) AS (
    VALUES(0) UNION ALL SELECT i+1 FROM records WHERE i<9999
  ) INSERT INTO transactions(id,account_id,date,amount_minor,currency,direction,status,description)
    SELECT printf('t%05d',i),'a','2026-10-01','-100','BRL','DEBIT','POSTED','Synthetic' FROM records`).run();
  const before = await env.DB.prepare(
    "SELECT * FROM transactions WHERE account_id='a' AND (date>'2026-10-01' OR (date='2026-10-01' AND id>'t09950')) ORDER BY date,id LIMIT 25",
  ).all();
  const after = await env.DB.prepare(
    "SELECT * FROM transactions WHERE account_id='a' AND (date,id)>('2026-10-01','t09950') ORDER BY date,id LIMIT 25",
  ).all();
  assert.deepEqual(after.results, before.results);
  assert.ok(after.meta.rows_read <= 51);
  assert.ok(after.meta.rows_read < before.meta.rows_read);
  const rows = await createSyncRepository(env.DB).classificationPage("a", {
    date: "2026-10-01",
    id: "t09950",
  });
  assert.equal(rows.length, 25);
  assert.equal(rows[0]?.id, "t09951");
  assert.equal(rows.at(-1)?.id, "t09975");
});
