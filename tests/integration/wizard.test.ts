import assert from "node:assert/strict";

import { applyD1Migrations, reset } from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";
import { beforeEach, afterEach, test, vi } from "vitest";
import { z } from "zod/v4";

import { AccountResponseSchema } from "#contracts/portal-contract.ts";
import { sourceUrl } from "#testing/helpers.ts";
import { mockNetwork, syntheticJwt } from "#testing/network.ts";
import { syncPresentation, supportPrompt } from "#web/account/account-model.ts";
import {
  installationChecks,
  installationReadiness,
} from "#worker/account/repository.ts";
import { portalRoutes } from "#worker/auth/controller.ts";
import { isOwner } from "#worker/auth/service.ts";
import type { Bindings } from "#worker/bindings.ts";
import { accountService, financialQueries } from "#worker/composition.ts";
import { hash, statement } from "#worker/database.ts";
import { invoke } from "#worker/mcp/invoke.ts";
import { startOperation } from "#worker/sync/repository.ts";

const principal = "github:123",
  other = "github:456";
const item = "00000000-0000-4000-8000-000000000001";
const credentials = {
  clientId: "synthetic-id",
  clientSecret: "synthetic-secret",
};
const key = btoa("01234567890123456789012345678901");
// Synthetic bindings for D1 tests. Authentication is represented by a real session row, never a user-authored identity header.
const env = () =>
  ({
    DB: bindings.DB,
    OWNER_GITHUB_ID: "123",
    PUBLIC_ORIGIN: "https://caderninho.test",
    CREDENTIAL_KEY: key,
  }) as Bindings;
beforeEach(async () => {
  await reset();
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
  await bindings.DB.exec(
    "INSERT INTO principals(id) VALUES('github:123'),('github:456')",
  );
  requests.length = 0;
  provider();
});
afterEach(() => vi.unstubAllGlobals());
const requests: { url: string; body: string }[] = [];
function provider(connectorId = 200) {
  mockNetwork(async (input, init) => {
    const url = sourceUrl(input).href;
    requests.push({ url, body: z.string().optional().parse(init?.body) ?? "" });
    if (url.endsWith("/auth")) return Response.json({ apiKey: syntheticJwt() });
    if (url.endsWith("/connect_token"))
      return Response.json({ accessToken: "synthetic-widget-token" });
    if (url.endsWith("/items/" + item))
      return Response.json({
        id: item,
        connector: { id: connectorId },
        status: "UPDATED",
      });
    throw new Error("Unexpected upstream");
  });
}
async function session(owner = principal) {
  const id = crypto.randomUUID();
  await statement(
    bindings.DB,
    "INSERT INTO portal_sessions(id,principal,csrf,expires) VALUES(?,?,?,?)",
    await hash(id),
    owner,
    "synthetic-csrf",
    Date.now() + 60000,
  ).run();
  return "__Host-caderninho=" + id;
}
async function post(
  action: string,
  fields: Record<string, string>,
  cookie: string,
  origin = "https://caderninho.test",
) {
  return portalRoutes().request(
    "https://caderninho.test/account/wizard/" + action,
    {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrf: "synthetic-csrf", ...fields }),
    },
    env(),
  );
}

test("installation is private and missing owner configuration fails closed", () => {
  assert.equal(isOwner(env(), principal), true);
  assert.equal(isOwner(env(), other), false);
  const withoutOwner = { ...env() };
  delete withoutOwner.OWNER_GITHUB_ID;
  assert.equal(isOwner(withoutOwner, principal), false);
  assert.equal(installationChecks(env(), "https://other.test").origin, false);
});
test("installation checks real schema readiness without returning private rows", async () => {
  assert.equal(
    (await installationReadiness(env(), env().PUBLIC_ORIGIN)).migrations,
    true,
  );
  // Isolated synthetic database only: simulate an incomplete installation.
  await bindings.DB.exec("DROP TABLE portal_logins");
  assert.equal(
    (await installationReadiness(env(), env().PUBLIC_ORIGIN)).migrations,
    false,
  );
});

test("wizard never reports an earlier import as confirmation of a changed connection", async () => {
  await accountService(env(), principal).saveCredentials(credentials);
  await accountService(env(), principal).connectItem(item);
  const operation = await startOperation(
    bindings.DB,
    principal,
    "wizard-progress",
    {
      kind: "sync",
      itemIds: [item],
    },
  );
  assert.equal(
    (await accountService(env(), principal).wizardState()).sync,
    "working",
  );
  await statement(
    bindings.DB,
    "UPDATE operations SET status='cancelled' WHERE id=?",
    operation.id,
  ).run();
  const cancelled = await accountService(env(), principal).wizardState();
  assert.equal(cancelled.sync, "cancelled");
  assert.equal(syncPresentation(cancelled).title, "Importação cancelada");
  await statement(
    bindings.DB,
    "UPDATE operations SET status='completed' WHERE id=?",
    operation.id,
  ).run();
  assert.equal(
    (await accountService(env(), principal).wizardState()).sync,
    "completed",
  );
  await statement(
    bindings.DB,
    "UPDATE pluggy_credentials SET updated_at='2099-01-01T00:00:00.000Z' WHERE principal=?",
    principal,
  ).run();
  assert.equal(
    (await accountService(env(), principal).wizardState()).sync,
    "waiting",
  );
  await statement(
    bindings.DB,
    "UPDATE pluggy_credentials SET enabled=0 WHERE principal=?",
    principal,
  ).run();
  assert.equal(
    syncPresentation(await accountService(env(), principal).wizardState())
      .title,
    "Próximas sincronizações pausadas",
  );
});

