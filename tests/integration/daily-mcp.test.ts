import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import { cookies, fixture, grant, login, origin } from "./access-fixture";
import { account, admit, collect, setup, source, transaction } from "./fixture";

beforeEach(setup);
afterEach(() => vi.useRealTimers());

async function client() {
  const app = fixture();
  const token = await grant(app, cookies(await login(app)));
  return async (name: string, args: object = {}) => {
    const response = await app.request("/mcp", {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          _meta: {
            "io.modelcontextprotocol/clientCapabilities": {},
            "io.modelcontextprotocol/clientInfo": {
              name: "Daily usage regression",
              version: "1",
            },
            "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          },
          arguments: args,
          name,
        },
      }),
      headers: {
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Mcp-Method": "tools/call",
        "Mcp-Name": name,
        "Mcp-Protocol-Version": "2026-07-28",
      },
      method: "POST",
    });
    const { result } = z
      .object({
        result: z.object({
          content: z.array(z.object({ text: z.string() })),
          isError: z.boolean(),
        }),
      })
      .parse(await response.json());
    const payload = z.json().parse(JSON.parse(result.content[0]?.text ?? ""));
    return { failed: result.isError, payload };
  };
}

test("two people's timeline never silently accepts an unknown selected account or connection", async () => {
  await collect(source([transaction({ amount: "-10", id: "first" })]));
  await collect(
    source(
      [transaction({ accountId: "b", amount: "-20", id: "second" })],
      [account({ id: "b", itemId: "d" })],
    ),
    "2026-10-01T00:00:00.000Z",
    "d",
  );
  const call = await client();
  await Promise.all(
    [
      { connectionIds: ["c", "missing"] },
      { accountIds: ["a", "missing"] },
      { accountIds: ["missing"] },
    ].flatMap((filter) =>
      ["caderninho_transactions", "caderninho_aggregate"].map(async (name) => {
        assert.deepEqual(await call(name, { filter }), {
          failed: true,
          payload: { error: "NOT_FOUND" },
        });
      }),
    ),
  );
  assert.deepEqual(
    await call("caderninho_status", { connectionIds: ["c", "missing"] }),
    { failed: true, payload: { error: "NOT_FOUND" } },
  );
  const selected = await call("caderninho_aggregate", {
    filter: { accountIds: ["a"], connectionIds: ["c", "d"] },
    metric: "debits",
  });
  assert.equal(selected.failed, false);
  assert.equal(
    z
      .object({ groups: z.array(z.object({ totalMinor: z.string() })) })
      .parse(selected.payload).groups[0]?.totalMinor,
    "1000",
  );
  const total = await call("caderninho_aggregate", { metric: "debits" });
  assert.equal(
    z
      .object({ groups: z.array(z.object({ totalMinor: z.string() })) })
      .parse(total.payload).groups[0]?.totalMinor,
    "3000",
  );
});

test("Portuguese description searches ignore letter case and keep wildcard characters literal", async () => {
  await collect(
    source([
      transaction({ description: "Almoço São Paulo", id: "lower" }),
      transaction({ description: "SÃO PAULO", id: "upper" }),
      transaction({ description: "SAO PAULO", id: "unaccented" }),
      transaction({ description: "Taxa 5% [VIP] * ?", id: "literal" }),
    ]),
  );
  const call = await client();
  const page = z.object({ records: z.array(z.object({ id: z.string() })) });
  await Promise.all(
    [
      { description: "são paulo", ids: ["lower", "upper"] },
      { description: "São Paulo", ids: ["lower", "upper"] },
      { description: "SÃO PAULO", ids: ["lower", "upper"] },
      ...["*", "?", "[vip]", "5%", "]"].map((description) => ({
        description,
        ids: ["literal"],
      })),
    ].map(async ({ description, ids }) => {
      const result = await call("caderninho_transactions", {
        filter: { description },
      });
      assert.equal(result.failed, false);
      assert.deepEqual(
        page
          .parse(result.payload)
          .records.map((row) => row.id)
          .sort(),
        ids,
      );
    }),
  );
});

test("MCP filter errors identify a safe repair without echoing private arguments", async () => {
  const call = await client();
  const cases = [
    [
      { filter: { minAmountMinor: "1000" } },
      "filter.currency",
      "Monetary filters require currency",
    ],
    [
      { filter: { from: "2026-10-22", to: "2026-10-01" } },
      "filter.to",
      "Invalid date range",
    ],
    [
      {
        filter: {
          currency: "BRL",
          maxAmountMinor: "100",
          minAmountMinor: "200",
        },
      },
      "filter.maxAmountMinor",
      "Invalid amount range",
    ],
    [
      {
        filter: {
          description: "private-description",
          "private-key": "private-value",
        },
      },
      "filter",
      "Unknown field",
    ],
  ] satisfies [object, string, string][];
  await Promise.all(
    cases.map(async ([args, path, message]) => {
      const result = await call("caderninho_transactions", args);
      assert.deepEqual(result, {
        failed: true,
        payload: { error: "INVALID_FILTER", issues: [{ message, path }] },
      });
      const serialized = JSON.stringify(result);
      for (const secret of [
        "private-description",
        "private-key",
        "private-value",
      ]) {
        assert.equal(serialized.includes(secret), false);
      }
    }),
  );
});

