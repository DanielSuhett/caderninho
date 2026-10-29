import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CardCommitmentsResponseSchema,
  InvestmentListSchema,
  PortalCardsSchema,
  type PortalMutation,
  PortalTransactionListSchema,
  RulePreviewSchema,
} from "../../contracts";
import { demoLedger, transactionFixture } from "../../fixtures/finance";
import { workspaceFixture } from "../../fixtures/workspace";
import { demoMonthly, demoOverview, demoTransactions } from "../demo-data";
import { createDemoSession } from "../demo-session";

const conflictPattern = /IDEMPOTENCY_CONFLICT/;
const linkedPattern = /SPACE_NOT_EMPTY/;
const protectedPattern = /SPACE_PROTECTED/;
const { signal } = new AbortController();
test("a demo installment opens the complete received purchase instead of only the selected month", async () => {
  const session = createDemoSession();
  const row = session
    .view()
    .records.find(
      (item) =>
        item.description === "Ferramentas de desenvolvimento" &&
        item.date === "2026-10-12",
    );
  assert.ok(row);
  const result = PortalTransactionListSchema.parse(
    await session.api.query(
      {
        accountId: row.accountId,
        limit: 1,
        spaceId: "personal",
        tool: "get_portal_transactions",
        transactionId: row.id,
      },
      "synthetic",
      signal,
    ),
  );
  const installments = result.data.records[0]?.installments;
  assert.equal(installments?.length, 12);
  assert.equal(installments?.at(0)?.date, "2026-05-12");
  assert.equal(installments?.at(-1)?.date, "2027-04-12");
  assert.equal(installments?.at(-1)?.status, "PENDING");
  assert.equal(installments?.at(0)?.billPayment, "bank");
  assert.equal(installments?.at(-1)?.billPayment, undefined);
});
test("manual demo categorization preserves money, checks revision and retries without duplicating changes", async () => {
  const session = createDemoSession();
  const row = session.view().records.find((item) => item.category === null);
  assert.ok(row);
  const edit: PortalMutation = {
    category: "market",
    confirmed: true,
    expected_revision: session.revision(),
    idempotency_key: "categorize-demo",
    ids: [row.id],
    spaceId: "personal",
    tool: "batch_edit_transactions",
  };
  await save(session, edit);
  const revision = session.revision();
  await save(session, edit);
  assert.equal(session.revision(), revision);
  assert.deepEqual(
    session.view().records.find((item) => item.id === row.id),
    { ...row, category: "market" },
  );
  await assert.rejects(
    save(session, { ...edit, category: null, idempotency_key: "stale-demo" }),
    { message: "RESTART_REQUIRED" },
  );
  assert.deepEqual(
    createDemoSession()
      .view()
      .records.find((item) => item.id === row.id),
    row,
  );
});
function save(
  session: ReturnType<typeof createDemoSession>,
  command: PortalMutation,
) {
  return session.api.planning(command, "synthetic", signal);
}
test("category appearance edits reach all demo consumers without reclassifying money or mutating shared fixtures", async () => {
  const session = createDemoSession();
  const original = structuredClone(session.view());
  await save(session, {
    color: "#7c3aed",
    confirmed: true,
    icon: "gift",
    id: "market",
    idempotency_key: "market-appearance",
    spaceId: "personal",
    tool: "update_category",
  });
  const data = session.view();
  const category = data.categories.find((item) => item.id === "market");
  const catalog = await session.api.catalog("personal", signal);
  assert.equal(category?.color, "#7c3aed");
  assert.equal(category?.icon, "gift");
  assert.deepEqual(
    catalog.categories.find((item) => item.id === "market"),
    category,
  );
  assert.deepEqual(data.records, original.records);
  assert.deepEqual(
    demoOverview("2026-10", data),
    demoOverview("2026-10", original),
  );
  assert.deepEqual(
    demoMonthly("2026-10", data),
    demoMonthly("2026-10", original),
  );
  assert.deepEqual(createDemoSession().view(), original);
});
test("demo saves a rule without changing history, explicitly reapplies it and updates the whole ledger and both financial views", async () => {
  const session = createDemoSession();
  const original = structuredClone(demoLedger);
  await save(session, {
    categoryId: "transfer",
    confirmed: true,
    direction: "DEBIT",
    id: "demo-market-rule",
    idempotency_key: "update-market",
    name: "Mercado como transferência",
    spaceId: "personal",
    text: "mercado",
    tool: "update_rule",
  });
  assert.equal(
    demoOverview("2026-10", session.view()).totals[0]?.expenseMinor,
    "439381",
  );
  assert.deepEqual(session.applyRules("personal"), {
    changed: 12,
    matched: 12,
  });
  const data = session.view();
  const overview = demoOverview("2026-10", data);
  assert.equal(overview.totals[0]?.expenseMinor, "333720");
  assert.equal(overview.totals[0]?.incomeMinor, "980000");
  assert.equal(overview.totals[0]?.cashFlowMinor, "605789");
  assert.equal(overview.totals[1]?.expenseMinor, "2400");
  assert.equal(
    overview.groups.find(
      (group) => group.group === "market" && group.currency === "BRL",
    )?.amountMinor,
    "-1250",
  );
  assert.equal(
    demoMonthly("2026-10", data).groups.find(
      (group) => group.group === "2026-10" && group.currency === "BRL",
    )?.amountMinor,
    "333720",
  );
  assert.equal(
    demoTransactions({ data, month: "2026-10", text: "Mercado da semana" })[0]
      ?.category,
    "transfer",
  );
  assert.equal(
    demoTransactions({ data, month: "2026-05", text: "Mercado da semana" })[0]
      ?.category,
    "transfer",
  );
  assert.deepEqual(session.applyRules("personal"), { changed: 0, matched: 12 });
  await save(session, {
    confirmed: true,
    id: "demo-market-rule",
    idempotency_key: "delete-market",
    spaceId: "personal",
    tool: "delete_rule",
  });
  assert.deepEqual(session.applyRules("personal"), { changed: 0, matched: 0 });
  assert.equal(
    demoOverview("2026-10", session.view()).totals[0]?.expenseMinor,
    "333720",
  );
  assert.deepEqual(demoLedger, original);
  assert.equal(
    demoOverview("2026-10", createDemoSession().view()).totals[0]?.expenseMinor,
    "439381",
  );
  session.reset();
  assert.equal(
    demoOverview("2026-10", session.view()).totals[0]?.expenseMinor,
    "439381",
  );
});

