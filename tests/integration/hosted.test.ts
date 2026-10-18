import assert from "node:assert/strict";

import { applyD1Migrations, reset } from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";
import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import { AccountResponseSchema } from "#contracts/portal-contract.ts";
import type { Connection } from "#contracts/wizard-contract.ts";
import { sourceUrl } from "#testing/helpers.ts";
import { mockNetwork, syntheticJwt } from "#testing/network.ts";
import { connectionStore } from "#worker/account/repository.ts";
import { connectWizardItem as connect } from "#worker/account/service.ts";
import { portalRoutes } from "#worker/auth/controller.ts";
import type { Bindings } from "#worker/bindings.ts";
import { scheduleSync, financialQueries } from "#worker/composition.ts";
import { hash, statement } from "#worker/database.ts";
import {
  sealCredentials,
  openCredentials,
  providerFor,
  credentialsFor,
} from "#worker/pluggy/credentials.ts";
import { connectionSource } from "#worker/pluggy/source.ts";

function connectAccount(
  env: Bindings,
  principal: string,
  input: Connection,
  fetcher: typeof fetch,
) {
  mockNetwork(fetcher);
  return connect(
    connectionStore(env, principal),
    connectionSource,
    input,
    input.itemId,
    new Date().toISOString(),
  );
}

const key = btoa("01234567890123456789012345678901");
const item = "00000000-0000-4000-8000-000000000001";
const credentials = {
  clientId: "synthetic-client",
  clientSecret: "synthetic-secret",
};
// Synthetic environment boundary; production OAuth is never replaced by an identity header here.
const env = () =>
  ({
    DB: bindings.DB,
    CREDENTIAL_KEY: key,
    OWNER_GITHUB_ID: "123",
    PUBLIC_ORIGIN: "https://caderninho.test",
    FINANCE: {
      async create({ id }: { id: string }) {
        return { id };
      },
    },
  }) as Bindings;
const source: typeof fetch = async (input) => {
  const url = sourceUrl(input).href;
  if (url.endsWith("/auth")) return Response.json({ apiKey: syntheticJwt() });
  if (url.endsWith("/items/" + item))
    return Response.json({
      id: item,
      status: "UPDATED",
      connector: { id: 200 },
    });
  throw new Error("Unexpected network request");
};
afterEach(() => vi.unstubAllGlobals());
beforeEach(async () => {
  await reset();
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
  await bindings.DB.exec(
    "INSERT INTO principals(id) VALUES('github:123'),('github:456')",
  );
});

test("vault binds ciphertext to principal, key and integrity; IV changes each time", async () => {
  const first = await sealCredentials(key, "github:123", credentials);
  assert.deepEqual(
    await openCredentials(key, "github:123", first),
    credentials,
  );
  assert.notEqual(first, await sealCredentials(key, "github:123", credentials));
  assert.ok(!first.includes(credentials.clientSecret));
  await assert.rejects(openCredentials(key, "github:456", first));
  await assert.rejects(
    openCredentials(
      btoa("11234567890123456789012345678901"),
      "github:123",
      first,
    ),
  );
  await assert.rejects(sealCredentials(undefined, "github:123", credentials));
  await assert.rejects(providerFor(env(), "github:456"), /NOT_CONFIGURED/);
});

test("onboarding is scoped, atomic and does not transfer an Item between people", async () => {
  await connectAccount(
    env(),
    "github:123",
    { ...credentials, itemId: item },
    source,
  );
  await assert.rejects(
    connectAccount(
      env(),
      "github:456",
      { ...credentials, itemId: item },
      source,
    ),
  );
  assert.equal(
    await statement(
      bindings.DB,
      "SELECT envelope FROM pluggy_credentials WHERE principal='github:456'",
    ).first("envelope"),
    null,
  );
  assert.equal(
    await statement(
      bindings.DB,
      "SELECT principal FROM items WHERE id=?",
      item,
    ).first("principal"),
    "github:123",
  );
  await assert.rejects(
    connectAccount(
      env(),
      "github:123",
      { ...credentials, clientId: "different", itemId: item },
      source,
    ),
    /MIGRATION/,
  );
  const failedSource: typeof fetch = async () =>
    Response.json({
      apiKey: syntheticJwt(),
      id: "wrong-item",
      connector: { id: 200 },
    });
  await assert.rejects(
    connectAccount(
      env(),
      "github:456",
      { ...credentials, itemId: item },
      failedSource,
    ),
    /SOURCE_SCOPE_MISMATCH/,
  );
});

