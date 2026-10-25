import type { CardCommitments, CardCommitmentsQuery } from "../../contracts";
import type { PlanningTransaction, TransactionDetails } from "../../domain";
import { monthDate } from "../../domain";
import type { PlanningRepository, PlanningSnapshot } from "./entity";
import { accounts, classification, transactionStream } from "./projection";

type Phase = "spent" | "pending" | "future";
interface Amount {
  known: bigint;
  unknown: number;
}
interface Totals {
  currency: string;
  future: Amount;
  pending: Amount;
  spent: Amount;
  unclassifiedCount: number;
  unclassifiedMinor: bigint;
  unclassifiedUnknown: number;
}
const emptyAmount = (): Amount => ({ known: 0n, unknown: 0 });
function emptyTotals(currency: string): Totals {
  return {
    currency,
    future: emptyAmount(),
    pending: emptyAmount(),
    spent: emptyAmount(),
    unclassifiedCount: 0,
    unclassifiedMinor: 0n,
    unclassifiedUnknown: 0,
  };
}
function amount(value: Amount) {
  return value.unknown ? null : value.known.toString();
}
function signedExpense(row: PlanningTransaction) {
  if (row.amountMinor === null) {
    return null;
  }
  const value = BigInt(row.amountMinor);
  const magnitude = value < 0n ? -value : value;
  return row.direction === "DEBIT" ? magnitude : -magnitude;
}
function add(value: Amount, row: PlanningTransaction) {
  const signed = signedExpense(row);
  if (signed === null) {
    value.unknown += 1;
  } else {
    value.known += signed;
  }
}
function totalResult(value: Totals): CardCommitments["totals"][number] {
  const known = value.spent.known + value.pending.known + value.future.known;
  const unknown =
    value.spent.unknown + value.pending.unknown + value.future.unknown;
  return {
    currency: value.currency,
    futureMinor: amount(value.future),
    knownFutureMinor: value.future.known.toString(),
    knownObservedCommitmentsMinor: known.toString(),
    knownPendingMinor: value.pending.known.toString(),
    knownSpentMinor: value.spent.known.toString(),
    knownUnclassifiedMinor: value.unclassifiedMinor.toString(),
    observedCommitmentsMinor: unknown ? null : known.toString(),
    pendingMinor: amount(value.pending),
    spentMinor: amount(value.spent),
    unclassifiedCount: value.unclassifiedCount,
    unclassifiedUnknownAmountCount: value.unclassifiedUnknown,
    unknownAmountCount: unknown,
  };
}
function phaseOf(row: PlanningTransaction, referenceDay: string): Phase {
  if (row.date > referenceDay) {
    return "future";
  }
  return row.status === "POSTED" ? "spent" : "pending";
}
function observeInstallment(input: {
  row: PlanningTransaction;
  detail: TransactionDetails | undefined;
  accountName: string;
  categoryName: string;
  phase: Phase;
}): CardCommitments["installments"][number] | null {
  const { row, detail, accountName, categoryName, phase } = input;
  const card = row.identification?.creditCardMetadata;
  const installmentNumber =
    detail?.installmentNumber ?? card?.installmentNumber;
  const totalInstallments =
    detail?.totalInstallments ?? card?.totalInstallments;
  if (
    !(installmentNumber && totalInstallments) ||
    totalInstallments < 2 ||
    installmentNumber > totalInstallments
  ) {
    return null;
  }
  return {
    accountId: row.accountId,
    accountName,
    amountMinor: row.amountMinor,
    cardNumber: detail?.cardNumber ?? card?.cardNumber ?? null,
    categoryId: row.category,
    categoryName,
    currency: row.currency,
    date: row.date,
    description: row.description,
    direction: row.direction,
    id: row.id,
    installmentNumber,
    phase,
    purchaseDate:
      detail?.purchaseDate ?? card?.purchaseDate?.slice(0, 10) ?? null,
    status: row.status,
    totalInstallments,
  };
}
function addTotals(input: {
  total: Totals;
  row: PlanningTransaction;
  kind: "expense" | "unclassified";
  phase: Phase;
}) {
  const { total, row, kind, phase } = input;
  if (kind === "expense") {
    add(total[phase], row);
    return;
  }
  total.unclassifiedCount += 1;
  const signed = signedExpense(row);
  if (signed === null) {
    total.unclassifiedUnknown += 1;
  } else {
    total.unclassifiedMinor += signed;
  }
}

