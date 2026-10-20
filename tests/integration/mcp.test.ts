import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { createLogger } from "../../src/shared/logger";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { withObservation } from "../../src/worker/observability";
import {
  command,
  cookies,
  fixture,
  grant,
  login,
  settings,
} from "./access-fixture";
import { collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

const wire = z.object({
  error: z.json().optional(),
  result: z
    .object({
      content: z
        .array(z.object({ text: z.string(), type: z.string() }))
        .optional(),
      isError: z.boolean().optional(),
      tools: z.array(z.object({ name: z.string() })).optional(),
    })
    .optional(),
});
const requestMeta = {
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    name: "Synthetic fixture",
    version: "1",
  },
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
};
beforeEach(setup);
test("official OAuth, six standard tools/defaults, protocol errors and grant revocation work together", async () => {
  await collect(source([transaction()]));
  const app = fixture();
  const cookie = cookies(await login(app));
  const first = await grant(app, cookie, "<script>synthetic</script>");
  const second = await grant(app, cookie);
  const call = async (
    token: string,
    method: string,
    params: Record<string, unknown> = {},
    target = app,
  ) =>
    target.request("/mcp", {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method,
        params: {
          ...params,
          _meta: requestMeta,
        },
      }),
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Mcp-Method": method,
        "Mcp-Protocol-Version": "2026-07-28",
        ...(typeof params.name === "string" && { "Mcp-Name": params.name }),
      },
      method: "POST",
    });
  const listing = wire.parse(await (await call(first, "tools/list")).json());
  assert.ok(listing.result, JSON.stringify(listing));
  assert.deepEqual(listing.result?.tools?.map((tool) => tool.name).sort(), [
    "caderninho_accounts",
    "caderninho_aggregate",
    "caderninho_correct_transaction",
    "caderninho_status",
    "caderninho_sync",
    "caderninho_transactions",
  ]);
  const transactions = wire.parse(
    await (
      await call(first, "tools/call", {
        arguments: {},
        name: "caderninho_transactions",
      })
    ).json(),
  );
  assert.equal(transactions.result?.isError, false);
  const payload = z
    .object({ records: z.array(z.object({ id: z.string() })) })
    .parse(JSON.parse(transactions.result?.content?.[0]?.text ?? "{}"));
  assert.equal(payload.records[0]?.id, "t");
  const invalid = wire.parse(
    await (
      await call(second, "tools/call", {
        arguments: { filter: { minAmountMinor: "0" } },
        name: "caderninho_transactions",
      })
    ).json(),
  );
  assert.equal(invalid.result?.isError, true);
  assert.deepEqual(JSON.parse(invalid.result?.content?.[0]?.text ?? "{}"), {
    error: "INVALID_FILTER",
  });
  const tasks = wire.parse(
    await (await call(second, "tasks/get", { taskId: "obsolete" })).json(),
  );
  assert.ok(tasks.error);
  assert.equal(
    (await app.request("/mcp", { headers: { "x-user-id": "owner" } })).status,
    401,
  );
  assert.equal((await command(app, cookie, "logout")).status, 200);
  const rotated = fixture({
    ...app.config,
    ADMIN_PASSWORD: "rotated-synthetic-password",
    CF_VERSION_METADATA: {
      ...app.config.CF_VERSION_METADATA,
      id: "rotated-version",
    },
  });
  assert.equal(
    (await rotated.request("/api/account", { headers: { Cookie: cookie } }))
      .status,
    401,
  );
  assert.equal((await call(first, "tools/list", {}, rotated)).status, 200);
  const rotatedCookie = cookies(
    await login(rotated, "rotated-synthetic-password"),
  );
  assert.equal(
    (await command(rotated, rotatedCookie, "disconnect-assistants")).status,
    200,
  );
  assert.equal((await call(first, "tools/list", {}, rotated)).status, 401);
  assert.equal((await call(second, "tools/list", {}, rotated)).status, 401);
  assert.equal(
    (
      await rotated.request("/api/account", {
        headers: { Cookie: rotatedCookie },
      })
    ).status,
    200,
  );
});
test("HTTP 200 tool failures remain visible and private arguments never enter diagnostics", async () => {
  const app = fixture();
  const token = await grant(app, cookies(await login(app)));
  const lines: string[] = [];
  const spans: object[] = [];
  const response = await withObservation(
    {
      onSpan: (span) => spans.push(span),
      output: createLogger({
        destination: { write: (line) => lines.push(line) },
        level: "debug",
        name: "synthetic-mcp",
      }),
    },
    () =>
      app.request("/mcp", {
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            _meta: requestMeta,
            arguments: {
              accountId: "private-account",
              connectionId: "private-connection",
              id: "private-id",
              patch: { description: "private-description" },
            },
            name: "caderninho_correct_transaction",
          },
        }),
        headers: {
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Mcp-Method": "tools/call",
          "Mcp-Name": "caderninho_correct_transaction",
          "Mcp-Protocol-Version": "2026-07-28",
        },
        method: "POST",
      }),
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(wire.parse(body).result?.isError, true);
  assert.deepEqual(
    JSON.parse(wire.parse(body).result?.content?.[0]?.text ?? "{}"),
    {
      error: "NOT_FOUND",
    },
  );
  const serialized = JSON.stringify({ lines, spans });
  for (const secret of [
    "private-connection",
    "private-account",
    "private-id",
    "private-description",
    token,
  ]) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.ok(
    lines.some(
      (line) => line.includes("MCP_REQUEST") && line.includes("rejected"),
    ),
  );
  assert.ok(
    lines.some(
      (line) =>
        line.includes(
          `"correlation":"${response.headers.get("X-Request-ID")}"`,
        ) && line.includes("MCP_REQUEST"),
    ),
  );
});

test("MCP reports missing configuration and durable import failures without reserving or leaking details", async () => {
  const {
    PLUGGY_CLIENT_ID: _clientId,
    PLUGGY_CLIENT_SECRET: _clientSecret,
    ...config
  } = settings();
  const app = fixture(config);
  const token = await grant(app, cookies(await login(app)));
  await createInstallationRepository(env.DB).register(
    { id: "c" },
    "2026-10-01T00:00:00Z",
  );
  const request = {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: { _meta: requestMeta, arguments: {}, name: "caderninho_sync" },
    }),
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Mcp-Method": "tools/call",
      "Mcp-Name": "caderninho_sync",
      "Mcp-Protocol-Version": "2026-07-28",
    },
    method: "POST",
  };
  const missing = wire.parse(await (await app.request("/mcp", request)).json());
  assert.equal(missing.result?.isError, true);
  assert.deepEqual(JSON.parse(missing.result?.content?.[0]?.text ?? "{}"), {
    error: "NOT_CONFIGURED",
  });
  const state = await createInstallationRepository(env.DB).state();
  assert.deepEqual(state.runs, []);
  assert.equal(state.connections[0]?.nextImportAt, null);
  await env.DB.exec(
    "CREATE TRIGGER reject_import BEFORE INSERT ON sync_runs BEGIN SELECT RAISE(ABORT,'private-database-failure'); END;",
  );
  const failed = wire.parse(
    await (await fixture().request("/mcp", request)).json(),
  );
  assert.equal(failed.result?.isError, true);
  assert.deepEqual(JSON.parse(failed.result?.content?.[0]?.text ?? "{}"), {
    error: "IMPORT_FAILED",
  });
});
