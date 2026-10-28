import assert from "node:assert/strict";

import { beforeEach, test } from "vitest";
import { z } from "zod/v4";

import {
  InvestmentListSchema,
  PlanningCommandSchema,
} from "../../src/contracts";
import { createPlanningService } from "../../src/worker/planning";
import { createPlanningRepository } from "../../src/worker/planning/repository";
import { collect, setup, source, transaction } from "./fixture";
import { env } from "cloudflare:workers";

beforeEach(setup);
const date = "2026-10-22";
const period = { from: "2026-10-01", to: "2026-10-31" };
function fixture() {
  const repository = createPlanningRepository(env.DB);
  const service = createPlanningService(
    repository,
    () => new Date(`${date}T15:00:00Z`),
  );
  const call = (tool: string, args: Record<string, unknown> = {}) =>
    service.execute(
      PlanningCommandSchema.parse({ spaceId: "personal", tool, ...args }),
    );
  const write = (tool: string, args: Record<string, unknown> = {}) =>
    call(tool, {
      confirmed: true,
      idempotency_key: crypto.randomUUID(),
      ...args,
    });
  return { call, repository, write };
}
const identify = (value: unknown) =>
  z.object({ id: z.string() }).parse(value).id;
const data = (value: unknown) =>
  z.object({ data: z.record(z.string(), z.unknown()) }).parse(value).data;
const records = (value: unknown) =>
  z.array(z.record(z.string(), z.unknown())).parse(data(value).records);
async function manual(f: ReturnType<typeof fixture>, type = "BANK") {
  return identify(
    await f.write("create_manual_account", {
      currency: "BRL",
      name: "Manual",
      openingBalanceMinor: "10000",
      type,
      ...(type === "CREDIT" && {
        closeDay: 20,
        creditLimitMinor: "50000",
        dueDay: 28,
      }),
    }),
  );
}

test("manual ledger preserves exact amounts, durable replay, conflicting keys, updates and source history", async () => {
  const f = fixture();
  const accountId = await manual(f);
  const request = {
    accountId,
    amountMinor: "999999999999999999999999999999",
    date,
    description: "Original",
    direction: "DEBIT",
    idempotency_key: "same-request",
  };
  const first = await f.write("create_transaction", request);
  assert.deepEqual(await f.write("create_transaction", request), first);
  await assert.rejects(
    () => f.write("create_transaction", { ...request, amountMinor: "1" }),
    { message: "IDEMPOTENCY_CONFLICT" },
  );
  const id = identify(first);
  await f.write("edit_transaction", {
    amountMinor: "75",
    category: "personal:expense",
    description: "Edited",
    id,
  });
  const list = records(await f.call("get_transactions"));
  assert.equal(list.length, 1);
  assert.equal(list[0]?.description, "Edited");
  assert.equal(list[0]?.amountMinor, "75");
  assert.equal(records(await f.call("get_accounts"))[0]?.balanceMinor, "9925");
  const overview = data(await f.call("get_overview", period));
  const totals = z
    .array(z.object({ expenseMinor: z.string() }))
    .parse(overview.totals);
  assert.equal(totals[0]?.expenseMinor, "75");
  await collect(source([transaction()]));
  await f.write("edit_transaction", { description: "Local label", id: "t" });
  await collect(
    source([transaction({ amount: "-20", description: "Provider update" })]),
    "2026-10-02T00:00:00Z",
  );
  assert.equal(
    (
      await env.DB.prepare(
        "SELECT description FROM transactions WHERE id='t'",
      ).first<{ description: string }>()
    )?.description,
    "Provider update",
  );
  assert.equal(
    records(await f.call("get_transactions", { text: "Local label" }))[0]
      ?.description,
    "Local label",
  );
  await f.write("delete_transaction", { id: "t" });
  assert.equal(
    records(await f.call("get_transactions", { text: "Local label" })).length,
    0,
  );
  assert.ok(
    await env.DB.prepare("SELECT id FROM transactions WHERE id='t'").first(),
  );
});

