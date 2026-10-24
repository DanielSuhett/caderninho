import assert from "node:assert/strict";
import { test } from "node:test";

import { type PortalMutation, RulePreviewSchema } from "../../contracts";
import { demoLedger, transactionFixture } from "../../fixtures/finance";
import { workspaceFixture } from "../../fixtures/workspace";
import { demoMonthly, demoOverview, demoTransactions } from "../demo-data";
import { createDemoSession } from "../demo-session";

const conflictPattern = /IDEMPOTENCY_CONFLICT/;
const linkedPattern = /SPACE_NOT_EMPTY/;
const protectedPattern = /SPACE_PROTECTED/;
const { signal } = new AbortController();
function save(
  session: ReturnType<typeof createDemoSession>,
  command: PortalMutation,
) {
  return session.api.planning(command, "synthetic", signal);
}
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
