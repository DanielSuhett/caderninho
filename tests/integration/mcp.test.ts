import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import { InvestmentListSchema } from "../../src/contracts";
import { planningOutputSchemas } from "../../src/contracts/planning-results";
import {
  Fault,
  FaultCode,
  FinancialIdentitySchema,
  type FinancialSource,
  TransactionIdentificationSchema,
} from "../../src/domain";
import { createLogger } from "../../src/shared/logger";
import { createInstallationRepository } from "../../src/worker/installation/repository";
import { withObservation } from "../../src/worker/observability";
import { runImport } from "../../src/worker/sync";
import { createSyncRepository } from "../../src/worker/sync/repository";
import { noInstitutions } from "../support";
import {
  command,
  cookies,
  fixture,
  grant,
  login,
  settings,
} from "./access-fixture";
import { admit, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

const wire = z.object({
  error: z.json().optional(),
  result: z
    .object({
      content: z
        .array(z.object({ text: z.string(), type: z.string() }))
        .optional(),
      isError: z.boolean().optional(),
      structuredContent: z.record(z.string(), z.unknown()).optional(),
      tools: z
        .array(
          z.object({
            name: z.string(),
            outputSchema: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});
const errorPayload = z.object({ error: z.string() });
const requestMeta = {
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    name: "Synthetic fixture",
    version: "1",
  },
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
};
beforeEach(setup);
test("official OAuth, legacy standard tools/defaults, protocol errors and grant revocation work together", async () => {
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
  assert.deepEqual(
    listing.result?.tools
      ?.filter((tool) => tool.name.startsWith("caderninho_"))
      .map((tool) => tool.name)
      .sort(),
    [
      "caderninho_aggregate",
      "caderninho_status",
      "caderninho_sync",
      "caderninho_transactions",
    ],
  );
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
    .object({
      accounts: z.never().optional(),
      records: z.array(z.object({ id: z.string() })),
    })
    .parse(JSON.parse(transactions.result?.content?.[0]?.text ?? "{}"));
  assert.equal(payload.records[0]?.id, "t");
  await createInstallationRepository(env.DB).register("unselected");
  const status = wire.parse(
    await (
      await call(first, "tools/call", {
        arguments: { connectionIds: ["c"] },
        name: "caderninho_status",
      })
    ).json(),
  );
  assert.equal(status.result?.isError, false);
  const statusPayload = z
    .object({
      accounts: z.never().optional(),
      connections: z.array(
        z.object({
          accounts: z.record(
            z.string(),
            z
              .object({
                balanceMinor: z.string().nullable(),
                balanceObservedAt: z.string().nullable(),
                currency: z.string(),
                identity: FinancialIdentitySchema.nullish(),
                name: z.string(),
                type: z.enum(["BANK", "CREDIT"]),
              })
              .strict(),
          ),
          id: z.string(),
        }),
      ),
    })
    .parse(JSON.parse(status.result?.content?.[0]?.text ?? "{}"));
  assert.deepEqual(
    statusPayload.connections.map((connection) => connection.id),
    ["c"],
  );
  assert.equal(statusPayload.connections[0]?.accounts.a?.balanceMinor, "12345");
  assert.equal(
    statusPayload.connections[0]?.accounts.a?.balanceObservedAt,
    "2026-10-01T00:00:00.000Z",
  );

  const invalid = wire.parse(
    await (
      await call(second, "tools/call", {
        arguments: { filter: { minAmountMinor: "0" } },
        name: "caderninho_transactions",
      })
    ).json(),
  );
  assert.equal(invalid.result?.isError, true);
  assert.deepEqual(
    errorPayload.parse(JSON.parse(invalid.result?.content?.[0]?.text ?? "{}")),
    { error: "INVALID_FILTER" },
  );
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
              filter: {
                accountIds: ["private-account"],
                connectionIds: ["private-connection"],
                description: "private-description",
                minAmountMinor: "0",
              },
            },
            name: "caderninho_transactions",
          },
        }),
        headers: {
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Mcp-Method": "tools/call",
          "Mcp-Name": "caderninho_transactions",
          "Mcp-Protocol-Version": "2026-07-28",
        },
        method: "POST",
      }),
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(wire.parse(body).result?.isError, true);
  assert.deepEqual(
    errorPayload.parse(
      JSON.parse(wire.parse(body).result?.content?.[0]?.text ?? "{}"),
    ),
    {
      error: "INVALID_FILTER",
    },
  );
  const serialized = JSON.stringify({ lines, spans });
  for (const secret of [
    "private-connection",
    "private-account",
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
  await createInstallationRepository(env.DB).register("c");
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
  assert.equal(state.connections[0]?.importStatus, null);
  assert.equal(state.connections[0]?.nextEligibleAt, null);
  await env.DB.exec(
    "CREATE TRIGGER reject_import BEFORE UPDATE OF import_id ON connections BEGIN SELECT RAISE(ABORT,'private-database-failure'); END;",
  );
  const failed = wire.parse(
    await (await fixture().request("/mcp", request)).json(),
  );
  assert.equal(failed.result?.isError, true);
  assert.deepEqual(JSON.parse(failed.result?.content?.[0]?.text ?? "{}"), {
    error: "IMPORT_FAILED",
  });
});

test("MCP accumulates imported history and updates only matching source IDs", async () => {
  await collect(
    source([
      transaction({ amount: "-10", id: "A" }),
      transaction({ amount: "-20", id: "B" }),
    ]),
  );
  const app = fixture();
  const token = await grant(app, cookies(await login(app)));
  const call = async (
    name: string,
    args: object = {},
    expectedError = false,
  ) => {
    const response = await app.request("/mcp", {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { _meta: requestMeta, arguments: args, name },
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
    const { result } = wire.parse(await response.json());
    assert.equal(result?.isError, expectedError);
    return z.json().parse(JSON.parse(result?.content?.[0]?.text ?? "{}"));
  };
  const firstPage = z
    .object({ cursor: z.json() })
    .parse(await call("caderninho_transactions", { limit: 1 }));
  const changedB = transaction({
    amount: "-25",
    category: "Updated",
    description: "Updated by source",
    id: "B",
    merchant: { cnpj: "00.000.000/0001-91", name: "Synthetic merchant" },
  });
  const updated: FinancialSource = {
    ...source([]),
    transactions: (_account, cursor) => {
      if (cursor === "last") {
        return Promise.resolve({
          next: null,
          records: [transaction({ amount: "-30", id: "C" })],
        });
      }
      return Promise.resolve({
        next: cursor === null ? "overlap" : "last",
        records: [changedB],
      });
    },
  };
  await collect(updated, "2026-10-02T00:00:00.000Z");
  assert.deepEqual(
    await call(
      "caderninho_transactions",
      { cursor: firstPage.cursor, limit: 1 },
      true,
    ),
    { error: "RESTART_REQUIRED" },
  );
  const query = z.object({
    cursor: z
      .object({
        accountId: z.string(),
        date: z.string(),
        id: z.string(),
        scope: z.string(),
        state: z.string(),
      })
      .nullable(),
    partial: z.boolean(),
    records: z.array(
      z
        .object({
          accountId: z.string(),
          amountMinor: z.string().nullable(),
          category: z.string().nullable(),
          currency: z.string(),
          date: z.string(),
          description: z.string(),
          direction: z.enum(["DEBIT", "CREDIT"]),
          id: z.string(),
          identification: TransactionIdentificationSchema.nullable(),
          status: z.enum(["POSTED", "PENDING"]),
        })
        .strict(),
    ),
  });
  const aggregate = z.object({
    groups: z.array(
      z.object({ count: z.string(), totalMinor: z.string().nullable() }),
    ),
    partial: z.boolean(),
  });
  const page = query.parse(await call("caderninho_transactions"));
  assert.deepEqual(page.records.map((row) => row.id).sort(), ["A", "B", "C"]);
  assert.equal(
    page.records.find((row) => row.id === "B")?.description,
    "Updated by source",
  );
  assert.equal(page.records.find((row) => row.id === "B")?.category, "Updated");
  const updatedRecord = page.records.find((row) => row.id === "B");
  assert.ok(updatedRecord?.identification);
  assert.deepEqual(updatedRecord.identification.merchant, {
    cnpj: "00.000.000/0001-91",
    name: "Synthetic merchant",
  });
  const totals = aggregate.parse(
    await call("caderninho_aggregate", { metric: "debits" }),
  );
  assert.equal(totals.groups[0]?.totalMinor, "6500");
  assert.equal(totals.partial, false);
  await Promise.all(
    [
      { filter: { ignored: true } },
      { filter: { presence: "not_observed" } },
    ].map(async (args) => {
      assert.deepEqual(
        errorPayload.parse(await call("caderninho_transactions", args, true)),
        { error: "INVALID_FILTER" },
      );
    }),
  );
  assert.deepEqual(
    errorPayload.parse(
      await call("caderninho_aggregate", { metric: "known_spending" }, true),
    ),
    { error: "INVALID_FILTER" },
  );
  await collect(updated, "2026-10-03T00:00:00.000Z");
  await collect(source([]), "2026-10-04T00:00:00.000Z");
  assert.equal(
    aggregate.parse(await call("caderninho_aggregate", { metric: "debits" }))
      .groups[0]?.totalMinor,
    "6500",
  );
  assert.equal(
    aggregate.parse(await call("caderninho_aggregate", { metric: "count" }))
      .groups[0]?.count,
    "3",
  );
  assert.equal(
    query.parse(await call("caderninho_transactions")).partial,
    false,
  );
  const id = await admit("2026-10-05T00:00:00.000Z");
  await assert.rejects(
    runImport(
      {
        now: () => "2026-10-05T00:00:00.000Z",
        repository: createSyncRepository(env.DB),
        source: {
          ...source([]),
          transactions: (_account, cursor) => {
            if (cursor) {
              return Promise.reject(new Fault(FaultCode.UPSTREAM_AUTH));
            }
            return Promise.resolve({
              next: "next",
              records: [
                transaction({ amount: "-27", id: "B" }),
                transaction({ amount: "-40", id: "D" }),
              ],
            });
          },
        },
        ...noInstitutions,
        steps: { do: (_name, fn) => fn() },
      },
      id,
    ),
    { code: "UPSTREAM_AUTH" },
  );
  const partialPage = query.parse(await call("caderninho_transactions"));
  assert.deepEqual(partialPage.records.map((row) => row.id).sort(), [
    "A",
    "B",
    "C",
    "D",
  ]);
  assert.equal(partialPage.partial, true);
  const partialTotal = aggregate.parse(
    await call("caderninho_aggregate", { metric: "debits" }),
  );
  assert.equal(partialTotal.groups[0]?.totalMinor, "10700");
  assert.equal(partialTotal.partial, true);
});

test("OAuth exposes 104 tools and executes confirmed local writes with durable replay", async () => {
  const app = fixture();
  const token = await grant(app, cookies(await login(app)));
  async function rpc(method: string, params: Record<string, unknown>) {
    return wire.parse(
      await (
        await app.request("/mcp", {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method,
            params: { ...params, _meta: requestMeta },
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
        })
      ).json(),
    );
  }
  const listed = await rpc("tools/list", {});
  assert.equal(listed.result?.tools?.length, 104);
  await Promise.all(
    [...planningOutputSchemas].map(async ([name, schema]) => {
      assert.ok(
        listed.result?.tools?.find((tool) => tool.name === name)?.outputSchema,
      );
      let argumentsValue: Record<string, unknown> = {
        from: "2026-10-01",
        to: "2026-10-24",
      };
      if (name === "get_investments") {
        argumentsValue = {};
      }
      if (name === "get_card_commitments") {
        argumentsValue = { month: "2026-10", months: 12 };
      }
      if (name === "generate_chart") {
        argumentsValue = { ...argumentsValue, includeSvg: false, type: "bar" };
      }
      const result = await rpc("tools/call", {
        arguments: argumentsValue,
        name,
      });
      assert.equal(result.result?.isError, false);
      assert.ok(schema.safeParse(result.result?.structuredContent).success);
      assert.deepEqual(
        result.result?.structuredContent,
        JSON.parse(result.result?.content?.[0]?.text ?? "{}"),
      );
    }),
  );
  const createdInvestment = await rpc("tools/call", {
    arguments: {
      amountMinor: "900719925474099301",
      confirmed: true,
      currency: "BRL",
      date: "2026-10-25",
      idempotency_key: "investor-mcp",
      name: "Reserva MCP",
      spaceId: "personal",
      type: "FIXED_INCOME",
    },
    name: "create_manual_investment",
  });
  assert.equal(createdInvestment.result?.isError, false);
  const investorRead = await rpc("tools/call", {
    arguments: { currency: "BRL", type: "FIXED_INCOME" },
    name: "get_investments",
  });
  assert.equal(investorRead.result?.isError, false);
  const investor = InvestmentListSchema.parse(
    investorRead.result?.structuredContent,
  ).data;
  assert.equal(investor.records[0]?.name, "Reserva MCP");
  assert.equal(investor.totals[0]?.gross.totalMinor, "900719925474099301");
  const groupRequest = {
    arguments: {
      color: "#123456",
      confirmed: true,
      icon: "gift",
      idempotency_key: "mcp-group",
      name: "Eventos",
      spaceId: "personal",
    },
    name: "create_category_group",
  };
  const group = await rpc("tools/call", groupRequest);
  assert.equal(group.result?.isError, false);
  assert.deepEqual(await rpc("tools/call", groupRequest), group);
  const groupId = z
    .object({ id: z.string() })
    .parse(JSON.parse(group.result?.content?.[0]?.text ?? "{}")).id;
  const updatedCategory = await rpc("tools/call", {
    arguments: {
      color: "#abcdef",
      confirmed: true,
      groupId,
      icon: "heart",
      id: "personal:fixed:casamento",
      idempotency_key: "mcp-category",
      spaceId: "personal",
    },
    name: "update_category",
  });
  assert.equal(updatedCategory.result?.isError, false);
  const groups = await rpc("tools/call", {
    arguments: { spaceId: "personal" },
    name: "get_category_groups",
  });
  assert.equal(groups.result?.isError, false);
  assert.ok((groups.result?.content?.[0]?.text ?? "").includes(groupId));
  const args = {
    currency: "BRL",
    idempotency_key: "mcp-write",
    name: "MCP account",
    openingBalanceMinor: "100",
    spaceId: "personal",
    type: "BANK",
  };
  const refused = await rpc("tools/call", {
    arguments: args,
    name: "create_manual_account",
  });
  assert.equal(refused.result?.isError, true);
  const request = {
    arguments: { ...args, confirmed: true },
    name: "create_manual_account",
  };
  const created = await rpc("tools/call", request);
  assert.equal(created.result?.isError, false);
  assert.deepEqual(await rpc("tools/call", request), created);
  const conflicting = await rpc("tools/call", {
    ...request,
    arguments: { ...args, confirmed: true, name: "Different" },
  });
  assert.equal(conflicting.result?.isError, true);
  assert.deepEqual(JSON.parse(conflicting.result?.content?.[0]?.text ?? "{}"), {
    error: "IDEMPOTENCY_CONFLICT",
  });
  const queried = await rpc("tools/call", {
    arguments: {},
    name: "get_accounts",
  });
  assert.equal(queried.result?.isError, false);
  const payload = z
    .object({
      data: z.object({
        records: z.array(
          z.object({ balanceMinor: z.string(), name: z.string() }),
        ),
      }),
    })
    .parse(JSON.parse(queried.result?.content?.[0]?.text ?? "{}"));
  assert.deepEqual(
    payload.data.records.map((row) => ({
      balanceMinor: row.balanceMinor,
      name: row.name,
    })),
    [{ balanceMinor: "100", name: "MCP account" }],
  );
});
