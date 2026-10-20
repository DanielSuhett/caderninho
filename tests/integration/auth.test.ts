import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";

import { PortalResponseSchema } from "../../src/contracts";
import {
  command,
  cookies,
  fixture,
  login,
  origin,
  password,
  settings,
} from "./access-fixture";
import { setup } from "./fixture";
import { reset } from "cloudflare:test";

const sessionPattern = /__Host-caderninho=/;
beforeEach(setup);
afterEach(() => vi.restoreAllMocks());
test("owner can sign in and open the private panel before D1 is initialized", async () => {
  await reset();
  const app = fixture();
  const response = await login(app);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await app.config.OAUTH_KV.list()).keys, []);
  assert.equal(
    (await app.request("/account", { headers: { Cookie: cookies(response) } }))
      .status,
    200,
  );
});
test("personal login protects private reads and logout only clears the browser cookie", async () => {
  const app = fixture();
  assert.equal((await app.request("/account")).status, 302);
  assert.equal((await app.request("/api/account")).status, 401);
  assert.equal((await app.request("/mcp")).status, 401);
  assert.equal((await login(app, "wrong-synthetic-password")).status, 401);
  const authenticated = await login(app);
  assert.equal(authenticated.status, 303);
  const cookie = cookies(authenticated);
  assert.match(cookie, sessionPattern);
  const flags = authenticated.headers.getSetCookie().join(";");
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) {
    assert.ok(flags.includes(flag));
  }
  const response = await app.request("/api/account", {
    headers: { Cookie: cookie },
  });
  const state = PortalResponseSchema.parse(await response.json());
  assert.equal(state.enabled, true);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok(
    response.headers
      .get("Content-Security-Policy")
      ?.includes("frame-ancestors 'none'"),
  );
  for (const secret of [password, "synthetic-secret", "synthetic-client"]) {
    assert.ok(!JSON.stringify(state).includes(secret));
  }
  const logout = await command(app, cookie, "logout");
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.getSetCookie().join(";").includes("Max-Age=0"));
  assert.equal((await app.request("/api/account")).status, 401);
  assert.equal(
    (await app.request("/api/account", { headers: { Cookie: cookie } })).status,
    200,
  );
});
test("owner cookies reject tampering, password/version rotation and missing configuration", async () => {
  const app = fixture();
  const cookie = cookies(await login(app));
  const { ADMIN_PASSWORD: _password, ...missing } = app.config;
  const denied = [
    {
      app,
      cookie: cookie.replace("__Host-caderninho=", "__Host-caderninho=x"),
    },
    { app, cookie: "__Host-caderninho=forged" },
    {
      app: fixture({
        ...app.config,
        ADMIN_PASSWORD: "different-synthetic-password",
      }),
      cookie,
    },
    {
      app: fixture({
        ...app.config,
        CF_VERSION_METADATA: {
          ...app.config.CF_VERSION_METADATA,
          id: "new-deploy",
        },
      }),
      cookie,
    },
    { app: fixture(missing), cookie },
  ];
  const responses = await Promise.all(
    denied.map((request) =>
      request.app.request("/api/account", {
        headers: { Cookie: request.cookie },
      }),
    ),
  );
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  const rotated = fixture({
    ...app.config,
    ADMIN_PASSWORD: "different-synthetic-password",
  });
  const renewed = await login(rotated, "different-synthetic-password");
  assert.equal(renewed.status, 303);
  assert.equal(
    (
      await rotated.request("/account", {
        headers: { Cookie: cookies(renewed) },
      })
    ).status,
    200,
  );
});
test("server expires a copied owner cookie at exactly eight hours", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(1_792_411_200_000);
  const app = fixture();
  const response = await login(app);
  const cookie = cookies(response);
  assert.ok(
    response.headers
      .getSetCookie()
      .some((value) => value.includes("Max-Age=28800")),
  );
  now.mockReturnValue(1_792_439_999_999);
  assert.equal(
    (await app.request("/api/account", { headers: { Cookie: cookie } })).status,
    200,
  );
  now.mockReturnValue(1_792_440_000_000);
  assert.equal(
    (await app.request("/api/account", { headers: { Cookie: cookie } })).status,
    401,
  );
  assert.equal(
    (await app.request("/account", { headers: { Cookie: cookie } })).status,
    302,
  );
});
test("native limiter uses only trusted IP and missing config/origin/CSRF fail closed", async () => {
  const base = settings();
  const attempts = new Map<string, number>();
  const keys: string[] = [];
  const app = fixture({
    ...base,
    LOGIN_LIMITER: {
      limit: ({ key }) => {
        keys.push(key);
        const count = (attempts.get(key) ?? 0) + 1;
        attempts.set(key, count);
        return Promise.resolve({ success: count <= 10 });
      },
    },
  });
  const page = await app.request("/account/login");
  const rejectedCsrf = await app.request("/account/login", {
    body: new URLSearchParams({ csrf: "forged", password }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies(page),
      Origin: origin,
    },
    method: "POST",
  });
  assert.equal(rejectedCsrf.status, 403);
  const forge = await app.request("/account/login", {
    body: new URLSearchParams({ password }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://attacker.test",
      "X-Forwarded-For": "private-ip",
      "X-Forwarded-Host": "attacker.test",
    },
    method: "POST",
  });
  assert.equal(forge.status, 403);
  await Array.from({ length: 10 }).reduce(async (previous) => {
    await previous;
    assert.equal((await login(app, "wrong-synthetic-password")).status, 401);
  }, Promise.resolve());
  const limited = await login(app);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
  assert.deepEqual(new Set(keys), new Set(["local"]));
  assert.equal((await login(app, password, "203.0.113.7")).status, 303);
  assert.equal(keys.at(-1), "203.0.113.7");
  const { ADMIN_PASSWORD: _password, ...missing } = base;
  assert.equal((await fixture(missing).request("/account/login")).status, 503);
});
test("panel commands require exact CSRF/origin/content type and GET status has no import side effect", async () => {
  const app = fixture();
  const cookie = cookies(await login(app));
  const { csrf } = PortalResponseSchema.parse(
    await (
      await app.request("/api/account", { headers: { Cookie: cookie } })
    ).json(),
  );
  const request = (headers: HeadersInit, body = { csrf }) =>
    app.request("/api/account/pause", {
      body: JSON.stringify(body),
      headers: { Cookie: cookie, ...headers },
      method: "POST",
    });
  assert.equal(
    (
      await request(
        { "Content-Type": "application/json", Origin: origin },
        { csrf: "forged" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request({
        "Content-Type": "application/json",
        Origin: "https://attacker.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (await request({ "Content-Type": "text/plain", Origin: origin })).status,
    415,
  );
  assert.equal((await command(app, cookie, "pause")).status, 200);
  assert.equal(
    PortalResponseSchema.parse(
      await (
        await app.request("/api/account", { headers: { Cookie: cookie } })
      ).json(),
    ).enabled,
    false,
  );
  assert.equal((await command(app, cookie, "resume")).status, 200);
  assert.deepEqual(
    PortalResponseSchema.parse(
      await (
        await app.request("/api/account", { headers: { Cookie: cookie } })
      ).json(),
    ).runs,
    [],
  );
});