test("daily scheduler coalesces ticks and pauses without removing finance history", async () => {
  await connectAccount(
    env(),
    "github:123",
    { ...credentials, itemId: item },
    source,
  );
  const now = new Date(Date.now() + 1000);
  await scheduleSync(env(), now);
  await scheduleSync(env(), now);
  assert.equal(
    await statement(
      bindings.DB,
      "SELECT count(*) AS n FROM operations WHERE principal='github:123'",
    ).first("n"),
    1,
  );
  await statement(
    bindings.DB,
    "UPDATE pluggy_credentials SET enabled=0,next_sync_at='2000-01-01' WHERE principal='github:123'",
  ).run();
  await scheduleSync(env(), new Date(now.getTime() + 86400000));
  assert.equal(
    await statement(bindings.DB, "SELECT count(*) AS n FROM operations").first(
      "n",
    ),
    1,
  );
  assert.equal(
    await statement(bindings.DB, "SELECT count(*) AS n FROM items").first("n"),
    1,
  );
});

async function session(principal = "github:123") {
  const id = crypto.randomUUID();
  await statement(
    bindings.DB,
    "INSERT INTO portal_sessions(id,principal,csrf,expires) VALUES(?,?,?,?)",
    await hash(id),
    principal,
    "synthetic-csrf",
    Date.now() + 60000,
  ).run();
  return "__Host-caderninho=" + id;
}
async function accountAction(
  action: string,
  settings: Bindings,
  csrf = "synthetic-csrf",
  principal = "github:123",
) {
  return portalRoutes().request(
    "https://caderninho.test/account/" + action,
    {
      method: "POST",
      headers: {
        Cookie: await session(principal),
        Origin: "https://caderninho.test",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrf }),
    },
    settings,
  );
}
test("owner resumes a paused agenda without re-entering Pluggy keys", async () => {
  await connectAccount(
    env(),
    "github:123",
    { ...credentials, itemId: item },
    source,
  );
  assert.equal((await accountAction("pause", env())).status, 303);
  assert.equal((await accountAction("resume", env(), "forged")).status, 403);
  assert.equal(
    (await accountAction("resume", env())).headers.get("location"),
    "/account?notice=resumed",
  );
  await scheduleSync(env(), new Date(Date.now() + 1000));
  assert.equal(
    await statement(bindings.DB, "SELECT count(*) AS n FROM operations").first(
      "n",
    ),
    1,
  );
});
test("vault rotation preserves access during transition and retires the old key without changing history", async () => {
  await connectAccount(
    env(),
    "github:123",
    { ...credentials, itemId: item },
    source,
  );
  const next = btoa("11234567890123456789012345678901");
  const rotating = {
    ...env(),
    CREDENTIAL_KEY: next,
    CREDENTIAL_PREVIOUS_KEY: key,
  };
  assert.deepEqual(await credentialsFor(rotating, "github:123"), credentials);
  assert.equal(
    (await accountAction("rotate-key", rotating, "forged")).status,
    403,
  );
  assert.equal(
    (
      await accountAction(
        "rotate-key",
        rotating,
        "synthetic-csrf",
        "github:456",
      )
    ).status,
    302,
  );
  assert.equal(
    (
      await accountAction("rotate-key", {
        ...rotating,
        CREDENTIAL_PREVIOUS_KEY: next,
      })
    ).status,
    400,
  );
  assert.deepEqual(await credentialsFor(env(), "github:123"), credentials);
  const before = await statement(
    bindings.DB,
    "SELECT enabled,updated_at,next_sync_at FROM pluggy_credentials",
  ).first();
  assert.equal(
    (await accountAction("rotate-key", rotating)).headers.get("location"),
    "/account?notice=rotated",
  );
  const currentKeyOnly: Bindings = { ...rotating };
  delete currentKeyOnly.CREDENTIAL_PREVIOUS_KEY;
  assert.deepEqual(
    await credentialsFor(currentKeyOnly, "github:123"),
    credentials,
  );
  await assert.rejects(credentialsFor(env(), "github:123"));
  assert.equal((await accountAction("rotate-key", rotating)).status, 303);
  assert.deepEqual(
    await statement(
      bindings.DB,
      "SELECT enabled,updated_at,next_sync_at FROM pluggy_credentials",
    ).first(),
    before,
  );
  assert.equal(
    await statement(bindings.DB, "SELECT count(*) AS n FROM items").first("n"),
    1,
  );
  // A new secret saved while both keys are installed remains readable with just the new key.
  await connectAccount(
    rotating,
    "github:123",
    { ...credentials, clientSecret: "renewed-synthetic-secret", itemId: item },
    source,
  );
  assert.equal(
    (await credentialsFor(currentKeyOnly, "github:123")).clientSecret,
    "renewed-synthetic-secret",
  );
});
test("portal rejects forged identity, cross-origin requests and invalid CSRF; logout revokes", async () => {
  const app = portalRoutes();
  const anonymous = await app.request(
    "https://caderninho.test/account",
    { headers: { Authorization: "Bearer forged" } },
    env(),
  );
  assert.equal(anonymous.status, 302);
  const cookie = await session();
  const post = (origin: string, csrf: string, action = "pause") =>
    app.request(
      "https://caderninho.test/account/" + action,
      {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: origin,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ csrf }),
      },
      env(),
    );
  assert.equal((await post("https://evil.test", "synthetic-csrf")).status, 403);
  assert.equal((await post("https://caderninho.test", "invalid")).status, 403);
  assert.equal(
    (await post("https://caderninho.test", "synthetic-csrf", "logout")).status,
    303,
  );
  assert.equal(
    (
      await app.request(
        "https://caderninho.test/account",
        { headers: { Cookie: cookie } },
        env(),
      )
    ).status,
    302,
  );
});

