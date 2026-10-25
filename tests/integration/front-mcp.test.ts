import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import {
  FinancialOverviewResponseSchema,
  MonthlySpendingResponseSchema,
  PortalTransactionListSchema,
  RulePreviewResultSchema,
  TransactionListSchema,
  WorkspaceCatalogSchema,
} from "../../src/contracts";
import { command, cookies, fixture, grant, login } from "./access-fixture";
import { account, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
const toolReply = z.object({
  result: z.object({
    content: z.array(z.object({ text: z.string(), type: z.literal("text") })),
    isError: z.boolean(),
  }),
});
async function client() {
  const app = fixture();
  const cookie = cookies(await login(app));
  const token = await grant(app, cookie);
  async function call(name: string, args: Record<string, unknown> = {}) {
    const response = await app.request("/mcp", {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          _meta: {
            "io.modelcontextprotocol/clientCapabilities": {},
            "io.modelcontextprotocol/clientInfo": {
              name: "Parity fixture",
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
    const { result } = toolReply.parse(await response.json());
    const value: unknown = JSON.parse(result.content[0]?.text ?? "null");
    return { error: result.isError, status: response.status, value };
  }
  return {
    call,
    catalog: (spaceId = "personal") =>
      app.request(`/api/account/catalog?${new URLSearchParams({ spaceId })}`, {
        headers: { Cookie: cookie },
      }),
    portal: (action: string, fields: Record<string, unknown>) =>
      command(app, cookie, action, fields),
    write: (name: string, fields: Record<string, unknown> = {}) =>
      call(name, {
        confirmed: true,
        idempotency_key: crypto.randomUUID(),
        spaceId: "personal",
        ...fields,
      }),
  };
}

test("MCP rule preview matches the front's exact AND/OR result without changing the ledger", async () => {
  await collect(
    source([
      transaction({
        amount: "-90071992547409.93",
        description: "Mercado %_",
        id: "match",
      }),
      transaction({
        amount: "-90071992547409.92",
        description: "Mercado %_",
        id: "below",
      }),
      transaction({
        amount: "-90071992547409.93",
        currencyCode: "USD",
        description: "Mercado %_",
        id: "usd",
      }),
    ]),
  );
  const f = await client();
  const filter = {
    alternatives: [
      {
        conditions: [
          { field: "description", operator: "contains", value: "%_" },
          { field: "amount", operator: "gte", value: "9007199254740993" },
        ],
      },
    ],
    currency: "BRL",
  };
  const selection = {
    accountId: "a",
    direction: "DEBIT",
    filter,
    spaceId: "personal",
  };
  const before = await env.DB.prepare(
    "SELECT revision FROM planning_revision WHERE id=1",
  ).first("revision");
  const front = await f.portal("rule-preview", selection);
  assert.equal(front.status, 200);
  const expected = RulePreviewResultSchema.parse(await front.json());
  const mcp = await f.call("preview_rule", selection);
  assert.equal(mcp.status, 200);
  assert.equal(mcp.error, false, JSON.stringify(mcp.value));
  const actual = z
    .object({ data: RulePreviewResultSchema })
    .parse(mcp.value).data;
  assert.deepEqual(actual, expected);
  assert.equal(actual.count, 1);
  assert.equal(actual.samples[0]?.id, "match");
  assert.equal(actual.samples[0]?.amountMinor, "-9007199254740993");
  assert.equal(
    await env.DB.prepare(
      "SELECT revision FROM planning_revision WHERE id=1",
    ).first("revision"),
    before,
  );
  assert.equal(
    await env.DB.prepare("SELECT count(*) AS n FROM planning_edits").first("n"),
    0,
  );
  const invalid = await f.call("preview_rule", {
    ...selection,
    spaceId: "missing",
  });
  assert.equal(invalid.error, true);
  assert.deepEqual(invalid.value, { error: "NOT_FOUND" });
});

test("MCP purchases match the front's grouped installments, identification and pagination", async () => {
  await collect(
    source(
      [
        ...[1, 2, 3].map((installmentNumber) =>
          transaction({
            amount: "-90071992547409.93",
            creditCardMetadata: {
              cardNumber: "1234",
              installmentNumber,
              purchaseDate: "2024-01-12",
              totalInstallments: 3,
            },
            date:
              installmentNumber === 3
                ? "2099-03-01"
                : `2024-0${installmentNumber}-12`,
            description: "Compra sintética",
            id: `card-${installmentNumber}`,
            merchant: {
              cnpj: "00.000.000/0001-91",
              name: "Comerciante sintético",
            },
            status: installmentNumber === 1 ? "POSTED" : "PENDING",
          }),
        ),
        transaction({ accountId: "b", date: "2024-01-01", id: "bank" }),
      ],
      [account({ type: "CREDIT" }), account({ id: "b" })],
    ),
  );
  const f = await client();
  const selection = {
    from: "2024-01-01",
    limit: 1,
    spaceId: "personal",
    to: "2024-01-31",
  };
  const front = await f.portal("query", {
    query: { ...selection, tool: "get_portal_transactions" },
  });
  assert.equal(front.status, 200);
  const expected = PortalTransactionListSchema.parse(await front.json());
  const mcp = await f.call("get_transaction_purchases", selection);
  assert.equal(mcp.status, 200);
  assert.equal(mcp.error, false, JSON.stringify(mcp.value));
  const actual = PortalTransactionListSchema.parse(mcp.value);
  assert.deepEqual(actual, expected);
  const [purchase] = actual.data.records;
  assert.ok(purchase);
  assert.equal(purchase.anchorDate, "2024-01-12");
  assert.equal(purchase.amountMinor, "-9007199254740993");
  assert.equal(
    purchase.identification?.merchant?.name,
    "Comerciante sintético",
  );
  assert.equal(purchase.installments.length, 3);
  assert.equal(purchase.installments[2]?.date, "2099-03-01");
  assert.equal(purchase.installments[2]?.status, "PENDING");
  assert.ok(actual.data.cursor);
  const next = await f.call("get_transaction_purchases", {
    ...selection,
    cursor: actual.data.cursor,
  });
  assert.equal(next.error, false);
  assert.deepEqual(
    PortalTransactionListSchema.parse(next.value).data.records.map(
      (row) => row.id,
    ),
    ["bank"],
  );
});

test("purchase queries apply currency and reject unknown selection references consistently with transactions", async () => {
  await collect(
    source([
      transaction({ date: "2024-01-01", id: "brl" }),
      transaction({ currencyCode: "USD", date: "2024-01-01", id: "usd" }),
    ]),
  );
  const f = await client();
  const selected = await f.call("get_transaction_purchases", {
    currency: "USD",
    spaceId: "personal",
  });
  assert.equal(selected.error, false);
  assert.deepEqual(
    PortalTransactionListSchema.parse(selected.value).data.records.map(
      (row) => row.id,
    ),
    ["usd"],
  );
  await Promise.all(
    [
      { accountId: "missing", spaceId: "personal" },
      { categoryId: "missing", spaceId: "personal" },
      { personId: "missing", spaceId: "personal" },
      { spaceId: "missing" },
    ].flatMap((selection) =>
      (
        [
          ["get_transactions", "get_transactions"],
          ["get_transaction_purchases", "get_portal_transactions"],
        ] as const
      ).map(async ([mcpTool, portalTool]) => {
        const [result, front] = await Promise.all([
          f.call(mcpTool, selection),
          f.portal("query", { query: { ...selection, tool: portalTool } }),
        ]);
        assert.equal(
          result.error,
          true,
          JSON.stringify({ mcpTool, selection }),
        );
        assert.deepEqual(result.value, { error: "NOT_FOUND" });
        assert.equal(front.status, 404);
      }),
    ),
  );
});

test("malformed planning cursors remain input errors in both HTTP and MCP", async () => {
  await collect(source([]));
  const f = await client();
  await Promise.all(
    ["%", "not-json", "[]"].flatMap((cursor) =>
      (
        [
          ["get_transactions", "get_transactions"],
          ["get_transaction_purchases", "get_portal_transactions"],
        ] as const
      ).map(async ([mcpTool, portalTool]) => {
        const selection = { cursor, spaceId: "personal" };
        const [result, front] = await Promise.all([
          f.call(mcpTool, selection),
          f.portal("query", { query: { ...selection, tool: portalTool } }),
        ]);
        assert.equal(result.error, true);
        assert.equal(
          z.object({ error: z.string() }).parse(result.value).error,
          "INVALID_FILTER",
        );
        assert.equal(front.status, 400);
      }),
    ),
  );
});

test("a reversed financial period is a rejected request in both HTTP and MCP", async () => {
  await collect(source([]));
  const f = await client();
  const query = {
    from: "2026-10-24",
    spaceId: "personal",
    to: "2026-10-01",
    tool: "get_overview",
  };
  const { tool, ...selection } = query;
  const [mcp, front] = await Promise.all([
    f.call(tool, selection),
    f.portal("query", { query }),
  ]);
  assert.equal(mcp.error, true);
  assert.deepEqual(mcp.value, { error: "INVALID_PERIOD" });
  assert.equal(front.status, 400);
});

test("MCP edits of category groups, categories, rules and spaces round-trip to the front with confirmation and replay", async () => {
  await collect(
    source([
      transaction({ category: "Shopping", description: "Mercado sintético" }),
    ]),
  );
  const f = await client();
  const id = (value: unknown) => z.object({ id: z.string() }).parse(value).id;
  const groupFields = {
    color: "#123456",
    icon: "gift",
    idempotency_key: "group-create",
    name: "Projeto",
  };
  const group = await f.write("create_category_group", groupFields);
  assert.equal(group.error, false);
  const groupId = id(group.value);
  assert.deepEqual(await f.write("create_category_group", groupFields), group);
  const conflict = await f.write("create_category_group", {
    ...groupFields,
    name: "Outro projeto",
  });
  assert.equal(conflict.error, true);
  assert.deepEqual(conflict.value, { error: "IDEMPOTENCY_CONFLICT" });
  assert.equal(
    (
      await f.write("update_category_group", {
        color: "#7c3aed",
        icon: "star",
        id: groupId,
        name: "Projeto revisado",
      })
    ).error,
    false,
  );
  const categoryId = "personal:fixed:mercado";
  assert.equal(
    (
      await f.write("update_category", {
        color: "#7c3aed",
        groupId,
        icon: "gift",
        id: categoryId,
      })
    ).error,
    false,
  );
  const custom = await f.write("create_category", {
    color: "#abcdef",
    groupId,
    icon: "home",
    kind: "expense",
    name: "Categoria sintética",
  });
  assert.equal(custom.error, false);
  assert.equal(
    (
      await f.write("update_category", {
        id: id(custom.value),
        name: "Categoria revisada",
      })
    ).error,
    false,
  );
  const createdRule = await f.write("create_rule", {
    categoryId,
    name: "Mercado",
    text: "Mercado",
  });
  assert.equal(createdRule.error, false);
  const ruleId = id(createdRule.value);
  assert.equal(
    (
      await f.write("update_rule", {
        categoryId: "personal:transfer",
        id: ruleId,
        name: "Mercado como transferência",
        text: "Mercado",
      })
    ).error,
    false,
  );
  const before = TransactionListSchema.parse(
    (await f.call("get_transactions")).value,
  );
  assert.equal(before.data.records[0]?.category, "personal:fixed:compras");
  const period = { from: "2026-10-01", to: "2026-10-31" };
  const overview = await f.call("get_overview", period);
  assert.equal(overview.error, false);
  assert.equal(
    FinancialOverviewResponseSchema.parse(overview.value).data.totals[0]
      ?.expenseMinor,
    "1000",
  );
  const monthly = await f.call("generate_chart", {
    ...period,
    groupBy: "month",
    type: "line",
  });
  assert.equal(monthly.error, false);
  assert.equal(
    MonthlySpendingResponseSchema.parse(monthly.value).data.groups[0]
      ?.amountMinor,
    "1000",
  );
  const categories = await f.call("get_categories", { include_hidden: true });
  const groups = await f.call("get_category_groups");
  const rules = await f.call("get_rules");
  const spaces = await f.call("get_spaces");
  const tags = await f.call("get_tags");
  const records = z.object({
    data: z.object({ records: z.array(z.unknown()) }),
  });
  for (const reply of [categories, groups, rules, spaces, tags]) {
    assert.equal(reply.error, false);
  }
  const front = WorkspaceCatalogSchema.parse(await (await f.catalog()).json());
  const mcpCatalog = WorkspaceCatalogSchema.parse({
    categories: records.parse(categories.value).data.records,
    categoryGroups: records.parse(groups.value).data.records,
    rules: records.parse(rules.value).data.records,
    spaces: records.parse(spaces.value).data.records,
    tags: records.parse(tags.value).data.records,
  });
  assert.deepEqual(mcpCatalog, front);
  assert.equal(
    front.categories.find((row) => row.id === categoryId)?.color,
    "#7c3aed",
  );
  assert.equal(
    front.categoryGroups.find((row) => row.id === groupId)?.name,
    "Projeto revisado",
  );
  assert.equal(
    front.rules.find((row) => row.id === ruleId)?.categoryId,
    "personal:transfer",
  );
  const refused = await f.call("update_category", {
    color: "#112233",
    id: categoryId,
    idempotency_key: "unconfirmed",
    spaceId: "personal",
  });
  assert.equal(refused.error, true);
  const protectedCategory = await f.write("update_category", {
    id: categoryId,
    name: "Alterar nome fixo",
  });
  assert.equal(protectedCategory.error, true);
  assert.deepEqual(protectedCategory.value, { error: "SYSTEM_CATEGORY" });
  assert.equal((await f.write("apply_rules", period)).error, false);
  const after = TransactionListSchema.parse(
    (await f.call("get_transactions")).value,
  );
  assert.equal(after.data.records[0]?.category, "personal:transfer");
  const [totals] = FinancialOverviewResponseSchema.parse(
    (await f.call("get_overview", period)).value,
  ).data.totals;
  assert.equal(totals?.expenseMinor, "0");
  assert.equal(totals?.cashFlowMinor, "-1000");
  assert.equal(
    await env.DB.prepare(
      "SELECT category FROM transactions WHERE id='t'",
    ).first("category"),
    "Shopping",
  );
  assert.equal((await f.write("delete_rule", { id: ruleId })).error, false);
  assert.equal(
    (await f.write("delete_category", { id: id(custom.value) })).error,
    false,
  );
  assert.equal(
    (await f.write("delete_category_group", { id: groupId })).error,
    false,
  );
  const final = WorkspaceCatalogSchema.parse(await (await f.catalog()).json());
  assert.equal(final.rules.length, 0);
  assert.equal(
    final.categories.find((row) => row.id === categoryId)?.groupId,
    null,
  );
  assert.equal(
    final.categoryGroups.some((row) => row.id === groupId),
    false,
  );
  const createdSpace = await f.write("create_space", {
    currency: "BRL",
    name: "Grupo sintético",
  });
  assert.equal(createdSpace.error, false);
  const spaceId = id(createdSpace.value);
  assert.equal(
    (
      await f.write("update_space", {
        id: spaceId,
        name: "Grupo revisado",
        spaceId,
      })
    ).error,
    false,
  );
  const other = await f.call("get_categories", {
    include_hidden: true,
    spaceId,
  });
  assert.equal(other.error, false);
  const appearance = z
    .object({
      data: z.object({
        records: z.array(
          z.object({
            color: z.string(),
            groupId: z.string().nullable(),
            icon: z.string(),
          }),
        ),
      }),
    })
    .parse(other.value);
  assert.equal(appearance.data.records.length, 35);
  const wrongScope = await f.write("update_category", {
    color: "#112233",
    id: categoryId,
    spaceId,
  });
  assert.equal(wrongScope.error, true);
  assert.deepEqual(wrongScope.value, { error: "SPACE_MISMATCH" });
  assert.equal(
    (await f.write("delete_space", { id: spaceId, spaceId })).error,
    false,
  );
  assert.equal((await f.catalog(spaceId)).status, 404);
});
