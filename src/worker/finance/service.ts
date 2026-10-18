import {
  type PreviewInput,
  type RuleCommand,
  RuleCommandAction,
  RuleImportMode,
  type SubscriptionInput,
} from "@/contracts/finance.types";
import type { Identity } from "@/contracts/queries.types";
import type { WizardState } from "@/contracts/wizard.types";
import { EntityChange, Resource } from "@/domain/enums";
import { localDay } from "@/domain/exact";
import {
  assertEntityIdentity,
  type CorrectionInput,
  entityChange,
  entityFingerprint,
  NORMALIZER,
  projectEntity,
  type RecordChange,
  recordChange,
} from "@/domain/finance.entity";
import type { ProviderRecord } from "@/domain/provider.entity";
import { assertReadRevision } from "@/domain/query.entity";
import { detectSubscriptions } from "@/domain/recurrence.entity";
import { importRules, txContext } from "@/domain/rules";

import type {
  EntityInput,
  EntityPreparation,
  FinancialRepository,
  PreparedEntity,
  PreviewSelection,
  RuleActions,
} from "./entity";

export interface FinancialQueries {
  setupStatus(): Promise<WizardState>;
  query: FinancialRepository["query"];
  aggregate: FinancialRepository["aggregate"];
  readStatus: FinancialRepository["readStatus"];
  manageRules(input: RuleCommand): ReturnType<typeof manageRules>;
  correctRecord(
    input: CorrectionInput,
  ): ReturnType<typeof correctFinancialRecord>;
  explainRecord: FinancialRepository["explain"];
  previewRules(input: PreviewInput): ReturnType<typeof previewRules>;
  readSubscriptions(
    input: SubscriptionInput,
  ): ReturnType<typeof readSubscriptions>;
  readAccount(accountId: string): Promise<ProviderRecord>;
  now(): string;
}

export function createFinancialService(deps: {
  repository: FinancialRepository;
  actions: RuleActions;
  setupStatus(): Promise<WizardState>;
  readAccount(accountId: string): Promise<ProviderRecord>;
  now(): Date;
}): FinancialQueries {
  const { repository } = deps;
  return {
    setupStatus: deps.setupStatus,
    query: repository.query,
    aggregate: repository.aggregate,
    readStatus: repository.readStatus,
    manageRules: (input) => manageRules(deps.actions, input),
    correctRecord: (input) => correctFinancialRecord(repository.correct, input),
    explainRecord: repository.explain,
    previewRules: (input) =>
      previewRules(
        {
          select: (before) => repository.preview(input, before),
          rules: () => repository.rules(input.revision),
          revision: repository.revision,
        },
        input.revision,
      ),
    readSubscriptions: (input) =>
      readSubscriptions(
        {
          select: () => repository.subscriptions(input),
          revision: repository.revision,
          now: deps.now,
        },
        input,
      ),
    readAccount: deps.readAccount,
    now: () => deps.now().toISOString(),
  };
}

export function correctFinancialRecord(
  persist: (
    identity: Identity,
    change: RecordChange,
  ) => Promise<{ updated: true }>,
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
    select(before: number): Promise<PreviewSelection>;
    rules(): ReturnType<FinancialRepository["rules"]>;
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
  assertReadRevision({ expected: before, actual: await reads.revision() });
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
    select(): ReturnType<FinancialRepository["subscriptions"]>;
    revision(): Promise<number>;
    now(): Date;
  },
  input: SubscriptionInput,
) {
  const { before, records } = await reads.select();
  assertReadRevision({ expected: before, actual: await reads.revision() });
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

export async function prepareEntity(
  dependencies: EntityPreparation,
  input: EntityInput,
): Promise<PreparedEntity> {
  const { identity, source, parent, legacyProjection } = input;
  assertEntityIdentity({ source, expectedId: identity.id });
  const [digest, previous] = await Promise.all([
    dependencies.hash(
      entityFingerprint({
        resource: identity.resource,
        raw: source,
        parent,
        legacyProjection,
      }),
    ),
    dependencies.repository.read(identity),
  ]);
  const observation = {
    identity,
    source,
    operationId: input.operationId,
    observedAt: input.observedAt,
  };
  const seenInOperation = previous?.seen_operation === input.operationId;
  const change = entityChange({
    previous: previous && {
      relevantHash: previous.relevant_hash,
      deleted: previous.deleted !== 0,
    },
    digest,
    renormalize: input.renormalize,
  });
  if (change === EntityChange.unchanged) {
    return {
      mutation: { kind: "observe", value: observation },
      seenInOperation,
      state: EntityChange.unchanged,
      classified: 0,
    };
  }
  const projection = projectEntity({
    resource: identity.resource,
    raw: source,
    parent,
    referenceDay: input.referenceDay,
    ...(legacyProjection && { legacyProjection }),
  });
  const derived =
    identity.resource === Resource.transactions
      ? await dependencies.evaluate(txContext(projection.record))
      : undefined;
  return {
    mutation: {
      kind: "save",
      value: {
        ...observation,
        projection,
        digest,
        normalizer: legacyProjection ? "legacy-projection-v1" : NORMALIZER,
        rulesRevision: input.rulesRevision,
        derived,
      },
    },
    seenInOperation,
    state: change,
    classified: derived ? 1 : 0,
  };
}