test("all writes require explicit confirmation; concurrent receipt is atomic and stale snapshots roll back", async () => {
  const f = fixture();
  assert.throws(() =>
    PlanningCommandSchema.parse({
      color: "blue",
      idempotency_key: "a",
      name: "x",
      spaceId: "personal",
      tool: "create_tag",
    }),
  );
  const args = { color: "blue", idempotency_key: "concurrent", name: "one" };
  const results = await Promise.all([
    f.write("create_tag", args),
    f.write("create_tag", args),
  ]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(records(await f.call("get_tags")).length, 1);
  const before = await f.repository.read();
  await f.write("create_tag", { color: "red", name: "two" });
  await assert.rejects(() =>
    f.repository.commit({
      before,
      digest: "stale",
      key: "stale",
      now: date,
      result: { ok: true },
      state: before.state,
    }),
  );
  assert.equal(await f.repository.receipt("stale"), undefined);
  assert.equal(records(await f.call("get_tags")).length, 2);
});

test("pagination invalidates on local edits and upstream publication, and batch selection is all or nothing", async () => {
  const f = fixture();
  const accountId = await manual(f);
  const ids: string[] = [];
  ids.push(
    identify(
      await f.write("create_transaction", {
        accountId,
        amountMinor: "100",
        date,
        description: "Row 0",
        direction: "DEBIT",
      }),
    ),
  );
  ids.push(
    identify(
      await f.write("create_transaction", {
        accountId,
        amountMinor: "100",
        date,
        description: "Row 1",
        direction: "DEBIT",
      }),
    ),
  );
  ids.push(
    identify(
      await f.write("create_transaction", {
        accountId,
        amountMinor: "100",
        date,
        description: "Row 2",
        direction: "DEBIT",
      }),
    ),
  );
  const first = data(await f.call("get_transactions", { limit: 1 }));
  const cursor = z.string().parse(first.cursor);
  assert.equal(
    records(await f.call("get_transactions", { cursor, limit: 1 })).length,
    1,
  );
  await assert.rejects(
    () =>
      f.write("batch_edit_transactions", {
        description: "Bad",
        ids: [ids[0], "missing"],
      }),
    { message: "NOT_FOUND" },
  );
  await f.write("batch_edit_transactions", { ids, ignored: true });
  await assert.rejects(() => f.call("get_transactions", { cursor, limit: 1 }), {
    message: "RESTART_REQUIRED",
  });
  assert.equal(records(await f.call("get_transactions")).length, 0);
  assert.equal(
    records(await f.call("get_transactions", { include_ignored: true })).length,
    3,
  );
  await f.write("edit_transactions_by_period", {
    ...period,
    accountId,
    ignored: false,
  });
  await f.write("batch_delete_transactions", { ids: [ids[0]] });
  await f.write("delete_transactions_by_period", { ...period, accountId });
  assert.equal(records(await f.call("get_transactions")).length, 0);
});

test("categories, budget, rules and tags retain edits after rule deletion and clean references on deletion", async () => {
  const f = fixture();
  const accountId = await manual(f);
  const categoryId = identify(
    await f.write("create_category", { kind: "expense", name: "Food" }),
  );
  await f.write("update_category", {
    hidden: true,
    id: categoryId,
    name: "Meals",
  });
  assert.equal(
    records(await f.call("get_categories", { include_hidden: true })).find(
      (c) => c.id === categoryId,
    )?.name,
    "Meals",
  );
  await assert.rejects(
    () =>
      f.write("set_category_limit", { amountMinor: "1000", id: categoryId }),
    { message: "BUDGET_DISABLED" },
  );
  await f.write("set_budget", {
    currency: "BRL",
    enabled: true,
    monthlyBudgetMinor: "10000",
  });
  await f.write("set_category_limit", { amountMinor: "1000", id: categoryId });
  await f.write("remove_category_limit", { id: categoryId });
  const tagId = identify(
    await f.write("create_tag", { color: "blue", name: "Trip" }),
  );
  await f.write("update_tag", { color: "red", id: tagId, name: "Holiday" });
  const id = identify(
    await f.write("create_transaction", {
      accountId,
      amountMinor: "123",
      date,
      description: "Market",
      direction: "DEBIT",
    }),
  );
  await f.write("attach_transaction_tags", { ids: [id], tagIds: [tagId] });
  assert.equal(records(await f.call("get_transactions", { tagId })).length, 1);
  await f.write("remove_transaction_tags", { ids: [id], tagIds: [tagId] });
  const ruleId = identify(
    await f.write("create_rule", {
      categoryId,
      name: "Market rule",
      text: "market",
    }),
  );
  await f.write("update_rule", {
    categoryId,
    id: ruleId,
    name: "Market rule 2",
    priority: 1,
    text: "Market",
  });
  await f.write("apply_rules", period);
  await f.write("delete_rule", { id: ruleId });
  assert.equal(
    records(await f.call("get_transactions"))[0]?.category,
    categoryId,
  );
  await f.write("delete_category", { id: categoryId });
  assert.equal(
    records(await f.call("get_transactions"))[0]?.category,
    "personal:expense",
  );
  await f.write("delete_tag", { id: tagId });
  await Promise.all(
    ["get_budget", "get_rules", "get_tags"].map((tool) => f.call(tool)),
  );
  await Promise.all(
    [
      "get_spending_by_category",
      "get_spending_comparison",
      "get_spending_pace",
      "analyze_categories",
    ].map((tool) => f.call(tool, period)),
  );
  assert.equal(
    data(await f.call("generate_chart", { ...period, type: "bar" })).unit,
    "minor",
  );
});

test("goals keep linked assets separate from contributions and preserve transaction when unlinked", async () => {
  const f = fixture();
  const accountId = await manual(f);
  const goalId = identify(
    await f.write("create_goal", {
      currency: "BRL",
      name: "Reserve",
      targetMinor: "10001",
    }),
  );
  await f.write("update_goal", {
    currency: "BRL",
    id: goalId,
    name: "Reserve 2",
    targetMinor: "12001",
  });
  const contribution = identify(
    await f.write("add_goal_contribution", {
      amountMinor: "1",
      date,
      id: goalId,
    }),
  );
  assert.equal(
    data(await f.call("get_goal_plan", { id: goalId, months: 3 })).monthlyMinor,
    "4000",
  );
  await f.write("remove_goal_contribution", {
    contributionId: contribution,
    id: goalId,
  });
  const transactionId = identify(
    await f.write("create_transaction", {
      accountId,
      amountMinor: "100",
      date,
      description: "Saving",
      direction: "CREDIT",
    }),
  );
  await f.write("add_goal_contribution", {
    amountMinor: "100",
    date,
    id: goalId,
    transactionId,
  });
  await f.write("unlink_goal_transaction", { id: goalId, transactionId });
  assert.equal(records(await f.call("get_transactions")).length, 1);
  await f.write("link_goal_asset", { accountId, id: goalId });
  assert.equal(
    data(await f.call("get_goal_plan", { id: goalId, months: 3 })).savedMinor,
    "10100",
  );
  await f.write("unlink_goal_asset", { id: goalId });
  await f.write("complete_goal", { id: goalId });
  await f.write("delete_goal", { id: goalId });
  assert.equal(records(await f.call("get_goals")).length, 0);
});

test("manual investments, recurrence, installments and cycle settings keep future transactions unmaterialized", async () => {
  const f = fixture();
  const accountId = await manual(f, "CREDIT");
  await f.write("update_account_settings", {
    closeDay: 21,
    creditLimitMinor: "60000",
    dueDay: 28,
    id: accountId,
    name: "Card",
  });
  const planId = identify(
    await f.write("create_manual_installment", {
      accountId,
      amountMinor: "101",
      current: 2,
      name: "Laptop",
      startDate: "2026-10-28",
      total: 4,
    }),
  );
  assert.equal(records(await f.call("get_transactions")).length, 0);
  assert.equal(
    records(await f.call("get_installments"))[0]?.remainingMinor,
    "303",
  );
  await f.write("update_installment", {
    categoryId: "personal:expense",
    id: planId,
    name: "Computer",
  });
  await f.write("complete_installment", { id: planId });
  assert.equal(records(await f.call("get_installments")).length, 0);
  await f.write("reopen_installment", { id: planId });
  const recurring = {
    accountId: await manual(f),
    amountMinor: "100",
    currency: "BRL",
    direction: "CREDIT",
    name: "Salary",
    startDate: "2026-10-31",
  };
  const recurrenceId = identify(await f.write("create_recurrence", recurring));
  await f.write("update_recurrence", {
    ...recurring,
    endDate: "2026-11-30",
    id: recurrenceId,
  });
  assert.ok(records(await f.call("get_upcoming_payments", period)).length);
  await f.write("deactivate_recurrence", { id: recurrenceId });
  const investmentId = identify(
    await f.write("create_manual_investment", {
      amountMinor: "100",
      currency: "BRL",
      date,
      name: "Fund",
      type: "FUND",
    }),
  );
  await f.write("update_manual_investment", {
    amountMinor: "200",
    currency: "BRL",
    date,
    id: investmentId,
    name: "Fund 2",
    type: "FUND",
  });
  await f.write("set_investment_inclusion", {
    id: investmentId,
    included: false,
  });
  assert.equal(records(await f.call("get_investments"))[0]?.included, false);
  await f.write("delete_manual_investment", { id: investmentId });
  await f.call("get_projection", { from: date, to: "2026-11-30" });
  await f.call("get_recurrences");
});

test("SAC conserves principal and enforces payment order, same-currency matching, undo and deletion guards", async () => {
  const f = fixture();
  const accountId = await manual(f);
  const loan = {
    amountMinor: "10001",
    currency: "BRL",
    firstPaymentDate: "2026-10-31",
    installmentMinor: "3500",
    name: "Debt",
    paid: 0,
    total: 3,
  };
  const id = identify(await f.write("create_manual_loan", loan));
  await f.write("update_manual_loan", { ...loan, id, name: "Debt 2" });
  await f.write("set_loan_visibility", { hidden: true, id });
  assert.equal(records(await f.call("get_loans")).length, 0);
  await f.write("set_loan_visibility", { hidden: false, id });
  const schedule = {
    count: 3,
    id,
    monthlyRateBps: 100,
    principalMinor: "10001",
    startDate: "2026-10-31",
  };
  await f.write("create_manual_loan_schedule", schedule);
  await f.write("replace_manual_loan_schedule", schedule);
  const payments = records(await f.call("get_loan_schedule", { id }));
  assert.deepEqual(
    payments.map((p) => p.principalMinor),
    ["3334", "3334", "3333"],
  );
  assert.deepEqual(
    payments.map((p) => p.date),
    ["2026-10-31", "2026-11-30", "2026-12-31"],
  );
  const paymentId = z.string().parse(payments[0]?.id);
  await assert.rejects(
    () =>
      f.write("reconcile_scheduled_payment", {
        accountId,
        id,
        paymentId: payments[1]?.id,
      }),
    { message: "PAYMENT_ORDER" },
  );
  const payment = await f.write("reconcile_scheduled_payment", {
    accountId,
    id,
    paymentId,
  });
  const { transactionId } = z
    .object({ transactionId: z.string() })
    .parse(payment);
  await f.write("undo_scheduled_payment", { id, paymentId });
  assert.equal(records(await f.call("get_transactions")).length, 1);
  await f.write("reconcile_scheduled_payment", {
    accountId,
    id,
    paymentId,
    transactionId,
  });
  await assert.rejects(() => f.write("delete_manual_loan", { id }), {
    message: "PENDING_PAYMENTS",
  });
  await f.write("reconcile_scheduled_payment", {
    accountId,
    id,
    paymentId: payments[1]?.id,
  });
  await f.write("reconcile_scheduled_payment", {
    accountId,
    id,
    paymentId: payments[2]?.id,
  });
  await f.write("delete_manual_loan", { id });
  assert.equal(records(await f.call("get_loans")).length, 0);
});

test("spaces reject cross-space changes and moving accounts updates the effective transaction scope", async () => {
  const f = fixture();
  const targetSpaceId = identify(
    await f.write("create_space", { currency: "BRL", name: "Business" }),
  );
  await f.write("update_space", {
    id: targetSpaceId,
    monthStartDay: 5,
    name: "Office",
    spaceId: targetSpaceId,
  });
  const accountId = await manual(f);
  const id = identify(
    await f.write("create_transaction", {
      accountId,
      amountMinor: "10",
      date,
      description: "Work",
      direction: "DEBIT",
    }),
  );
  await assert.rejects(
    () =>
      f.write("edit_transaction", {
        description: "Wrong",
        id,
        spaceId: targetSpaceId,
      }),
    { message: "NOT_FOUND" },
  );
  await f.write("move_transactions", { ids: [id], targetSpaceId });
  assert.equal(records(await f.call("get_transactions")).length, 0);
  assert.equal(
    records(await f.call("get_transactions", { spaceId: targetSpaceId }))
      .length,
    1,
  );
  await f.write("move_account", { id: accountId, targetSpaceId });
  assert.equal(
    records(await f.call("get_accounts", { spaceId: targetSpaceId })).length,
    1,
  );
  await collect(source([transaction()]));
  await f.write("move_connection", { connectionId: "c", targetSpaceId });
  assert.equal(
    records(await f.call("get_transactions", { spaceId: targetSpaceId }))
      .length,
    2,
  );
  await f.write("set_notification_preference", {
    channel: "email",
    enabled: true,
    event: "bill_due",
  });
  assert.equal(
    data(await f.call("get_notification_preferences")).deliveryConfigured,
    false,
  );
  await f.call("get_spaces");
  const empty = await manual(f);
  await f.write("delete_manual_account", { id: empty });
});

test("extended import publishes paginated products, card metadata and local bill states without overwriting preferences", async () => {
  const f = fixture();
  function productResult(input: {
    kind: "bills" | "investments" | "loans";
    id: string;
    page: number;
    observedAt: string;
  }): import("../../src/domain").ProductPage {
    switch (input.kind) {
      case "investments":
        return {
          kind: input.kind,
          next: input.page === 1 ? 2 : null,
          records: [
            {
              amountMinor: "10000",
              connectionId: "c",
              currency: "BRL",
              date,
              id: `investment-${input.page}`,
              included: true,
              manual: false,
              name: "Fund",
              spaceId: "personal",
              type: "FUND",
            },
          ],
        };
      case "loans":
        return {
          kind: input.kind,
          next: null,
          records: [
            {
              amountMinor: "50000",
              connectionId: "c",
              currency: "BRL",
              firstPaymentDate: null,
              hidden: false,
              id: "loan",
              installmentMinor: null,
              manual: false,
              name: "Bank loan",
              paid: 2,
              spaceId: "personal",
              total: 10,
            },
          ],
        };
      case "bills":
        return {
          kind: input.kind,
          next: null,
          records: [
            {
              accountId: input.id,
              amountMinor: "10000",
              charges: [],
              currency: "BRL",
              dueDate: "2026-10-28",
              id: "bill",
              minimumMinor: "1000",
              observedAt: input.observedAt,
              payments: [],
            },
          ],
        };
      default:
        throw new Error("Unexpected product");
    }
  }
  const financialSource = {
    ...source(
      [
        transaction({
          accountId: "a",
          creditCardMetadata: {
            billId: "bill",
            cardNumber: "5678",
            installmentNumber: 2,
            purchaseDate: "2026-09-01",
            totalInstallments: 4,
          },
        }),
      ],
      [
        {
          balance: "100",
          creditData: {
            availableCreditLimit: "900",
            balanceCloseDate: "2026-10-20",
            balanceDueDate: "2026-10-28",
            creditLimit: "1000",
          },
          currencyCode: "BRL",
          id: "a",
          itemId: "c",
          name: "Card",
          number: "1234",
          type: "CREDIT" as const,
        },
      ],
    ),
    products: (input: Parameters<typeof productResult>[0]) =>
      Promise.resolve(productResult(input)),
  };
  await collect(financialSource);
  assert.equal(records(await f.call("get_investments")).length, 2);
  assert.equal(records(await f.call("get_loans")).length, 1);
  assert.equal(records(await f.call("get_bills"))[0]?.amountMinor, "10000");
  const cards = records(await f.call("get_cards"));
  assert.equal(cards.length, 2);
  const additionalId = z
    .string()
    .parse(cards.find((c) => c.number === "5678")?.id);
  await f.write("update_card", {
    hidden: true,
    id: additionalId,
    name: "Virtual",
  });
  assert.equal(records(await f.call("get_cards")).length, 1);
  await f.write("update_card", { hidden: false, id: additionalId });
  await f.write("set_primary_card", { id: additionalId });
  await assert.rejects(() => f.write("delete_card", { id: additionalId }), {
    message: "PRIMARY_CARD_REQUIRED",
  });
  await f.write("set_primary_card", { id: "a:1234" });
  await f.write("delete_card", { id: additionalId });
  await f.write("mark_bill_paid", { id: "bill" });
  assert.equal(records(await f.call("get_bills"))[0]?.manuallyPaid, true);
  await f.write("unmark_bill_paid", { id: "bill" });
  await f.write("set_investment_inclusion", {
    id: "investment-1",
    included: false,
  });
  await f.write("set_loan_visibility", { hidden: true, id: "loan" });
  await collect(financialSource, "2026-10-02T00:00:00Z");
  assert.equal(
    records(await f.call("get_investments")).find(
      (i) => i.id === "investment-1",
    )?.included,
    false,
  );
  assert.equal(records(await f.call("get_loans")).length, 0);
  assert.equal(
    Array.isArray(records(await f.call("get_bills"))[0]?.payments),
    true,
  );
  assert.equal(records(await f.call("get_installments"))[0]?.estimated, true);
});

test("manual billing uses closing and due dates; matching a recurrence avoids double counting", async () => {
  const f = fixture();
  const accountId = await manual(f, "CREDIT");
  await f.write("create_manual_installment", {
    accountId,
    amountMinor: "101",
    current: 1,
    name: "Laptop",
    startDate: "2026-10-22",
    total: 3,
  });
  const recurrenceId = z
    .string()
    .parse(records(await f.call("get_recurrences"))[0]?.id);
  const availableBefore = records(await f.call("get_accounts"))[0]
    ?.availableCreditMinor;
  let bills = records(await f.call("get_bills"));
  assert.equal(bills[0]?.dueDate, "2026-11-28");
  assert.equal(bills[0]?.amountMinor, "101");
  await f.write("create_transaction", {
    accountId,
    amountMinor: "101",
    date: "2026-10-22",
    description: "Laptop 1/3",
    direction: "DEBIT",
    recurrenceId,
  });
  bills = records(await f.call("get_bills"));
  assert.equal(bills[0]?.amountMinor, "101");
  assert.equal(bills.length, 3);
  assert.equal(
    records(await f.call("get_accounts"))[0]?.availableCreditMinor,
    availableBefore,
  );
  await f.write("mark_bill_paid", { id: bills[0]?.id });
  assert.equal(records(await f.call("get_bills"))[0]?.manuallyPaid, true);
});

test("settled bank recurrences and ignored spending affect cash balances exactly once", async () => {
  const f = fixture();
  const accountId = await manual(f);
  const recurrenceId = identify(
    await f.write("create_recurrence", {
      accountId,
      amountMinor: "500",
      currency: "BRL",
      direction: "DEBIT",
      name: "Rent",
      startDate: date,
    }),
  );
  const id = identify(
    await f.write("create_transaction", {
      accountId,
      amountMinor: "500",
      date,
      description: "Rent paid",
      direction: "DEBIT",
      recurrenceId,
    }),
  );
  await f.write("edit_transaction", { id, ignored: true });
  assert.equal(records(await f.call("get_accounts"))[0]?.balanceMinor, "9500");
  assert.equal(
    records(await f.call("get_upcoming_payments", period)).length,
    0,
  );
  const projection = data(
    await f.call("get_projection", { from: date, to: "2026-11-30" }),
  );
  assert.deepEqual(projection.groups, [
    {
      currency: "BRL",
      knownSubtotalMinor: "9000",
      projectedMinor: "9000",
      unknownCount: 0,
    },
  ]);
  await assert.rejects(
    () => f.call("get_projection", { from: "2026-12-01", to: "2026-11-30" }),
    { message: "INVALID_PERIOD" },
  );
});

test("new imported transactions use local rules and later source updates do not undo explicit edits", async () => {
  const f = fixture();
  await f.write("create_rule", {
    categoryId: "personal:expense",
    name: "Synthetic expense",
    text: "Synthetic",
  });
  await collect(source([transaction()]));
  assert.equal(
    records(await f.call("get_transactions"))[0]?.category,
    "personal:expense",
  );
  await f.write("edit_transaction", { category: "personal:transfer", id: "t" });
  await collect(source([transaction()]), "2026-10-02T00:00:00Z");
  assert.equal(
    records(await f.call("get_transactions"))[0]?.category,
    "personal:transfer",
  );
});

test("deleting a manually emptied account leaves tombstoned transactions queryable as absent", async () => {
  const f = fixture();
  const accountId = await manual(f);
  const id = identify(
    await f.write("create_transaction", {
      accountId,
      amountMinor: "1",
      date,
      description: "Delete me",
      direction: "DEBIT",
    }),
  );
  await f.write("delete_transaction", { id });
  await f.write("delete_manual_account", { id: accountId });
  assert.equal(records(await f.call("get_transactions")).length, 0);
});

test("automatic and explicit rule matching use the same literal accents and ASCII case folding", async () => {
  const f = fixture();
  const rule = identify(
    await f.write("create_rule", {
      categoryId: "personal:expense",
      name: "Cafe",
      text: "café",
    }),
  );
  await collect(source([transaction({ description: "CAFÉ" })]));
  const original = records(await f.call("get_transactions"))[0]?.category;
  await f.write("apply_rules", period);
  assert.equal(
    records(await f.call("get_transactions"))[0]?.category,
    original,
  );
  await f.write("update_rule", {
    categoryId: "personal:expense",
    id: rule,
    name: "Cafe",
    text: "cafÉ",
  });
  await f.write("apply_rules", period);
  assert.equal(
    records(await f.call("get_transactions"))[0]?.category,
    "personal:expense",
  );
});

test("manual investor holdings retain an explicit local coverage and unknown net", async () => {
  const f = fixture();
  await f.write("create_manual_investment", {
    amountMinor: "900719925474099301",
    currency: "BRL",
    date: "2026-10-25",
    name: "Reserva manual",
    type: "FIXED_INCOME",
  });
  const result = await f.call("get_investments", { currency: "BRL" });
  assert.equal(
    z.object({ coverage: z.object({ kind: z.string() }) }).parse(result)
      .coverage.kind,
    "local_only",
  );
  const portfolio = InvestmentListSchema.parse(result).data;
  assert.equal(portfolio.totals[0]?.gross.totalMinor, "900719925474099301");
  assert.equal(portfolio.totals[0]?.net.totalMinor, null);
});