test("preview and reapplication share exact AND/OR scope and deterministic active-rule priority", async () => {
  const catalog = workspaceFixture();
  const [rule] = catalog.rules;
  assert.ok(rule);
  const filter = {
    alternatives: [
      {
        conditions: [
          { field: "amount", operator: "gte", value: "9007199254740993" },
          { field: "description", operator: "contains", value: "CAFÉ" },
        ],
      },
    ],
    currency: "BRL",
  } as const;
  const input = RulePreviewSchema.parse({
    accountId: "demo-bank",
    csrf: "synthetic",
    direction: "DEBIT",
    filter,
    spaceId: "personal",
  });
  catalog.rules = [
    {
      ...rule,
      accountId: "demo-bank",
      categoryId: "home",
      filter: input.filter,
      id: "z",
      text: "",
    },
    {
      ...rule,
      accountId: "demo-bank",
      categoryId: "health",
      filter: input.filter,
      id: "a",
      text: "",
    },
    {
      ...rule,
      categoryId: "tools",
      enabled: false,
      id: "paused",
      priority: 0,
      text: "",
    },
  ];
  const ledger = [
    transactionFixture({
      amountMinor: "-9007199254740993",
      description: "CAFÉ comprado",
    }),
    transactionFixture({
      amountMinor: "-9007199254740992",
      description: "CAFÉ comprado",
      id: "small",
    }),
    transactionFixture({
      amountMinor: "-9007199254740993",
      currency: "USD",
      description: "CAFÉ comprado",
      id: "usd",
    }),
    transactionFixture({
      accountId: "demo-card",
      amountMinor: "-9007199254740993",
      description: "CAFÉ comprado",
      id: "other-account",
    }),
  ];
  const session = createDemoSession({ catalog, ledger });
  const preview = await session.api.previewRule(input, signal);
  assert.equal(preview.count, 1);
  assert.equal(preview.examined, 4);
  assert.equal(preview.samples[0]?.amountMinor, "-9007199254740993");
  assert.deepEqual(session.applyRules("personal"), { changed: 1, matched: 1 });
  assert.equal(session.view().records[0]?.category, "health");
  assert.equal(session.view().records[1]?.category, null);
  assert.equal(session.view().records[2]?.currency, "USD");
});

