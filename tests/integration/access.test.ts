import assert from "node:assert/strict";

import {
  applyD1Migrations,
  createExecutionContext,
  reset,
} from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";
import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { AccountResponseSchema } from "#contracts/portal-contract.ts";
import { required } from "#testing/helpers.ts";
import { portalRoutes, oauth } from "#worker/auth/controller.ts";
import { oauthSubject } from "#worker/auth/repository.ts";
import {
  pkceChallenge,
  ownerPrincipal,
  adminKeyDigest,
} from "#worker/auth/service.ts";
import type { Bindings } from "#worker/bindings.ts";
import { statement } from "#worker/database.ts";

const origin = "https://caderninho.test";
const key = "a".repeat(64);
const owner = "00000000-0000-4000-8000-000000000001";
// The provider injects OAUTH_PROVIDER on the first request; never stub that helper.
async function config() {
  const settings: Omit<Bindings, "OAUTH_PROVIDER"> = {
    DB: bindings.DB,
    OAUTH_KV: bindings.OAUTH_KV,
    FINANCE: {
      async create() {
        throw new Error("Not used by access tests");
      },
      async get() {
        throw new Error("Not used by access tests");
      },
    },
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
    WEBHOOK_SECRET: "synthetic",
    PUBLIC_ORIGIN: origin,
    OWNER_ID: owner,
    ADMIN_KEY_SHA256: await adminKeyDigest(key),
  };
  return settings as Bindings;
}
const cookies = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
beforeEach(async () => {
  await reset();
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
});
async function login(settings: Bindings, supplied = key) {
  const app = portalRoutes();
  const page = await app.request(origin + "/account/access", {}, settings);
  const csrf = z
    .string()
    .parse((await page.text()).match(/name="csrf" value="([^"]+)"/)?.[1]);
  return app.request(
    origin + "/account/access",
    {
      method: "POST",
      headers: {
        Cookie: cookies(page),
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrf, key: supplied }),
    },
    settings,
  );
}
test("admin login is provisioned, rate limited, origin protected and rotated sessions fail closed", async () => {
  const settings = await config();
  assert.equal(
    ownerPrincipal({ ...settings, OWNER_GITHUB_ID: "123" }),
    "github:123",
  );
  assert.equal(
    ownerPrincipal({ ...settings, OWNER_GITHUB_ID: "invalid" }),
    null,
  );
  const withoutOwner = { ...settings };
  delete withoutOwner.OWNER_ID;
  assert.equal((await login(withoutOwner)).status, 401);
  const app = portalRoutes();
  assert.equal(
    (
      await app.request(
        origin + "/account/access",
        {
          method: "POST",
          body: "key=" + key,
          headers: { Origin: "https://evil.test" },
        },
        settings,
      )
    ).status,
    403,
  );
  assert.equal((await login(settings, "b".repeat(64))).status, 401);
  const accepted = await login(settings);
  assert.equal(accepted.status, 303);
  assert.match(accepted.headers.get("Set-Cookie") ?? "", /HttpOnly/);
  assert.match(accepted.headers.get("Set-Cookie") ?? "", /Secure/);
  const headers = { Cookie: cookies(accepted) };
  assert.equal(
    (await app.request(origin + "/api/account", { headers }, settings)).status,
    200,
  );
  assert.equal(
    (
      await app.request(
        origin + "/api/account",
        { headers },
        { ...settings, ADMIN_KEY_SHA256: await adminKeyDigest("c".repeat(64)) },
      )
    ).status,
    401,
  );
  for (let i = 0; i < 7; i++) await login(settings, "b".repeat(64));
  const limited = await login(settings);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
});
test("GitHub owners keep their stored principal when adding admin access", async () => {
  const settings = { ...(await config()), OWNER_GITHUB_ID: "123" };
  assert.equal((await login(settings)).status, 303);
  assert.equal(
    await statement(settings.DB, "SELECT principal FROM portal_sessions").first(
      "principal",
    ),
    "github:123",
  );
});
test("OAuth with admin session completes PKCE, records grant-specific receipt and revokes only that grant", async () => {
  const settings = await config();
  const session = cookies(await login(settings));
  const provider = oauth(settings, async () => Response.json({ ok: true }));
  const request = (path: string, options?: RequestInit) =>
    provider.fetch(
      new Request(origin + path, options),
      settings,
      createExecutionContext(),
    );
  const registered = await request("/oauth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Synthetic client",
      redirect_uris: ["http://localhost:8123/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  assert.equal(registered.status, 201);
  const client = z
    .object({ client_id: z.string() })
    .parse(await registered.json());
  const verifier = "synthetic-verifier-" + "a".repeat(48);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: "http://localhost:8123/callback",
    scope: "finance",
    resource: origin + "/mcp",
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    state: "synthetic",
  });
  assert.equal((await request("/authorize?" + params)).status, 302);
  const consent = await request("/authorize?" + params, {
    headers: { Cookie: session },
  });
  assert.equal(consent.status, 200, await consent.clone().text());
  const handle = z
    .string()
    .parse((await consent.text()).match(/name="handle" value="([^"]+)"/)?.[1]);
  const approve = () =>
    request("/authorize", {
      method: "POST",
      headers: {
        Cookie: session + "; " + cookies(consent),
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ handle, decision: "approve" }),
    });
  const approved = await approve();
  assert.equal(approved.status, 302, await approved.clone().text());
  const code = new URL(
    z.string().parse(approved.headers.get("Location")),
  ).searchParams.get("code");
  const exchanged = await request("/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: z.string().parse(code),
      client_id: client.client_id,
      redirect_uri: "http://localhost:8123/callback",
      code_verifier: verifier,
      resource: origin + "/mcp",
    }),
  });
  assert.equal(exchanged.status, 200, await exchanged.clone().text());
  const tokens = z
    .object({ access_token: z.string() })
    .parse(await exchanged.json());
  assert.equal(
    await statement(
      settings.DB,
      "SELECT count(*) AS n FROM mcp_receipts",
    ).first("n"),
    0,
  );
  const call = () =>
    request("/mcp", {
      method: "POST",
      headers: { Authorization: "Bearer " + tokens.access_token },
      body: "{}",
    });
  const called = await call();
  assert.equal(called.status, 200, await called.clone().text());
  assert.equal(
    await statement(settings.DB, "SELECT client_id FROM mcp_receipts").first(
      "client_id",
    ),
    client.client_id,
  );
  const account = await request("/api/account", {
    headers: { Cookie: session },
  });
  const accountData = AccountResponseSchema.parse(await account.json());
  assert.equal(accountData.data.status.received, 1);
  const grant = await settings.OAUTH_PROVIDER.listUserGrants(
    oauthSubject("instance:" + owner),
  );
  const id = z.string().parse(required(grant.items[0])?.id);
  const csrf = z
    .string()
    .parse(
      await statement(settings.DB, "SELECT csrf FROM portal_sessions").first(
        "csrf",
      ),
    );
  const revoked = await request("/account/revoke", {
    method: "POST",
    headers: {
      Cookie: session,
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ csrf, grantId: id }),
  });
  assert.equal(revoked.status, 303);
  assert.equal((await call()).status, 401);
});
