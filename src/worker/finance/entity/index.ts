import type {
  Aggregate,
  Cursor,
  Identity,
  PreviewInput,
  Query,
  SubscriptionInput,
} from "../../../contracts";
import type {
  EntityChange,
  FinanceRecord,
  ItemAdmission,
  metricFor,
  ProviderRecord,
  projectEntity,
  RecordChange,
  Resource,
} from "../../../domain";
import type { Derived, RuleEngine, Rules } from "../../../domain/rules";
import type {
  coverage,
  effective_entities,
  items,
  operations,
  overrides,
  rule_sets,
  tags,
} from "../../schema";

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
  aggregate: (input: Aggregate) => Promise<{
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
  correct: (
    identity: Identity,
    change: RecordChange,
  ) => Promise<{ updated: true }>;
  explain: (identity: Identity) => Promise<{
    tags: Pick<typeof tags.$inferSelect, "key" | "value" | "origin">[];
    record: SerializedEntity | null;
    overrides: Pick<typeof overrides.$inferSelect, "field" | "value">[];
  }>;
  preview: (input: PreviewInput, before: number) => Promise<PreviewSelection>;
  query: (input: Query) => Promise<{
    revision: number;
    coverage: QueryCoverage;
    records: (SerializedEntity & { effective_tags: string })[];
    cursor: Cursor | null;
  }>;
  readStatus: () => Promise<{
    schedule?: { paused: boolean; nextAutomaticAt: string } | undefined;
    freshness?: ItemAdmission[] | undefined;
    items: (typeof items.$inferSelect)[];
    coverage: (typeof coverage.$inferSelect)[];
    operations: (Pick<
      typeof operations.$inferSelect,
      | "id"
      | "status"
      | "phase"
      | "created_at"
      | "dispatched"
      | "kind"
      | "execution_mode"
    > & { progress: string })[];
    backlog: { pending: number } | undefined;
    limitation: string;
  }>;
  revision: () => Promise<number>;
  rules: (revision: string) => Promise<RuleEngine>;
  subscriptions: (
    input: SubscriptionInput,
  ) => Promise<{ before: number; records: FinanceRecord[] }>;
}
export interface PreviewSelection {
  before: number;
  sample: {
    id: string;
    normalized: FinanceRecord;
    effective_category: string | null;
    effective_description: string | null;
  }[];
  total: number;
}
export interface RuleActions {
  activate: (
    revision: string,
  ) => Promise<{ activated: string; historicalReclassification: boolean }>;
  list: () => Promise<
    Pick<typeof rule_sets.$inferSelect, "id" | "created_at" | "normalizer">[]
  >;
  read: (
    revision: string,
  ) => Promise<(typeof rule_sets.$inferSelect)["document"]>;
  save: (
    document: Rules,
    activate?: boolean,
  ) => Promise<{ id: string; rules: number; activated: boolean }>;
}

export interface EntityObservation {
  identity: Identity;
  observedAt: string;
  operationId: string;
  source: ProviderRecord;
}
export interface EntityPublication extends EntityObservation {
  derived: Derived | undefined;
  digest: string;
  normalizer: string;
  projection: ReturnType<typeof projectEntity>;
  rulesRevision: string;
}
export type EntityMutation =
  | { kind: "observe"; value: EntityObservation }
  | { kind: "save"; value: EntityPublication };
export interface PreparedEntity {
  classified: number;
  mutation: EntityMutation;
  seenInOperation: boolean;
  state: (typeof EntityChange)[keyof typeof EntityChange];
}
export interface EntityReader {
  read: (identity: Identity) => Promise<
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
  legacyProjection?: FinanceRecord;
  observedAt: string;
  operationId: string;
  parent: FinanceRecord | undefined;
  referenceDay: string;
  renormalize: boolean;
  rulesRevision: string;
  source: ProviderRecord;
}
export interface EntityPreparation {
  evaluate: RuleEngine["evaluate"];
  hash: (value: unknown) => Promise<string>;
  repository: EntityReader;
}