test("demo groups remain isolated, edits persist across reads, and repeated creation or reset cannot mutate shared fixtures", async () => {
  const session = createDemoSession();
  const create: PortalMutation = {
    confirmed: true,
    currency: "USD",
    idempotency_key: "new-house",
    monthStartDay: 15,
    name: "Casa",
    spaceId: "personal",
    tool: "create_space",
    type: "family",
  };
  await save(session, create);
  await save(session, create);
  const catalog = await session.api.catalog("personal", signal);
  assert.equal(catalog.spaces.length, 2);
  const group = catalog.spaces.find((space) => space.name === "Casa");
  assert.ok(group);
  assert.equal(group.currency, "USD");
  assert.equal(group.monthStartDay, 15);
  assert.equal(session.view(group.id).records.length, 0);
  const other = await session.api.catalog(group.id, signal);
  assert.equal(other.rules.length, 0);
  const category = other.categories.find((item) => item.kind === "expense");
  assert.ok(category);
  await save(session, {
    categoryId: category.id,
    confirmed: true,
    idempotency_key: "house-rule",
    name: "Casa",
    spaceId: group.id,
    text: "mercado",
    tool: "create_rule",
  });
  assert.deepEqual(session.applyRules(group.id), { changed: 0, matched: 0 });
  assert.equal((await session.api.catalog("personal", signal)).rules.length, 1);
  await assert.rejects(
    save(session, { ...create, name: "Outro nome" }),
    conflictPattern,
  );
  await assert.rejects(
    save(session, {
      confirmed: true,
      id: group.id,
      idempotency_key: "delete-linked",
      spaceId: group.id,
      tool: "delete_space",
    }),
    linkedPattern,
  );
  await assert.rejects(
    save(session, {
      confirmed: true,
      id: "personal",
      idempotency_key: "delete-protected",
      spaceId: "personal",
      tool: "delete_space",
    }),
    protectedPattern,
  );
  session.reset();
  assert.equal(
    (await session.api.catalog("personal", signal)).spaces.length,
    1,
  );
  assert.equal(workspaceFixture().spaces.length, 1);
});

test("demo preview and reapplication exclude ignored records while keeping pending and future states intact", async () => {
  const ledger = [
    transactionFixture({ category: null, description: "mercado" }),
    transactionFixture({
      category: "home",
      description: "mercado",
      id: "ignored",
      ignored: true,
    }),
    transactionFixture({
      description: "mercado",
      id: "pending",
      status: "PENDING",
    }),
    transactionFixture({
      date: "2026-11-10",
      description: "mercado",
      id: "future",
    }),
  ];
  const session = createDemoSession({ ledger });
  const preview = await session.api.previewRule(
    RulePreviewSchema.parse({
      csrf: "synthetic",
      direction: "DEBIT",
      spaceId: "personal",
      text: "mercado",
    }),
    signal,
  );
  assert.equal(preview.count, 3);
  assert.deepEqual(session.applyRules("personal"), { changed: 3, matched: 3 });
  assert.equal(
    session.view().records.find((row) => row.id === "ignored")?.category,
    "home",
  );
  assert.equal(
    session.view().records.find((row) => row.id === "pending")?.status,
    "PENDING",
  );
  assert.equal(
    session.view().records.find((row) => row.id === "future")?.date,
    "2026-11-10",
  );
  assert.equal(
    demoOverview("2026-10", session.view()).totals[0]?.expenseMinor,
    "1000",
  );
});

test("shared fixtures retain independent source direction, zero and unavailable money; abort prevents a local write", async () => {
  const zero = transactionFixture({ amountMinor: "0" });
  const unknown = transactionFixture({ amountMinor: null, id: "unknown" });
  const divergent = transactionFixture({
    amountMinor: "12345",
    direction: "DEBIT",
    id: "divergent",
  });
  assert.equal(divergent.direction, "DEBIT");
  const session = createDemoSession({ ledger: [zero, unknown, divergent] });
  const [total] = demoOverview("2026-10", session.view()).totals;
  assert.equal(total?.unknownAmountCount, 1);
  assert.equal(total?.cashFlowMinor, null);
  assert.equal(total?.knownCashFlowMinor, "12345");
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    session.api.planning(
      {
        confirmed: true,
        id: "demo-market-rule",
        idempotency_key: "aborted",
        spaceId: "personal",
        tool: "delete_rule",
      },
      "synthetic",
      controller.signal,
    ),
  );
  assert.equal((await session.api.catalog("personal", signal)).rules.length, 1);
});

