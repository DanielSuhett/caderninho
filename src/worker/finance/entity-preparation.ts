import type { Identity } from "#contracts/queries.types.ts";
import {
  entityFingerprint,
  NORMALIZER,
  projectEntity,
} from "#domain/entity.ts";
import { EntityChange, Resource } from "#domain/enums.ts";
import type { FinanceRecord } from "#domain/finance.types.ts";
import type { ProviderRecord } from "#domain/provider.types.ts";
import { txContext } from "#domain/rules/rules.ts";
import type { RuleEngine } from "#domain/rules/rules.types.ts";
import type { entityPersistence } from "#worker/finance/entities.repository.ts";

interface EntityInput {
  identity: Identity;
  source: ProviderRecord;
  parent: FinanceRecord | undefined;
  operationId: string;
  referenceDay: string;
  rulesRevision: string;
  renormalize: boolean;
  observedAt: string;
  legacyProjection?: FinanceRecord;
}

export async function prepareEntity(
  dependencies: {
    repository: ReturnType<typeof entityPersistence>;
    hash(value: unknown): Promise<string>;
    evaluate: RuleEngine["evaluate"];
  },
  input: EntityInput,
) {
  const { identity, source, parent, legacyProjection } = input;
  if (String(source.id ?? source.resourceId) !== identity.id) {
    throw new Error("SOURCE_ID_MISMATCH");
  }
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
  if (
    !input.renormalize &&
    previous?.relevant_hash === digest &&
    previous.deleted === 0
  ) {
    return {
      statements: dependencies.repository.observe(observation),
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
    statements: dependencies.repository.save({
      ...observation,
      projection,
      digest,
      normalizer: legacyProjection ? "legacy-projection-v1" : NORMALIZER,
      rulesRevision: input.rulesRevision,
      derived,
    }),
    seenInOperation,
    state: previous ? EntityChange.changed : EntityChange.new,
    classified: derived ? 1 : 0,
  };
}
