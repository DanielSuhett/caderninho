import assert from "node:assert/strict";

import { applyD1Migrations, reset } from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";
import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { AccountResponseSchema } from "#contracts/portal-contract.ts";
import { required } from "#testing/helpers.ts";

import {
  command,
  cookies,
  fixture,
  login,
  origin,
  password,
  settings,
} from "./personal-fixture.ts";

beforeEach(async () => {
  await reset();
  await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
});

async function grant(
  app: ReturnType<typeof fixture>,
  ownerCookie: string,
  name = "Synthetic assistant",
) {
  const registered = await app.request("/oauth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: name,
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
  const verifier = "a".repeat(64);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
  const authorize =
    "/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: "http://localhost:8123/callback",
      scope: "finance offline_access",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "synthetic-state",
    });
  const anonymous = await app.request(authorize);
  assert.equal(anonymous.status, 302);
  assert.match(anonymous.headers.get("Location") ?? "", /account\/login/);
  const consent = await app.request(authorize, {
    headers: { Cookie: ownerCookie },
  });
  assert.equal(consent.status, 200);
  const html = await consent.text();
  assert.ok(!html.includes("<script>synthetic</script>"));
  const handle = z
    .string()
    .parse(html.match(/name="handle" value="([^"]+)"/)?.[1]);
  const approved = await app.request("/authorize", {
    method: "POST",
    headers: {
      Cookie: ownerCookie + "; " + cookies(consent),
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ handle, decision: "approve" }),
  });
  assert.equal(approved.status, 302);
  const code = required(
    new URL(required(approved.headers.get("Location"))).searchParams.get(
      "code",
    ),
  );
  const response = await app.request("/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: client.client_id,
      code,
      redirect_uri: "http://localhost:8123/callback",
      code_verifier: verifier,
    }),
  });
  assert.equal(response.status, 200);
  return z.object({ access_token: z.string() }).parse(await response.json())
    .access_token;
}

test("only the password opens private routes; missing configuration fails closed", async () => {
  const app = fixture();
  assert.equal((await app.request("/account")).status, 302);
  assert.equal((await app.request("/api/account")).status, 401);
  assert.equal((await login(app, "wrong-synthetic-password")).status, 401);
  const authenticated = await login(app);
  assert.equal(authenticated.status, 303);
  const cookie = cookies(authenticated);
  assert.match(cookie, /__Host-caderninho=/);
  const flags = authenticated.headers.getSetCookie().join(";");
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax"])
    assert.ok(flags.includes(flag));
  const state = AccountResponseSchema.parse(
    await (
      await app.request("/api/account", { headers: { Cookie: cookie } })
    ).json(),
  );
  assert.equal(state.status.credentials, true);
  for (const secret of [password, "synthetic-secret", "synthetic-client"])
    assert.ok(!JSON.stringify(state).includes(secret));
  const absent = settings();
  delete absent.ADMIN_PASSWORD;
  assert.equal((await fixture(absent).request("/account/login")).status, 503);
  assert.equal((await fixture(absent).request("/api/account")).status, 401);
  assert.equal((await app.request("/account/access")).status, 404);
});

test("login rate limit, CSRF and request origin cannot be bypassed by identity headers", async () => {
  const app = fixture();
  const forged = await app.request("/account/login", {
    method: "POST",
    headers: {
      Origin: "https://attacker.test",
      "X-Forwarded-Host": "attacker.test",
      "x-user-id": "owner",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ password }),
  });
  assert.equal(forged.status, 403);
  const missingCsrf = await app.request("/account/login", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ password }),
  });
  assert.equal(missingCsrf.status, 403);
  for (let i = 0; i < 10; i++)
    assert.equal((await login(app, "wrong-synthetic-password")).status, 401);
  const limited = await login(app);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
});

test("private commands require CSRF; logout, expiry and a new deployment invalidate sessions", async () => {
  const app = fixture();
  const cookie = cookies(await login(app));
  const forged = await app.request("/api/account/pause", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ csrf: "forged" }),
  });
  assert.equal(forged.status, 403);
  assert.equal((await command(app, cookie, "logout")).status, 200);
  assert.equal(
    (await app.request("/api/account", { headers: { Cookie: cookie } })).status,
    401,
  );
  const expired = cookies(await login(app));
  await bindings.DB.exec("UPDATE portal_sessions SET expires=0");
  assert.equal(
    (await app.request("/api/account", { headers: { Cookie: expired } }))
      .status,
    401,
  );
  const previous = cookies(await login(app));
  app.config.CF_VERSION_METADATA = {
    ...app.config.CF_VERSION_METADATA,
    id: "next-deployment",
  };
  assert.equal(
    (await app.request("/api/account", { headers: { Cookie: previous } }))
      .status,
    401,
  );
});

test("official OAuth authorizes assistants and the owner can revoke every grant", async () => {
  const app = fixture();
  const cookie = cookies(await login(app));
  const first = await grant(app, cookie, "<script>synthetic</script>");
  const second = await grant(app, cookie);
  const use = (token: string) =>
    app.request("/mcp", { headers: { Authorization: "Bearer " + token } });
  assert.equal((await use(first)).status, 200);
  assert.equal((await use(second)).status, 200);
  assert.equal(
    (
      await app.request("/mcp", {
        headers: { "x-user-id": "owner", "x-authenticated-user-id": "owner" },
      })
    ).status,
    401,
  );
  assert.equal(
    (await command(app, cookie, "disconnect-assistants")).status,
    200,
  );
  assert.equal((await use(first)).status, 401);
  assert.equal((await use(second)).status, 401);
  assert.equal(
    (await app.request("/api/account", { headers: { Cookie: cookie } })).status,
    200,
  );
});