test("investment demo shares the MCP portfolio contract, owner and institution filters", async () => {
  const session = createDemoSession();
  const result = InvestmentListSchema.parse(
    await session.api.query(
      {
        currency: "BRL",
        personId: "demo-person-2",
        spaceId: "personal",
        tool: "get_investments",
      },
      "synthetic",
      signal,
    ),
  );
  assert.equal(result.data.records.length, 2);
  assert.equal(result.data.totals[0]?.gross.totalMinor, "2286000");
  assert.ok(
    result.data.records.every((row) => row.personId === "demo-person-2"),
  );
  const other = InvestmentListSchema.parse(
    await session.api.query(
      { spaceId: "missing", tool: "get_investments" },
      "synthetic",
      signal,
    ),
  );
  assert.equal(other.data.records.length, 0);
});

test("investment demo accumulates certificates of several banks through the MCP contract", async () => {
  const session = createDemoSession();
  const result = InvestmentListSchema.parse(
    await session.api.query(
      { currency: "BRL", spaceId: "personal", tool: "get_investments" },
      "synthetic",
      signal,
    ),
  );
  const cdb = result.data.groups.find((group) => group.subtype === "CDB");
  assert.equal(cdb?.count, 4);
  assert.equal(cdb?.gross.totalMinor, "5354000");
  assert.deepEqual(
    cdb?.banks.map((bank) => bank.name),
    ["Itaú", "Corretora Horizonte"],
  );
  assert.equal(cdb?.nearestDueDate, "2027-03-01");
  assert.equal(cdb?.furthestDueDate, "2029-08-10");
  assert.equal(
    result.data.records.filter((row) => row.details?.subtype === "CDB").length,
    5,
  );
  assert.deepEqual(cdb?.recordIds, [
    "cdb-horizonte",
    "cdb",
    "cdb-prefixado",
    "cdb-ipca",
    "closed",
  ]);
});

test("demo keeps both card views available through the typed query API with default scope and currency", async () => {
  const session = createDemoSession();
  const cards = PortalCardsSchema.parse(
    await session.api.query(
      { month: "2026-10", tool: "get_portal_cards" },
      "synthetic",
      signal,
    ),
  );
  const commitments = CardCommitmentsResponseSchema.parse(
    await session.api.query(
      { tool: "get_card_commitments" },
      "synthetic",
      signal,
    ),
  );
  assert.equal(cards.data.currency, "BRL");
  assert.ok(cards.data.accounts.length);
  assert.ok(cards.data.installments.length);
  assert.equal(commitments.scope.spaceId, "personal");
  assert.ok(commitments.data.totals.length);
});
test("an additional demo card keeps its own spend, sublimit and transactions", async () => {
  const session = createDemoSession();
  const readCards = async () =>
    PortalCardsSchema.parse(
      await session.api.query(
        {
          currency: "BRL",
          month: "2026-10",
          spaceId: "personal",
          tool: "get_portal_cards",
        },
        "synthetic",
        signal,
      ),
    ).data;
  const extra = (await readCards()).accounts
    .find((account) => account.id === "demo-card")
    ?.cards.find((card) => card.number === "5151");
  assert.ok(extra);
  assert.equal(extra.primary, false);
  assert.equal(extra.confirmed.totalMinor, "12890");
  assert.equal(extra.creditLimitMinor, null);
  await save(session, {
    confirmed: true,
    creditLimitMinor: "50000",
    expected_revision: session.revision(),
    id: extra.id,
    idempotency_key: "sublimit-demo",
    spaceId: "personal",
    tool: "update_card",
  });
  const saved = (await readCards()).accounts
    .find((account) => account.id === "demo-card")
    ?.cards.find((card) => card.id === extra.id);
  assert.equal(saved?.creditLimitMinor, "50000");
  const transactions = async (cardId: string) =>
    PortalTransactionListSchema.parse(
      await session.api.query(
        {
          accountId: "demo-card",
          cardId,
          from: "2026-10-01",
          limit: 50,
          spaceId: "personal",
          to: "2026-10-31",
          tool: "get_portal_transactions",
        },
        "synthetic",
        signal,
      ),
    ).data.records.map((row) => row.description);
  assert.deepEqual(await transactions(extra.id), ["Farmácia"]);
  assert.ok(!(await transactions("demo-card:4242")).includes("Farmácia"));
});
