import type { Identity, WizardState } from "../../contracts";
import {
  type PreviewInput,
  type RuleCommand,
  RuleCommandAction,
  RuleImportMode,
  type SubscriptionInput,
} from "../../contracts";
import type { ProviderRecord } from "../../domain";
import {
  assertEntityIdentity,
  assertReadRevision,
  type CorrectionInput,
  detectSubscriptions,
  EntityChange,
  entityChange,
  entityFingerprint,
  localDay,
  NORMALIZER,
  projectEntity,
  type RecordChange,
  Resource,
  recordChange,
} from "../../domain";
import { type Derived, importRules, txContext } from "../../domain/rules";
import type {
  EntityInput,
  EntityPreparation,
  FinancialRepository,
  PreparedEntity,
  PreviewSelection,
  RuleActions,
} from "./entity";

export interface FinancialQueries {
  aggregate: FinancialRepository["aggregate"];
  correctRecord: (
    input: CorrectionInput,
  ) => ReturnType<typeof correctFinancialRecord>;
  explainRecord: FinancialRepository["explain"];
  manageRules: (input: RuleCommand) => ReturnType<typeof manageRules>;
  now: () => string;
  previewRules: (input: PreviewInput) => ReturnType<typeof previewRules>;
  query: FinancialRepository["query"];
  readAccount: (accountId: string) => Promise<ProviderRecord>;
  readStatus: FinancialRepository["readStatus"];
  readSubscriptions: (
    input: SubscriptionInput,
  ) => ReturnType<typeof readSubscriptions>;
  setupStatus: () => Promise<WizardState>;
}

export function createFinancialService(deps: {
  repository: FinancialRepository;
  actions: RuleActions;
  setupStatus: () => Promise<WizardState>;
  readAccount: (accountId: string) => Promise<ProviderRecord>;
  now: () => Date;
}): FinancialQueries {
  const { repository } = deps;
  return {
    aggregate: repository.aggregate,
    correctRecord: (input) => correctFinancialRecord(repository.correct, input),
    explainRecord: repository.explain,
    manageRules: (input) => manageRules(deps.actions, input),
    now: () => deps.now().toISOString(),
    previewRules: (input) =>
      previewRules(
        {
          revision: repository.revision,
          rules: () => repository.rules(input.revision),
          select: (before) => repository.preview(input, before),
        },
        input.revision,
      ),
    query: repository.query,
    readAccount: deps.readAccount,
    readStatus: repository.readStatus,
    readSubscriptions: (input) =>
      readSubscriptions(
        {
          now: deps.now,
          revision: repository.revision,
          select: () => repository.subscriptions(input),
        },
        input,
      ),
    setupStatus: deps.setupStatus,
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
      id: input.id,
      itemId: input.itemId,
      parentId: input.parentId,
      resource: input.resource,
    },
    change,
  );
}

export async function manageRules(actions: RuleActions, a: RuleCommand) {
  if (a.action === RuleCommandAction.read) {
    return await (a.revision ? actions.read(a.revision) : actions.list());
  }
  if (a.action === RuleCommandAction.activate) {
    if (a.revision === undefined) {
      throw new Error("RULES_REVISION_REQUIRED");
    }
    return await actions.activate(a.revision);
  }
  const report = importRules(a.document, a.catalog);
  if (a.action === RuleCommandAction.validate || !report.compatible) {
    return report;
  }
  return await actions.save(report.document, false);
}

export async function previewRules(
  reads: {
    select: (before: number) => Promise<PreviewSelection>;
    rules: () => ReturnType<FinancialRepository["rules"]>;
    revision: () => Promise<number>;
  },
  rulesRevision: string,
) {
  const before = await reads.revision();
  const engine = await reads.rules();
  const { total, sample } = await reads.select(before);
  const differences: {
    id: string;
    before: { category: string | null; description: string | null };
    derived: Derived;
  }[] = [];
  await sample.reduce(async (previous, row) => {
    await previous;
    differences.push({
      before: {
        category: row.effective_category,
        description: row.effective_description,
      },
      derived: await engine.evaluate(txContext(row.normalized)),
      id: row.id,
    });
  }, Promise.resolve());
  assertReadRevision({ actual: await reads.revision(), expected: before });
  return {
    differences,
    revision: before,
    rulesRevision,
    sampleOnly: true,
    selected: total,
  };
}

export async function readSubscriptions(
  reads: {
    select: () => ReturnType<FinancialRepository["subscriptions"]>;
    revision: () => Promise<number>;
    now: () => Date;
  },
  input: SubscriptionInput,
) {
  const { before, records } = await reads.select();
  assertReadRevision({ actual: await reads.revision(), expected: before });
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
  return await actions.save(
    report.document,
    input.mode === RuleImportMode.activate,
  );
}

export async function prepareEntity(
  dependencies: EntityPreparation,
  input: EntityInput,
): Promise<PreparedEntity> {
  const { identity, source, parent, legacyProjection } = input;
  assertEntityIdentity({ expectedId: identity.id, source });
  const [digest, previous] = await Promise.all([
    dependencies.hash(
      entityFingerprint({
        legacyProjection,
        parent,
        raw: source,
        resource: identity.resource,
      }),
    ),
    dependencies.repository.read(identity),
  ]);
  const observation = {
    identity,
    observedAt: input.observedAt,
    operationId: input.operationId,
    source,
  };
  const seenInOperation = previous?.seen_operation === input.operationId;
  const change = entityChange({
    digest,
    previous: previous && {
      deleted: previous.deleted !== 0,
      relevantHash: previous.relevant_hash,
    },
    renormalize: input.renormalize,
  });
  if (change === EntityChange.unchanged) {
    return {
      classified: 0,
      mutation: { kind: "observe", value: observation },
      seenInOperation,
      state: EntityChange.unchanged,
    };
  }
  const projection = projectEntity({
    parent,
    raw: source,
    referenceDay: input.referenceDay,
    resource: identity.resource,
    ...(legacyProjection && { legacyProjection }),
  });
  const derived =
    identity.resource === Resource.transactions
      ? await dependencies.evaluate(txContext(projection.record))
      : undefined;
  return {
    classified: derived ? 1 : 0,
    mutation: {
      kind: "save",
      value: {
        ...observation,
        derived,
        digest,
        normalizer: legacyProjection ? "legacy-projection-v1" : NORMALIZER,
        projection,
        rulesRevision: input.rulesRevision,
      },
    },
    seenInOperation,
    state: change,
  };
}