test("reordering or repeating selected account and connection IDs does not restart a timeline", async () => {
  await collect(
    source([transaction({ id: "first" }), transaction({ id: "second" })]),
  );
  await collect(
    source(
      [transaction({ accountId: "b", id: "third" })],
      [account({ id: "b", itemId: "d" })],
    ),
    "2026-10-01T00:00:00.000Z",
    "d",
  );
  const call = await client();
  const first = await call("caderninho_transactions", {
    filter: { accountIds: ["a", "b"], connectionIds: ["c", "d"] },
    limit: 1,
  });
  const page = z.object({
    cursor: z.json(),
    records: z.array(z.object({ id: z.string() })),
  });
  const firstPage = page.parse(first.payload);
  assert.ok(firstPage.cursor);
  const second = await call("caderninho_transactions", {
    cursor: firstPage.cursor,
    filter: { accountIds: ["b", "a", "a"], connectionIds: ["d", "c", "d"] },
  });
  assert.equal(second.failed, false);
  assert.deepEqual(
    [...firstPage.records, ...page.parse(second.payload).records]
      .map((row) => row.id)
      .sort(),
    ["first", "second", "third"],
  );
  assert.deepEqual(
    await call("caderninho_transactions", {
      cursor: firstPage.cursor,
      filter: { accountIds: ["a"], connectionIds: ["c"] },
    }),
    { failed: true, payload: { error: "CURSOR_SCOPE_MISMATCH" } },
  );
});

test("owner command input limits reject invalid bodies without an internal error or import", async () => {
  const app = fixture();
  const cookie = cookies(await login(app));
  const { csrf } = z
    .object({ csrf: z.string() })
    .parse(
      await (
        await app.request("/api/account", { headers: { Cookie: cookie } })
      ).json(),
    );
  const cases = [
    [JSON.stringify({ csrf, padding: "x".repeat(32_768) }), 413],
    [undefined, 400],
  ] satisfies [string | undefined, number][];
  await Promise.all(
    cases.map(async ([body, status]) => {
      const response = await app.request("/api/account/sync", {
        ...(body !== undefined && { body }),
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          Origin: origin,
        },
        method: "POST",
      });
      assert.equal(response.status, status);
    }),
  );
  const after = await app.request("/api/account", {
    headers: { Cookie: cookie },
  });
  assert.deepEqual(
    z.object({ connections: z.array(z.json()) }).parse(await after.json())
      .connections,
    [],
  );
});

test("an empty recent timeline exposes the oldest successful collection in its selected connections", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T12:00:00.000Z"));
  await collect(source([transaction()]));
  await collect(
    source(
      [transaction({ accountId: "b", id: "second" })],
      [account({ id: "b", itemId: "d" })],
    ),
    "2026-10-05T00:00:00.000Z",
    "d",
  );
  const call = await client();
  const selection = {
    connectionIds: ["c", "d"],
    from: "2026-10-22",
    to: "2026-10-22",
  };
  for (const result of await Promise.all([
    call("caderninho_transactions", { filter: selection }),
    call("caderninho_aggregate", { filter: selection, metric: "debits" }),
  ])) {
    assert.equal(result.failed, false);
    assert.deepEqual(
      z
        .object({
          oldestLastSuccessAt: z.string().nullable(),
          partial: z.boolean(),
          referenceDay: z.string(),
        })
        .parse(result.payload),
      {
        oldestLastSuccessAt: "2026-10-01T00:00:00.000Z",
        partial: false,
        referenceDay: "2026-10-22",
      },
    );
  }
  const selected = await call("caderninho_transactions", {
    filter: { connectionIds: ["d"] },
  });
  assert.equal(
    z.object({ oldestLastSuccessAt: z.string() }).parse(selected.payload)
      .oldestLastSuccessAt,
    "2026-10-05T00:00:00.000Z",
  );
  await admit("2026-10-22T00:00:00.000Z", "pending");
  const neverCompleted = await call("caderninho_aggregate");
  assert.deepEqual(
    z
      .object({
        oldestLastSuccessAt: z.string().nullable(),
        partial: z.boolean(),
      })
      .parse(neverCompleted.payload),
    { oldestLastSuccessAt: null, partial: true },
  );
});
