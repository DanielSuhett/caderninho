import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { AccountResponseSchema } from "../../src/contracts";
import { createLogger } from "../../src/shared/logger";
import worker from "../../src/worker";
import { compactAccess } from "../../src/worker/auth/repository";
import { database } from "../../src/worker/database";
import { withObservation } from "../../src/worker/observability";
import { portal_sessions } from "../../src/worker/schema";
import { receiveWebhook } from "../../src/worker/sync/controller";
import { required } from "../support";
import {
  command,
  cookies,
  fixture,
  login,
  origin,
  password,
  settings,
  testMigrations,
} from "./personal-fixture";
import {
  applyD1Migrations,
  createExecutionContext,
  reset,
} from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";

const loginPathPattern = /account\/login/;
const consentHandlePattern = /name="handle" value="([^"]+)"/;
const sessionCookiePattern = /__Host-caderninho=/;

beforeEach(async () => {
  await reset();
  await applyD1Migrations(bindings.DB, testMigrations);
});

test("daily session retention removes at most 200 expired sessions per call", async () => {
  await bindings.DB.prepare(
    "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<201) INSERT INTO portal_sessions(id,csrf,expires,auth_version) SELECT CAST(x AS TEXT),'synthetic',0,'synthetic' FROM n",
  ).run();
  await compactAccess(bindings.DB);
  assert.equal(
    (await database(bindings.DB).select().from(portal_sessions)).length,
    1,
  );
});

test("the password opens private routes; missing configuration fails closed", async () => {
  const app = fixture();
  assert.equal((await app.request("/account")).status, 302);
  assert.equal((await app.request("/api/account")).status, 401);
  assert.equal((await login(app, "wrong-synthetic-password")).status, 401);
  const authenticated = await login(app);
  assert.equal(authenticated.status, 303);
  const cookie = cookies(authenticated);
  assert.match(cookie, sessionCookiePattern);
  const flags = authenticated.headers.getSetCookie().join(";");
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax"]) {
    assert.ok(flags.includes(flag));
  }
  const state = AccountResponseSchema.parse(
    await (
      await app.request("/api/account", { headers: { Cookie: cookie } })
    ).json(),
  );
  assert.equal(state.status.credentials, true);
  for (const secret of [password, "synthetic-secret", "synthetic-client"]) {
    assert.ok(!JSON.stringify(state).includes(secret));
  }
  const { ADMIN_PASSWORD: _password, ...absent } = settings();
  assert.equal((await fixture(absent).request("/account/login")).status, 503);
  assert.equal((await fixture(absent).request("/api/account")).status, 401);
  assert.equal((await app.request("/account/access")).status, 404);
});

test("login rate limit, CSRF and request origin cannot be bypassed by identity headers", async () => {
  const app = fixture();
  const forged = await app.request("/account/login", {
    body: new URLSearchParams({ password }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://attacker.test",
      "X-Forwarded-Host": "attacker.test",
      "x-user-id": "owner",
    },
    method: "POST",
  });
  assert.equal(forged.status, 403);
  const missingCsrf = await app.request("/account/login", {
    body: new URLSearchParams({ password }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
    },
    method: "POST",
  });
  assert.equal(missingCsrf.status, 403);
  await Array.from({ length: 10 }, (_, index) => index).reduce(
    async (priorCase) => {
      await priorCase;
      assert.equal((await login(app, "wrong-synthetic-password")).status, 401);
    },
    Promise.resolve(),
  );
  const limited = await login(app);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
});

test("webhook authenticates the raw secret before reading its body", async () => {
  const config = { ...settings(), WEBHOOK_SECRET: "synthetic-webhook-secret" };
  await [null, "wrong-secret", "synthetic-webhook-secreX"].reduce(
    async (priorCase, supplied) => {
      await priorCase;
      const response = await receiveWebhook(
        new Request(`${origin}/webhook`, {
          body: "invalid JSON must not be read before authentication",
          headers: supplied ? { "X-Caderninho-Webhook-Secret": supplied } : {},
          method: "POST",
        }),
        config,
      );
      assert.equal(response.status, 401);
    },
    Promise.resolve(),
  );
  const event = {
    accountId: "22222222-2222-4222-8222-222222222222",
    event: "transactions/created",
    eventId: "synthetic-event",
    itemId: "11111111-1111-4111-8111-111111111111",
    transactionsCreatedAtFrom: "2026-10-01T00:00:00.000Z",
  };
  const request = () =>
    new Request(`${origin}/webhook`, {
      body: JSON.stringify(event),
      headers: { "X-Caderninho-Webhook-Secret": config.WEBHOOK_SECRET },
      method: "POST",
    });
  assert.equal((await receiveWebhook(request(), config)).status, 404);
  const { WEBHOOK_SECRET: _secret, ...missing } = settings();
  assert.equal((await receiveWebhook(request(), missing)).status, 401);
});

