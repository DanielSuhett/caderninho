import type { z } from "zod/v4";

import type {
  PortalMutationSchema,
  PortalQuery,
  PortalQueryResults,
  RuleJob,
  RuleJobCommand,
  WorkspaceCatalog,
} from "../contracts";
import {
  activeRules,
  categoryCatalog,
  financialIdentity,
  type Institution,
  importedTotals,
  investmentPortfolio,
  matchesFinancialIdentity,
  planRuleApplication,
  prepareRuleImport,
  RULE_JOB_CHUNK_RULES,
  type RuleJobChunkResult,
  RuleJobKind,
  RuleJobPhase,
  RuleJobStatus,
  ruleApplication,
  ruleImportCategoryMapping,
  ruleJobActive,
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
import { tryCatch, tryCatchSync } from "../shared";
import type { OrganizationApi } from "./account/account-api";
import { type DemoCardEdit, demoCards } from "./demo-cards";
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
interface DemoRuleJob {
  categories: unknown[];
  chunks: Map<number, unknown[]>;
  job: RuleJob;
}
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

function nativeRules(rules: WorkspaceCatalog["rules"]) {
  return rules.map(({ pack, filter, ...rule }) => ({
    ...rule,
    filter: filter ?? null,
    ...(pack && { pack }),
  }));
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
  let accountRecords = structuredClone(demoAccounts);
  let revision = 0;
  const listeners = new Set<() => void>();
  const receipts = new Map<string, string>();
  const mutationResults = new Map<string, unknown>();
  const categoryOverrides = new Map<string, string | null>();
  const cardLimits = new Map<string, string>();
  const cardEdits = new Map<string, DemoCardEdit>();
  const importPrefixes = new Map<string, string>();
  const ruleJobs = new Map<string, DemoRuleJob>();
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
      accounts: spaceId === "personal" ? accountRecords : [],
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
  function updateCard(
    command: Extract<ParsedMutation, { tool: "update_card" }>,
  ) {
    if (command.expected_revision !== revision) {
      throw new Error("RESTART_REQUIRED");
    }
    const [accountId] = command.id.split(":");
    required(
      view(command.spaceId).accounts.find(
        (row) => row.id === accountId && row.type === "CREDIT",
      ),
    );
    cardEdits.set(command.id, {
      ...cardEdits.get(command.id),
      ...(command.name !== undefined && { name: command.name }),
      ...(command.hidden !== undefined && { hidden: command.hidden }),
      ...(command.personId !== undefined && { personId: command.personId }),
    });
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
    for (const id of selected) {
      categoryOverrides.set(id, command.category);
    }
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
  function prepareApplication(input: {
    spaceId: string;
    from: string;
    to: string;
    accountId?: string | undefined;
  }) {
    if (input.from > input.to) {
      throw new Error("INVALID_PERIOD");
    }
    const data = view(input.spaceId);
    if (
      input.accountId &&
      !data.accounts.some((row) => row.id === input.accountId)
    ) {
      throw new Error("NOT_FOUND");
    }
    return planRuleApplication({
      categoryOverrides,
      preserveManual: true,
      rows: data.records.filter(
        (row) =>
          row.date >= input.from &&
          row.date <= input.to &&
          (!input.accountId || row.accountId === input.accountId),
      ),
      rules: nativeRules(required(groups.get(input.spaceId)).rules),
    });
  }
  function applyRulesInPeriod(
    command: Extract<ParsedMutation, { tool: "apply_rules" }>,
  ) {
    if (command.expected_revision !== revision) {
      throw new Error("RESTART_REQUIRED");
    }
    const result = prepareApplication(command);
    const changes = new Map(
      result.changes.map((row) => [row.id, row.categoryId]),
    );
    records = records.map((row) => {
      const category = changes.get(row.id);
      if (category === undefined) {
        return row;
      }
      return { ...row, category };
    });
    return {
      changed: result.changed,
      count: result.examined,
      ids: result.changes.map((change) => change.id),
      matched: result.matched,
      preserved: result.preserved,
      truncated: result.truncated,
    };
  }
  // Same contract as the Worker job: tolerant chunks, native packs and bounded
  // application passes, executed synchronously against the synthetic ledger.
  function importJobChunk(
    job: RuleJob,
    input: { categories: unknown[]; rules: unknown[]; seq: number },
    prepareChunk: typeof import("../contracts").prepareRuleJobChunk,
  ): RuleJobChunkResult {
    const prepared = prepareChunk({
      categories: input.categories,
      offset: input.seq * RULE_JOB_CHUNK_RULES,
      rules: input.rules,
    });
    const result: RuleJobChunkResult = {
      categoriesCreated: 0,
      rulesCreated: 0,
      rulesExisting: 0,
      skipped: prepared.skipped,
    };
    const pack = required(job.pack ?? undefined);
    function importBatch(batch: (typeof prepared.batches)[number]) {
      const group = required(groups.get(job.spaceId));
      const { data: plan, error } = tryCatchSync(() =>
        prepareImport({
          categoryIds: ruleImportCategoryMapping(
            group.categories.map((category) => ({
              ...category,
              spaceId: job.spaceId,
            })),
            batch.categories,
          ),
          pack: { ...pack, ...batch },
          spaceId: job.spaceId,
        }),
      );
      if (error) {
        const [single] = batch.rules;
        if (batch.rules.length === 1 && single) {
          result.skipped.push({ key: single.key, reason: error.message });
          return;
        }
        for (const rule of batch.rules) {
          importBatch({
            categories: batch.categories.filter(
              (category) => category.key === rule.categoryKey,
            ),
            rules: [rule],
          });
        }
        return;
      }
      groups.set(job.spaceId, plan.group);
      result.categoriesCreated += plan.result.categoriesCreated;
      result.rulesCreated += plan.result.rulesCreated;
      result.rulesExisting += plan.result.rulesExisting;
      for (const rule of plan.result.rules) {
        if (rule.status === "blocked") {
          result.skipped.push({
            key: rule.key,
            reason: "Categoria indisponível neste grupo.",
          });
        }
      }
    }
    for (const batch of prepared.batches) {
      importBatch(batch);
    }
    return result;
  }
  async function runJob(entry: DemoRuleJob) {
    const { prepareRuleJobChunk } = await import("../contracts");
    const { job } = entry;
    const results =
      job.kind === RuleJobKind.import
        ? Array.from({ length: job.chunks }, (_, seq) =>
            importJobChunk(
              job,
              {
                categories: entry.categories,
                rules: entry.chunks.get(seq) ?? [],
                seq,
              },
              prepareRuleJobChunk,
            ),
          )
        : [];
    let changed = 0;
    let passes = 0;
    let examined = 0;
    let truncated = true;
    while (truncated) {
      const applied = applyRulesInPeriod({
        confirmed: true,
        expected_revision: revision,
        from: "1900-01-01",
        idempotency_key: randomId(),
        preserveManual: true,
        spaceId: job.spaceId,
        to: "9999-12-31",
        tool: "apply_rules",
      });
      changed += applied.changed;
      examined = applied.count;
      passes += 1;
      ({ truncated } = applied);
    }
    entry.job = {
      ...job,
      applied: { changed, examined, passes },
      imported: importedTotals(results),
      phase: RuleJobPhase.done,
      status: RuleJobStatus.succeeded,
      updatedAt: new Date().toISOString(),
    };
    publish();
  }
  function createRuleJob(
    input: Extract<RuleJobCommand, { action: "create_import" | "reapply" }>,
  ) {
    const active = [...ruleJobs.values()].some(
      (entry) =>
        entry.job.spaceId === input.spaceId && ruleJobActive(entry.job),
    );
    if (active) {
      throw new Error("JOB_ACTIVE");
    }
    required(groups.get(input.spaceId));
    const at = new Date().toISOString();
    const upload = input.action === "create_import" ? input : null;
    const created: RuleJob = {
      applied: { changed: 0, examined: 0, passes: 0 },
      chunks: upload?.chunks ?? 0,
      createdAt: at,
      error: null,
      id: randomId(),
      imported: importedTotals([]),
      kind: upload ? RuleJobKind.import : RuleJobKind.reapply,
      pack: upload && { id: upload.pack.id, version: upload.pack.version },
      phase: RuleJobPhase.upload,
      received: upload?.received ?? 0,
      spaceId: input.spaceId,
      status: upload ? RuleJobStatus.uploading : RuleJobStatus.running,
      updatedAt: at,
    };
    ruleJobs.set(created.id, {
      categories: upload?.pack.categories ?? [],
      chunks: new Map(),
      job: created,
    });
    return created;
  }
  function commandRuleJob(input: RuleJobCommand) {
    if (input.action === "create_import" || input.action === "reapply") {
      return createRuleJob(input);
    }
    const entry = ruleJobs.get(input.id);
    if (!entry) {
      throw new Error("NOT_FOUND");
    }
    if (input.action === "append") {
      if (!entry.chunks.has(input.seq)) {
        entry.chunks.set(input.seq, input.rules);
      }
      return entry.job;
    }
    if (entry.job.status !== RuleJobStatus.uploading) {
      return entry.job;
    }
    if (entry.chunks.size !== entry.job.chunks) {
      throw new Error("INVALID_REQUEST");
    }
    entry.job = { ...entry.job, status: RuleJobStatus.running };
    return entry.job;
  }
  function mutate(command: ParsedMutation) {
    const group = required(groups.get(command.spaceId));
    if (mutateCategoryCatalog(group, command)) {
      return;
    }
    switch (command.tool) {
      case "apply_rules":
        return applyRulesInPeriod(command);
      case "import_rules":
        importRules(command);
        break;
      case "batch_edit_transactions":
        categorizeTransactions(command, group);
        break;
      case "update_account_settings":
        updateCardLimit(command);
        break;
      case "update_card":
        updateCard(command);
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
        cardEdits,
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
    // Synthetic reads are computed from memory on every call.
    invalidate: () => undefined,
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
            const outcome = mutate(
              mutationSchema.parse({ command, csrf: _csrf }).command,
            );
            receipts.set(command.idempotency_key, payload);
            mutationResults.set(
              command.idempotency_key,
              outcome ?? { ok: true },
            );
            publish();
          }
          return mutationResults.get(command.idempotency_key);
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
    ruleJob: (selection, signal) =>
      local(signal, () => {
        if ("id" in selection) {
          return ruleJobs.get(selection.id)?.job ?? null;
        }
        return (
          [...ruleJobs.values()]
            .map((entry) => entry.job)
            .filter((job) => job.spaceId === selection.spaceId)
            .at(-1) ?? null
        );
      }),
    ruleJobs: async (input, signal) => {
      const job = await local(signal, () => commandRuleJob(input));
      const entry = ruleJobs.get(job.id);
      const starts =
        input.action === "reapply" ||
        (input.action === "start" && job.status === RuleJobStatus.running);
      if (entry && starts) {
        await runJob(entry);
        return entry.job;
      }
      return job;
    },
  };
  return {
    api,
    applyRules(spaceId: string) {
      const rules = activeRules(
        nativeRules(required(groups.get(spaceId)).rules),
      );
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
        const { rule } = ruleApplication({
          categoryOverride: categoryOverrides.get(row.id),
          preserveManual: false,
          row,
          rules,
        });
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
    identifyInstitution(input: {
      accountIds: string[];
      institution: Institution | null;
    }) {
      const selected = new Set(input.accountIds);
      accountRecords = accountRecords.map((account) =>
        selected.has(account.id)
          ? {
              ...account,
              identity: financialIdentity({
                identity: {
                  ...account.identity,
                  cardBrand: account.identity?.cardBrand ?? null,
                  institution: null,
                },
                institution: input.institution,
              }),
            }
          : account,
      );
      publish();
    },
    reset() {
      spaces = structuredClone(catalog.spaces);
      groups = new Map([["personal", structuredClone(catalog)]]);
      records = structuredClone(ledger);
      accountRecords = structuredClone(demoAccounts);
      receipts.clear();
      mutationResults.clear();
      categoryOverrides.clear();
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
