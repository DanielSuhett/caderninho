import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";

import {
  PortalResponseSchema,
  SyncHistoryResultSchema,
} from "../../src/contracts";
import worker from "../../src/worker";
import { mockNetwork, syntheticJwt } from "../support/network";
import { command, cookies, fixture, login, settings } from "./access-fixture";
import { setup } from "./fixture";

beforeEach(setup);
afterEach(() => vi.unstubAllGlobals());

test("password-only installation saves a person and vault credentials, groups banks and imports only after finishing People", async () => {
  const config = {
    ...settings(),
    PLUGGY_CLIENT_ID: "",
    PLUGGY_CLIENT_SECRET: "",
  };
  const app = fixture(config);
  const start = vi.spyOn(config.FINANCE, "create");
  const cookie = cookies(await login(app));
  const read = async () =>
    PortalResponseSchema.parse(
      await (
        await app.request("/api/account", { headers: { Cookie: cookie } })
      ).json(),
    );
  assert.equal((await read()).configured, false);
  mockNetwork(async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    if (path === "/auth") {
      const credentials = await request.json();
      assert.deepEqual(credentials, {
        clientId: "synthetic-onboarding-client",
        clientSecret: "synthetic-onboarding-secret",
        nonExpiring: false,
      });
      return Response.json({ apiKey: syntheticJwt() });
    }
    if (path.startsWith("/items/")) {
      return Response.json({
        connector: { id: 200 },
        id: path.slice(7),
        status: "UPDATED",
      });
    }
    if (path === "/connect_token") {
      return Response.json({ accessToken: "synthetic-connect-token" });
    }
    throw new Error("Unexpected synthetic provider endpoint");
  });
  const photo = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(
    (
      await command(app, cookie, "manage", {
        action: "save_person",
        id: "self",
        name: "Pessoa exemplo",
        photo,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await command(app, cookie, "manage", {
        action: "save_profile",
        clientId: "synthetic-onboarding-client",
        clientSecret: "synthetic-onboarding-secret",
        enabled: true,
        id: "default",
        name: "Meu Pluggy",
        personId: "self",
      })
    ).status,
    200,
  );
  const configured = await read();
  assert.equal(configured.configured, true);
  assert.equal(configured.people[0]?.photo, photo);
  assert.equal(
    JSON.stringify(configured).includes("synthetic-onboarding-secret"),
    false,
  );
  await ["first", "second"].reduce(async (previous, itemId) => {
    await previous;
    assert.equal(
      (await command(app, cookie, "items", { deferImport: true, itemId }))
        .status,
      200,
    );
  }, Promise.resolve());
  const pending = await read();
  assert.equal(pending.profiles.length, 1);
  assert.deepEqual(
    pending.connections.map((connection) => [
      connection.id,
      connection.importStatus,
    ]),
    [
      ["first", null],
      ["second", null],
    ],
  );
  assert.equal(start.mock.calls.length, 0);
  await worker.scheduled(
    { cron: "0 9 * * *", noRetry: () => undefined, scheduledTime: Date.now() },
    config,
  );
  assert.equal(start.mock.calls.length, 0);
  const ids = pending.connections.map((connection) => connection.id);
  assert.equal(
    (await command(app, cookie, "sync", { connectionIds: ids })).status,
    200,
  );
  assert.equal(start.mock.calls.length, 2);
  const importing = await read();
  assert.ok(
    importing.connections.every(
      (connection) => connection.importStatus === "pending",
    ),
  );
  const history = SyncHistoryResultSchema.parse(
    await (
      await app.request("/api/account/history?connectionId=first", {
        headers: { Cookie: cookie },
      })
    ).json(),
  );
  assert.equal(history.records.length, 1);
  assert.equal(history.records[0]?.connectionId, "first");
  await command(app, cookie, "sync", { connectionIds: ids });
  const repeated = SyncHistoryResultSchema.parse(
    await (
      await app.request("/api/account/history", { headers: { Cookie: cookie } })
    ).json(),
  );
  assert.equal(repeated.records.length, 2);
});
