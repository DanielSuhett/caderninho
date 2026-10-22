import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";

import {
  SyncHistoryResultSchema,
  TransactionListSchema,
  WorkspaceCatalogSchema,
} from "../../src/contracts";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { createSyncHistoryRepository } from "../../src/worker/sync/repository/history.repository";
import {
  command,
  cookies,
  fixture,
  login,
  testMigrations,
} from "./access-fixture";
import { account, collect, setup, source, transaction } from "./fixture";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env } from "cloudflare:workers";

beforeEach(setup);

test("run history survives later imports, preserves admission ownership and paginates without duplicate retries", async () => {
  const history = createSyncHistoryRepository(env.DB);
  const original = await collect(source([transaction()]));
  const repeated = await createSyncRepository(env.DB).admit(
    ["c"],
    "2026-10-01T01:00:00Z",
  );
  assert.equal(repeated[0]?.status, "cooldown");
  await env.DB.prepare("INSERT INTO people VALUES('ana','Ana')").run();
  await env.DB.prepare(
    "UPDATE connection_owners SET person_id='ana' WHERE connection_id='c'",
  ).run();
  const newer = await collect(
    source([transaction({ amount: "-25.00" })]),
    "2026-10-02T00:00:00Z",
  );
  const first = SyncHistoryResultSchema.parse(
    await history.query({ limit: 1 }),
  );
  assert.equal(first.records[0]?.id, newer);
  assert.equal(first.records[0]?.personId, "ana");
  assert.equal(first.records[0]?.status, "succeeded");
  assert.ok(first.records[0]?.finishedAt);
  assert.ok(first.cursor);
  const second = await history.query({ cursor: first.cursor, limit: 1 });
  assert.equal(second.records[0]?.id, original);
  assert.equal(second.records[0]?.personId, "self");
  assert.equal(second.cursor, null);
  assert.equal((await history.query({ limit: 25 })).records.length, 2);
  assert.equal(
    (await history.query({ limit: 25, personId: "self" })).records.length,
    1,
  );
  assert.equal(
    (await history.query({ limit: 25, status: "failed" })).records.length,
    0,
  );
  await assert.rejects(history.query({ cursor: '{"id":"bad"}', limit: 1 }));
});

test("durable failures record the committed checkpoint and atomic publication guards do not add history rows", async () => {
  const history = createSyncHistoryRepository(env.DB);
  await assert.rejects(collect(source([transaction({ amount: "bad" })])));
  const page = await history.query({ limit: 25, status: "failed" });
  assert.equal(page.records.length, 1);
  assert.equal(page.records[0]?.status, "failed");
  assert.equal(page.records[0]?.phase, "transactions");
  assert.equal(page.records[0]?.sequence, 1);
  assert.ok(page.records[0]?.error);
  const repo = createSyncRepository(env.DB);
  const run = await repo.read(page.records[0]?.id ?? "missing");
  await assert.rejects(
    repo.publish({
      done: true,
      next: run.checkpoint,
      now: "2026-10-01T00:00:00Z",
      run,
    }),
  );
  assert.deepEqual((await history.query({ limit: 25 })).records, page.records);
});

test("migration recovers only the latest legacy run without inventing an end time", async () => {
  await reset();
  await applyD1Migrations(env.DB, testMigrations.slice(0, 3));
  await createInstallationRepository(env.DB).register("c");
  await env.DB.prepare(
    "UPDATE connections SET import_id='old-run',import_status='failed',import_admitted_at='2026-10-01T00:00:00.000Z',import_error='INVALID_RESPONSE' WHERE id='c'",
  ).run();
  await applyD1Migrations(env.DB, testMigrations.slice(3));
  const page = await createSyncHistoryRepository(env.DB).query({ limit: 25 });
  assert.equal(page.records.length, 1);
  assert.equal(page.records[0]?.legacy, true);
  assert.equal(page.records[0]?.finishedAt, null);
});

test("workspace routes require session, query CSRF and an explicit read-only tool allowlist", async () => {
  const app = fixture();
  const responses = await Promise.all(
    ["/api/account/catalog", "/api/account/history"].map((path) =>
      app.request(path),
    ),
  );
  assert.deepEqual(
    responses.map((response) => response.status),
    [401, 401],
  );
  assert.equal((await app.request("/account/transactions")).status, 302);
  const cookie = cookies(await login(app));
  const page = await app.request("/account/rules", {
    headers: { Cookie: cookie },
  });
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes("account-root"));
  const catalog = await app.request("/api/account/catalog", {
    headers: { Cookie: cookie },
  });
  assert.equal(catalog.headers.get("Cache-Control"), "no-store");
  assert.equal(
    WorkspaceCatalogSchema.parse(await catalog.json()).spaces[0]?.id,
    "personal",
  );
  const rejected = await command(app, cookie, "query", {
    query: { name: "Bad", spaceId: "personal", tool: "create_rule" },
  });
  assert.equal(rejected.status, 400);
  const csrf = await command(app, cookie, "query", {
    csrf: "wrong",
    query: { tool: "get_transactions" },
  });
  assert.equal(csrf.status, 403);
});

test("transaction page reads exact effective amounts, person filters and date order across page boundaries", async () => {
  await collect(
    source(
      Array.from({ length: 65 }, (_, i) =>
        transaction({
          amount: "-9007199254740993.01",
          date: `2026-10-${String(1 + (i % 20)).padStart(2, "0")}`,
          id: `t-${String(i).padStart(3, "0")}`,
        }),
      ),
      [account()],
    ),
  );
  const app = fixture();
  const cookie = cookies(await login(app));
  const query = {
    limit: 50,
    order: "date_desc",
    personId: "self",
    spaceId: "personal",
    tool: "get_transactions",
  };
  const first = TransactionListSchema.parse(
    await (await command(app, cookie, "query", { query })).json(),
  );
  assert.equal(first.data.records.length, 50);
  assert.equal(first.data.records[0]?.date, "2026-10-20");
  assert.equal(first.data.records[0]?.amountMinor, "-900719925474099301");
  assert.ok(first.data.cursor);
  const second = TransactionListSchema.parse(
    await (
      await command(app, cookie, "query", {
        query: { ...query, cursor: first.data.cursor },
      })
    ).json(),
  );
  assert.equal(second.data.records.length, 15);
  const rows = [...first.data.records, ...second.data.records];
  assert.equal(new Set(rows.map((r) => r.id)).size, 65);
  assert.deepEqual(
    rows.map((r) => `${r.date}:${r.id}`),
    rows
      .map((r) => `${r.date}:${r.id}`)
      .sort()
      .reverse(),
  );
});
