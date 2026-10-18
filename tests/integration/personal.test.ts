import assert from "node:assert/strict";

import { count } from "drizzle-orm";
import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import {
  AccountConnectTokenSchema,
  AccountResponseSchema,
} from "@/contracts/portal-contract";
import { sourceUrl } from "@/testing/helpers";
import { mockNetwork, syntheticJwt } from "@/testing/network";
import {
  accountService,
  financialQueries,
  scheduleSync,
} from "@/worker/composition";
import { database } from "@/worker/database";
import { invoke } from "@/worker/mcp/invoke";
import * as tables from "@/worker/schema";

import { command, cookies, fixture, login, settings } from "./personal-fixture";
import { applyD1Migrations, reset } from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";

const item = "11111111-1111-4111-8111-111111111111";
beforeEach(async () => {
  await reset();
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
});
afterEach(() => vi.unstubAllGlobals());
function source(connector = 200) {
  mockNetwork(async (input) => {
    const url = sourceUrl(input);
    if (url.pathname === "/auth") {
      return Response.json({ apiKey: syntheticJwt() });
    }
    if (url.pathname === "/connect_token") {
      return Response.json({ accessToken: "synthetic-widget-token" });
    }
    if (url.pathname === `/items/${item}`) {
      return Response.json({ id: item, connector: { id: connector } });
    }
    throw new Error("Unexpected synthetic request");
  });
}

test("deployment credentials connect Meu Pluggy; D1 stores settings without credentials", async () => {
  source();
  const config = settings();
  const service = accountService(config);
  assert.equal((await service.wizardState()).credentials, true);
  assert.equal((await service.wizardState()).connected, false);
  assert.equal((await service.token()).accessToken, "synthetic-widget-token");
  await service.connectItem(item);
  const state = await service.state();
  assert.equal(state.status.connected, true);
  assert.equal(state.status.sync, "waiting");
  assert.equal(state.panel.initialStep, 2);
  assert.equal(state.panel.sync, "preparing");
  assert.deepEqual(state.panel.polling, {
    intervalMs: 5000,
    retryIntervalMs: 30000,
  });
  const stored = await database(bindings.DB)
    .select()
    .from(tables.settings)
    .get()
    .then((row) => row ?? null);
  assert.ok(!JSON.stringify(stored).includes("synthetic-secret"));
  assert.ok(!JSON.stringify(stored).includes("synthetic-client"));
  const bad = { ...config, PLUGGY_CLIENT_ID: "different-application" };
  assert.equal(
    (await accountService(bad).token()).accessToken,
    "synthetic-widget-token",
  );
  assert.equal((await financialQueries(bad).readStatus()).items.length, 1);
});

test("upstream validation rejects a wrong Item and direct bank connector before anything is saved", async () => {
  mockNetwork(async (input) => {
    if (sourceUrl(input).pathname === "/auth") {
      return Response.json({ apiKey: syntheticJwt() });
    }
    return Response.json({ id: "different-item", connector: { id: 200 } });
  });
  await assert.rejects(
    accountService(settings()).connectItem(item),
    /SOURCE_IDENTITY_MISMATCH/,
  );
  source(1);
  const config = settings();
  await assert.rejects(
    accountService(config).connectItem(item),
    /MEU_PLUGGY_REQUIRED/,
  );
  assert.equal(
    await database(bindings.DB)
      .select({ n: count() })
      .from(tables.items)
      .get()
      .then((row) => row?.n ?? null),
    0,
  );
  source();
  await accountService(config).connectItem(item);
  assert.equal(
    (await accountService(config).token("99999999-9999-4999-8999-999999999999"))
      .accessToken,
    "synthetic-widget-token",
  );
});

