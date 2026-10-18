import type {
  PreviewInput,
  SubscriptionInput,
} from "@/contracts/finance.types";
import type {
  Aggregate,
  Cursor,
  Identity,
  Query,
} from "@/contracts/queries.types";
import type { EntityChange, Resource } from "@/domain/enums";
import type {
  FinanceRecord,
  projectEntity,
  RecordChange,
} from "@/domain/finance.entity";
import type { metricFor } from "@/domain/finance-model";
import type { ProviderRecord } from "@/domain/provider.entity";
import type { Derived, RuleEngine, Rules } from "@/domain/rules";

import type {
  coverage,
  effective_entities,
  items,
  operations,
  overrides,
  rule_sets,
  tags,
} from "../schema";

export type EffectiveEntity = typeof effective_entities.$inferSelect;
export type SerializedEntity = Omit<
  EffectiveEntity,
  "source" | "normalized" | "evidence"
> & { source: string; normalized: string; evidence: string | null };
export type QueryCoverage = {
  itemId: string;
  coverage: (
    | Pick<
        typeof coverage.$inferSelect,
        | "resource"
        | "parent_id"
        | "status"
        | "bootstrap_complete"
        | "observed_at"
      >
    | {
        resource: Resource;
        status: "not_synced";
        bootstrap_complete: number;
      }
  )[];
}[];
export interface FinancialRepository {
  query(input: Query): Promise<{
    revision: number;
    coverage: QueryCoverage;
    records: (SerializedEntity & { effective_tags: string })[];
    cursor: Cursor | null;
  }>;
  aggregate(input: Aggregate): Promise<{
    revision: number;
    coverage: QueryCoverage;
    metric: string;
    definition: ReturnType<typeof metricFor> | null;
    groups: {
      currency: string | null;
      count: string;
      known: string;
      totalMinor: string | null;
      partial: boolean;
    }[];
  }>;
  readStatus(): Promise<{
    items: (typeof items.$inferSelect)[];
    coverage: (typeof coverage.$inferSelect)[];
    operations: (Pick<
      typeof operations.$inferSelect,
      "id" | "status" | "phase" | "created_at" | "dispatched"
    > & { progress: string })[];
    backlog: { pending: number } | undefined;
    limitation: string;
  }>;
  correct(identity: Identity, change: RecordChange): Promise<{ updated: true }>;
  explain(identity: Identity): Promise<{
    tags: Pick<typeof tags.$inferSelect, "key" | "value" | "origin">[];
    record: SerializedEntity | null;
    overrides: Pick<typeof overrides.$inferSelect, "field" | "value">[];
  }>;
  preview(input: PreviewInput, before: number): Promise<PreviewSelection>;
  subscriptions(
    input: SubscriptionInput,
  ): Promise<{ before: number; records: FinanceRecord[] }>;
  revision(): Promise<number>;
  rules(revision: string): Promise<RuleEngine>;
}
export interface PreviewSelection {
  before: number;
  total: number;
  sample: {
    id: string;
    normalized: FinanceRecord;
    effective_category: string | null;
    effective_description: string | null;
  }[];
}
export interface RuleActions {
  read(revision: string): Promise<(typeof rule_sets.$inferSelect)["document"]>;
  list(): Promise<
    Pick<typeof rule_sets.$inferSelect, "id" | "created_at" | "normalizer">[]
  >;
  activate(
    revision: string,
  ): Promise<{ activated: string; historicalReclassification: boolean }>;
  save(
    document: Rules,
    activate?: boolean,
  ): Promise<{ id: string; rules: number; activated: boolean }>;
}

export interface EntityObservation {
  identity: Identity;
  source: ProviderRecord;
  operationId: string;
  observedAt: string;
}
export interface EntityPublication extends EntityObservation {
  projection: ReturnType<typeof projectEntity>;
  digest: string;
  normalizer: string;
  rulesRevision: string;
  derived: Derived | undefined;
}
export type EntityMutation =
  | { kind: "observe"; value: EntityObservation }
  | { kind: "save"; value: EntityPublication };
export interface PreparedEntity {
  mutation: EntityMutation;
  seenInOperation: boolean;
  state: (typeof EntityChange)[keyof typeof EntityChange];
  classified: number;
}
export interface EntityReader {
  read(identity: Identity): Promise<
    | {
        relevant_hash: string;
        deleted: number;
        seen_operation: string | null;
      }
    | undefined
  >;
}
export interface EntityInput {
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
export interface EntityPreparation {
  repository: EntityReader;
  hash(value: unknown): Promise<string>;
  evaluate: RuleEngine["evaluate"];
}
