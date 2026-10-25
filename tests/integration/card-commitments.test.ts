import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import {
  CardCommitmentsQuerySchema,
  CardCommitmentsResponseSchema,
  PlanningCommandSchema,
  TransactionListSchema,
  tools,
} from "../../src/contracts";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { required } from "../support";
import { command, cookies, fixture, grant, login } from "./access-fixture";
import { account, admit, collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(async () => {
  await setup();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T15:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());

function planning() {
  const service = createPlanningService(createPlanningRepository(env.DB));
  const call = (tool: string, fields: Record<string, unknown> = {}) =>
    service.execute(PlanningCommandSchema.parse({ tool, ...fields }));
  return {
    call,
    query: async (fields: Record<string, unknown> = {}) =>
      CardCommitmentsResponseSchema.parse(
        await call("get_card_commitments", {
          month: "2026-10",
          months: 3,
          ...fields,
        }),
      ),
    write: (tool: string, fields: Record<string, unknown>) =>
      call(tool, {
        confirmed: true,
        idempotency_key: crypto.randomUUID(),
        spaceId: "personal",
        ...fields,
      }),
  };
}
const credit = (fields: Parameters<typeof account>[0] = {}) =>
  account({
    balance: "9999",
    creditData: { availableCreditLimit: "400", creditLimit: "1000" },
    name: "Card",
    number: "1234",
    type: "CREDIT",
    ...fields,
  });
const installment = {
  cardNumber: "1234",
  installmentNumber: 2,
  purchaseDate: "2026-09-01",
  totalInstallments: 6,
};

test("card commitments read the complete effective CREDIT selection and separate refunds, pending, future and unclassified installments", async () => {
  await collect(
    source(
      [
        ...Array.from({ length: 501 }, (_, index) =>
          transaction({
            amount: "-9007199254740993.01",
            category: "Groceries",
            id: `purchase-${index}`,
          }),
        ),
        transaction({
          amount: "100",
          category: "Groceries",
          id: "refund",
          type: "CREDIT",
        }),
        transaction({
          amount: "7000",
          category: "Salary",
          id: "credit-not-refund",
          type: "CREDIT",
        }),
        transaction({
          amount: "-2000",
          category: "Groceries",
          id: "bill-payment",
          operationType: "PAGAMENTO_FATURA",
        }),
        transaction({ category: "Transfers", id: "transfer" }),
        transaction({ category: "Groceries", id: "ignored" }),
        transaction({
          amount: "-7",
          category: "Groceries",
          creditCardMetadata: installment,
          id: "pending",
          status: "PENDING",
        }),
        transaction({
          amount: "-12",
          category: "Groceries",
          creditCardMetadata: { ...installment, installmentNumber: 3 },
          date: "2026-11-01",
          id: "future-posted",
        }),
        transaction({
          amount: "-13",
          category: "Groceries",
          creditCardMetadata: { ...installment, installmentNumber: 4 },
          date: "2026-12-01",
          id: "future-pending",
          status: "PENDING",
        }),
        transaction({
          amount: "-9",
          category: null,
          creditCardMetadata: { ...installment, installmentNumber: 5 },
          date: "2026-11-02",
          id: "uncategorized-installment",
        }),
        transaction({
          accountId: "bank",
          amount: "-99999999999999999",
          category: "Groceries",
          id: "bank-expense",
        }),
      ],
      [credit(), account({ id: "bank" })],
    ),
  );
  const f = planning();
  await f.write("edit_transaction", { id: "ignored", ignored: true });
  await f.write("edit_transaction", {
    amountMinor: "123",
    id: "purchase-0",
  });
  const result = await f.query();
  const total = required(result.data.totals[0]);
  const spent = (500n * 900719925474099301n + 123n - 10000n).toString();
  assert.equal(total.currency, "BRL");
  assert.equal(total.spentMinor, spent);
  assert.equal(total.pendingMinor, "700");
  assert.equal(total.futureMinor, "2500");
  assert.equal(
    total.observedCommitmentsMinor,
    (BigInt(spent) + 3200n).toString(),
  );
  assert.equal(total.unclassifiedCount, 1);
  assert.equal(total.knownUnclassifiedMinor, "900");
  assert.equal(
    result.data.categories[0]?.amountMinor,
    total.observedCommitmentsMinor,
  );
  assert.equal(result.data.months.length, 3);
  assert.equal(result.data.months[1]?.spentMinor, "0");
  assert.equal(result.data.months[1]?.futureMinor, "1200");
  assert.deepEqual(
    result.data.installments.map((row) => [row.id, row.phase]),
    [
      ["pending", "pending"],
      ["future-posted", "future"],
      ["uncategorized-installment", "future"],
      ["future-pending", "future"],
    ],
  );
  assert.equal(result.data.installments[2]?.categoryName, "Sem categoria");
  assert.equal(result.data.installments.length, 4);
  assert.equal(result.data.accounts.length, 1);
  assert.equal(result.data.accounts[0]?.creditLimitMinor, "100000");
  assert.equal(result.data.accounts[0]?.availableCreditMinor, "40000");
  assert.equal(result.data.accounts[0]?.allocatedCreditMinor, "60000");
  assert.equal(result.data.referenceDay, "2026-10-24");
  assert.equal(result.oldestLastSuccessAt, "2026-10-01T00:00:00.000Z");
});

test("unknown values stay unknown, category refunds stay signed and currency filters use transaction currency", async () => {
  await collect(
    source(
      [
        transaction({ amount: "-10", category: "Groceries", id: "known" }),
        transaction({ amount: null, category: "Groceries", id: "unknown" }),
        transaction({
          amount: null,
          category: null,
          creditCardMetadata: installment,
          id: "unknown-unclassified",
        }),
        transaction({
          amount: "20",
          category: "Shopping",
          id: "refund-only-category",
          type: "CREDIT",
        }),
        transaction({
          amount: "-5.50",
          category: "Groceries",
          currencyCode: "USD",
          id: "foreign-currency",
        }),
      ],
      [credit({ creditData: {} })],
    ),
  );
  const f = planning();
  const result = await f.query();
  const brl = required(
    result.data.totals.find((row) => row.currency === "BRL"),
  );
  assert.equal(brl.spentMinor, null);
  assert.equal(brl.knownSpentMinor, "-1000");
  assert.equal(brl.observedCommitmentsMinor, null);
  assert.equal(brl.unknownAmountCount, 1);
  assert.equal(brl.unclassifiedUnknownAmountCount, 1);
  assert.equal(
    result.data.categories.find((row) => row.name === "Compras")?.amountMinor,
    "-2000",
  );
  assert.equal(result.data.installments[0]?.amountMinor, null);
  assert.equal(result.data.accounts[0]?.creditLimitMinor, null);
  assert.equal(result.data.accounts[0]?.availableCreditMinor, null);
  assert.equal(result.data.accounts[0]?.allocatedCreditMinor, null);
  assert.equal(result.data.accounts[0]?.limitSource, "unavailable");
  const selected = await f.query({ currency: "USD" });
  assert.equal(selected.data.totals.length, 1);
  assert.equal(selected.data.totals[0]?.spentMinor, "550");
  assert.equal(selected.data.totals[0]?.currency, "USD");
  assert.equal(selected.data.accounts[0]?.currency, "BRL");
});

test("person and space selection validate IDs, preserve hidden credit accounts and never infer manual available credit", async () => {
  const f = planning();
  const id = z.object({ id: z.string() });
  const manual = id.parse(
    await f.write("create_manual_account", {
      creditLimitMinor: "50000",
      currency: "BRL",
      name: "Manual card",
      openingBalanceMinor: "10000",
      type: "CREDIT",
    }),
  ).id;
  await f.write("update_account_settings", { hidden: true, id: manual });
  const result = await f.query({ accountId: manual, personId: "self" });
  assert.equal(result.coverage.kind, "local_only");
  assert.equal(result.partial, false);
  assert.equal(result.data.accounts[0]?.hidden, true);
  assert.equal(result.data.accounts[0]?.limitSource, "manual");
  assert.equal(result.data.accounts[0]?.creditLimitMinor, "50000");
  assert.equal(result.data.accounts[0]?.availableCreditMinor, null);
  assert.equal(result.data.accounts[0]?.allocatedCreditMinor, null);
  await assert.rejects(() => f.query({ accountId: "missing" }), {
    message: "NOT_FOUND",
  });
  await assert.rejects(() => f.query({ personId: "missing" }), {
    message: "NOT_FOUND",
  });
  await assert.rejects(() => f.query({ spaceId: "missing" }), {
    message: "NOT_FOUND",
  });
  await collect(source([], [account({ id: "bank" })]));
  await assert.rejects(() => f.query({ accountId: "bank" }), {
    message: "CARD_REQUIRED",
  });
  await env.DB.prepare("INSERT INTO people(id,name) VALUES('ana','Ana')").run();
  await collect(
    source(
      [
        transaction({
          accountId: "other-card",
          category: "Groceries",
          id: "other-person",
        }),
      ],
      [credit({ id: "other-card", itemId: "d" })],
    ),
    "2026-10-02T00:00:00.000Z",
    "d",
  );
  await env.DB.prepare(
    "UPDATE connection_owners SET person_id='ana' WHERE connection_id='d'",
  ).run();
  assert.equal(
    (await f.query({ personId: "self" })).data.totals[0]?.spentMinor,
    "0",
  );
  const ana = await f.query({ personId: "ana" });
  assert.equal(ana.data.totals[0]?.spentMinor, "1000");
  assert.deepEqual(ana.coverage.connectionIds, ["d"]);
  await assert.rejects(
    () => f.query({ accountId: "other-card", personId: "self" }),
    { message: "SPACE_MISMATCH" },
  );
  await admit("2026-10-24T00:00:00.000Z", "d");
  assert.equal((await f.query({ personId: "ana" })).partial, true);
  const space = id.parse(
    await f.write("create_space", {
      currency: "BRL",
      name: "Family",
      type: "family",
    }),
  ).id;
  await f.write("move_account", { id: "other-card", targetSpaceId: space });
  await assert.rejects(() => f.query({ accountId: "other-card" }), {
    message: "SPACE_MISMATCH",
  });
  assert.equal(
    (await f.query({ personId: "ana", spaceId: space })).data.totals[0]
      ?.spentMinor,
    "1000",
  );
});

test("individually moved installments stay visible in their effective space without moving their source account", async () => {
  await collect(
    source(
      [
        transaction({
          amount: "-12.34",
          category: "Groceries",
          creditCardMetadata: installment,
          id: "moved-credit",
        }),
        transaction({
          amount: "-88.88",
          category: "Groceries",
          creditCardMetadata: installment,
          id: "unmoved-credit",
        }),
        transaction({
          accountId: "bank",
          amount: "-99.99",
          category: "Groceries",
          creditCardMetadata: installment,
          id: "moved-bank",
        }),
      ],
      [credit(), credit({ id: "unrelated-card" }), account({ id: "bank" })],
    ),
  );
  const f = planning();
  const { id: familyId } = z.object({ id: z.string() }).parse(
    await f.write("create_space", {
      currency: "BRL",
      name: "Family",
      type: "family",
    }),
  );
  await f.write("move_transactions", {
    ids: ["moved-credit", "moved-bank"],
    targetSpaceId: familyId,
  });
  const transactions = async () =>
    TransactionListSchema.parse(
      await f.call("get_transactions", {
        from: "2026-10-01",
        spaceId: familyId,
        to: "2026-12-31",
      }),
    );
  const ledger = await transactions();
  const creditRows = ledger.data.records.filter((row) => row.accountId === "a");
  assert.deepEqual(
    creditRows.map((row) => row.id),
    ["moved-credit"],
  );
  const result = await f.query({ spaceId: familyId });
  assert.deepEqual(
    result.data.accounts.map((row) => row.id),
    ["a"],
  );
  assert.deepEqual(
    result.data.installments.map((row) => row.id),
    creditRows.map((row) => row.id),
  );
  assert.equal(result.data.installments[0]?.accountName, "Card");
  assert.equal(result.data.installments[0]?.amountMinor, "-1234");
  assert.equal(result.data.accounts[0]?.creditLimitMinor, "100000");
  assert.equal(result.data.accounts[0]?.allocatedCreditMinor, "60000");
  assert.equal(result.data.totals[0]?.knownUnclassifiedMinor, "1234");
  assert.equal(result.data.totals[0]?.unclassifiedCount, 1);
  assert.equal(result.data.totals[0]?.spentMinor, "0");
  assert.equal(result.data.months[0]?.knownUnclassifiedMinor, "1234");
  assert.deepEqual(result.coverage.connectionIds, ["c"]);
  assert.equal(result.coverage.kind, "imported");
  assert.equal(result.oldestLastSuccessAt, "2026-10-01T00:00:00.000Z");
  assert.equal(result.partial, ledger.partial);
  assert.equal(result.partial, false);
  assert.deepEqual(
    (await f.query({ accountId: "a", spaceId: familyId })).data,
    result.data,
  );
  assert.deepEqual(
    (await f.query()).data.installments.map((row) => row.id),
    ["unmoved-credit"],
  );
  const accountList = z.object({
    data: z.object({
      records: z.array(z.object({ id: z.string(), spaceId: z.string() })),
    }),
  });
  const sourceAccounts = accountList.parse(await f.call("get_accounts"));
  assert.equal(
    sourceAccounts.data.records.find((row) => row.id === "a")?.spaceId,
    "personal",
  );
  assert.deepEqual(
    accountList.parse(await f.call("get_accounts", { spaceId: familyId })).data
      .records,
    [],
  );
  await admit("2026-10-24T00:00:00.000Z");
  const partial = await f.query({ spaceId: familyId });
  assert.equal(partial.partial, true);
  assert.equal(partial.partial, (await transactions()).partial);
  assert.deepEqual(partial.coverage.connectionIds, ["c"]);
});

test("portal and MCP expose the same authenticated read-only card query with output schema", async () => {
  await collect(
    source(
      [transaction({ category: "Groceries", creditCardMetadata: installment })],
      [credit()],
    ),
  );
  const app = fixture();
  assert.equal((await app.request("/account/commitments")).status, 302);
  const cookie = cookies(await login(app));
  assert.equal(
    (await app.request("/account/commitments", { headers: { Cookie: cookie } }))
      .status,
    404,
  );
  const query = { month: "2026-10", months: 3, tool: "get_card_commitments" };
  const response = await command(app, cookie, "query", { query });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const portal = CardCommitmentsResponseSchema.parse(await response.json());
  const rejected = await command(app, cookie, "query", {
    csrf: "wrong",
    query,
  });
  assert.equal(rejected.status, 403);
  const token = await grant(app, cookie);
  const mcp = await app.request("/mcp", {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        _meta: {
          "io.modelcontextprotocol/clientCapabilities": {},
          "io.modelcontextprotocol/clientInfo": {
            name: "Card commitments parity",
            version: "1",
          },
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        },
        arguments: { month: "2026-10", months: 3 },
        name: "get_card_commitments",
      },
    }),
    headers: {
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Mcp-Method": "tools/call",
      "Mcp-Name": "get_card_commitments",
      "Mcp-Protocol-Version": "2026-07-28",
    },
    method: "POST",
  });
  const { result } = z
    .object({
      result: z.object({
        isError: z.boolean(),
        structuredContent: CardCommitmentsResponseSchema,
      }),
    })
    .parse(await mcp.json());
  assert.equal(result.isError, false);
  assert.deepEqual(result.structuredContent, portal);
  const definition = required(
    tools.find((tool) => tool.name === "get_card_commitments"),
  );
  assert.equal(definition.annotations.readOnlyHint, true);
  assert.ok(definition.outputSchema);
});

test("card query rejects invalid months and horizons at the boundary", async () => {
  for (const fields of [
    { month: "2026-13" },
    { month: "0000-01" },
    { month: "9999-12" },
    { months: 0 },
    { months: 13 },
  ]) {
    assert.equal(CardCommitmentsQuerySchema.safeParse(fields).success, false);
  }
  const empty = await planning().query();
  assert.equal(empty.coverage.kind, "empty");
  assert.deepEqual(empty.data.totals, []);
  assert.deepEqual(empty.data.installments, []);
  const lastSupported = await planning().query({
    month: "9998-12",
    months: 12,
  });
  assert.equal(lastSupported.data.to, "9999-11-30");
});
