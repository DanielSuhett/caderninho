import type {
  PlanningAccount,
  PlanningState,
  PlanningTransaction,
  TransactionProjection,
} from "../../domain";
import type { PlanningRepository, PlanningSnapshot } from "./entity";

export function found<T>(row: T | undefined): T {
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  return row;
}
export function inSpace<T extends { id: string; spaceId: string }>(
  rows: T[],
  id: string,
  spaceId: string,
): T {
  const row = found(rows.find((item) => item.id === id));
  if (row.spaceId !== spaceId) {
    throw new Error("SPACE_MISMATCH");
  }
  return row;
}
export function accounts(
  snapshot: PlanningSnapshot,
  state = snapshot.state,
): PlanningAccount[] {
  const settings = new Map(state.accounts.map((row) => [row.id, row]));
  const imported = snapshot.accounts.map((row) => {
    const setting = settings.get(row.id);
    return {
      ...row,
      hidden: setting?.hidden ?? false,
      name: setting?.name ?? row.name,
      spaceId: setting?.spaceId ?? "personal",
    };
  });
  return [
    ...imported,
    ...state.accounts
      .filter((row) => row.manual)
      .map((row) => ({
        balanceMinor: row.openingBalanceMinor ?? "0",
        balanceObservedAt: null,
        connectionId: null,
        currency: row.currency ?? "BRL",
        hidden: row.hidden,
        id: row.id,
        manual: true,
        name: row.name ?? "",
        spaceId: row.spaceId,
        type: row.type ?? "BANK",
      })),
  ];
}
export interface Selection {
  accountId?: string | undefined;
  cardNumber?: string | undefined;
  categoryId?: string | undefined;
  direction?: string | undefined;
  from?: string | undefined;
  include_ignored?: boolean | undefined;
  spaceId: string;
  status?: string | undefined;
  tagId?: string | undefined;
  text?: string | undefined;
  to?: string | undefined;
}
export function validatePeriod(input: {
  from?: string | undefined;
  to?: string | undefined;
}) {
  if (input.from && input.to && input.from > input.to) {
    throw new Error("INVALID_PERIOD");
  }
}
export function transactionStream(
  repository: PlanningRepository,
  snapshot: PlanningSnapshot,
  state = snapshot.state,
) {
  const accountMap = new Map(
    accounts(snapshot, state).map((row) => [row.id, row]),
  );
  const edits = new Map(state.edits.map((row) => [row.id, row]));
  const details = new Map(
    snapshot.transactionDetails.map((row) => [row.id, row]),
  );
  function effective(row: TransactionProjection): PlanningTransaction | null {
    const edit = edits.get(row.id);
    if (edit?.deleted) {
      return null;
    }
    const account = accountMap.get(edit?.accountId ?? row.accountId);
    return {
      ...row,
      ...edit,
      category: edit?.category === undefined ? row.category : edit.category,
      goalId: edit?.goalId ?? null,
      ignored: edit?.ignored ?? false,
      manual: edit?.manual ?? false,
      spaceId: edit?.spaceId ?? account?.spaceId ?? "personal",
      tagIds: edit?.tagIds ?? [],
    };
  }
  function matches(row: PlanningTransaction, selection: Selection) {
    return (
      row.spaceId === selection.spaceId &&
      (!selection.from || row.date >= selection.from) &&
      (!selection.to || row.date <= selection.to) &&
      (!selection.accountId || row.accountId === selection.accountId) &&
      (!selection.categoryId || row.category === selection.categoryId) &&
      (!selection.tagId || row.tagIds.includes(selection.tagId)) &&
      (!selection.direction || row.direction === selection.direction) &&
      (!selection.status || row.status === selection.status) &&
      (!selection.text ||
        row.description
          .toLocaleLowerCase()
          .includes(selection.text.toLocaleLowerCase())) &&
      (selection.include_ignored || !row.ignored) &&
      (!selection.cardNumber ||
        details.get(row.id)?.cardNumber === selection.cardNumber)
    );
  }
  function manualProjection(edit: import("../../domain").TransactionEdit) {
    const account = found(accountMap.get(edit.accountId ?? ""));
    return effective({
      accountId: account.id,
      amountMinor: edit.amountMinor ?? null,
      category: edit.category ?? null,
      currency: account.currency,
      date: edit.date ?? "",
      description: edit.description ?? "",
      direction: edit.direction ?? "DEBIT",
      id: edit.id,
      status: edit.status ?? "POSTED",
    });
  }
  return async function* (selection: Selection, ids?: string[]) {
    validatePeriod(selection);
    for await (const page of repository.transactions(ids)) {
      for (const row of page) {
        const value = effective(row);
        if (value && matches(value, selection)) {
          yield value;
        }
      }
    }
    for (const edit of state.edits.filter(
      (row) => row.manual && !row.deleted && (!ids || ids.includes(row.id)),
    )) {
      const row = manualProjection(edit);
      if (row && matches(row, selection)) {
        yield row;
      }
    }
  };
}
export async function selectedTransactions(
  stream: ReturnType<typeof transactionStream>,
  selection: Selection,
  ids?: string[],
) {
  const rows: PlanningTransaction[] = [];
  for await (const row of stream(
    { ...selection, include_ignored: true },
    ids,
  )) {
    rows.push(row);
    if (rows.length > 500) {
      throw new Error("SELECTION_TOO_LARGE");
    }
  }
  if (ids && (new Set(ids).size !== ids.length || rows.length !== ids.length)) {
    throw new Error("NOT_FOUND");
  }
  return rows;
}
export function classification(
  row: PlanningTransaction,
  state: PlanningState,
  operationType: string | null,
) {
  const category = state.categories.find(
    (item) => item.id === row.category && item.spaceId === row.spaceId,
  );
  if (category) {
    return category.kind;
  }
  if (
    operationType &&
    [
      "PIX",
      "TED",
      "DOC",
      "TRANSFERENCIA_MESMA_INSTITUICAO",
      "PAGAMENTO",
      "PAGAMENTO_FATURA",
      "RESGATE_APLIC_FINANCEIRA",
      "OPERACAO_CREDITO",
    ].includes(operationType)
  ) {
    return "unclassified";
  }
  // Provider category names are not a stable classification contract.
  return "unclassified";
}