test("portal renders only owner's Items and never renders stored credentials", async () => {
  await connectAccount(
    env(),
    "github:123",
    { ...credentials, itemId: item },
    source,
  );
  const app = portalRoutes();
  const alice = await app.request(
    "https://caderninho.test/api/account",
    { headers: { Cookie: await session() } },
    env(),
  );
  const text = await alice.text();
  assert.equal(alice.status, 200);
  assert.ok(text.includes(item));
  assert.ok(!text.includes(credentials.clientSecret));
  assert.ok(!text.includes(credentials.clientId));
  assert.equal(alice.headers.get("Cache-Control"), "no-store");
  const bob = await app.request(
    "https://caderninho.test/api/account",
    { headers: { Cookie: await session("github:456") } },
    env(),
  );
  assert.equal(bob.status, 401);
  assert.ok(!(await bob.text()).includes(item));
});

test("OAuth callback rejects state without browser binding", async () => {
  const app = portalRoutes();
  const id = "portal.synthetic",
    browser = "synthetic-browser";
  await statement(
    bindings.DB,
    "INSERT INTO portal_logins VALUES(?,?,?,?)",
    await hash(id),
    await hash(browser),
    "verifier",
    Date.now() + 60000,
  ).run();
  const invalid = await app.request(
    "https://caderninho.test/callback?state=" + id,
    {},
    env(),
  );
  assert.equal(invalid.status, 400);
  assert.equal(
    await statement(
      bindings.DB,
      "SELECT count(*) AS n FROM portal_logins",
    ).first("n"),
    1,
  );
});

