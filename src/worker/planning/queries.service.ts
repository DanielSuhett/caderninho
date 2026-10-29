import type { PlanningCommand, PlanningQuery } from "../../contracts";
import {
  AccountType,
  CategoryKind,
  cardCredit,
  closedMonths,
  compareRules,
  detectSubscriptions,
  emergencyReservePlan,
  type FinancialIdentityFilter,
  financialCharts,
  financialIdentity,
  fixedCostBreakdown,
  investmentPortfolio,
  localDay,
  type MonthlyRollupData,
  matchesFinancialIdentity,
  minorPresentation,
  monthDate,
  PlanningError,
  type PlanningTransaction,
  reserveDefaults,
  reserveId,
  SpendingGroupBy,
  TransactionDirection,
  TransactionOrder,
  type TransactionProjection,
  TransactionStatus,
} from "../../domain";
import { type ProjectedPayment, recurrencePayments } from "./billing";
import { effectiveBills } from "./bills.service";
import { cardCommitments } from "./card-commitments.service";
import { planningCursor } from "./cursor";
import type {
  MonthlyRollup,
  PlanningRepository,
  PlanningResult,
  PlanningSnapshot,
} from "./entity";
import {
  cardCatalog,
  classification,
  found,
  inSpace,
  planningSelection,
  type Selection,
  transactionStream,
  validatePeriod,
  validateSelection,
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
interface SummaryBucket {
  /** Classified expense per account, collected only when requested. */
  accounts?: Map<string, bigint>;
  groups: Map<
    string,
    { currency: string; group: string; amount: bigint; unknown: number }
  >;
  totals: Map<string, Totals>;
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
function monthSegments(from: string, to: string) {
  const segments: {
    from: string;
    month: string;
    to: string;
    whole: boolean;
  }[] = [];
  let month = from.slice(0, 7);
  while (month <= to.slice(0, 7)) {
    const first = `${month}-01`;
    const last = new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
    )
      .toISOString()
      .slice(0, 10);
    segments.push({
      from: first < from ? from : first,
      month,
      to: last > to ? to : last,
      whole: first >= from && last <= to,
    });
    const next = new Date(`${last}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    month = next.toISOString().slice(0, 7);
  }
  return segments;
}
function rollupData(
  totals: Map<string, Totals> = new Map(),
  groups: Map<string, { amount: bigint; currency: string }> = new Map(),
): MonthlyRollupData {
  return {
    expenses: Object.fromEntries(
      [...groups.values()].map((g) => [g.currency, g.amount.toString()]),
    ),
    totals: Object.fromEntries(
      [...totals].map(([currency, t]) => [
        currency,
        {
          ...t,
          cashFlow: t.cashFlow.toString(),
          expense: t.expense.toString(),
          income: t.income.toString(),
          unclassifiedAmount: t.unclassifiedAmount.toString(),
        },
      ]),
    ),
  };
}
function mergeRollup(
  period: {
    groups: Map<
      string,
      { currency: string; group: string; amount: bigint; unknown: number }
    >;
    totals: Map<string, Totals>;
  },
  month: string,
  data: MonthlyRollupData,
) {
  for (const [currency, t] of Object.entries(data.totals)) {
    const total = period.totals.get(currency) ?? emptyTotals();
    period.totals.set(currency, total);
    total.cashFlow += BigInt(t.cashFlow);
    total.count += t.count;
    total.expense += BigInt(t.expense);
    total.income += BigInt(t.income);
    total.unclassified += t.unclassified;
    total.unclassifiedAmount += BigInt(t.unclassifiedAmount);
    total.unclassifiedUnknown += t.unclassifiedUnknown;
    total.unknown += t.unknown;
  }
  for (const [currency, amount] of Object.entries(data.expenses)) {
    period.groups.set(JSON.stringify([currency, month]), {
      amount: BigInt(amount),
      currency,
      group: month,
      unknown: 0,
    });
  }
}
function transactionOrder(order: TransactionOrder, after: string) {
  const descending = order === TransactionOrder.date_desc;
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
export async function planningQuery(
  command: PlanningQuery,
  snapshot: PlanningSnapshot,
  repository: PlanningRepository,
  {
    now,
    identityFilter = {},
  }: { now: Date; identityFilter?: FinancialIdentityFilter },
): Promise<PlanningResult> {
  const { state } = snapshot;
  const day = localDay(now);
  const querySelection = planningSelection(command, identityFilter);
  const {
    space,
    accountMap,
    accountList: allAccounts,
  } = validateSelection(querySelection, snapshot);
  const { personId } = querySelection;
  const allTransactions = transactionStream(repository, snapshot);
  const stream = (selection: Selection) =>
    allTransactions({
      ...selection,
      ...identityFilter,
      ...(personId && { personId }),
    });
  const metadata = new Map(
    snapshot.transactionDetails.map((row) => [row.id, row]),
  );
  const scoped = <T extends { spaceId: string }>(rows: T[]) =>
    rows.filter((row) => row.spaceId === command.spaceId);
  function owned<
    T extends {
      spaceId: string;
      personId?: string | undefined;
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
    const rows = owned(allAccounts)
      .filter((account) =>
        matchesFinancialIdentity(account.identity, identityFilter),
      )
      .map((a) => ({ ...a }));
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
        row.status !== TransactionStatus.POSTED ||
        row.date > day ||
        row.amountMinor === null
      ) {
        continue;
      }
      if (row.recurrenceId) {
        matched.add(`${row.recurrenceId}:${row.date.slice(0, 7)}`);
      }
      const cashSign = row.direction === TransactionDirection.DEBIT ? -1n : 1n;
      const sign = account.type === AccountType.CREDIT ? -cashSign : cashSign;
      account.balanceMinor = (
        BigInt(account.balanceMinor ?? "0") +
        sign * absolute(row.amountMinor)
      ).toString();
    }
    return rows.map((row) => {
      const setting = state.accounts.find((a) => a.id === row.id);
      const details = snapshot.accountDetails.find((a) => a.id === row.id);
      const credit = cardCredit({
        available: details?.availableCreditMinor ?? null,
        limit: details?.creditLimitMinor ?? null,
        localLimit: setting?.creditLimitMinor,
      });
      const limit = credit.creditLimitMinor;
      let available = credit.availableCreditMinor;
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
        creditEstimated: row.manual || credit.creditEstimated,
        creditLimitMinor: limit,
        dueDate: details?.dueDate ?? null,
        dueDay: setting?.dueDay ?? null,
      };
    });
  }
  function addExpense(
    row: PlanningTransaction,
    total: Totals,
    { groups, accounts }: SummaryBucket,
    groupBy: SpendingGroupBy,
  ) {
    const magnitude = absolute(row.amountMinor ?? "0");
    const expense =
      row.direction === TransactionDirection.DEBIT ? magnitude : -magnitude;
    total.expense += expense;
    accounts?.set(row.accountId, (accounts.get(row.accountId) ?? 0n) + expense);
    const group =
      groupBy === SpendingGroupBy.month
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
    row: PlanningTransaction,
    bucket: SummaryBucket,
    groupBy: SpendingGroupBy,
  ) {
    const { totals } = bucket;
    const total = totals.get(row.currency) ?? emptyTotals();
    totals.set(row.currency, total);
    total.count += 1;
    const kind = classification(row, state);
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
    if (accountMap.get(row.accountId)?.type === AccountType.BANK) {
      total.cashFlow +=
        row.direction === TransactionDirection.DEBIT ? -amount : amount;
    }
    if (kind === CategoryKind.income) {
      total.income +=
        row.direction === TransactionDirection.CREDIT ? amount : -amount;
    }
    if (kind === CategoryKind.expense) {
      addExpense(row, total, bucket, groupBy);
    }
  }
  async function summaries(
    intervals: { from: string; to: string }[],
    groupBy: SpendingGroupBy = SpendingGroupBy.category,
  ) {
    return (await accumulate(intervals, groupBy)).map((period) =>
      presentSummary(period, groupBy),
    );
  }
  async function accumulate(
    intervals: { from: string; to: string }[],
    groupBy: SpendingGroupBy = SpendingGroupBy.category,
  ) {
    for (const interval of intervals) {
      validatePeriod(interval);
    }
    const periods = intervals.map((interval) => ({
      ...interval,
      accounts: new Map<string, bigint>(),
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
      if (row.status !== TransactionStatus.POSTED || row.date > day) {
        continue;
      }
      for (const interval of periods) {
        if (row.date >= interval.from && row.date <= interval.to) {
          addSummaryRow(row, interval, groupBy);
        }
      }
    }
    return periods;
  }
  function presentSummary(
    {
      from,
      to,
      totals,
      groups,
    }: {
      from: string;
      to: string;
      totals: Map<string, Totals>;
      groups: Map<
        string,
        { currency: string; group: string; amount: bigint; unknown: number }
      >;
    },
    groupBy: SpendingGroupBy,
  ) {
    return {
      classification:
        "Only explicit local income/expense categories; unclassified bank movements are reported separately.",
      dateBasis: "transaction",
      eligibility: { status: TransactionStatus.POSTED, throughDay: day },
      from,
      groups: [...groups.values()].map((g) => ({
        amountMinor: g.amount.toString(),
        ...minorPresentation(g.amount.toString(), g.currency),
        currency: g.currency,
        group: g.group,
        label:
          groupBy === SpendingGroupBy.category
            ? (state.categories.find((category) => category.id === g.group)
                ?.name ?? "Sem classificação")
            : g.group,
        ...(groupBy === SpendingGroupBy.category && {
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
    };
  }
  async function summary(
    from: string,
    to: string,
    groupBy: SpendingGroupBy = SpendingGroupBy.category,
  ) {
    if (groupBy === SpendingGroupBy.month) {
      return monthlySummary(from, to);
    }
    return found((await summaries([{ from, to }], groupBy))[0]);
  }
  /**
   * Month series backed by planning_monthly_rollups. Closed months are cached
   * per selection and reused while the planning revision and every
   * connection's import sequence stay the same; the current month and partial
   * edge months are always computed from transactions.
   */
  async function monthlySummary(from: string, to: string) {
    validatePeriod({ from, to });
    const scope = JSON.stringify(querySelection);
    const version = [
      snapshot.revision,
      ...snapshot.connections
        .map((row) => `${row.id}:${row.importSequence}:${row.lastSuccessAt}`)
        .toSorted(),
    ].join("|");
    const openMonth = day.slice(0, 7);
    const segments = monthSegments(from, to);
    const closed = segments
      .filter((segment) => segment.whole && segment.month < openMonth)
      .map((segment) => segment.month);
    const cached = new Map(
      (await repository.monthlyRollups(scope, closed))
        .filter((row) => row.version === version)
        .map((row) => [row.month, row.data]),
    );
    const period = {
      from,
      groups: new Map<
        string,
        { currency: string; group: string; amount: bigint; unknown: number }
      >(),
      to,
      totals: new Map<string, Totals>(),
    };
    const missing = segments.filter((segment) => !cached.has(segment.month));
    const buckets = new Map(
      missing.map((segment) => [
        segment.month,
        {
          groups: new Map<
            string,
            { currency: string; group: string; amount: bigint; unknown: number }
          >(),
          totals: new Map<string, Totals>(),
        },
      ]),
    );
    const first = missing.at(0);
    const last = missing.at(-1);
    if (first && last) {
      for await (const row of stream({
        ...querySelection,
        from: first.from,
        to: last.to,
      })) {
        const bucket = buckets.get(row.date.slice(0, 7));
        if (
          !bucket ||
          row.status !== TransactionStatus.POSTED ||
          row.date > day
        ) {
          continue;
        }
        addSummaryRow(row, bucket, SpendingGroupBy.month);
      }
    }
    const fresh: MonthlyRollup[] = [];
    for (const [month, bucket] of buckets) {
      const data = rollupData(bucket.totals, bucket.groups);
      mergeRollup(period, month, data);
      if (closed.includes(month)) {
        fresh.push({ data, month, version });
      }
    }
    for (const [month, data] of cached) {
      mergeRollup(period, month, data);
    }
    await repository.saveMonthlyRollups(scope, fresh);
    return presentSummary(period, SpendingGroupBy.month);
  }
  async function upcoming(from: string, to: string) {
    validatePeriod({ from, to });
    const matched = new Set<string>();
    for await (const row of stream({
      include_ignored: true,
      spaceId: command.spaceId,
      status: TransactionStatus.POSTED,
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
          direction: TransactionDirection.DEBIT,
          id: bill.id,
          kind: "bill",
        });
      }
    }
    result.push(
      ...owned(state.recurrences)
        .filter(
          ({ active, accountId }) =>
            active && accountMap.get(accountId)?.type !== AccountType.CREDIT,
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
          direction: TransactionDirection.DEBIT,
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
      records: scoped(cardCatalog(snapshot, state))
        .filter(
          (c) =>
            !c.deleted &&
            (input.include_hidden || !c.hidden) &&
            (!personId || c.personId === personId),
        )
        .map((c) => ({
          ...c,
          profileId: accountMap.get(c.accountId)?.profileId ?? null,
        })),
    };
  }

  async function handleGetTransactions(
    input: Extract<PlanningCommand, { tool: "get_transactions" }>,
  ) {
    validatePeriod(input);
    const { cursor, limit, tool: _tool, ...filter } = input;
    const cursorState = await planningCursor({
      cursor,
      filter,
      revision: snapshot.revision,
    });
    const { after } = cursorState;
    const rows: PlanningTransaction[] = [];
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
        ? cursorState.encode(order.key(found(records.at(-1))))
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
          (input.fixedCost === undefined || c.fixedCost === input.fixedCost),
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
    input: Extract<PlanningCommand, { tool: "get_investments" }>,
  ) {
    return investmentPortfolio(
      owned(state.investments)
        .map((investment) => ({
          ...investment,
          identity: financialIdentity({
            identity: investment.identity,
            institution:
              financialIdentity({ identity: investment.identity })
                .institution ??
              snapshot.owners.find(
                (owner) => owner.connectionId === investment.connectionId,
              )?.institution ??
              allAccounts.find(
                (account) =>
                  account.connectionId === investment.connectionId &&
                  account.identity?.institution,
              )?.identity?.institution,
          }),
        }))
        .filter((investment) =>
          matchesFinancialIdentity(investment.identity, identityFilter),
        ),
      input,
    );
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

  async function handleGetEmergencyReserve(
    input: Extract<PlanningCommand, { tool: "get_emergency_reserve" }>,
  ) {
    const config = state.reserves.find(
      (row) => row.id === reserveId(input.spaceId, input.personId),
    );
    const months = config?.months ?? reserveDefaults.months;
    const fixed = new Set(
      scoped(state.categories)
        .filter((c) => c.fixedCost)
        .map((c) => c.id),
    );
    const closed = closedMonths(day, reserveDefaults.window);
    const periods = await summaries(closed);
    const perMonth = periods.map(
      (period) =>
        new Map(
          period.groups
            .filter((g) => g.currency === space.currency && fixed.has(g.group))
            .map((g) => [g.group, BigInt(g.amountMinor)]),
        ),
    );
    const monthTotal = (month: Map<string, bigint> | undefined) =>
      [...(month?.values() ?? [])].reduce((sum, value) => sum + value, 0n);
    const linked = new Set([
      ...(config?.accountIds ?? []),
      ...(config?.investmentIds ?? []),
    ]);
    const sources = [
      ...(await balances())
        .filter((a) => a.type !== AccountType.CREDIT && !a.hidden)
        .map((a) => ({
          balanceMinor: a.balanceMinor,
          id: a.id,
          identity: a.identity,
          kind: "account" as const,
          name: a.name,
        })),
      ...owned(state.investments).map((i) => ({
        balanceMinor: i.amountMinor,
        id: i.id,
        identity: i.identity,
        kind: "investment" as const,
        name: i.name,
      })),
    ].map((source) => ({ ...source, linked: linked.has(source.id) }));
    const breakdown = fixedCostBreakdown(perMonth);
    const plan = emergencyReservePlan({
      balancesMinor: sources
        .filter((source) => source.linked)
        .map((source) =>
          source.balanceMinor === null ? null : BigInt(source.balanceMinor),
        ),
      monthlyMinor: perMonth.map(monthTotal),
      months,
    });
    return {
      ...plan,
      categories: breakdown.categories.map((row) => {
        const category = state.categories.find((c) => c.id === row.id);
        return {
          ...row,
          ...(category?.color && { color: category.color }),
          ...(category?.icon && { icon: category.icon }),
          name: category?.name ?? row.id,
        };
      }),
      currency: space.currency,
      monthly: closed.map((period, index) => ({
        amountMinor: monthTotal(perMonth[index]).toString(),
        month: period.month,
      })),
      months,
      personId: input.personId,
      reductionMinor: breakdown.reductionMinor,
      sources,
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
    const period = found(
      (await accumulate([input], SpendingGroupBy.category))[0],
    );
    return {
      ...presentSummary(period, SpendingGroupBy.category),
      accounts: (await balances()).map((account) => ({
        ...account,
        periodExpenseMinor: (period.accounts.get(account.id) ?? 0n).toString(),
      })),
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
        throw new Error(PlanningError.INVALID_PERIOD);
      }
      ({ previousFrom, previousTo } = input);
    } else if (input.previousFrom || input.previousTo) {
      throw new Error(PlanningError.INVALID_PERIOD);
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
      throw new Error(
        PlanningError.PROJECTION_REQUIRES_CURRENT_OR_FUTURE_PERIOD,
      );
    }
    const base = await balances();
    const projection = new Map<string, { balance: bigint; unknown: number }>();
    for (const account of base.filter(
      (a) => a.type === AccountType.BANK && !a.hidden,
    )) {
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
        accountMap.get(event.accountId)?.type === AccountType.CREDIT &&
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
          (event.direction === TransactionDirection.DEBIT ? -1n : 1n) *
          BigInt(event.amountMinor);
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
    const transactions: TransactionProjection[] = [];
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
      const kind = classification(row, state);
      if (kind !== CategoryKind.transfer && kind !== CategoryKind.income) {
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
    case "get_card_commitments":
      return cardCommitments({
        query: command,
        referenceDay: day,
        repository,
        snapshot,
      });
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
    case "get_emergency_reserve":
      return await handleGetEmergencyReserve(command);
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
      throw new Error(PlanningError.UNKNOWN_TOOL);
  }
}
