import assert from "node:assert/strict";

import type { PluggyConnect } from "pluggy-connect-sdk";
import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import { TransactionQuerySchema } from "../../src/contracts";
import type { Cursor } from "../../src/domain";
import { createLogger } from "../../src/shared/logger";
import { createConnectWidget } from "../../src/web/account";
import { createAccountApi } from "../../src/web/account/account-api";
import { synchronizationDependencies } from "../../src/worker/composition";
import { withObservation } from "../../src/worker/observability";
import { runImport } from "../../src/worker/sync";
import { required } from "../support";
import { mockNetwork, syntheticJwt } from "../support/network";
import {
  command,
  cookies,
  fixture,
  grant,
  login,
  origin,
  password,
  settings,
} from "./access-fixture";
import { account, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const itemId = "00000000-0000-4000-8000-000000000001";
const accountId = "00000000-0000-4000-8000-000000000002";
const a = "00000000-0000-4000-8000-000000000003";
const b = "00000000-0000-4000-8000-000000000004";
const c = "00000000-0000-4000-8000-000000000005";
const wire = z.object({
  result: z.object({
    content: z.array(z.object({ text: z.string() })).optional(),
    isError: z.boolean().optional(),
    tools: z.array(z.object({ name: z.string() })).optional(),
  }),
});
const pageSchema = z.object({
  cursor: TransactionQuerySchema.shape.cursor.unwrap().nullable(),
  records: z.array(
    z.object({ amountMinor: z.string().nullable(), id: z.string() }),
  ),
});
const totalsSchema = z.object({
  groups: z.array(
    z.object({ count: z.string(), totalMinor: z.string().nullable() }),
  ),
  partial: z.boolean(),
});

test("a fresh installation connects/reconnects the widget, imports cumulative pages and grants/revokes assistant access", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
  const apiKey = syntheticJwt("installation-private-api-key");
  const connectToken = "synthetic-limited-widget-token";
  const responses: string[] = [];
  const logs: string[] = [];
  const output = createLogger({
    destination: { write: (line) => logs.push(line) },
    level: "debug",
    name: "installation",
  });
  const failingPaths = new Set<string>();
  const tokenRequests: unknown[] = [];
  mockNetwork(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname === "/auth") {
      assert.deepEqual(await request.json(), {
        clientId: "synthetic-client",
        clientSecret: "synthetic-secret",
        nonExpiring: false,
      });
      return Response.json({ apiKey });
    }
    assert.equal(request.headers.get("X-API-KEY"), apiKey);
    if (failingPaths.has(url.pathname)) {
      return new Response(
        `${password} synthetic-client synthetic-secret ${apiKey}`,
        { status: 503 },
      );
    }
    if (url.pathname === "/connect_token") {
      tokenRequests.push(await request.json());
      return Response.json({
        accessToken: connectToken,
        apiKey,
        clientSecret: "synthetic-secret",
      });
    }
    if (url.pathname === `/items/${itemId}`) {
      return Response.json({
        connector: { id: 200, name: "Unused" },
        id: itemId,
        status: "UPDATED",
      });
    }
    if (url.pathname === "/accounts") {
      assert.equal(url.searchParams.get("itemId"), itemId);
      return Response.json({
        page: 1,
        results: [account({ id: accountId, itemId })],
        total: 1,
        totalPages: 1,
      });
    }
    if (["/investments", "/loans"].includes(url.pathname)) {
      assert.equal(url.searchParams.get("itemId"), itemId);
      return Response.json({ page: 1, results: [], total: 0, totalPages: 0 });
    }
    assert.equal(url.pathname, "/v2/transactions");
    assert.equal(url.searchParams.get("accountId"), accountId);
    const secondWindow = Date.now() >= Date.parse("2026-10-02T12:00:00Z");
    const after = url.searchParams.get("after");
    const firstId = secondWindow ? b : a;
    const lastId = secondWindow ? c : b;
    const id = after ? lastId : firstId;
    let amount = "-9007199254740993.01";
    if (secondWindow) {
      amount = "-0.03";
    }
    if (after) {
      amount = "-0.02";
    }
    return Response.json({
      next: after ? null : `?accountId=${accountId}&after=next`,
      results: [transaction({ accountId, amount, id })],
    });
  });
  const config = settings();
  const dispatches: string[] = [];
  config.FINANCE = {
    ...config.FINANCE,
    create: async ({ id, params }) => {
      dispatches.push(id);
      await runImport(
        {
          ...synchronizationDependencies(config),
          steps: { do: (_name, fn) => fn() },
        },
        params.runId,
      );
      return { id, status: async () => ({ status: "complete" }) };
    },
  };
  const raw = fixture(config);
  const app = {
    config,
    request: async (path: string, init?: RequestInit) => {
      const response = await withObservation({ output }, () =>
        raw.request(path, init),
      );
      responses.push(
        await response.clone().text(),
        JSON.stringify([...response.headers]),
      );
      return response;
    },
  };
  const cookie = cookies(await login(app));
  const browserFetch: typeof fetch = (input, init) => {
    const request = new Request(input, init);
    request.headers.set("Cookie", cookie);
    request.headers.set("Origin", origin);
    return app.request(new URL(request.url).pathname, request);
  };
  const api = createAccountApi(origin, browserFetch);
  const { signal } = new AbortController();
  const initial = await api.read(signal);
  assert.deepEqual(initial.connections, []);
  let options: ConstructorParameters<typeof PluggyConnect>[0] | undefined;
  class Widget {
    constructor(input: ConstructorParameters<typeof PluggyConnect>[0]) {
      options = input;
    }
    init() {
      return Promise.resolve();
    }
    destroy() {
      return Promise.resolve();
    }
  }
  const widget = createConnectWidget(async () => ({ PluggyConnect: Widget }));
  let registration = Promise.resolve();
  async function connect(update?: string) {
    const token = await api.token(initial.csrf, signal, update);
    await widget.open({
      ...token,
      ...(update && { itemId: update }),
      onClose: () => undefined,
      onError: () => assert.fail("Widget failed"),
      onSuccess: (id) => {
        registration = api.command("items", initial.csrf, signal, {
          itemId: id,
        });
      },
    });
    assert.equal(required(options).connectToken, connectToken);
    assert.equal(required(options).updateItem, update);
    assert.deepEqual(required(options).connectorIds, [200]);
    await required(options).onSuccess?.({ item: { id: itemId } });
    await registration;
  }
  await connect();
  await connect(itemId);
  await widget.destroy();
  assert.deepEqual(tokenRequests, [
    { options: { avoidDuplicates: true } },
    { itemId, options: { avoidDuplicates: true } },
  ]);
  assert.equal(
    dispatches.length,
    1,
    "registration starts the first import once, including reconnect callbacks",
  );
  const imported = await api.read(signal);
  assert.equal(imported.connections.length, 1);
  assert.equal(imported.connections[0]?.importStatus, "succeeded");
  assert.equal(imported.connections[0]?.hasTransactions, true);
  assert.equal(
    imported.connections[0]?.accounts[accountId]?.balanceMinor,
    "12345",
  );
  let assistant = await grant(app, cookie);
  function mcp(method: string, name?: string, args: object = {}) {
    return app.request("/mcp", {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method,
        params: {
          ...(name && { arguments: args, name }),
          _meta: {
            "io.modelcontextprotocol/clientCapabilities": {},
            "io.modelcontextprotocol/clientInfo": {
              name: "Installation fixture",
              version: "1",
            },
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          },
        },
      }),
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${assistant}`,
        "Content-Type": "application/json",
        "Mcp-Method": method,
        "Mcp-Protocol-Version": "2026-07-28",
        ...(name && { "Mcp-Name": name }),
      },
      method: "POST",
    });
  }
  async function call(name: string, args: object = {}) {
    const response = await mcp("tools/call", name, args);
    assert.equal(response.status, 200);
    const { result } = wire.parse(await response.json());
    assert.equal(result.isError, false);
    return z.json().parse(JSON.parse(required(result.content?.[0]?.text)));
  }
  assert.deepEqual(
    wire
      .parse(await (await mcp("tools/list")).json())
      .result.tools?.filter((tool) => tool.name.startsWith("caderninho_"))
      .map((tool) => tool.name)
      .sort(),
    [
      "caderninho_aggregate",
      "caderninho_status",
      "caderninho_sync",
      "caderninho_transactions",
    ],
  );
  const first = pageSchema.parse(
    await call("caderninho_transactions", { limit: 1 }),
  );
  assert.ok(first.cursor);
  assert.equal(
    totalsSchema.parse(await call("caderninho_aggregate", { metric: "debits" }))
      .groups[0]?.totalMinor,
    "900719925474099303",
  );
  vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  const renewed = cookies(await login(app));
  // A fresh access token is needed after 24h; owner login does not replace old grants.
  assistant = await grant(app, renewed);
  await call("caderninho_sync");
  const seen: string[] = [];
  async function readPage(cursor: Cursor | null): Promise<void> {
    const page = pageSchema.parse(
      await call("caderninho_transactions", {
        limit: 1,
        ...(cursor && { cursor }),
      }),
    );
    seen.push(...page.records.map((row) => row.id));
    if (page.cursor) {
      await readPage(page.cursor);
    }
  }
  await readPage(null);
  assert.deepEqual(seen.sort(), [a, b, c]);
  const totals = totalsSchema.parse(
    await call("caderninho_aggregate", { metric: "debits" }),
  );
  assert.equal(totals.groups[0]?.totalMinor, "900719925474099306");
  assert.equal(totals.groups[0]?.count, "3");
  assert.equal(totals.partial, false);
  assert.equal((await command(app, renewed, "logout")).status, 200);
  assert.equal((await mcp("tools/list")).status, 200);
  assert.equal(
    (await command(app, renewed, "disconnect-assistants")).status,
    200,
  );
  assert.equal((await mcp("tools/list")).status, 401);
  failingPaths.add("/connect_token");
  assert.equal((await command(app, renewed, "connect-token")).status, 500);
  assert.ok(logs.length > 0);
  assert.equal(logs.join("").includes(connectToken), false);
  for (const secret of [
    password,
    "synthetic-client",
    "synthetic-secret",
    apiKey,
  ]) {
    assert.equal(responses.join("").includes(secret), false);
    assert.equal(logs.join("").includes(secret), false);
    assert.equal(JSON.stringify(options).includes(secret), false);
  }
});

test("the source tables retain eighteen columns alongside additive planning storage", async () => {
  const tables = await env.DB.prepare(
    "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name!='d1_migrations' AND name IN ('connections','transactions') ORDER BY name",
  ).all<{ name: string }>();
  assert.deepEqual(
    tables.results.map((row) => row.name),
    ["connections", "transactions"],
  );
  const columns = async (table: string) =>
    (
      await env.DB.prepare(`PRAGMA table_info(${table})`).all<{
        name: string;
      }>()
    ).results
      .map((row) => row.name)
      .sort();
  assert.deepEqual(await columns("connections"), [
    "accounts",
    "id",
    "import_admitted_at",
    "import_checkpoint",
    "import_error",
    "import_id",
    "import_sequence",
    "import_status",
    "last_success_at",
  ]);
  assert.deepEqual(await columns("transactions"), [
    "account_id",
    "amount_minor",
    "category",
    "currency",
    "date",
    "description",
    "direction",
    "id",
    "status",
  ]);
  await collect(source([transaction()]));
  const persisted = required(
    await env.DB.prepare(
      "SELECT accounts, import_checkpoint FROM connections",
    ).first<{ accounts: string; import_checkpoint: string }>(),
  );
  assert.deepEqual(
    Object.keys(
      z.record(z.string(), z.json()).parse(JSON.parse(persisted.accounts)),
    ),
    ["a"],
  );
  const accounts = z
    .record(z.string(), z.record(z.string(), z.json()))
    .parse(JSON.parse(persisted.accounts));
  assert.deepEqual(Object.keys(required(accounts.a)).sort(), [
    "balanceMinor",
    "balanceObservedAt",
    "currency",
    "name",
    "type",
  ]);
  assert.deepEqual(
    Object.keys(
      z
        .record(z.string(), z.json())
        .parse(JSON.parse(persisted.import_checkpoint)),
    ).sort(),
    ["accountId", "cursor", "phase"],
  );
});