test("GitHub login binds browser, uses PKCE, creates a session and refuses callback replay", async () => {
  mockNetwork(async (input: RequestInfo | URL) => {
    if (sourceUrl(input).href === "https://github.com/login/oauth/access_token")
      return Response.json({ access_token: "synthetic-github-token" });
    if (sourceUrl(input).href === "https://api.github.com/user")
      return Response.json({ id: 123 });
    throw new Error("Unexpected upstream");
  });
  const app = portalRoutes();
  const login = await app.request(
    "https://caderninho.test/account/login",
    {},
    env(),
  );
  const target = new URL(login.headers.get("Location") ?? "");
  assert.equal(target.searchParams.get("code_challenge_method"), "S256");
  const loginCookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const callback =
    "https://caderninho.test/callback?" +
    new URLSearchParams({
      state: target.searchParams.get("state") ?? "",
      code: "synthetic-code",
    });
  const success = await app.request(
    callback,
    { headers: { Cookie: loginCookie } },
    env(),
  );
  assert.equal(success.status, 302);
  assert.equal(success.headers.get("Location"), "/account");
  assert.equal(
    await statement(bindings.DB, "SELECT principal FROM portal_sessions").first(
      "principal",
    ),
    "github:123",
  );
  assert.match(success.headers.get("Set-Cookie") ?? "", /HttpOnly/);
  assert.equal(
    (await app.request(callback, { headers: { Cookie: loginCookie } }, env()))
      .status,
    400,
  );
});

test("scheduler uses incremental sync after bootstrap and isolates a paused account", async () => {
  await connectAccount(
    env(),
    "github:123",
    { ...credentials, itemId: item },
    source,
  );
  const now = new Date(Date.now() + 1000);
  await statement(
    bindings.DB,
    "UPDATE pluggy_credentials SET reconcile_after=?",
    new Date(now.getTime() + 86400000).toISOString(),
  ).run();
  await scheduleSync(env(), now);
  assert.equal(
    await statement(bindings.DB, "SELECT kind FROM operations").first("kind"),
    "sync",
  );
});

test("portal shows failed financial operations even when MCP task status is completed", async () => {
  await connectAccount(
    env(),
    "github:123",
    { ...credentials, itemId: item },
    source,
  );
  await scheduleSync(env(), new Date(Date.now() + 1000));
  await statement(
    bindings.DB,
    "UPDATE operations SET status='completed',phase='error' WHERE principal='github:123'",
  ).run();
  const response = await portalRoutes().request(
    "https://caderninho.test/api/account",
    { headers: { Cookie: await session() } },
    env(),
  );
  const body = AccountResponseSchema.parse(await response.json());
  assert.equal(body.account.latest?.phase, "error");
});

test("live balance uses only the authenticated owner's enabled vault credentials", async () => {
  const { invoke } = await import("#worker/mcp/invoke.ts");
  await connectAccount(
    env(),
    "github:123",
    { ...credentials, itemId: item },
    source,
  );
  await statement(
    bindings.DB,
    "INSERT INTO entities(principal,item_id,resource,id,source,normalized,relevant_hash,normalizer,first_seen_at,observed_at) VALUES(?,?,'accounts','account','{}','{}','hash','test','now','now')",
    "github:123",
    item,
  ).run();
  let calls = 0;
  mockNetwork(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    if (sourceUrl(input).href.endsWith("/auth")) {
      assert.deepEqual(JSON.parse(z.string().parse(init?.body)), {
        ...credentials,
        nonExpiring: false,
      });
      return Response.json({ apiKey: syntheticJwt("vault-token") });
    }
    assert.equal(
      new Headers(init?.headers).get("X-API-KEY"),
      syntheticJwt("vault-token"),
    );
    return Response.json({
      id: "account",
      balance: "123.45",
      currencyCode: "BRL",
    });
  });
  const settings = {
    ...env(),
    PLUGGY_CLIENT_ID: "wrong-global",
    PLUGGY_CLIENT_SECRET: "wrong-global",
  };
  const input = { itemId: item, accountId: "account" };
  const result = await invoke(
    financialQueries(settings, "github:123"),
    "caderninho_live_balance",
    input,
  );
  assert.equal(JSON.stringify(result).includes("123.45"), true);
  assert.equal(calls, 2);
  await assert.rejects(
    invoke(
      financialQueries(settings, "github:456"),
      "caderninho_live_balance",
      input,
    ),
  );
  assert.equal(calls, 2);
  await statement(bindings.DB, "UPDATE pluggy_credentials SET enabled=0").run();
  await assert.rejects(
    invoke(
      financialQueries(settings, "github:123"),
      "caderninho_live_balance",
      input,
    ),
    /NOT_CONFIGURED/,
  );
  assert.equal(calls, 2);
});