test("pause and manual sync preserve settings; daily scheduling creates one durable operation", async () => {
  source();
  const config = settings();
  const service = accountService(config);
  await service.connectItem(item);
  await service.pause();
  assert.equal((await service.wizardState()).paused, true);
  await scheduleSync(config, new Date("2099-01-01T00:00:00Z"));
  assert.equal(
    await database(bindings.DB)
      .select({ n: count() })
      .from(tables.operations)
      .get()
      .then((row) => row?.n ?? null),
    0,
  );
  await service.resume();
  await database(bindings.DB)
    .update(tables.settings)
    .set({ next_sync_at: "2099-01-01T00:00:00Z" });
  assert.equal(await service.requestSync(), true);
  assert.equal(await service.requestSync(), false);
  await scheduleSync(config, new Date("2099-01-01T00:00:00Z"));
  await scheduleSync(config, new Date("2099-01-01T00:00:00Z"));
  assert.equal(
    await database(bindings.DB)
      .select({ n: count() })
      .from(tables.operations)
      .get()
      .then((row) => row?.n ?? null),
    1,
  );
  assert.equal(
    await database(bindings.DB)
      .select({ dispatched: tables.operations.dispatched })
      .from(tables.operations)
      .get()
      .then((row) => row?.dispatched ?? null),
    1,
  );
});

test("named account commands connect an Item and never return deployment secrets", async () => {
  source();
  const app = fixture();
  const cookie = cookies(await login(app));
  assert.equal(
    (await command(app, cookie, "items", { itemId: item })).status,
    200,
  );
  const token = await command(app, cookie, "connect-token", { itemId: item });
  assert.equal(token.status, 200);
  const tokenBody = AccountConnectTokenSchema.parse(await token.json());
  assert.equal(tokenBody.accessToken, "synthetic-widget-token");
  assert.deepEqual(tokenBody.configuration, {
    connectorIds: [200],
    selectedConnectorId: 200,
    includeSandbox: false,
  });
  assert.ok(!JSON.stringify(tokenBody).includes("synthetic-secret"));
  assert.equal((await command(app, cookie, "pause")).status, 200);
  const paused = AccountResponseSchema.parse(
    await (
      await app.request("/api/account", { headers: { Cookie: cookie } })
    ).json(),
  );
  assert.equal(paused.panel.polling, null);
  assert.equal(paused.panel.sync, "paused");
  const diagnostic = JSON.stringify(paused.panel.support.diagnostic);
  assert.ok(!diagnostic.includes(item));
  assert.ok(!diagnostic.includes(paused.csrf));
  assert.equal((await command(app, cookie, "resume")).status, 200);
  const missing = settings();
  delete missing.PLUGGY_CLIENT_SECRET;
  assert.equal(
    (await accountService(missing).wizardState()).credentials,
    false,
  );
  assert.equal((await financialQueries(missing).readStatus()).items.length, 1);
  await assert.rejects(
    accountService(missing).token(),
    /PLUGGY_ACCOUNT_NOT_CONFIGURED/,
  );
});

test("live balance reads the owner's account directly with renewed installation secrets", async () => {
  const config = settings();
  const accountId = "22222222-2222-4222-8222-222222222222";
  let requests = 0;
  config.PLUGGY_CLIENT_SECRET = "renewed-synthetic-secret";
  mockNetwork(async (input, init) => {
    requests++;
    const url = sourceUrl(input);
    if (url.pathname === "/auth") {
      const body = z
        .object({ clientSecret: z.string() })
        .parse(JSON.parse(z.string().parse(init?.body)));
      assert.equal(body.clientSecret, "renewed-synthetic-secret");
      return Response.json({ apiKey: syntheticJwt() });
    }
    assert.equal(url.pathname, `/accounts/${accountId}`);
    return new Response(
      '{"id":"' +
        accountId +
        '","balance":9007199254740993.29,"currencyCode":"BRL"}',
    );
  });
  const queries = financialQueries(config);
  await accountService(config).pause();
  const result = await invoke(queries, "caderninho_live_balance", {
    accountId,
  });
  const balance = z
    .object({
      balance: z.string(),
      currency: z.string(),
      sourceUpdatedAt: z.null(),
      readAt: z.iso.datetime(),
      bankRealtime: z.literal(false),
    })
    .parse(result);
  assert.equal(balance.balance, "9007199254740993.29");
  assert.equal(balance.currency, "BRL");
  assert.equal(requests, 2);
});