test("credentials are validated and encrypted before wizard advances, without starting a sync", async () => {
  await accountService(env(), principal).saveCredentials(credentials);
  const row = await statement(
    bindings.DB,
    "SELECT envelope,enabled FROM pluggy_credentials WHERE principal=?",
    principal,
  ).first();
  assert.ok(
    row &&
      typeof row.envelope === "string" &&
      !row.envelope.includes(credentials.clientSecret),
  );
  assert.equal(row?.enabled, 0);
  assert.equal(
    await statement(bindings.DB, "SELECT COUNT(*) AS n FROM operations").first(
      "n",
    ),
    0,
  );
  assert.ok(
    requests.some(
      (r) =>
        r.url.endsWith("/connect_token") &&
        r.body.includes('"avoidDuplicates":true'),
    ),
  );
  const unavailable: typeof fetch = async () =>
    Response.json(
      { message: "provider response must remain private" },
      { status: 401 },
    );
  mockNetwork(unavailable);
  await assert.rejects(
    accountService(env(), other).saveCredentials(credentials),
  );
  assert.equal(
    await statement(
      bindings.DB,
      "SELECT envelope FROM pluggy_credentials WHERE principal=?",
      other,
    ).first("envelope"),
    null,
  );
});

test("widget result is revalidated server-side and only accepts Meu Pluggy", async () => {
  await accountService(env(), principal).saveCredentials(credentials);
  provider(601);
  await assert.rejects(
    accountService(env(), principal).connectItem(item),
    /MEU_PLUGGY_REQUIRED/,
  );
  assert.equal(
    await statement(bindings.DB, "SELECT COUNT(*) AS n FROM items").first("n"),
    0,
  );
  provider();
  requests.length = 0;
  await accountService(env(), principal).connectItem(item);
  assert.equal(
    requests.filter((r) => r.url.endsWith("/items/" + item)).length,
    1,
  );
  assert.equal(requests.filter((r) => r.url.endsWith("/auth")).length, 1);
  await accountService(env(), principal).connectItem(item);
  assert.equal(
    await statement(bindings.DB, "SELECT COUNT(*) AS n FROM items").first("n"),
    1,
  );
  const state = await accountService(env(), principal).wizardState();
  assert.equal(state.connected, true);
  assert.equal(state.sync, "waiting");
});

test("wizard HTTP flow returns only scoped connect token and persists callback, with CSRF checks", async () => {
  const cookie = await session();
  const saved = await post(
    "credentials",
    { ...credentials, consent: "yes" },
    cookie,
  );
  assert.equal(saved.status, 200);
  const tokenResponse = await post("token", {}, cookie);
  const tokenText = await tokenResponse.text();
  assert.ok(tokenText.includes("synthetic-widget-token"));
  for (const secret of [
    credentials.clientSecret,
    credentials.clientId,
    syntheticJwt(),
    key,
  ])
    assert.ok(!tokenText.includes(secret));
  assert.equal(tokenResponse.headers.get("Cache-Control"), "no-store");
  assert.equal(
    (await post("token", {}, cookie, "https://evil.test")).status,
    403,
  );
  assert.equal((await post("token", { csrf: "invalid" }, cookie)).status, 403);
  assert.equal((await post("item", { itemId: item }, cookie)).status, 200);
  assert.equal((await post("token", {}, await session(other))).status, 302);
});

test("reconnect token cannot target an unregistered Item", async () => {
  await accountService(env(), principal).saveCredentials(credentials);
  const cookie = await session();
  const denied = await post("token", { itemId: item }, cookie);
  assert.equal(denied.status, 400);
  await accountService(env(), principal).connectItem(item);
  requests.length = 0;
  assert.equal((await post("token", { itemId: item }, cookie)).status, 200);
  assert.ok(
    requests.some(
      (r) => r.url.endsWith("/connect_token") && r.body.includes(item),
    ),
  );
});

test("wizard resumes at saved step and never reprints secrets", async () => {
  await accountService(env(), principal).saveCredentials(credentials);
  const response = await portalRoutes().request(
    "https://caderninho.test/api/account",
    { headers: { Cookie: await session() } },
    env(),
  );
  const text = await response.text();
  assert.equal(response.status, 200);
  const body = AccountResponseSchema.parse(JSON.parse(text));
  assert.equal(body.data.status.wizard.credentials, true);
  for (const secret of [credentials.clientSecret, credentials.clientId, key])
    assert.ok(!text.includes(secret));
  assert.equal(body.data.status.wizard.connected, false);
  assert.ok(!text.includes('name="clientSecret"'));
});

test("AI diagnostic tool exposes only setup state, never IDs or raw financial data", async () => {
  await accountService(env(), principal).saveCredentials(credentials);
  await accountService(env(), principal).connectItem(item);
  const state = await accountService(env(), principal).wizardState();
  const tool = JSON.stringify(
    await invoke(
      financialQueries(env(), principal),
      "caderninho_setup_status",
      {},
    ),
  );
  const prompt = supportPrompt(state, "credentials");
  for (const secret of [
    principal,
    item,
    credentials.clientId,
    credentials.clientSecret,
    key,
  ]) {
    assert.ok(!tool.includes(secret));
    assert.ok(!prompt.includes(secret));
  }
  assert.ok(prompt.includes("Não peça senhas"));
});

test("invalid credentials show an actionable code without reflecting provider payload", async () => {
  mockNetwork(async () =>
    Response.json(
      { message: "synthetic-secret internal detail" },
      { status: 401 },
    ),
  );
  const response = await post(
    "credentials",
    { ...credentials, consent: "yes" },
    await session(),
  );
  assert.equal(response.status, 400);
  assert.equal(await response.text(), '{"issue":"credentials"}');
});
