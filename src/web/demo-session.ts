import type { z } from "zod/v4";

import type {
  PortalMutationSchema,
  PortalQuery,
  PortalQueryResults,
  WorkspaceCatalog,
} from "../contracts";
import {
  activeRules,
  categoryCatalog,
  investmentPortfolio,
  matchesFinancialIdentity,
  prepareRuleImport,
  ruleMatches,
  transactionMatchesText,
} from "../domain";
import { cardCommitmentsFixture } from "../fixtures/card-commitments";
import {
  type DemoRecord,
  demoAccounts,
  demoLedger,
  demoPeople,
  demoReferenceDay,
} from "../fixtures/finance";
import { demoInvestments } from "../fixtures/investments";
import { workspaceFixture } from "../fixtures/workspace";
import { tryCatch } from "../shared";
import type { OrganizationApi } from "./account/account-api";
import { demoCards } from "./demo-cards";
import { type DemoData, demoSummary, scopedDemoData } from "./demo-data";
import { demoTransactionDetail } from "./demo-transaction-detail";
import { randomId } from "./random-id";

function demoCommitments(
  query: Extract<PortalQuery, { tool: "get_card_commitments" }>,
  categories: WorkspaceCatalog["categories"],
  revision: number,
): PortalQueryResults["get_card_commitments"] {
  const fixture = cardCommitmentsFixture(
    { month: query.month ?? "2026-10" },
    query,
  );

  const data =
    query.spaceId === "personal" || !query.spaceId
      ? {
          ...fixture,
          categories: fixture.categories.map((row) => ({
            ...row,
            color:
              categories.find((category) => category.id === row.id)?.color ??
              row.color,
            name:
              categories.find((category) => category.id === row.id)?.name ??
              row.name,
          })),
        }
      : {
          ...fixture,
          accounts: [],
          categories: [],
          installments: [],
          months: [],
          totals: [],
        };
  return {
    coverage: {
      connectionIds: [],
      kind: "local_only",
      oldestLastSuccessAt: demoReferenceDay,
      partial: false,
    },
    data,
    oldestLastSuccessAt: demoReferenceDay,
    partial: false,
    revision,
    scope: {
      spaceId: query.spaceId ?? "personal",
      ...(query.personId && { personId: query.personId }),
    },
    view: "effective",
  };
}
type Group = Omit<WorkspaceCatalog, "spaces">;
type ParsedMutation = z.output<typeof PortalMutationSchema>["command"];
type RuleCommand = Extract<
  ParsedMutation,
  { tool: "create_rule" | "update_rule" }
>;
function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("NOT_FOUND");
  }
  return value;
}
function validateRule(command: RuleCommand, group: Group, data: DemoData) {
  if (!(command.text || command.filter)) {
    throw new Error("INVALID_RULE");
  }
  required(
    group.categories.find((category) => category.id === command.categoryId),
  );
  validateRuleReferences(command, data);
}
function validateRuleReferences(
  command: Pick<RuleCommand, "accountId" | "filter">,
  data: DemoData,
) {
  const accounts = new Set(data.accounts.map((account) => account.id));
  if (command.accountId && !accounts.has(command.accountId)) {
    throw new Error("NOT_FOUND");
  }
  for (const condition of command.filter?.alternatives.flatMap(
    (alternative) => alternative.conditions,
  ) ?? []) {
    if (condition.field === "accountId" && !accounts.has(condition.value)) {
      throw new Error("NOT_FOUND");
    }
    if (
      condition.field === "personId" &&
      !demoPeople.some((person) => person.id === condition.value)
    ) {
      throw new Error("NOT_FOUND");
    }
  }
}

function updateDemoCategory(
  group: Group,
  command: Extract<ParsedMutation, { tool: "update_category" }>,
) {
  const row = required(group.categories.find((item) => item.id === command.id));
  if (
    row.system &&
    (command.name !== undefined || command.hidden !== undefined)
  ) {
    throw new Error("SYSTEM_CATEGORY");
  }
  if (command.groupId) {
    required(group.categoryGroups.find((item) => item.id === command.groupId));
  }
  if (command.name !== undefined) {
    row.name = command.name;
  }
  if (command.hidden !== undefined) {
    row.hidden = command.hidden;
  }
  if (command.icon !== undefined) {
    row.icon = command.icon;
  }
  if (command.color !== undefined) {
    row.color = command.color;
  }
  if (command.groupId !== undefined) {
    row.groupId = command.groupId;
  }
}

