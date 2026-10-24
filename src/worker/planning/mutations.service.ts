import type { PlanningCommand } from "../../contracts";
import type {
  AccountSettings,
  PlanningState,
  TransactionEdit,
} from "../../domain";
import {
  activeRules,
  localDay,
  monthDate,
  ruleMatches,
  sacSchedule,
} from "../../domain";
import { effectiveBills } from "./bills.service";
import type { PlanningRepository, PlanningSnapshot } from "./entity";
import {
  accounts,
  found,
  inSpace,
  selectedTransactions,
  transactionStream,
} from "./projection";
import { cardCatalog } from "./queries.service";

export async function planningMutation(
  command: PlanningCommand,
  context: {
    snapshot: PlanningSnapshot;
    state: PlanningState;
    repository: PlanningRepository;
    now: string;
  },
): Promise<unknown> {
  const { snapshot, state, repository, now } = context;
  if (
    "personId" in command &&
    command.personId &&
    !snapshot.people.some((p) => p.id === command.personId)
  ) {
    throw new Error("NOT_FOUND");
  }
  const space = found(state.spaces.find((s) => s.id === command.spaceId));
  const accountList = accounts(snapshot, state);
  const account = (id: string) => inSpace(accountList, id, command.spaceId);
  const category = (id: string | null) =>
    id === null ? null : inSpace(state.categories, id, command.spaceId);
  const uuid = () => `local:${crypto.randomUUID()}`;
  const stream = transactionStream(repository, snapshot, state);
  function settings(id: string): AccountSettings {
    const source = account(id);
    let row = state.accounts.find((a) => a.id === id);
    if (!row) {
      row = { hidden: false, id, manual: false, spaceId: source.spaceId };
      state.accounts.push(row);
    }
    return row;
  }
  function edit(id: string, accountId?: string): TransactionEdit {
    let row = state.edits.find((t) => t.id === id);
    if (!row) {
      row = { id, manual: false, ...(accountId && { accountId }) };
      state.edits.push(row);
    }
    return row;
  }
  function manualLoan(id: string) {
    const row = inSpace(state.loans, id, command.spaceId);
    if (!row.manual) {
      throw new Error("SOURCE_READ_ONLY");
    }
    return row;
  }
  function selected(
    ids?: string[],
    period?: { from: string; to: string; accountId?: string },
  ) {
    return selectedTransactions(
      stream,
      { spaceId: command.spaceId, ...period },
      ids,
    );
  }
  function handleCreateManualAccount(
    input: Extract<PlanningCommand, { tool: "create_manual_account" }>,
  ) {
    if (
      input.type !== "CREDIT" &&
      (input.closeDay || input.dueDay || input.creditLimitMinor)
    ) {
      throw new Error("CARD_REQUIRED");
    }
    const row: AccountSettings = {
      currency: input.currency,
      hidden: false,
      id: uuid(),
      manual: true,
      name: input.name,
      openingBalanceMinor: input.openingBalanceMinor,
      personId: input.personId ?? "self",
      spaceId: input.spaceId,
      type: input.type,
      ...(input.closeDay !== undefined && { closeDay: input.closeDay }),
      ...(input.dueDay !== undefined && { dueDay: input.dueDay }),
      ...(input.creditLimitMinor !== undefined && {
        creditLimitMinor: input.creditLimitMinor,
      }),
    };
    state.accounts.push(row);
    return row;
  }

  function assignManualOwner(row: AccountSettings, personId?: string) {
    if (!personId) {
      return;
    }
    if (!row.manual) {
      throw new Error("SOURCE_READ_ONLY");
    }
    row.personId = personId;
  }
  function handleUpdateAccountSettings(
    input: Extract<PlanningCommand, { tool: "update_account_settings" }>,
  ) {
    const row = settings(input.id);
    assignManualOwner(row, input.personId);
    if (
      input.creditLimitMinor !== undefined ||
      input.closeDay !== undefined ||
      input.dueDay !== undefined
    ) {
      if (!row.manual) {
        throw new Error("SOURCE_READ_ONLY");
      }
      if (row.type !== "CREDIT") {
        throw new Error("CARD_REQUIRED");
      }
    }
    if (input.name !== undefined) {
      row.name = input.name;
    }
    if (input.hidden !== undefined) {
      row.hidden = input.hidden;
    }
    if (input.creditLimitMinor !== undefined) {
      row.creditLimitMinor = input.creditLimitMinor;
    }
    if (input.closeDay !== undefined) {
      row.closeDay = input.closeDay;
    }
    if (input.dueDay !== undefined) {
      row.dueDay = input.dueDay;
    }
    return row;
  }

  function handleDeleteManualAccount(
    input: Extract<PlanningCommand, { tool: "delete_manual_account" }>,
  ) {
    const row = settings(input.id);
    if (!row.manual) {
      throw new Error("SOURCE_READ_ONLY");
    }
    if (
      state.edits.some((t) => t.accountId === row.id && !t.deleted) ||
      state.recurrences.some((r) => r.accountId === row.id) ||
      state.installments.some((p) => p.accountId === row.id) ||
      state.goals.some((g) => g.accountId === row.id)
    ) {
      throw new Error("RESOURCE_IN_USE");
    }
    state.accounts = state.accounts.filter((a) => a.id !== row.id);
    return { deleted: true, id: row.id };
  }

  function handleUpdateCard(
    input: Extract<
      PlanningCommand,
      { tool: "update_card" | "delete_card" | "set_primary_card" }
    >,
  ) {
    const card = inSpace(cardCatalog(snapshot, state), input.id, input.spaceId);
    if (input.tool === "delete_card" && card.primary) {
      throw new Error("PRIMARY_CARD_REQUIRED");
    }
    if (input.tool === "set_primary_card") {
      settings(card.accountId).primaryCard = card.number;
      return { id: card.id, primary: true };
    }
    let row = state.cards.find((c) => c.id === card.id);
    if (!row) {
      row = {
        accountId: card.accountId,
        deleted: false,
        hidden: false,
        id: card.id,
        name: card.name,
        number: card.number,
      };
      state.cards.push(row);
    }
    if (input.tool === "delete_card") {
      row.deleted = true;
    } else {
      if (input.hidden !== undefined) {
        row.hidden = input.hidden;
      }
      if (input.name !== undefined) {
        row.name = input.name;
      }
    }
    return row;
  }

  async function handleMarkBillPaid(
    input: Extract<
      PlanningCommand,
      { tool: "mark_bill_paid" | "unmark_bill_paid" }
    >,
  ) {
    const bill = found(
      (
        await effectiveBills({
          referenceDay: localDay(new Date(now)),
          repository,
          snapshot,
          state,
        })
      ).find((b) => b.id === input.id),
    );
    account(bill.accountId);
    const row = {
      id: bill.id,
      paid: input.tool === "mark_bill_paid",
      updatedAt: now,
    };
    state.billPayments = state.billPayments.filter((p) => p.id !== bill.id);
    state.billPayments.push(row);
    return {
      accountId: bill.accountId,
      bankConfirmationPending: row.paid,
      id: bill.id,
      manuallyPaid: row.paid,
    };
  }

  function handleCreateTransaction(
    input: Extract<PlanningCommand, { tool: "create_transaction" }>,
  ) {
    const target = account(input.accountId);
    if (!target.manual) {
      throw new Error("MANUAL_ACCOUNT_REQUIRED");
    }
    category(input.category);
    if (input.recurrenceId) {
      const recurrence = inSpace(
        state.recurrences,
        input.recurrenceId,
        input.spaceId,
      );
      if (
        recurrence.accountId !== target.id ||
        recurrence.currency !== target.currency
      ) {
        throw new Error("CURRENCY_MISMATCH");
      }
    }
    const row: TransactionEdit = {
      ...(input.recurrenceId && { recurrenceId: input.recurrenceId }),
      accountId: target.id,
      amountMinor: input.amountMinor,
      category: input.category,
      currency: target.currency,
      date: input.date,
      description: input.description,
      direction: input.direction,
      id: uuid(),
      manual: true,
      spaceId: input.spaceId,
      status: input.status,
    };
    state.edits.push(row);
    return row;
  }

  function applyFields(
    patch: TransactionEdit,
    input: Extract<
      PlanningCommand,
      {
        tool:
          | "edit_transaction"
          | "batch_edit_transactions"
          | "edit_transactions_by_period";
      }
    >,
  ) {
    if (input.description !== undefined) {
      patch.description = input.description;
    }
    if (input.amountMinor !== undefined) {
      patch.amountMinor = input.amountMinor;
    }
    if (input.date !== undefined) {
      patch.date = input.date;
    }
    if (input.category !== undefined) {
      patch.category = input.category;
    }
    if (input.ignored !== undefined) {
      patch.ignored = input.ignored;
    }
    if (input.direction !== undefined) {
      patch.direction = input.direction;
    }
    if (input.status !== undefined) {
      patch.status = input.status;
    }
  }
  function financialChange(input: PlanningCommand) {
    return (
      [
        "delete_transaction",
        "batch_delete_transactions",
        "delete_transactions_by_period",
        "move_transactions",
      ].includes(input.tool) ||
      ("amountMinor" in input && input.amountMinor !== undefined) ||
      ("date" in input && input.date !== undefined) ||
      ("direction" in input && input.direction !== undefined) ||
      ("status" in input && input.status !== undefined)
    );
  }
  async function handleEditTransaction(
    input: Extract<
      PlanningCommand,
      {
        tool:
          | "edit_transaction"
          | "batch_edit_transactions"
          | "edit_transactions_by_period"
          | "delete_transaction"
          | "batch_delete_transactions"
          | "delete_transactions_by_period"
          | "attach_transaction_tags"
          | "remove_transaction_tags"
          | "move_transactions"
          | "apply_rules";
      }
    >,
  ) {
    let ids: string[] | undefined;
    if ("ids" in input) {
      ({ ids } = input);
    } else if ("id" in input) {
      ids = [input.id];
    }
    const period =
      "from" in input
        ? {
            from: input.from,
            to: input.to,
            ...(input.accountId && { accountId: input.accountId }),
          }
        : undefined;
    const rows = await selected(ids, period);
    const critical = financialChange(input);
    if (
      critical &&
      rows.some(
        (row) =>
          state.schedules.some((p) => p.transactionId === row.id) ||
          state.contributions.some((c) => c.transactionId === row.id),
      )
    ) {
      throw new Error("RESOURCE_IN_USE");
    }
    if ("category" in input && input.category !== undefined) {
      category(input.category);
    }
    if ("tagIds" in input) {
      for (const id of input.tagIds) {
        inSpace(state.tags, id, input.spaceId);
      }
    }
    if ("targetSpaceId" in input) {
      found(state.spaces.find((s) => s.id === input.targetSpaceId));
    }
    const rules = activeRules(
      state.rules.filter((r) => r.spaceId === input.spaceId),
    );
    function changeRow(row: import("../../domain").PlanningTransaction) {
      const patch = edit(row.id, row.accountId);
      switch (input.tool) {
        case "delete_transaction":
        case "batch_delete_transactions":
        case "delete_transactions_by_period":
          patch.deleted = true;
          break;
        case "attach_transaction_tags":
          patch.tagIds = [...new Set([...row.tagIds, ...input.tagIds])];
          break;
        case "remove_transaction_tags":
          patch.tagIds = row.tagIds.filter((t) => !input.tagIds.includes(t));
          break;
        case "move_transactions":
          patch.spaceId = input.targetSpaceId;
          patch.category = null;
          patch.tagIds = [];
          patch.goalId = null;
          state.contributions = state.contributions.filter(
            (c) => c.transactionId !== row.id,
          );
          break;
        case "apply_rules": {
          const rule = rules.find((r) => ruleMatches(row, r));
          if (rule) {
            patch.category = rule.categoryId;
          }
          break;
        }
        default:
          applyFields(patch, input);
      }
    }
    rows.forEach(changeRow);
    return { count: rows.length, ids: rows.map((r) => r.id) };
  }

  function handleCreateManualInstallment(
    input: Extract<PlanningCommand, { tool: "create_manual_installment" }>,
  ) {
    const target = account(input.accountId);
    const config = settings(target.id);
    if (!target.manual || target.type !== "CREDIT") {
      throw new Error("MANUAL_CARD_REQUIRED");
    }
    if (!(config.closeDay && config.dueDay)) {
      throw new Error("BILLING_CYCLE_REQUIRED");
    }
    if (input.current > input.total) {
      throw new Error("INVALID_INSTALLMENT");
    }
    category(input.categoryId);
    const id = uuid();
    const row = {
      accountId: target.id,
      amountMinor: input.amountMinor,
      categoryId: input.categoryId,
      completed: false,
      currency: target.currency,
      current: input.current,
      id,
      manual: true,
      name: input.name,
      spaceId: input.spaceId,
      startDate: input.startDate,
      total: input.total,
      transactionIds: [],
    };
    state.installments.push(row);
    state.recurrences.push({
      accountId: target.id,
      active: true,
      amountMinor: row.amountMinor,
      categoryId: row.categoryId,
      currency: target.currency,
      direction: "DEBIT",
      endDate: monthDate(row.startDate, row.total - row.current),
      id: uuid(),
      installmentId: id,
      name: row.name,
      spaceId: input.spaceId,
      startDate: row.startDate,
    });
    return row;
  }

  function handleUpdateInstallment(
    input: Extract<
      PlanningCommand,
      {
        tool:
          | "update_installment"
          | "complete_installment"
          | "reopen_installment";
      }
    >,
  ) {
    const row = inSpace(state.installments, input.id, input.spaceId);
    if (input.tool === "update_installment") {
      if (input.name !== undefined) {
        row.name = input.name;
        for (const id of row.transactionIds) {
          edit(id, row.accountId).description = input.name;
        }
      }
      if (input.categoryId !== undefined) {
        category(input.categoryId);
        row.categoryId = input.categoryId;
        for (const id of row.transactionIds) {
          edit(id, row.accountId).category = input.categoryId;
        }
      }
    } else {
      row.completed = input.tool === "complete_installment";
    }
    for (const recurrence of state.recurrences.filter(
      (r) => r.installmentId === row.id,
    )) {
      recurrence.name = row.name;
      recurrence.categoryId = row.categoryId;
      recurrence.active = !row.completed;
    }
    return row;
  }

  function handleCreateRecurrence(
    input: Extract<
      PlanningCommand,
      { tool: "create_recurrence" | "update_recurrence" }
    >,
  ) {
    const target = account(input.accountId);
    if (target.currency !== input.currency) {
      throw new Error("CURRENCY_MISMATCH");
    }
    category(input.categoryId);
    if (input.endDate && input.endDate < input.startDate) {
      throw new Error("INVALID_PERIOD");
    }
    const id =
      input.tool === "update_recurrence"
        ? inSpace(state.recurrences, input.id, input.spaceId).id
        : uuid();
    const row = {
      accountId: input.accountId,
      active: input.active,
      amountMinor: input.amountMinor,
      categoryId: input.categoryId,
      currency: input.currency,
      direction: input.direction,
      endDate: input.endDate,
      id,
      installmentId: null,
      name: input.name,
      spaceId: input.spaceId,
      startDate: input.startDate,
    };
    state.recurrences = state.recurrences.filter((r) => r.id !== id);
    state.recurrences.push(row);
    return row;
  }

  function handleDeactivateRecurrence(
    input: Extract<PlanningCommand, { tool: "deactivate_recurrence" }>,
  ) {
    const row = inSpace(state.recurrences, input.id, input.spaceId);
    row.active = false;
    return row;
  }

  function handleSetBudget(
    input: Extract<PlanningCommand, { tool: "set_budget" }>,
  ) {
    space.budgetEnabled = input.enabled;
    space.monthlyBudgetMinor = input.monthlyBudgetMinor;
    space.currency = input.currency;
    return space;
  }

  function handleSetCategoryLimit(
    input: Extract<
      PlanningCommand,
      { tool: "set_category_limit" | "remove_category_limit" }
    >,
  ) {
    if (!space.budgetEnabled) {
      throw new Error("BUDGET_DISABLED");
    }
    const row = inSpace(state.categories, input.id, input.spaceId);
    row.limitMinor =
      input.tool === "set_category_limit" ? input.amountMinor : null;
    return row;
  }

  function handleCreateCategory(
    input: Extract<PlanningCommand, { tool: "create_category" }>,
  ) {
    const row = {
      hidden: false,
      id: uuid(),
      kind: input.kind,
      limitMinor: null,
      name: input.name,
      spaceId: input.spaceId,
      system: false,
    };
    state.categories.push(row);
    return row;
  }

  function handleUpdateCategory(
    input: Extract<PlanningCommand, { tool: "update_category" }>,
  ) {
    const row = inSpace(state.categories, input.id, input.spaceId);
    if (row.system) {
      throw new Error("SYSTEM_CATEGORY");
    }
    if (input.hidden !== undefined) {
      row.hidden = input.hidden;
    }
    if (input.name !== undefined) {
      row.name = input.name;
    }
    return row;
  }

  function handleDeleteCategory(
    input: Extract<PlanningCommand, { tool: "delete_category" }>,
  ) {
    const row = inSpace(state.categories, input.id, input.spaceId);
    if (row.system) {
      throw new Error("SYSTEM_CATEGORY");
    }
    const fallback = found(
      state.categories.find(
        (c) => c.spaceId === input.spaceId && c.system && c.kind === row.kind,
      ),
    );
    for (const item of state.edits.filter(
      (value) => value.category === row.id,
    )) {
      item.category = fallback.id;
    }
    for (const item of state.rules.filter(
      (value) => value.categoryId === row.id,
    )) {
      item.categoryId = fallback.id;
    }
    for (const item of state.recurrences.filter(
      (value) => value.categoryId === row.id,
    )) {
      item.categoryId = fallback.id;
    }
    for (const item of state.installments.filter(
      (value) => value.categoryId === row.id,
    )) {
      item.categoryId = fallback.id;
    }
    state.categories = state.categories.filter((c) => c.id !== row.id);
    return { fallbackId: fallback.id, id: row.id };
  }

  function handleCreateRule(
    input: Extract<PlanningCommand, { tool: "create_rule" | "update_rule" }>,
  ) {
    if (!(input.text || input.filter)) {
      throw new Error("INVALID_RULE");
    }
    category(input.categoryId);
    for (const condition of input.filter?.alternatives.flatMap(
      (a) => a.conditions,
    ) ?? []) {
      if (condition.field === "accountId") {
        account(condition.value);
      }
      if (
        condition.field === "personId" &&
        !snapshot.people.some((p) => p.id === condition.value)
      ) {
        throw new Error("NOT_FOUND");
      }
    }
    if (input.accountId) {
      account(input.accountId);
    }
    const id =
      input.tool === "update_rule"
        ? inSpace(state.rules, input.id, input.spaceId).id
        : uuid();
    const row = {
      accountId: input.accountId,
      categoryId: input.categoryId,
      direction: input.direction,
      enabled: input.enabled,
      filter: input.filter,
      id,
      name: input.name,
      priority: input.priority,
      spaceId: input.spaceId,
      text: input.text,
    };
    state.rules = state.rules.filter((r) => r.id !== id);
    state.rules.push(row);
    return row;
  }

  function handleDeleteRule(
    input: Extract<PlanningCommand, { tool: "delete_rule" }>,
  ) {
    inSpace(state.rules, input.id, input.spaceId);
    state.rules = state.rules.filter((r) => r.id !== input.id);
    return { deleted: true, id: input.id };
  }

  function handleCreateGoal(
    input: Extract<PlanningCommand, { tool: "create_goal" | "update_goal" }>,
  ) {
    const prior =
      input.tool === "update_goal"
        ? inSpace(state.goals, input.id, input.spaceId)
        : undefined;
    if (
      prior &&
      prior.currency !== input.currency &&
      (state.contributions.some((c) => c.goalId === prior.id) ||
        prior.accountId ||
        prior.investmentId)
    ) {
      throw new Error("CURRENCY_MISMATCH");
    }
    const row = {
      accountId: prior?.accountId ?? null,
      completed: prior?.completed ?? false,
      currency: input.currency,
      id: prior?.id ?? uuid(),
      investmentId: prior?.investmentId ?? null,
      name: input.name,
      personId:
        input.personId ??
        ("id" in input
          ? state.goals.find((r) => r.id === input.id)?.personId
          : undefined) ??
        "self",
      spaceId: input.spaceId,
      targetDate: input.targetDate,
      targetMinor: input.targetMinor,
    };
    state.goals = state.goals.filter((g) => g.id !== row.id);
    state.goals.push(row);
    return row;
  }

  async function handleAddGoalContribution(
    input: Extract<PlanningCommand, { tool: "add_goal_contribution" }>,
  ) {
    const goal = inSpace(state.goals, input.id, input.spaceId);
    if (input.transactionId) {
      const row = found((await selected([input.transactionId]))[0]);
      if (row.currency !== goal.currency) {
        throw new Error("CURRENCY_MISMATCH");
      }
      if (
        row.amountMinor === null ||
        BigInt(row.amountMinor.replace("-", "")) !== BigInt(input.amountMinor)
      ) {
        throw new Error("AMOUNT_MISMATCH");
      }
      if (state.contributions.some((c) => c.transactionId === row.id)) {
        throw new Error("RESOURCE_IN_USE");
      }
      edit(row.id, row.accountId).goalId = goal.id;
    }
    const row = {
      amountMinor: input.amountMinor,
      date: input.date,
      goalId: goal.id,
      id: uuid(),
      transactionId: input.transactionId ?? null,
    };
    state.contributions.push(row);
    return row;
  }

  function handleRemoveGoalContribution(
    input: Extract<
      PlanningCommand,
      { tool: "remove_goal_contribution" | "unlink_goal_transaction" }
    >,
  ) {
    inSpace(state.goals, input.id, input.spaceId);
    const contribution = found(
      state.contributions.find(
        (c) =>
          c.goalId === input.id &&
          (input.tool === "remove_goal_contribution"
            ? c.id === input.contributionId
            : c.transactionId === input.transactionId),
      ),
    );
    if (contribution.transactionId) {
      edit(contribution.transactionId).goalId = null;
    }
    state.contributions = state.contributions.filter(
      (c) => c.id !== contribution.id,
    );
    return { deleted: true, id: contribution.id };
  }

  function handleCompleteGoal(
    input: Extract<PlanningCommand, { tool: "complete_goal" }>,
  ) {
    const row = inSpace(state.goals, input.id, input.spaceId);
    row.completed = true;
    return row;
  }

  function handleLinkGoalAsset(
    input: Extract<PlanningCommand, { tool: "link_goal_asset" }>,
  ) {
    const goal = inSpace(state.goals, input.id, input.spaceId);
    if (!!input.accountId === !!input.investmentId) {
      throw new Error("ONE_ASSET_REQUIRED");
    }
    const asset = input.accountId
      ? account(input.accountId)
      : inSpace(state.investments, input.investmentId ?? "", input.spaceId);
    if (asset.currency !== goal.currency) {
      throw new Error("CURRENCY_MISMATCH");
    }
    if (
      state.goals.some(
        (g) =>
          g.id !== goal.id &&
          ((input.accountId && g.accountId === input.accountId) ||
            (input.investmentId && g.investmentId === input.investmentId)),
      )
    ) {
      throw new Error("RESOURCE_IN_USE");
    }
    goal.accountId = input.accountId ?? null;
    goal.investmentId = input.investmentId ?? null;
    return goal;
  }

  function handleUnlinkGoalAsset(
    input: Extract<PlanningCommand, { tool: "unlink_goal_asset" }>,
  ) {
    const goal = inSpace(state.goals, input.id, input.spaceId);
    goal.accountId = null;
    goal.investmentId = null;
    return goal;
  }

  function handleDeleteGoal(
    input: Extract<PlanningCommand, { tool: "delete_goal" }>,
  ) {
    inSpace(state.goals, input.id, input.spaceId);
    for (const row of state.edits) {
      if (row.goalId === input.id) {
        row.goalId = null;
      }
    }
    state.contributions = state.contributions.filter(
      (c) => c.goalId !== input.id,
    );
    state.goals = state.goals.filter((g) => g.id !== input.id);
    return { deleted: true, id: input.id };
  }

  function handleCreateManualInvestment(
    input: Extract<
      PlanningCommand,
      { tool: "create_manual_investment" | "update_manual_investment" }
    >,
  ) {
    const prior =
      input.tool === "update_manual_investment"
        ? inSpace(state.investments, input.id, input.spaceId)
        : undefined;
    if (prior && !prior.manual) {
      throw new Error("SOURCE_READ_ONLY");
    }
    if (
      prior &&
      prior.currency !== input.currency &&
      state.goals.some((g) => g.investmentId === prior.id)
    ) {
      throw new Error("CURRENCY_MISMATCH");
    }
    const row = {
      amountMinor: input.amountMinor,
      connectionId: null,
      currency: input.currency,
      date: input.date,
      id: prior?.id ?? uuid(),
      included: input.included,
      manual: true,
      name: input.name,
      personId:
        input.personId ??
        ("id" in input
          ? state.investments.find((r) => r.id === input.id)?.personId
          : undefined) ??
        "self",
      spaceId: input.spaceId,
      type: input.type,
    };
    state.investments = state.investments.filter((i) => i.id !== row.id);
    state.investments.push(row);
    return row;
  }

  function handleSetInvestmentInclusion(
    input: Extract<PlanningCommand, { tool: "set_investment_inclusion" }>,
  ) {
    const row = inSpace(state.investments, input.id, input.spaceId);
    row.included = input.included;
    return row;
  }

  function handleDeleteManualInvestment(
    input: Extract<PlanningCommand, { tool: "delete_manual_investment" }>,
  ) {
    const row = inSpace(state.investments, input.id, input.spaceId);
    if (!row.manual) {
      throw new Error("SOURCE_READ_ONLY");
    }
    for (const goal of state.goals) {
      if (goal.investmentId === row.id) {
        goal.investmentId = null;
      }
    }
    state.investments = state.investments.filter((i) => i.id !== row.id);
    return { deleted: true, id: row.id };
  }

  function handleCreateManualLoan(
    input: Extract<
      PlanningCommand,
      { tool: "create_manual_loan" | "update_manual_loan" }
    >,
  ) {
    if (input.paid > input.total) {
      throw new Error("INVALID_INSTALLMENT");
    }
    const prior =
      input.tool === "update_manual_loan" ? manualLoan(input.id) : undefined;
    if (prior && state.schedules.some((p) => p.loanId === prior.id)) {
      throw new Error("SCHEDULE_EXISTS");
    }
    const row = {
      amountMinor: input.amountMinor,
      connectionId: null,
      currency: input.currency,
      firstPaymentDate: input.firstPaymentDate,
      hidden: false,
      id: prior?.id ?? uuid(),
      installmentMinor: input.installmentMinor,
      manual: true,
      name: input.name,
      paid: input.paid,
      personId:
        input.personId ??
        ("id" in input
          ? state.loans.find((r) => r.id === input.id)?.personId
          : undefined) ??
        "self",
      spaceId: input.spaceId,
      total: input.total,
    };
    state.loans = state.loans.filter((l) => l.id !== row.id);
    state.loans.push(row);
    return row;
  }

  function handleSetLoanVisibility(
    input: Extract<PlanningCommand, { tool: "set_loan_visibility" }>,
  ) {
    const row = inSpace(state.loans, input.id, input.spaceId);
    row.hidden = input.hidden;
    return row;
  }

  function handleDeleteManualLoan(
    input: Extract<PlanningCommand, { tool: "delete_manual_loan" }>,
  ) {
    const row = manualLoan(input.id);
    if (state.schedules.some((p) => p.loanId === row.id && !p.transactionId)) {
      throw new Error("PENDING_PAYMENTS");
    }
    state.schedules = state.schedules.filter((p) => p.loanId !== row.id);
    state.loans = state.loans.filter((l) => l.id !== row.id);
    return { deleted: true, id: row.id };
  }

  function handleCreateManualLoanSchedule(
    input: Extract<
      PlanningCommand,
      { tool: "create_manual_loan_schedule" | "replace_manual_loan_schedule" }
    >,
  ) {
    const loan = manualLoan(input.id);
    const prior = state.schedules.filter((p) => p.loanId === loan.id);
    if (
      prior.some((p) => p.transactionId) ||
      (input.tool === "create_manual_loan_schedule" && prior.length)
    ) {
      throw new Error("SCHEDULE_EXISTS");
    }
    const rows = sacSchedule({
      count: input.count,
      loanId: loan.id,
      monthlyRateBps: input.monthlyRateBps,
      principalMinor: input.principalMinor,
      startDate: input.startDate,
    });
    state.schedules = state.schedules.filter((p) => p.loanId !== loan.id);
    state.schedules.push(...rows);
    loan.total = input.count;
    loan.paid = 0;
    loan.amountMinor = input.principalMinor;
    loan.firstPaymentDate = input.startDate;
    return { records: rows };
  }

  async function handleReconcileScheduledPayment(
    input: Extract<PlanningCommand, { tool: "reconcile_scheduled_payment" }>,
  ) {
    const loan = manualLoan(input.id);
    const payment = found(
      state.schedules.find(
        (p) => p.id === input.paymentId && p.loanId === loan.id,
      ),
    );
    if (payment.transactionId) {
      throw new Error("ALREADY_RECONCILED");
    }
    if (
      state.schedules.some(
        (p) =>
          p.loanId === loan.id && p.number < payment.number && !p.transactionId,
      )
    ) {
      throw new Error("PAYMENT_ORDER");
    }
    const target = account(input.accountId);
    if (target.type !== "BANK" || target.currency !== loan.currency) {
      throw new Error("CURRENCY_MISMATCH");
    }
    if (input.transactionId) {
      const row = found((await selected([input.transactionId]))[0]);
      if (
        row.accountId !== target.id ||
        row.direction !== "DEBIT" ||
        row.status !== "POSTED" ||
        row.currency !== loan.currency ||
        row.amountMinor === null ||
        BigInt(row.amountMinor.replace("-", "")) !== BigInt(payment.amountMinor)
      ) {
        throw new Error("PAYMENT_MISMATCH");
      }
      if (state.schedules.some((p) => p.transactionId === row.id)) {
        throw new Error("RESOURCE_IN_USE");
      }
      payment.transactionId = row.id;
      payment.createdTransaction = false;
    } else {
      if (!target.manual) {
        throw new Error("MANUAL_ACCOUNT_REQUIRED");
      }
      const id = uuid();
      state.edits.push({
        accountId: target.id,
        amountMinor: payment.amountMinor,
        currency: loan.currency,
        date: localDay(new Date(now)),
        description: loan.name,
        direction: "DEBIT",
        id,
        manual: true,
        spaceId: input.spaceId,
        status: "POSTED",
      });
      payment.transactionId = id;
      payment.createdTransaction = true;
    }
    loan.paid = state.schedules.filter(
      (p) => p.loanId === loan.id && p.transactionId,
    ).length;
    return payment;
  }

  function handleUndoScheduledPayment(
    input: Extract<PlanningCommand, { tool: "undo_scheduled_payment" }>,
  ) {
    const loan = manualLoan(input.id);
    const payment = found(
      state.schedules.find(
        (p) => p.id === input.paymentId && p.loanId === loan.id,
      ),
    );
    if (!payment.transactionId) {
      throw new Error("NOT_RECONCILED");
    }
    if (
      state.schedules.some(
        (p) =>
          p.loanId === loan.id && p.number > payment.number && p.transactionId,
      )
    ) {
      throw new Error("PAYMENT_ORDER");
    }
    const preservedTransactionId = payment.transactionId;
    payment.transactionId = null;
    payment.createdTransaction = false;
    loan.paid = state.schedules.filter(
      (p) => p.loanId === loan.id && p.transactionId,
    ).length;
    return { ...payment, preservedTransactionId };
  }

  function handleCreateTag(
    input: Extract<PlanningCommand, { tool: "create_tag" }>,
  ) {
    const row = {
      color: input.color,
      id: uuid(),
      name: input.name,
      spaceId: input.spaceId,
    };
    state.tags.push(row);
    return row;
  }

  function handleUpdateTag(
    input: Extract<PlanningCommand, { tool: "update_tag" }>,
  ) {
    const row = inSpace(state.tags, input.id, input.spaceId);
    if (input.color !== undefined) {
      row.color = input.color;
    }
    if (input.name !== undefined) {
      row.name = input.name;
    }
    return row;
  }

  function handleDeleteTag(
    input: Extract<PlanningCommand, { tool: "delete_tag" }>,
  ) {
    inSpace(state.tags, input.id, input.spaceId);
    for (const row of state.edits) {
      if (row.tagIds) {
        row.tagIds = row.tagIds.filter((t) => t !== input.id);
      }
    }
    state.tags = state.tags.filter((t) => t.id !== input.id);
    return { deleted: true, id: input.id };
  }

  function handleCreateSpace(
    input: Extract<PlanningCommand, { tool: "create_space" }>,
  ) {
    const id = uuid();
    const row = {
      budgetEnabled: false,
      color: input.color,
      currency: input.currency,
      icon: input.icon,
      id,
      monthlyBudgetMinor: null,
      monthStartDay: input.monthStartDay,
      name: input.name,
      type: input.type,
    };
    state.spaces.push(row);
    for (const kind of ["income", "expense", "transfer"] as const) {
      state.categories.push({
        hidden: false,
        id: `${id}:${kind}`,
        kind,
        limitMinor: null,
        name: kind,
        spaceId: id,
        system: true,
      });
    }
    return row;
  }

  function handleUpdateSpace(
    input: Extract<PlanningCommand, { tool: "update_space" }>,
  ) {
    const row = found(
      state.spaces.find((s) => s.id === input.id && s.id === input.spaceId),
    );
    if (input.name !== undefined) {
      row.name = input.name;
    }
    if (input.icon !== undefined) {
      row.icon = input.icon;
    }
    if (input.color !== undefined) {
      row.color = input.color;
    }
    if (input.type !== undefined) {
      row.type = input.type;
    }
    if (input.monthStartDay !== undefined) {
      row.monthStartDay = input.monthStartDay;
    }
    return row;
  }

  function handleDeleteSpace(
    input: Extract<PlanningCommand, { tool: "delete_space" }>,
  ) {
    if (input.id !== input.spaceId) {
      throw new Error("SPACE_MISMATCH");
    }
    if (input.id === "personal") {
      throw new Error("SPACE_PROTECTED");
    }
    const linked = [
      state.accounts,
      state.edits,
      state.rules,
      state.tags,
      state.goals,
      state.investments,
      state.loans,
      state.recurrences,
      state.installments,
      state.notifications,
    ].some((rows) => rows.some((row) => row.spaceId === input.id));
    if (
      linked ||
      accountList.some((row) => row.spaceId === input.id) ||
      state.categories.some((row) => row.spaceId === input.id && !row.system)
    ) {
      throw new Error("SPACE_NOT_EMPTY");
    }
    state.spaces = state.spaces.filter((row) => row.id !== input.id);
    state.categories = state.categories.filter(
      (row) => row.spaceId !== input.id,
    );
    return { deleted: true, id: input.id };
  }

  function moveTarget(
    target: import("../../domain").PlanningAccount,
    targetSpaceId: string,
  ) {
    settings(target.id).spaceId = targetSpaceId;
    for (const row of state.edits.filter((t) => t.accountId === target.id)) {
      row.spaceId = targetSpaceId;
      row.category = null;
      row.tagIds = [];
      row.goalId = null;
      state.contributions = state.contributions.filter(
        (c) => c.transactionId !== row.id,
      );
    }
    for (const recurrence of state.recurrences.filter(
      (r) => r.accountId === target.id,
    )) {
      recurrence.spaceId = targetSpaceId;
      recurrence.categoryId = null;
    }
    for (const plan of state.installments.filter(
      (p) => p.accountId === target.id,
    )) {
      plan.spaceId = targetSpaceId;
      plan.categoryId = null;
    }
    for (const goal of state.goals.filter((g) => g.accountId === target.id)) {
      goal.accountId = null;
    }
  }
  function handleMoveAccount(
    input: Extract<
      PlanningCommand,
      { tool: "move_account" | "move_connection" }
    >,
  ) {
    found(state.spaces.find((s) => s.id === input.targetSpaceId));
    const targets =
      input.tool === "move_account"
        ? [account(input.id)]
        : accountList.filter(
            (a) =>
              a.connectionId === input.connectionId &&
              a.spaceId === input.spaceId,
          );
    if (!targets.length) {
      throw new Error("NOT_FOUND");
    }
    for (const target of targets) {
      moveTarget(target, input.targetSpaceId);
    }
    if (input.tool === "move_connection") {
      for (const asset of state.investments.filter(
        (i) => i.connectionId === input.connectionId,
      )) {
        asset.spaceId = input.targetSpaceId;
        for (const goal of state.goals.filter(
          (g) => g.investmentId === asset.id,
        )) {
          goal.investmentId = null;
        }
      }
      for (const loan of state.loans.filter(
        (l) => l.connectionId === input.connectionId,
      )) {
        loan.spaceId = input.targetSpaceId;
      }
    }
    return { ids: targets.map((t) => t.id), spaceId: input.targetSpaceId };
  }

  function handleSetNotificationPreference(
    input: Extract<PlanningCommand, { tool: "set_notification_preference" }>,
  ) {
    const id = `${input.spaceId}:${input.channel}:${input.event}`;
    const row = {
      channel: input.channel,
      enabled: input.enabled,
      event: input.event,
      id,
      spaceId: input.spaceId,
    };
    state.notifications = state.notifications.filter((p) => p.id !== id);
    state.notifications.push(row);
    return { ...row, deliveryConfigured: false };
  }
  switch (command.tool) {
    case "create_manual_account":
      return handleCreateManualAccount(command);
    case "update_account_settings":
      return handleUpdateAccountSettings(command);
    case "delete_manual_account":
      return handleDeleteManualAccount(command);
    case "update_card":
    case "delete_card":
    case "set_primary_card":
      return handleUpdateCard(command);
    case "mark_bill_paid":
    case "unmark_bill_paid":
      return await handleMarkBillPaid(command);
    case "create_transaction":
      return handleCreateTransaction(command);
    case "edit_transaction":
    case "batch_edit_transactions":
    case "edit_transactions_by_period":
    case "delete_transaction":
    case "batch_delete_transactions":
    case "delete_transactions_by_period":
    case "attach_transaction_tags":
    case "remove_transaction_tags":
    case "move_transactions":
    case "apply_rules":
      return await handleEditTransaction(command);
    case "create_manual_installment":
      return handleCreateManualInstallment(command);
    case "update_installment":
    case "complete_installment":
    case "reopen_installment":
      return handleUpdateInstallment(command);
    case "create_recurrence":
    case "update_recurrence":
      return handleCreateRecurrence(command);
    case "deactivate_recurrence":
      return handleDeactivateRecurrence(command);
    case "set_budget":
      return handleSetBudget(command);
    case "set_category_limit":
    case "remove_category_limit":
      return handleSetCategoryLimit(command);
    case "create_category":
      return handleCreateCategory(command);
    case "update_category":
      return handleUpdateCategory(command);
    case "delete_category":
      return handleDeleteCategory(command);
    case "create_rule":
    case "update_rule":
      return handleCreateRule(command);
    case "delete_rule":
      return handleDeleteRule(command);
    case "create_goal":
    case "update_goal":
      return handleCreateGoal(command);
    case "add_goal_contribution":
      return await handleAddGoalContribution(command);
    case "remove_goal_contribution":
    case "unlink_goal_transaction":
      return handleRemoveGoalContribution(command);
    case "complete_goal":
      return handleCompleteGoal(command);
    case "link_goal_asset":
      return handleLinkGoalAsset(command);
    case "unlink_goal_asset":
      return handleUnlinkGoalAsset(command);
    case "delete_goal":
      return handleDeleteGoal(command);
    case "create_manual_investment":
    case "update_manual_investment":
      return handleCreateManualInvestment(command);
    case "set_investment_inclusion":
      return handleSetInvestmentInclusion(command);
    case "delete_manual_investment":
      return handleDeleteManualInvestment(command);
    case "create_manual_loan":
    case "update_manual_loan":
      return handleCreateManualLoan(command);
    case "set_loan_visibility":
      return handleSetLoanVisibility(command);
    case "delete_manual_loan":
      return handleDeleteManualLoan(command);
    case "create_manual_loan_schedule":
    case "replace_manual_loan_schedule":
      return handleCreateManualLoanSchedule(command);
    case "reconcile_scheduled_payment":
      return await handleReconcileScheduledPayment(command);
    case "undo_scheduled_payment":
      return handleUndoScheduledPayment(command);
    case "create_tag":
      return handleCreateTag(command);
    case "update_tag":
      return handleUpdateTag(command);
    case "delete_tag":
      return handleDeleteTag(command);
    case "delete_space":
      return handleDeleteSpace(command);
    case "create_space":
      return handleCreateSpace(command);
    case "update_space":
      return handleUpdateSpace(command);
    case "move_account":
    case "move_connection":
      return handleMoveAccount(command);
    case "set_notification_preference":
      return handleSetNotificationPreference(command);
    default:
      throw new Error("UNKNOWN_TOOL");
  }
}