test("private commands require CSRF; logout, expiry and a new deployment invalidate sessions", async () => {
  const app = fixture();
  const cookie = cookies(await login(app));
  const forged = await app.request("/api/account/pause", {
    body: JSON.stringify({ csrf: "forged" }),
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: origin,
    },
    method: "POST",
  });
  assert.equal(forged.status, 403);
  assert.equal((await command(app, cookie, "logout")).status, 200);
  assert.equal(
    (await app.request("/api/account", { headers: { Cookie: cookie } })).status,
    401,
  );
  const expired = cookies(await login(app));
  await database(bindings.DB).update(portal_sessions).set({ expires: 0 });
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
  async function grant(ownerCookie: string, name = "Synthetic assistant") {
    const registered = await app.request("/oauth/register", {
      body: JSON.stringify({
        client_name: name,
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: ["http://localhost:8123/callback"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
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
        client_id: client.client_id,
        code_challenge: challenge,
        code_challenge_method: "S256",
        redirect_uri: "http://localhost:8123/callback",
        response_type: "code",
        scope: "offline_access",
        state: "synthetic-state",
      });
    const anonymous = await app.request(authorize);
    assert.equal(anonymous.status, 302);
    assert.match(anonymous.headers.get("Location") ?? "", loginPathPattern);
    const consent = await app.request(authorize, {
      headers: { Cookie: ownerCookie },
    });
    assert.equal(consent.status, 200);
    const html = await consent.text();
    assert.ok(!html.includes("<script>synthetic</script>"));
    const handle = z.string().parse(html.match(consentHandlePattern)?.[1]);
    const approved = await app.request("/authorize", {
      body: new URLSearchParams({ decision: "approve", handle }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: `${ownerCookie}; ${cookies(consent)}`,
        Origin: origin,
      },
      method: "POST",
    });
    assert.equal(approved.status, 302);
    const code = required(
      new URL(required(approved.headers.get("Location"))).searchParams.get(
        "code",
      ),
    );
    const response = await app.request("/oauth/token", {
      body: new URLSearchParams({
        client_id: client.client_id,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: "http://localhost:8123/callback",
      }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
    assert.equal(response.status, 200);
    return z.object({ access_token: z.string() }).parse(await response.json())
      .access_token;
  }

  const app = fixture();
  const cookie = cookies(await login(app));
  const first = await grant(cookie, "<script>synthetic</script>");
  const second = await grant(cookie);
  const use = (token: string) =>
    app.request("/mcp", { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await use(first)).status, 200);
  assert.equal((await use(second)).status, 200);
  const lines: string[] = [];
  const spans: object[] = [];
  const rejectedImport = await withObservation(
    {
      onSpan: (span) => spans.push(span),
      output: createLogger({
        destination: { write: (line) => lines.push(line) },
        level: "warn",
        name: "synthetic-import",
      }),
    },
    () =>
      worker.fetch(
        new Request(`${origin}/mcp/rules/import`, {
          body: '{"document":{"version":9007199254740993}}',
          headers: {
            Authorization: `Bearer ${first}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
        app.config,
        createExecutionContext(),
      ),
  );
  assert.equal(rejectedImport.status, 500);
  assert.deepEqual(await rejectedImport.json(), {
    error: "AUTHENTICATION_OR_REQUEST_FAILED",
  });
  assert.deepEqual(lines, []);
  const requestSpan = z
    .array(
      z.object({
        failure: z.string().optional(),
        name: z.string(),
        outcome: z.string(),
        status: z.number().optional(),
      }),
    )
    .parse(spans)
    .find(({ name }) => name === "http.request");
  assert.equal(requestSpan?.outcome, "rejected");
  assert.equal(requestSpan?.failure, "INVALID_REQUEST");
  assert.equal(requestSpan?.status, 500);
  assert.equal(
    (
      await app.request("/mcp", {
        headers: { "x-authenticated-user-id": "owner", "x-user-id": "owner" },
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