function mutateCategoryCatalog(group: Group, command: ParsedMutation) {
  switch (command.tool) {
    case "create_category_group": {
      group.categoryGroups.push({
        color: command.color,
        icon: command.icon,
        id: `demo:${randomId()}`,
        name: command.name,
      });
      return true;
    }
    case "update_category_group": {
      const row = required(
        group.categoryGroups.find((item) => item.id === command.id),
      );
      if (command.name !== undefined) {
        row.name = command.name;
      }
      if (command.icon !== undefined) {
        row.icon = command.icon;
      }
      if (command.color !== undefined) {
        row.color = command.color;
      }
      return true;
    }
    case "delete_category_group": {
      required(group.categoryGroups.find((item) => item.id === command.id));
      for (const row of group.categories) {
        if (row.groupId === command.id) {
          row.groupId = null;
        }
      }
      group.categoryGroups = group.categoryGroups.filter(
        (item) => item.id !== command.id,
      );
      return true;
    }
    case "update_category": {
      updateDemoCategory(group, command);
      return true;
    }
    default:
      return false;
  }
}

function local<T>(
  signal: AbortSignal,
  operation: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve().then(() => {
    signal.throwIfAborted();
    return operation();
  });
}

// Each tab owns one synthetic session. No fetch, storage, Worker bindings or real credentials.
export function createDemoSession({
  catalog = workspaceFixture(),
  ledger = demoLedger,
}: {
  catalog?: WorkspaceCatalog;
  ledger?: DemoRecord[];
} = {}) {
  let spaces = structuredClone(catalog.spaces);
  let groups = new Map<string, Group>([["personal", structuredClone(catalog)]]);
  let records = structuredClone(ledger);
  let revision = 0;
  const listeners = new Set<() => void>();
  const receipts = new Map<string, string>();
  const cardLimits = new Map<string, string>();
  const importPrefixes = new Map<string, string>();
  let writing = Promise.resolve();
  function publish() {
    revision += 1;
    for (const listener of listeners) {
      listener();
    }
  }
  function view(spaceId = "personal"): DemoData {
    const group = groups.get(spaceId);
    return {
      accounts: spaceId === "personal" ? demoAccounts : [],
      categories: group?.categories ?? [],
      records: spaceId === "personal" ? records : [],
    };
  }
  function catalogFor(spaceId: string): WorkspaceCatalog {
    return structuredClone({ ...required(groups.get(spaceId)), spaces });
  }
  function financialData(
    query: Extract<PortalQuery, { tool: "get_overview" | "generate_chart" }>,
  ) {
    const data = scopedDemoData(view(query.spaceId), query);
    return {
      ...data,
      records: data.records.filter(
        (row) =>
          (!query.accountId || row.accountId === query.accountId) &&
          (!query.currency || row.currency === query.currency) &&
          (!query.direction || row.direction === query.direction) &&
          (!query.categoryId || row.category === query.categoryId) &&
          (!query.status || row.status === query.status) &&
          (!query.text || transactionMatchesText(row, query.text)) &&
          (!query.uncategorized || row.category === null),
      ),
    };
  }
  function updateCardLimit(
    command: Extract<ParsedMutation, { tool: "update_account_settings" }>,
  ) {
    if (command.expected_revision !== revision) {
      throw new Error("RESTART_REQUIRED");
    }
    const account = required(
      view(command.spaceId).accounts.find((row) => row.id === command.id),
    );
    if (account.type !== "CREDIT") {
      throw new Error("CARD_REQUIRED");
    }
    if (command.creditLimitMinor === null) {
      cardLimits.delete(command.id);
    } else {
      cardLimits.set(command.id, command.creditLimitMinor);
    }
  }
  function categorizeTransactions(
    command: Extract<ParsedMutation, { tool: "batch_edit_transactions" }>,
    group: Group,
  ) {
    if (command.expected_revision !== revision) {
      throw new Error("RESTART_REQUIRED");
    }
    if (command.category !== null) {
      required(group.categories.find((item) => item.id === command.category));
    }
    const selected = new Set(command.ids);
    const scoped = view(command.spaceId).records;
    for (const id of selected) {
      required(scoped.find((item) => item.id === id));
    }
    records = records.map((row) =>
      selected.has(row.id) ? { ...row, category: command.category } : row,
    );
  }
  function importRules(
    command: Extract<ParsedMutation, { tool: "import_rules" }>,
  ) {
    if (command.revision !== revision) {
      throw new Error("RESTART_REQUIRED");
    }
    const prepared = prepareImport(command);
    if (
      prepared.result.categories.some(
        (category) =>
          category.status === "invalid" || category.status === "ambiguous",
      )
    ) {
      throw new Error("INVALID_RULE_IMPORT_CATEGORY");
    }
    groups.set(command.spaceId, prepared.group);
  }
  function mutate(command: ParsedMutation) {
    const group = required(groups.get(command.spaceId));
    if (mutateCategoryCatalog(group, command)) {
      return;
    }
    switch (command.tool) {
      case "import_rules":
        importRules(command);
        break;
      case "batch_edit_transactions":
        categorizeTransactions(command, group);
        break;
      case "update_account_settings":
        updateCardLimit(command);
        break;
      case "create_rule":
      case "update_rule": {
        validateRule(command, group, view(command.spaceId));
        const id =
          command.tool === "update_rule"
            ? required(group.rules.find((rule) => rule.id === command.id)).id
            : `demo:${randomId()}`;
        const {
          accountId,
          categoryId,
          direction,
          enabled,
          filter,
          name,
          priority,
          text,
        } = command;
        group.rules = [
          ...group.rules.filter((rule) => rule.id !== id),
          {
            accountId,
            categoryId,
            direction,
            enabled,
            filter,
            id,
            name,
            priority,
            text,
          },
        ];
        break;
      }
      case "delete_rule":
        required(group.rules.find((rule) => rule.id === command.id));
        group.rules = group.rules.filter((rule) => rule.id !== command.id);
        break;
      case "create_space": {
        const id = `demo:${randomId()}`;
        const { name, type, currency, monthStartDay } = command;
        spaces = [
          ...spaces,
          {
            budgetEnabled: false,
            currency,
            id,
            monthlyBudgetMinor: null,
            monthStartDay,
            name,
            type,
          },
        ];
        groups.set(id, {
          ...categoryCatalog(id),
          rules: [],
          tags: [],
        } satisfies Group);
        break;
      }
      case "update_space": {
        if (command.spaceId !== command.id) {
          throw new Error("SPACE_MISMATCH");
        }
        const space = required(spaces.find((item) => item.id === command.id));
        spaces = spaces.map((item) =>
          item.id === space.id
            ? {
                ...item,
                ...(command.name !== undefined && { name: command.name }),
                ...(command.type !== undefined && { type: command.type }),
                ...(command.monthStartDay !== undefined && {
                  monthStartDay: command.monthStartDay,
                }),
              }
            : item,
        );
        break;
      }
      case "delete_space": {
        if (command.spaceId !== command.id) {
          throw new Error("SPACE_MISMATCH");
        }
        if (command.id === "personal") {
          throw new Error("SPACE_PROTECTED");
        }
        if (
          group.rules.length ||
          group.tags.length ||
          view(command.id).accounts.length
        ) {
          throw new Error("SPACE_NOT_EMPTY");
        }
        groups.delete(command.id);
        spaces = spaces.filter((space) => space.id !== command.id);
        break;
      }
      default:
        throw new Error("UNSUPPORTED_DEMO_OPERATION");
    }
  }
  function prepareImport(
    input: Pick<
      Extract<ParsedMutation, { tool: "import_rules" }>,
      "spaceId" | "pack" | "categoryIds"
    >,
  ) {
    const group = required(groups.get(input.spaceId));
    const key = JSON.stringify([input.spaceId, input.pack.id]);
    let prefix = importPrefixes.get(key);
    if (!prefix) {
      // Stable across preview/apply, scoped to this tab; getRandomValues also
      // works on HTTP LAN previews where crypto.subtle is unavailable.
      prefix = `demo:pack:${randomId()}:`;
      importPrefixes.set(key, prefix);
    }
    const plan = prepareRuleImport({
      ...input,
      categories: group.categories.map((category) => ({
        ...category,
        spaceId: input.spaceId,
      })),
      prefix,
      revision,
      rules: group.rules.map(({ pack: _origin, ...rule }) => ({
        ...rule,
        filter: rule.filter ?? null,
        spaceId: input.spaceId,
      })),
    });
    for (const rule of plan.rules) {
      validateRuleReferences(rule, view(input.spaceId));
    }
    return {
      group: {
        ...group,
        categories: [
          ...group.categories,
          ...plan.categories.map(
            ({ spaceId: _spaceId, ...category }) => category,
          ),
        ],
        rules: [
          ...group.rules,
          ...plan.rules.map(({ spaceId: _spaceId, ...rule }) => rule),
        ],
      },
      result: plan.result,
    };
  }

  const queries: Partial<{
    [Tool in keyof PortalQueryResults]: (
      query: PortalQuery & { tool: Tool },
    ) => PortalQueryResults[Tool] | Promise<PortalQueryResults[Tool]>;
  }> = {
    generate_chart: (query) => ({
      data: {
        ...demoSummary(query.from, query.to, "month", financialData(query)),
        groupBy: "month",
      },
    }),
    get_accounts: (query) => ({
      data: {
        records: view(query.spaceId).accounts.map((account) => ({
          id: account.id,
          identity: account.identity,
          name: account.name,
          personId: account.personId,
          personName:
            demoPeople.find((person) => person.id === account.personId)?.name ??
            "Pessoa de exemplo",
          type: account.type,
        })),
      },
    }),
    get_card_commitments: (query) =>
      demoCommitments(
        query,
        view(query.spaceId ?? "personal").categories,
        revision,
      ),
    get_investments: (query) => ({
      data: investmentPortfolio(
        demoInvestments.filter(
          (row) =>
            row.spaceId === query.spaceId &&
            (!query.personId || row.personId === query.personId) &&
            matchesFinancialIdentity(row.identity, query),
        ),
        query,
      ),
      partial: false,
    }),
    get_overview: (query) => {
      const data = financialData(query);
      return {
        data: {
          ...demoSummary(query.from, query.to, "category", data),
          accounts: data.accounts,
        },
      };
    },
    get_portal_cards: (query) => ({
      data: demoCards(
        {
          ...query,
          currency: query.currency ?? "BRL",
          spaceId: query.spaceId ?? "personal",
        },
        view(query.spaceId ?? "personal"),
        cardLimits,
      ),
      partial: false,
      revision,
    }),
    get_portal_transactions: (query) =>
      demoTransactionDetail(query, view(query.spaceId ?? "personal"), revision),
    preview_rule_import: async (query) => {
      const { RuleImportPackageSchema } = await import("../contracts");
      return {
        data: prepareImport({
          ...query,
          categoryIds: query.categoryIds ?? {},
          pack: RuleImportPackageSchema.parse(query.pack),
        }).result,
      };
    },
  };
  const api: OrganizationApi = {
    catalog: (spaceId, signal) => local(signal, () => catalogFor(spaceId)),
    planning: async (command, _csrf, signal) => {
      const { PortalMutationSchema: mutationSchema } = await import(
        "../contracts"
      );
      const result = writing.then(() =>
        local(signal, () => {
          const payload = JSON.stringify(command);
          const previous = receipts.get(command.idempotency_key);
          if (previous && previous !== payload) {
            throw new Error("IDEMPOTENCY_CONFLICT");
          }
          if (!previous) {
            mutate(mutationSchema.parse({ command, csrf: _csrf }).command);
            receipts.set(command.idempotency_key, payload);
            publish();
          }
          return { ok: true };
        }),
      );
      // Failed commands release the synthetic write queue; callers receive the error.
      writing = tryCatch(result).then(
        ({ data: _data, error: _error }) => undefined,
      );
      return await result;
    },
    previewRule: (input, signal) =>
      local(signal, () => {
        const eligible = view(input.spaceId).records.filter(
          (row) => !row.ignored,
        );
        const matches = eligible.filter((row) => ruleMatches(row, input));
        return {
          count: matches.length,
          examined: eligible.length,
          partial: false,
          revision,
          samples: matches
            .slice(0, 5)
            .map(
              ({
                id,
                accountId,
                amountMinor,
                currency,
                date,
                description,
                personName,
              }) => ({
                accountId,
                amountMinor,
                currency,
                date,
                description,
                id,
                personName,
              }),
            ),
          truncated: false,
        };
      }),
    query: (query, _csrf, signal) =>
      local(signal, () => {
        const read = queries[query.tool];
        if (!read) {
          throw new Error("UNSUPPORTED_DEMO_OPERATION");
        }
        return read(query);
      }),
  };
  return {
    api,
    applyRules(spaceId: string) {
      const rules = activeRules(required(groups.get(spaceId)).rules);
      const scoped = new Set(
        view(spaceId)
          .records.filter((row) => !row.ignored)
          .map((row) => row.id),
      );
      let matched = 0;
      let changed = 0;
      records = records.map((row) => {
        if (!scoped.has(row.id)) {
          return row;
        }
        const rule = rules.find((candidate) =>
          ruleMatches(row, { ...candidate, filter: candidate.filter ?? null }),
        );
        if (!rule) {
          return row;
        }
        matched += 1;
        if (row.category === rule.categoryId) {
          return row;
        }
        changed += 1;
        return { ...row, category: rule.categoryId };
      });
      publish();
      return { changed, matched };
    },
    catalog: catalogFor,
    reset() {
      spaces = structuredClone(catalog.spaces);
      groups = new Map([["personal", structuredClone(catalog)]]);
      records = structuredClone(ledger);
      receipts.clear();
      importPrefixes.clear();
      publish();
    },
    revision: () => revision,
    spaces: () => structuredClone(spaces),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    view,
  };
}
