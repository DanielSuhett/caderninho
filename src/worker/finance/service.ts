import {
  type LiveBalanceInput,
  type PreviewInput,
  type RuleCommand,
  RuleCommandAction,
  RuleImportMode,
  type SubscriptionInput,
} from "#contracts/finance.types.ts";
import type { Aggregate, Identity, Query } from "#contracts/queries.types.ts";
import type { WizardState } from "#contracts/wizard.types.ts";
import { localDay } from "#domain/exact.ts";
import type { ProviderRecord } from "#domain/provider.types.ts";
import { recordChange } from "#domain/record-correction.ts";
import type {
  CorrectionInput,
  RecordChange,
  RecordReference,
} from "#domain/record-correction.types.ts";
import { importRules } from "#domain/rules/import-rules.ts";
import { txContext } from "#domain/rules/rules.ts";
import type { Rules } from "#domain/rules/rules.types.ts";
import { detectSubscriptions } from "#domain/subscriptions.ts";
import type {
  correctRecord,
  explainRecord,
} from "#worker/finance/entities.repository.ts";
import type {
  aggregateEntities,
  previewSelection,
  queryEntities,
  readStatus,
  subscriptionRecords,
} from "#worker/finance/repository.ts";
import type {
  activateRules,
  listRules,
  readRules,
  rulesFor,
  saveRules,
} from "#worker/finance/rules.repository.ts";

export interface FinancialQueries {
  setupStatus(): Promise<WizardState>;
  query(input: Query): ReturnType<typeof queryEntities>;
  aggregate(input: Aggregate): ReturnType<typeof aggregateEntities>;
  readStatus(): ReturnType<typeof readStatus>;
  manageRules(input: RuleCommand): ReturnType<typeof manageRules>;
  correctRecord(
    input: CorrectionInput,
  ): ReturnType<typeof correctFinancialRecord>;
  explainRecord(input: RecordReference): ReturnType<typeof explainRecord>;
  previewRules(input: PreviewInput): ReturnType<typeof previewRules>;
  readSubscriptions(
    input: SubscriptionInput,
  ): ReturnType<typeof readSubscriptions>;
  authorizeAccount(input: LiveBalanceInput): Promise<void>;
  readAccount(accountId: string): Promise<ProviderRecord>;
  now(): string;
}

export function correctFinancialRecord(
  persist: (
    identity: Identity,
    change: RecordChange,
  ) => ReturnType<typeof correctRecord>,
  input: CorrectionInput,
) {
  const change = recordChange(input);
  return persist(
    {
      itemId: input.itemId,
      resource: input.resource,
      parentId: input.parentId,
      id: input.id,
    },
    change,
  );
}

export interface RuleActions {
  read(revision: string): ReturnType<typeof readRules>;
  list(): ReturnType<typeof listRules>;
  activate(revision: string): ReturnType<typeof activateRules>;
  save(document: Rules, activate?: boolean): ReturnType<typeof saveRules>;
}

export async function manageRules(actions: RuleActions, a: RuleCommand) {
  if (a.action === RuleCommandAction.read) {
    return a.revision ? actions.read(a.revision) : actions.list();
  }
  if (a.action === RuleCommandAction.activate) {
    if (a.revision === undefined) {
      throw new Error("RULES_REVISION_REQUIRED");
    }
    return actions.activate(a.revision);
  }
  const report = importRules(a.document, a.catalog);
  if (a.action === RuleCommandAction.validate || !report.compatible) {
    return report;
  }
  return actions.save(report.document, false);
}

export async function previewRules(
  reads: {
    select(before: number): ReturnType<typeof previewSelection>;
    rules(): ReturnType<typeof rulesFor>;
    revision(): Promise<number>;
  },
  rulesRevision: string,
) {
  const before = await reads.revision();
  const engine = await reads.rules();
  const { total, sample } = await reads.select(before);
  const differences = [];
  for (const row of sample) {
    differences.push({
      id: row.id,
      before: {
        category: row.effective_category,
        description: row.effective_description,
      },
      derived: await engine.evaluate(txContext(row.normalized)),
    });
  }
  if (before !== (await reads.revision())) {
    throw new Error("RESTART_REQUIRED");
  }
  return {
    selected: total,
    sampleOnly: true,
    differences,
    revision: before,
    rulesRevision,
  };
}

export async function readSubscriptions(
  reads: {
    select(): ReturnType<typeof subscriptionRecords>;
    revision(): Promise<number>;
    now(): Date;
  },
  input: SubscriptionInput,
) {
  const { before, records } = await reads.select();
  if (before !== (await reads.revision())) {
    throw new Error("RESTART_REQUIRED");
  }
  return detectSubscriptions(records, {
    ...input,
    asOfDay: localDay(reads.now()),
  });
}

export async function importRuleDocument(
  actions: RuleActions,
  input: {
    document: unknown;
    catalog?: Parameters<typeof importRules>[1];
    mode: RuleImportMode;
  },
) {
  const report = importRules(input.document, input.catalog);
  if (!report.compatible || input.mode === RuleImportMode.dry_run) {
    return report;
  }
  return actions.save(report.document, input.mode === RuleImportMode.activate);
}
