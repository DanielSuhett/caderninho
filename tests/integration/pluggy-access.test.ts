import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";

import { PortalResponseSchema } from "../../src/contracts";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { mockNetwork, syntheticJwt } from "../support/network";
import { cookies, fixture, grant, login, origin } from "./access-fixture";
import { setup } from "./fixture";

beforeEach(setup);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("Pluggy setup rejects anonymous requests, tampered/expired cookies and MCP credentials before contacting the provider", async () => {
  const app = fixture();
  const owner = cookies(await login(app));
  const clock = vi
    .spyOn(Date, "now")
    .mockReturnValue(Date.now() - 8 * 60 * 60 * 1000);
  const expired = cookies(await login(app));
  clock.mockRestore();
  const assistant = await grant(app, owner);
  const upstream = vi.fn(async () => new Response(null, { status: 500 }));
  mockNetwork(upstream);
  const credentials = [
    {},
    { Cookie: owner.replace("__Host-caderninho=", "__Host-caderninho=x") },
    { Cookie: expired },
    { Authorization: `Bearer ${assistant}` },
  ];
  const denied = await Promise.all(
    credentials.flatMap((credential) =>
      ["connect-token", "items"].map((endpoint) =>
        app.request(`/api/account/${endpoint}`, {
          body: JSON.stringify({ csrf: "forged", itemId: "registered" }),
          headers: {
            "Content-Type": "application/json",
            Origin: origin,
            ...credential,
          },
          method: "POST",
        }),
      ),
    ),
  );
  for (const response of denied) {
    assert.equal(response.status, 401);
  }
  const privateReads = await Promise.all(
    credentials.map((headers) => app.request("/api/account", { headers })),
  );
  for (const response of privateReads) {
    assert.equal(response.status, 401);
  }
  const consents = await Promise.all(
    credentials.map((credential) =>
      app.request("/authorize", {
        body: new URLSearchParams({ decision: "approve", handle: "forged" }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: origin,
          ...credential,
        },
        method: "POST",
      }),
    ),
  );
  for (const response of consents) {
    assert.equal(response.status, 401);
  }
  const assistantHeaders = { Authorization: `Bearer ${assistant}` };
  assert.equal(
    (await app.request("/account", { headers: assistantHeaders })).status,
    302,
  );
  assert.equal(
    (await app.request("/authorize", { headers: assistantHeaders })).status,
    302,
  );
  assert.equal(upstream.mock.calls.length, 0);
  assert.deepEqual(
    (await createInstallationRepository(app.config.DB).state()).connections,
    [],
  );
});

test("widget tokens require owner CSRF/origin, bind updates to a registered Item and expose only the connect token", async () => {
  const app = fixture();
  const cookie = cookies(await login(app));
  const { csrf } = PortalResponseSchema.parse(
    await (
      await app.request("/api/account", { headers: { Cookie: cookie } })
    ).json(),
  );
  const requests: unknown[] = [];
  let calls = 0;
  mockNetwork(async (input, init) => {
    calls += 1;
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path === "/auth") {
      return Response.json({ apiKey: syntheticJwt() });
    }
    if (path === "/items/registered") {
      assert.equal(request.method, "GET");
      return Response.json({
        connector: { id: 200 },
        id: "registered",
        status: "UPDATED",
      });
    }
    assert.equal(path, "/connect_token");
    assert.equal(request.method, "POST");
    requests.push(await request.json());
    return Response.json({
      accessToken: "synthetic-connect-token",
      apiKey: "synthetic-private-api-key",
      clientSecret: "synthetic-private-secret",
    });
  });
  const post = (body: object, requestHeaders: Record<string, string>) =>
    app.request("/api/account/connect-token", {
      body: JSON.stringify(body),
      headers: { Cookie: cookie, ...requestHeaders },
      method: "POST",
    });
  const headers = { "Content-Type": "application/json", Origin: origin };
  assert.equal((await post({ csrf: "forged" }, headers)).status, 403);
  assert.equal(
    (await post({ csrf }, { "Content-Type": "application/json" })).status,
    403,
  );
  assert.equal(
    (await post({ csrf }, { ...headers, Origin: "https://attacker.test" }))
      .status,
    403,
  );
  assert.equal(
    (await post({ csrf }, { ...headers, "Content-Type": "text/plain" })).status,
    415,
  );
  assert.equal(
    (await post({ csrf, webhookUrl: "https://attacker.test" }, headers)).status,
    400,
  );
  assert.equal(
    (await post({ csrf, itemId: "unregistered" }, headers)).status,
    404,
  );
  assert.equal(calls, 0);

  const connected = await app.request("/api/account/items", {
    body: JSON.stringify({ csrf, itemId: "registered" }),
    headers: { ...headers, Cookie: cookie },
    method: "POST",
  });
  assert.equal(connected.status, 200);
  const state = PortalResponseSchema.parse(
    await (
      await app.request("/api/account", {
        headers: { Cookie: cookie },
      })
    ).json(),
  );
  assert.equal(state.connections[0]?.id, "registered");
  await [{ csrf }, { csrf, itemId: "registered" }].reduce(
    async (previous, body) => {
      await previous;
      const response = await post(body, headers);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await response.json(), {
        accessToken: "synthetic-connect-token",
        configuration: {
          connectorIds: [200],
          includeSandbox: false,
          selectedConnectorId: 200,
        },
      });
    },
    Promise.resolve(),
  );
  assert.deepEqual(requests, [{}, { itemId: "registered" }]);
});
