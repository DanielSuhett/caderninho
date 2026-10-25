import type { PlanningCommand } from "../../contracts";
import { PlanningCursorSchema } from "../../contracts";
import type { PlanningState, PlanningTransaction } from "../../domain";
import {
  compareRules,
  detectSubscriptions,
  financialCharts,
  localDay,
  minorPresentation,
  monthDate,
} from "../../domain";
import { hash } from "../../shared";
import { type ProjectedPayment, recurrencePayments } from "./billing";
import { effectiveBills } from "./bills.service";
import type { PlanningRepository, PlanningSnapshot } from "./entity";
import {
  accounts,
  classification,
  found,
  inSpace,
  planningSelection,
  type Selection,
  transactionStream,
  validatePeriod,
} from "./projection";

interface Totals {
  cashFlow: bigint;
  count: number;
  expense: bigint;
  income: bigint;
  unclassified: number;
  unclassifiedAmount: bigint;
  unclassifiedUnknown: number;
  unknown: number;
}
const emptyTotals = (): Totals => ({
  cashFlow: 0n,
  count: 0,
  expense: 0n,
  income: 0n,
  unclassified: 0,
  unclassifiedAmount: 0n,
  unclassifiedUnknown: 0,
  unknown: 0,
});
const absolute = (value: string) => {
  const amount = BigInt(value);
  return amount < 0n ? -amount : amount;
};
function transactionOrder(order: "id" | "date_desc", after: string) {
  const descending = order === "date_desc";
  const key = (row: PlanningTransaction) =>
    descending ? `${row.date}:${row.id}` : row.id;
  return {
    compare: (a: PlanningTransaction, b: PlanningTransaction) =>
      (key(a) < key(b) ? -1 : Number(key(a) > key(b))) * (descending ? -1 : 1),
    following: (row: PlanningTransaction) =>
      !after || (descending ? key(row) < after : key(row) > after),
    key,
  };
}
export function cardCatalog(snapshot: PlanningSnapshot, state: PlanningState) {
  const result = new Map<
    string,
    {
      id: string;
      accountId: string;
      number: string;
      name: string;
      hidden: boolean;
      deleted: boolean;
      primary: boolean;
      spaceId: string;
    }
  >();
  for (const account of accounts(snapshot, state).filter(
    (a) => a.type === "CREDIT",
  )) {
    const settings = state.accounts.find((a) => a.id === account.id);
    const main =
      settings?.primaryCard ??
      snapshot.accountDetails.find((a) => a.id === account.id)?.cardNumber ??
      "main";
    const numbers = new Set([
      main,
      snapshot.accountDetails.find((a) => a.id === account.id)?.cardNumber ??
        "main",
    ]);
    // Additional card membership is recorded by the provider adapter as accountId:number.
    for (const setting of state.cards.filter(
      (c) => c.accountId === account.id,
    )) {
      numbers.add(setting.number);
    }
    for (const number of numbers) {
      const id = `${account.id}:${number}`;
      const setting = state.cards.find((c) => c.id === id);
      result.set(id, {
        accountId: account.id,
        deleted: setting?.deleted ?? false,
        hidden: setting?.hidden ?? account.hidden,
        id,
        name: setting?.name ?? account.name,
        number,
        primary: number === main,
        spaceId: account.spaceId,
      });
    }
  }
  return [...result.values()];
}
function validateSelection(
  selection: Selection,
  snapshot: PlanningSnapshot,
  accountMap: Map<string, import("../../domain").PlanningAccount>,
) {
  if (selection.accountId) {
    const account = found(accountMap.get(selection.accountId));
    const moved = snapshot.state.edits.some(
      (edit) =>
        edit.accountId === account.id &&
        edit.spaceId === selection.spaceId &&
        !edit.deleted,
    );
    if (
      (account.spaceId !== selection.spaceId && !moved) ||
      (selection.personId && account.personId !== selection.personId)
    ) {
      throw new Error("SPACE_MISMATCH");
    }
  }
  if (selection.categoryId) {
    inSpace(snapshot.state.categories, selection.categoryId, selection.spaceId);
  }
  if (selection.tagId) {
    inSpace(snapshot.state.tags, selection.tagId, selection.spaceId);
  }
}
export async function planningQuery(
  command: PlanningCommand,
  snapshot: PlanningSnapshot,
  repository: PlanningRepository,
  now: Date,
): Promise<unknown> {
  const { state } = snapshot;
  const day = localDay(now);
  const space = found(state.spaces.find((s) => s.id === command.spaceId));
  const allAccounts = accounts(snapshot);
  const personId = "personId" in command ? command.personId : undefined;
  if (personId && !snapshot.people.some((p) => p.id === personId)) {
    throw new Error("NOT_FOUND");
  }
  const allTransactions = transactionStream(repository, snapshot);
  const stream = (selection: import("./projection").Selection) =>
    allTransactions({ ...selection, ...(personId && { personId }) });
  const metadata = new Map(
    snapshot.transactionDetails.map((row) => [row.id, row]),
  );
  const accountMap = new Map(allAccounts.map((row) => [row.id, row]));
  const querySelection = planningSelection(command);
  validateSelection(querySelection, snapshot, accountMap);
  const scoped = <T extends { spaceId: string }>(rows: T[]) =>
    rows.filter((row) => row.spaceId === command.spaceId);
  function owned<
    T extends {
      spaceId: string;
      personId?: string;
      accountId?: string | null;
      connectionId?: string | null;
    },
  >(rows: T[]) {
    return scoped(rows)
      .map((row) => {
        const account = row.accountId
          ? accountMap.get(row.accountId)
          : undefined;
        const origin = row.connectionId
          ? snapshot.owners.find((o) => o.connectionId === row.connectionId)
          : undefined;
        const ownerId =
          account?.personId ?? origin?.personId ?? row.personId ?? "self";
        return {
          ...row,
          personId: ownerId,
          personName:
            snapshot.people.find((p) => p.id === ownerId)?.name ?? "Eu",
          profileId: account?.profileId ?? origin?.profileId ?? null,
        };
      })
      .filter((row) => !personId || row.personId === personId);
  }
  const billRows = [
    "get_bills",
    "get_upcoming_payments",
    "get_projection",
  ].includes(command.tool)
    ? await effectiveBills({
        referenceDay: day,
        repository,
        snapshot,
        state,
        ...("to" in command && command.to && { through: command.to }),
      })
    : [];
  const bills = () => owned(billRows);
  async function balances() {
    const rows = owned(allAccounts).map((a) => ({ ...a }));
    const map = new Map(rows.map((a) => [a.id, a]));
    const matched = new Set<string>();
    const manualIds = rows.filter((row) => row.manual).map((row) => row.id);
    for await (const row of manualIds.length
      ? stream({
          accountIds: manualIds,
          include_ignored: true,
          spaceId: command.spaceId,
        })
      : []) {
      const account = map.get(row.accountId);
      if (
        !account?.manual ||
        row.status !== "POSTED" ||
        row.date > day ||
        row.amountMinor === null
      ) {
        continue;
      }
      if (row.recurrenceId) {
        matched.add(`${row.recurrenceId}:${row.date.slice(0, 7)}`);
      }
      const cashSign = row.direction === "DEBIT" ? -1n : 1n;
      const sign = account.type === "CREDIT" ? -cashSign : cashSign;
      account.balanceMinor = (
        BigInt(account.balanceMinor ?? "0") +
        sign * absolute(row.amountMinor)
      ).toString();
    }
    return rows.map((row) => {
      const setting = state.accounts.find((a) => a.id === row.id);
      const details = snapshot.accountDetails.find((a) => a.id === row.id);
      const limit = setting?.manual
        ? (setting.creditLimitMinor ?? null)
        : (details?.creditLimitMinor ?? null);
      let available = details?.availableCreditMinor ?? null;
      if (row.manual && limit !== null && row.balanceMinor !== null) {
        const committed = state.recurrences
          .filter((r) => r.accountId === row.id && r.active && r.installmentId)
          .flatMap((r) =>
            recurrencePayments(
              r,
              r.startDate,
              r.endDate ?? monthDate(r.startDate, 600),
            ).filter(
              (event) => !matched.has(`${r.id}:${event.date.slice(0, 7)}`),
            ),
          )
          .reduce((sum, event) => sum + BigInt(event.amountMinor ?? "0"), 0n);
        available = (
          BigInt(limit) -
          BigInt(row.balanceMinor) -
          committed
        ).toString();
      }
      return {
        ...row,
        availableCreditMinor: available,
        closeDate: details?.closeDate ?? null,
        closeDay: setting?.closeDay ?? null,
        creditEstimated: row.manual,
        creditLimitMinor: limit,
        dueDate: details?.dueDate ?? null,
        dueDay: setting?.dueDay ?? null,
      };
    });
  }
  function addExpense(
    row: import("../../domain").PlanningTransaction,
    total: Totals,
    groups: Map<
      string,
      { currency: string; group: string; amount: bigint; unknown: number }
    >,
    groupBy: "category" | "month",
  ) {
    const magnitude = absolute(row.amountMinor ?? "0");
    const expense = row.direction === "DEBIT" ? magnitude : -magnitude;
    total.expense += expense;
    const group =
      groupBy === "month"
        ? row.date.slice(0, 7)
        : (row.category ?? "unclassified");
    const key = JSON.stringify([row.currency, group]);
    const item = groups.get(key) ?? {
      amount: 0n,
      currency: row.currency,
      group,
      unknown: 0,
    };
    item.amount += expense;
    groups.set(key, item);
  }
  function addSummaryRow(
    row: import("../../domain").PlanningTransaction,
    totals: Map<string, Totals>,
    groups: Map<
      string,
      { currency: string; group: string; amount: bigint; unknown: number }
    >,
    groupBy: "category" | "month",
  ) {
    const total = totals.get(row.currency) ?? emptyTotals();
    totals.set(row.currency, total);
    total.count += 1;
    const kind = classification(
      row,
      state,
      metadata.get(row.id)?.operationType ?? null,
    );
    if (kind === "unclassified") {
      total.unclassified += 1;
      if (row.amountMinor === null) {
        total.unclassifiedUnknown += 1;
      } else {
        total.unclassifiedAmount += absolute(row.amountMinor);
      }
    }
    if (row.amountMinor === null) {
      total.unknown += 1;
      return;
    }
    const amount = absolute(row.amountMinor);
    if (accountMap.get(row.accountId)?.type === "BANK") {
      total.cashFlow += row.direction === "DEBIT" ? -amount : amount;
    }
    if (kind === "income") {
      total.income += row.direction === "CREDIT" ? amount : -amount;
    }
    if (kind === "expense") {
      addExpense(row, total, groups, groupBy);
    }
  }
  async function summaries(
    intervals: { from: string; to: string }[],
    groupBy: "category" | "month" = "category",
  ) {
    for (const interval of intervals) {
      validatePeriod(interval);
    }
    const periods = intervals.map((interval) => ({
      ...interval,
      groups: new Map<
        string,
        { currency: string; group: string; amount: bigint; unknown: number }
      >(),
      totals: new Map<string, Totals>(),
    }));
    const [firstDay] = intervals.map((interval) => interval.from).sort();
    const lastDay = intervals
      .map((interval) => interval.to)
      .sort()
      .at(-1);
    for await (const row of stream({
      ...querySelection,
      from: firstDay,
      to: lastDay,
    })) {
      if (row.status !== "POSTED" || row.date > day) {
        continue;
      }
      for (const interval of periods) {
        if (row.date >= interval.from && row.date <= interval.to) {
          addSummaryRow(row, interval.totals, interval.groups, groupBy);
        }
      }
    }
    return periods.map(({ from, to, totals, groups }) => ({
      classification:
        "Only explicit local income/expense categories; unclassified bank movements are reported separately.",
      dateBasis: "transaction",
      eligibility: { status: "POSTED", throughDay: day },
      from,
      groups: [...groups.values()].map((g) => ({
        amountMinor: g.amount.toString(),
        ...minorPresentation(g.amount.toString(), g.currency),
        currency: g.currency,
        group: g.group,
        label:
          groupBy === "category"
            ? (state.categories.find((category) => category.id === g.group)
                ?.name ?? "Sem classificação")
            : g.group,
        ...(groupBy === "category" && {
          categoryId: g.group,
          categoryName:
            state.categories.find((category) => category.id === g.group)
              ?.name ?? "Sem classificação",
        }),
      })),
      measure: "classified_expense",
      partial: snapshot.partial,
      referenceDay: day,
      selection: { ...querySelection, from, to },
      to,
      totals: [...totals].map(([currency, t]) => ({
        cashFlowMinor: t.unknown ? null : t.cashFlow.toString(),
        count: t.count,
        currency,
        expenseMinor: t.unknown ? null : t.expense.toString(),
        incomeMinor: t.unknown ? null : t.income.toString(),
        knownCashFlowMinor: t.cashFlow.toString(),
        knownExpenseMinor: t.expense.toString(),
        knownIncomeMinor: t.income.toString(),
        knownUnclassifiedMinor: t.unclassifiedAmount.toString(),
        unclassifiedCount: t.unclassified,
        unclassifiedMinor: t.unclassifiedUnknown
          ? null
          : t.unclassifiedAmount.toString(),
        unclassifiedUnknownAmountCount: t.unclassifiedUnknown,
        unknownAmountCount: t.unknown,
      })),
      unit: "minor",
    }));
  }
  async function summary(
    from: string,
    to: string,
    groupBy: "category" | "month" = "category",
  ) {
    return found((await summaries([{ from, to }], groupBy))[0]);
  }
  async function upcoming(from: string, to: string) {
    validatePeriod({ from, to });
    const matched = new Set<string>();
    for await (const row of stream({
      include_ignored: true,
      spaceId: command.spaceId,
      status: "POSTED",
      to: day,
    })) {
      if (row.recurrenceId) {
        matched.add(`${row.recurrenceId}:${row.date.slice(0, 7)}`);
      }
    }
    const result: ProjectedPayment[] = [];
    for (const bill of bills()) {
      if (bill.dueDate >= from && bill.dueDate <= to && !bill.paid) {
        result.push({
          accountId: bill.accountId,
          amountMinor: bill.amountMinor,
          currency: bill.currency,
          date: bill.dueDate,
          direction: "DEBIT",
          id: bill.id,
          kind: "bill",
        });
      }
    }
    result.push(
      ...owned(state.recurrences)
        .filter(
          ({ active, accountId }) =>
            active && accountMap.get(accountId)?.type !== "CREDIT",
        )
        .flatMap((r) =>
          recurrencePayments(r, from, to).filter(
            (event) => !matched.has(`${r.id}:${event.date.slice(0, 7)}`),
          ),
        ),
    );
    for (const loan of owned(state.loans)) {
      for (const payment of state.schedules.filter(
        (p) =>
          p.loanId === loan.id &&
          !p.transactionId &&
          p.date >= from &&
          p.date <= to,
      )) {
        result.push({
          accountId: null,
          amountMinor: payment.amountMinor,
          currency: loan.currency,
          date: payment.date,
          direction: "DEBIT",
          id: payment.id,
          kind: "loan",
        });
      }
    }
    return result.sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
  }
  function handleGetSpaces(
    _input: Extract<PlanningCommand, { tool: "get_spaces" }>,
  ) {
    return { records: state.spaces };
  }

  async function handleGetAccounts(
    input: Extract<PlanningCommand, { tool: "get_accounts" }>,
  ) {
    return {
      records: (await balances()).filter(
        (a) => input.include_hidden || !a.hidden,
      ),
    };
  }

  function handleGetCards(
    input: Extract<PlanningCommand, { tool: "get_cards" }>,
  ) {
    return {
      records: owned(cardCatalog(snapshot, state)).filter(
        (c) =>
          c.spaceId === input.spaceId &&
          !c.deleted &&
          (input.include_hidden || !c.hidden),
      ),
    };
  }

  async function handleGetTransactions(
    input: Extract<PlanningCommand, { tool: "get_transactions" }>,
  ) {
    validatePeriod(input);
    const { cursor, limit, tool: _tool, ...filter } = input;
    const scope = await hash(filter);
    let after = "";
    if (cursor) {
      const decoded = PlanningCursorSchema.parse(
        JSON.parse(decodeURIComponent(cursor)),
      );
      if (
        decoded.length !== 3 ||
        decoded[0] !== snapshot.revision ||
        decoded[1] !== scope
      ) {
        throw new Error("RESTART_REQUIRED");
      }
      after = decoded[2] ?? "";
    }
    const rows: import("../../domain").PlanningTransaction[] = [];
    const order = transactionOrder(input.order, after);
    for await (const row of allTransactions(input, undefined, {
      after,
      limit: limit + 1,
      order: input.order,
    })) {
      if (order.following(row)) {
        rows.push(row);
        rows.sort(order.compare);
        if (rows.length > limit + 1) {
          rows.pop();
        }
      }
    }
    const more = rows.length > limit;
    const records = rows.slice(0, limit);
    return {
      cursor: more
        ? encodeURIComponent(
            JSON.stringify([
              snapshot.revision,
              scope,
              order.key(found(records.at(-1))),
            ]),
          )
        : null,
      partial: snapshot.partial,
      records,
      referenceDay: day,
      selection: {
        ...querySelection,
        ...(input.from && { from: input.from }),
        ...(input.to && { to: input.to }),
      },
    };
  }

  function handleGetBills(
    input: Extract<PlanningCommand, { tool: "get_bills" }>,
  ) {
    return {
      records: bills().filter(
        (b) =>
          (!input.accountId || b.accountId === input.accountId) &&
          (!input.from || b.dueDate >= input.from) &&
          (!input.to || b.dueDate <= input.to),
      ),
    };
  }

  function handleGetCategories(
    input: Extract<PlanningCommand, { tool: "get_categories" }>,
  ) {
    return {
      records: scoped(state.categories).filter(
        (c) =>
          (input.include_hidden || !c.hidden) &&
          (input.groupId === undefined ||
            (c.groupId ?? null) === input.groupId),
      ),
    };
  }

  function handleGetTags(
    _input: Extract<PlanningCommand, { tool: "get_tags" }>,
  ) {
    return { records: scoped(state.tags) };
  }

  function handleGetRules(
    _input: Extract<PlanningCommand, { tool: "get_rules" }>,
  ) {
    return {
      records: scoped(state.rules).sort(compareRules),
    };
  }

  function handleGetRecurrences(
    _input: Extract<PlanningCommand, { tool: "get_recurrences" }>,
  ) {
    return { records: owned(state.recurrences) };
  }

  function handleGetGoals(
    _input: Extract<PlanningCommand, { tool: "get_goals" }>,
  ) {
    return { records: owned(state.goals) };
  }

  function handleGetInvestments(
    _input: Extract<PlanningCommand, { tool: "get_investments" }>,
  ) {
    return { records: owned(state.investments) };
  }

  function handleGetLoans(
    input: Extract<PlanningCommand, { tool: "get_loans" }>,
  ) {
    return {
      records: owned(state.loans)
        .filter((l) => input.include_hidden || !l.hidden)
        .map((loan) => {
          const schedule = state.schedules.filter((p) => p.loanId === loan.id);
          const remainingPrincipalMinor = schedule.length
            ? schedule
                .filter((p) => !p.transactionId)
                .reduce((sum, p) => sum + BigInt(p.principalMinor), 0n)
                .toString()
            : null;
          return { ...loan, remainingPrincipalMinor };
        }),
    };
  }

  function handleGetLoanSchedule(
    input: Extract<PlanningCommand, { tool: "get_loan_schedule" }>,
  ) {
    found(owned(state.loans).find((l) => l.id === input.id));
    return { records: state.schedules.filter((p) => p.loanId === input.id) };
  }

  function handleGetNotificationPreferences(
    _input: Extract<PlanningCommand, { tool: "get_notification_preferences" }>,
  ) {
    return {
      deliveryConfigured: false,
      records: scoped(state.notifications),
    };
  }

  async function handleGetGoalPlan(
    input: Extract<PlanningCommand, { tool: "get_goal_plan" }>,
  ) {
    const goal = found(owned(state.goals).find((g) => g.id === input.id));
    let saved = state.contributions
      .filter((c) => c.goalId === goal.id)
      .reduce((sum, c) => sum + BigInt(c.amountMinor), 0n);
    if (goal.accountId) {
      const account = found(
        (await balances()).find((a) => a.id === goal.accountId),
      );
      if (account.balanceMinor === null) {
        return {
          monthlyMinor: null,
          reason: "UNKNOWN_BALANCE",
          savedMinor: null,
        };
      }
      saved = BigInt(account.balanceMinor);
    }
    if (goal.investmentId) {
      const investment = inSpace(
        state.investments,
        goal.investmentId,
        input.spaceId,
      );
      if (investment.amountMinor === null) {
        return {
          monthlyMinor: null,
          reason: "UNKNOWN_BALANCE",
          savedMinor: null,
        };
      }
      saved = BigInt(investment.amountMinor);
    }
    const remaining =
      BigInt(goal.targetMinor) > saved ? BigInt(goal.targetMinor) - saved : 0n;
    return {
      assetLinkReplacesContributions: !!(goal.accountId || goal.investmentId),
      currency: goal.currency,
      monthlyMinor: (
        (remaining + BigInt(input.months) - 1n) /
        BigInt(input.months)
      ).toString(),
      months: input.months,
      remainingMinor: remaining.toString(),
      savedMinor: saved.toString(),
    };
  }

  function handleGetInstallments(
    input: Extract<PlanningCommand, { tool: "get_installments" }>,
  ) {
    return {
      records: owned(state.installments)
        .filter(
          (p) =>
            (input.include_completed || !p.completed) &&
            (!input.month || p.startDate.slice(0, 7) <= input.month) &&
            (!input.cardNumber ||
              p.transactionIds.some(
                (id) => metadata.get(id)?.cardNumber === input.cardNumber,
              )) &&
            (!input.month ||
              monthDate(p.startDate, p.total - p.current).slice(0, 7) >=
                input.month),
        )
        .map((p) => ({
          ...p,
          estimated: !p.manual,
          paidCount: p.manual ? p.current - 1 : null,
          remaining: Math.max(0, p.total - p.current + 1),
          remainingMinor: (
            BigInt(p.amountMinor) * BigInt(Math.max(0, p.total - p.current + 1))
          ).toString(),
        })),
    };
  }

  async function handleGetBudget(
    _input: Extract<PlanningCommand, { tool: "get_budget" }>,
  ) {
    const anchor = `${day.slice(0, 7)}-${String(space.monthStartDay).padStart(2, "0")}`;
    const from = day < anchor ? monthDate(anchor, -1) : anchor;
    const next = monthDate(from, 1);
    const to = new Date(Date.parse(next) - 86_400_000)
      .toISOString()
      .slice(0, 10);
    return {
      currency: space.currency,
      enabled: space.budgetEnabled,
      limits: scoped(state.categories).filter((c) => c.limitMinor !== null),
      totalMinor: space.monthlyBudgetMinor,
      usage: await summary(from, to),
    };
  }

  async function handleGetOverview(
    input: Extract<PlanningCommand, { tool: "get_overview" }>,
  ) {
    return {
      ...(await summary(input.from, input.to)),
      accounts: await balances(),
      investments: owned(state.investments).filter((i) => i.included),
      loans: owned(state.loans).filter((l) => !l.hidden),
    };
  }

  function handleGetSpendingByCategory(
    input: Extract<
      PlanningCommand,
      { tool: "get_spending_by_category" | "analyze_categories" }
    >,
  ) {
    return summary(input.from, input.to);
  }

  async function handleGenerateChart(
    input: Extract<PlanningCommand, { tool: "generate_chart" }>,
  ) {
    const result = await summary(input.from, input.to, input.groupBy);
    return {
      charts: input.includeSvg
        ? financialCharts({ groups: result.groups, type: input.type })
        : [],
      groupBy: input.groupBy,
      type: input.type,
      ...result,
    };
  }

  async function handleGetSpendingComparison(
    input: Extract<PlanningCommand, { tool: "get_spending_comparison" }>,
  ) {
    validatePeriod(input);
    const days =
      (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000 + 1;
    let previousFrom = new Date(Date.parse(input.from) - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    let previousTo = new Date(Date.parse(input.from) - 86_400_000)
      .toISOString()
      .slice(0, 10);
    if (input.comparison === "previous_month") {
      previousFrom = monthDate(input.from, -1);
      previousTo = monthDate(input.to, -1);
    }
    if (input.comparison === "explicit") {
      if (!(input.previousFrom && input.previousTo)) {
        throw new Error("INVALID_PERIOD");
      }
      ({ previousFrom, previousTo } = input);
    } else if (input.previousFrom || input.previousTo) {
      throw new Error("INVALID_PERIOD");
    }
    const [current, previous] = await summaries([
      input,
      { from: previousFrom, to: previousTo },
    ]);
    return {
      comparison: input.comparison,
      current: found(current),
      previous: found(previous),
    };
  }

  async function handleGetSpendingPace(
    input: Extract<PlanningCommand, { tool: "get_spending_pace" }>,
  ) {
    const result = await summary(input.from, input.to);
    const elapsed = Math.max(
      0,
      (Date.parse(day < input.to ? day : input.to) - Date.parse(input.from)) /
        86_400_000 +
        1,
    );
    const days =
      (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000 + 1;
    return {
      ...result,
      elapsedDays: elapsed,
      estimated: true,
      periodDays: days,
      projection: result.totals.map((t) => ({
        amountMinor:
          elapsed && t.expenseMinor !== null
            ? (
                (BigInt(t.expenseMinor) * BigInt(days)) /
                BigInt(elapsed)
              ).toString()
            : null,
        currency: t.currency,
      })),
    };
  }

  async function handleGetUpcomingPayments(
    input: Extract<PlanningCommand, { tool: "get_upcoming_payments" }>,
  ) {
    return { estimated: true, records: await upcoming(input.from, input.to) };
  }

  async function handleGetProjection(
    input: Extract<PlanningCommand, { tool: "get_projection" }>,
  ) {
    validatePeriod(input);
    if (input.from < day) {
      throw new Error("PROJECTION_REQUIRES_CURRENT_OR_FUTURE_PERIOD");
    }
    const base = await balances();
    const projection = new Map<string, { balance: bigint; unknown: number }>();
    for (const account of base.filter((a) => a.type === "BANK" && !a.hidden)) {
      const item = projection.get(account.currency) ?? {
        balance: 0n,
        unknown: 0,
      };
      if (account.balanceMinor === null) {
        item.unknown += 1;
      } else {
        item.balance += BigInt(account.balanceMinor);
      }
      projection.set(account.currency, item);
    }
    const events = await upcoming(day, input.to);
    for (const event of events) {
      if (
        event.accountId &&
        accountMap.get(event.accountId)?.type === "CREDIT" &&
        event.kind !== "bill"
      ) {
        continue;
      }
      const item = projection.get(event.currency) ?? {
        balance: 0n,
        unknown: 0,
      };
      if (event.amountMinor === null) {
        item.unknown += 1;
      } else {
        item.balance +=
          (event.direction === "DEBIT" ? -1n : 1n) * BigInt(event.amountMinor);
      }
      projection.set(event.currency, item);
    }
    return {
      assumptions: [
        "Current BANK balances plus scheduled cash flows; card purchases are not deducted twice.",
        "Unscheduled future income, spending and future card bills are unknown.",
      ],
      estimated: true,
      groups: [...projection].map(([currency, p]) => ({
        currency,
        knownSubtotalMinor: p.balance.toString(),
        projectedMinor: p.unknown ? null : p.balance.toString(),
        unknownCount: p.unknown,
      })),
      referenceDay: day,
      through: input.to,
    };
  }
  async function handleGetSubscriptions(
    input: Extract<PlanningCommand, { tool: "get_subscriptions" }>,
  ) {
    const to = input.to && input.to < day ? input.to : day;
    const from = input.from ?? monthDate(to, -12);
    validatePeriod({ from, to });
    const transactions: import("../../domain").TransactionProjection[] = [];
    const scanLimit = 10_000;
    let scannedCount = 0;
    let truncated = false;
    for await (const row of stream({ ...querySelection, from, to })) {
      if (scannedCount === scanLimit) {
        truncated = true;
        break;
      }
      scannedCount += 1;
      const details = metadata.get(row.id);
      const kind = classification(row, state, details?.operationType ?? null);
      if (kind !== "transfer" && kind !== "income") {
        transactions.push({ ...row, ...(details && { details }) });
      }
    }
    const candidates = detectSubscriptions({
      minOccurrences: input.minOccurrences,
      transactions,
    });
    return {
      estimated: true,
      matchedCount: candidates.length,
      records: candidates.slice(0, input.limit),
      referenceDay: day,
      scanLimit,
      scannedCount,
      selection: { ...querySelection, from, to },
      truncated: truncated || candidates.length > input.limit,
    };
  }
  switch (command.tool) {
    case "get_subscriptions":
      return await handleGetSubscriptions(command);
    case "get_spaces":
      return handleGetSpaces(command);
    case "get_accounts":
      return await handleGetAccounts(command);
    case "get_cards":
      return handleGetCards(command);
    case "get_transactions":
      return await handleGetTransactions(command);
    case "get_bills":
      return handleGetBills(command);
    case "get_categories":
      return handleGetCategories(command);
    case "get_category_groups":
      return { records: scoped(state.categoryGroups) };
    case "get_tags":
      return handleGetTags(command);
    case "get_rules":
      return handleGetRules(command);
    case "get_recurrences":
      return handleGetRecurrences(command);
    case "get_goals":
      return handleGetGoals(command);
    case "get_investments":
      return handleGetInvestments(command);
    case "get_loans":
      return handleGetLoans(command);
    case "get_loan_schedule":
      return handleGetLoanSchedule(command);
    case "get_notification_preferences":
      return handleGetNotificationPreferences(command);
    case "get_goal_plan":
      return await handleGetGoalPlan(command);
    case "get_installments":
      return handleGetInstallments(command);
    case "get_budget":
      return await handleGetBudget(command);
    case "get_overview":
      return await handleGetOverview(command);
    case "get_spending_by_category":
    case "analyze_categories":
      return handleGetSpendingByCategory(command);
    case "generate_chart":
      return await handleGenerateChart(command);
    case "get_spending_comparison":
      return await handleGetSpendingComparison(command);
    case "get_spending_pace":
      return await handleGetSpendingPace(command);
    case "get_upcoming_payments":
      return handleGetUpcomingPayments(command);
    case "get_projection":
      return await handleGetProjection(command);
    default:
      throw new Error("UNKNOWN_TOOL");
  }
}