export async function cardCommitments(input: {
  query: CardCommitmentsQuery;
  snapshot: PlanningSnapshot;
  repository: PlanningRepository;
  referenceDay: string;
}): Promise<CardCommitments> {
  const { query, snapshot, repository, referenceDay } = input;
  const month = query.month ?? referenceDay.slice(0, 7);
  const from = `${month}-01`;
  const until = monthDate(from, query.months);
  const to = new Date(Date.parse(until) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const allAccounts = accounts(snapshot);
  if (
    query.accountId &&
    allAccounts.find((row) => row.id === query.accountId)?.type !== "CREDIT"
  ) {
    throw new Error("CARD_REQUIRED");
  }
  const movedAccountIds = new Set(
    snapshot.state.edits
      .filter((edit) => edit.spaceId === query.spaceId && !edit.deleted)
      .flatMap((edit) => (edit.accountId ? [edit.accountId] : [])),
  );
  const selectedAccounts = allAccounts.filter(
    (row) =>
      row.type === "CREDIT" &&
      (row.spaceId === query.spaceId || movedAccountIds.has(row.id)) &&
      (!query.accountId || row.id === query.accountId) &&
      (!query.personId || row.personId === query.personId),
  );
  const accountMap = new Map(selectedAccounts.map((row) => [row.id, row]));
  const details = new Map(snapshot.accountDetails.map((row) => [row.id, row]));
  const settings = new Map(snapshot.state.accounts.map((row) => [row.id, row]));
  const metadata = new Map(
    snapshot.transactionDetails.map((row) => [row.id, row]),
  );
  const categoryMap = new Map(
    snapshot.state.categories
      .filter((row) => row.spaceId === query.spaceId)
      .map((row) => [row.id, row]),
  );
  const totals = new Map<string, Totals>();
  const monthly = new Map<string, { month: string; total: Totals }>();
  const categories = new Map<
    string,
    { amount: Amount; categoryId: string | null; currency: string }
  >();
  const installments: CardCommitments["installments"] = [];
  function currencyTotals(currency: string) {
    const total = totals.get(currency) ?? emptyTotals(currency);
    if (!totals.has(currency)) {
      totals.set(currency, total);
      for (let offset = 0; offset < query.months; offset += 1) {
        const key = monthDate(from, offset).slice(0, 7);
        monthly.set(JSON.stringify([key, currency]), {
          month: key,
          total: emptyTotals(currency),
        });
      }
    }
    return total;
  }
  for (const account of selectedAccounts) {
    if (!query.currency || account.currency === query.currency) {
      currencyTotals(account.currency);
    }
  }
  function observe(row: PlanningTransaction) {
    const account = accountMap.get(row.accountId);
    if (!account) {
      return;
    }
    const detail = metadata.get(row.id);
    const operation =
      detail?.operationType ?? row.identification?.operationType ?? null;
    if (operation === "PAGAMENTO_FATURA") {
      return;
    }
    const kind = classification(row, snapshot.state, operation);
    if (kind !== "expense" && kind !== "unclassified") {
      return;
    }
    const total = currencyTotals(row.currency);
    const monthTotal = monthly.get(
      JSON.stringify([row.date.slice(0, 7), row.currency]),
    );
    const sums = [total, ...(monthTotal ? [monthTotal.total] : [])];
    const phase = phaseOf(row, referenceDay);
    const installment = observeInstallment({
      accountName: account.name,
      categoryName:
        categoryMap.get(row.category ?? "")?.name ?? "Sem categoria",
      detail,
      phase,
      row,
    });
    if (installment) {
      installments.push(installment);
    }
    for (const sum of sums) {
      addTotals({ kind, phase, row, total: sum });
    }
    if (kind === "unclassified") {
      return;
    }
    const categoryKey = JSON.stringify([row.category, row.currency]);
    const group = categories.get(categoryKey) ?? {
      amount: emptyAmount(),
      categoryId: row.category,
      currency: row.currency,
    };
    add(group.amount, row);
    categories.set(categoryKey, group);
  }
  for await (const row of transactionStream(
    repository,
    snapshot,
  )({
    accountIds: selectedAccounts.map((account) => account.id),
    from,
    spaceId: query.spaceId,
    to,
    ...(query.currency && { currency: query.currency }),
    ...(query.personId && { personId: query.personId }),
  })) {
    observe(row);
  }
  return {
    accounts: selectedAccounts.map((account) => {
      const detail = details.get(account.id);
      const setting = settings.get(account.id);
      const limit = account.manual
        ? (setting?.creditLimitMinor ?? null)
        : (detail?.creditLimitMinor ?? null);
      const available = account.manual
        ? null
        : (detail?.availableCreditMinor ?? null);
      const allocated =
        limit !== null &&
        available !== null &&
        BigInt(limit) >= BigInt(available)
          ? (BigInt(limit) - BigInt(available)).toString()
          : null;
      let limitSource: CardCommitments["accounts"][number]["limitSource"] =
        "unavailable";
      if (limit !== null) {
        limitSource = account.manual ? "manual" : "provider";
      }
      return {
        allocatedCreditMinor: allocated,
        availabilitySource: available === null ? "unavailable" : "provider",
        availableCreditMinor: available,
        balanceObservedAt: account.balanceObservedAt,
        creditLimitMinor: limit,
        currency: account.currency,
        hidden: account.hidden,
        id: account.id,
        identity: account.identity ?? null,
        limitSource,
        manual: account.manual,
        name: account.name,
        personId: account.personId,
        personName: account.personName,
      };
    }),
    assumptions: [
      "Somente contas CREDIT da seleção e despesas com classificação efetiva. Transferências, pagamentos de fatura e registros ignorados ficam fora.",
      "Gastos realizados exigem POSTED e data até referenceDay. Créditos classificados como despesa reduzem o gasto; créditos sem essa evidência não são tratados como estorno.",
      "Pendentes e lançamentos com data futura são compromissos observados, nunca gastos realizados. O cronograma contém apenas parcelas registradas, sem inferir parcelas ausentes ou pagamentos.",
      "Categorias distribuem os compromissos observados do período, líquidos de estornos; não representam a ocupação do limite bancário. Valores sem classificação são informados separadamente.",
      "Limite e disponível só usam valores explícitos do provedor ou limite manual. Alocado é limite menos disponível quando ambos são conhecidos e consistentes; não é inferido do saldo nem somado às parcelas.",
    ],
    categories: [...categories.values()]
      .map((group) => {
        const category = categoryMap.get(group.categoryId ?? "");
        return {
          amountMinor: amount(group.amount),
          color: category?.color ?? "#64748b",
          currency: group.currency,
          id: group.categoryId,
          knownAmountMinor: group.amount.known.toString(),
          name: category?.name ?? "Sem categoria",
          unknownAmountCount: group.amount.unknown,
        };
      })
      .sort(
        (a, b) =>
          a.currency.localeCompare(b.currency) || a.name.localeCompare(b.name),
      ),
    categoryBasis: "observed_commitments",
    from,
    installments: installments.sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    ),
    month,
    months: [...monthly.values()]
      .map((entry) => ({ month: entry.month, ...totalResult(entry.total) }))
      .sort(
        (a, b) =>
          a.month.localeCompare(b.month) ||
          a.currency.localeCompare(b.currency),
      ),
    referenceDay,
    to,
    totals: [...totals.values()]
      .map(totalResult)
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}
