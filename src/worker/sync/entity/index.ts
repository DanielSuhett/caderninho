import type {
  FinishedOperationStatus,
  Identity,
  MigrationRequest,
  OperationInput,
  OperationKind,
  OperationStatus,
  WebhookEvent,
} from "../../../contracts";
import type {
  CoverageStatus,
  ExecutionPhase,
  FaultCode,
  FinanceRecord,
  ItemAdmission,
  ProviderRecord,
  ReapplicationInput,
  ReapplicationResult,
  Resource,
} from "../../../domain";
import type { Derived, RuleEngine } from "../../../domain/rules";
import type { PreparedEntity } from "../../finance/entity";
import type {
  checkpoints,
  entities,
  inbox,
  items,
  operations,
} from "../../schema";

export type Operation = typeof operations.$inferSelect;
export interface Progress {
  changed: number;
  classified: number;
  duplicates: number;
  errors: number;
  new: number;
  pages: number;
  received: number;
  resources: number;
  unchanged: number;
}
export interface PageCommit {
  cancelled: boolean;
  done: boolean;
  item?: string;
  next?: string | null;
  nextCursor?: string | null;
  parent?: string;
  resource?: string;
}

export function progressWithDefaults(saved: Partial<Progress>): Progress {
  return {
    changed: 0,
    classified: 0,
    duplicates: 0,
    errors: 0,
    new: 0,
    pages: 0,
    received: 0,
    resources: 0,
    unchanged: 0,
    ...saved,
  };
}

export interface OperationHandle {
  id: string;
  status: OperationStatus;
}
export interface WorkflowDispatcher {
  create: (id: string) => Promise<void>;
  status: (id: string) => Promise<string>;
}
export interface SyncRecoveryNotice {
  error: Error;
  operationId?: string;
  phase: "dispatch" | "status" | "schedule";
}
export const WebhookReceipt = {
  changed: "changed",
  noop: "noop",
  unknown: "unknown",
} as const;
export type WebhookReceipt =
  (typeof WebhookReceipt)[keyof typeof WebhookReceipt];
export interface AdmissionResult {
  items: ItemAdmission[];
  operation: Operation | null;
}
export interface LocalReapplication {
  activeRules: string | null;
  after: string[];
  batch: number;
  expectedRevision: number;
  operation: Operation;
}
export interface ReapplicationRepository {
  acquire: (id: string) => Promise<boolean>;
  begin: (input: ReapplicationInput) => Promise<LocalReapplication>;
  commit: (
    run: LocalReapplication,
    changes: { identity: Identity; derived: Derived }[],
    result: ReapplicationResult,
    after: string[],
  ) => Promise<void>;
  receipt: (id: string, batch: number) => Promise<ReapplicationResult | null>;
  release: (id: string) => Promise<void>;
  rules: (revision: string) => Promise<RuleEngine>;
  select: (run: LocalReapplication) => Promise<StoredEntity[]>;
}

export interface ReapplicationObservation {
  batch: (
    run: { operationId: string; batch: number },
    callback: () => Promise<ReapplicationResult>,
  ) => Promise<ReapplicationResult>;
  phase: NonNullable<ExecutionDependencies["observePhase"]>;
}

export interface FinancialSource {
  ids: (account: string, ids: string[]) => Promise<ProviderRecord[]>;
  page: (input: {
    resource: Resource;
    item: string;
    parent: string;
    cursor: string | null;
    floor: string | null;
    connectorId?: string | undefined;
  }) => Promise<{
    records: ProviderRecord[];
    next: string | null;
    total?: number;
  }>;
}
// Durable checkpoints carry plain serializable data, independent of the host SDK.
export type StepValue<T> =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<T extends ReadonlyArray<infer U> ? StepValue<U> : never>
  | { [K in keyof T]: K extends string | number ? StepValue<T[K]> : never };
export interface Steps {
  do: <T extends StepValue<T>>(
    name: string,
    callback: () => Promise<T>,
  ) => Promise<T>;
  sleep: (name: string, duration: string) => Promise<void>;
}
export interface SynchronizationDependencies extends ExecutionDependencies {
  source: () => Promise<FinancialSource>;
}

export interface DueSchedule {
  next_sync_at: string;
  reconcile_after: string;
}
export interface SchedulingStore {
  due: (now: string) => Promise<DueSchedule | null>;
  enqueue: (
    account: DueSchedule,
    kind: typeof OperationKind.sync | typeof OperationKind.reconcile,
    next: string,
    reconcileAfter: string,
  ) => Promise<OperationHandle | null>;
}

export interface OperationState {
  createdAt: string;
  error?: NonNullable<Operation["error"]>;
  id: string;
  result?: NonNullable<Operation["result"]>;
  status: OperationStatus;
  summary: string;
  updatedAt: string;
}
export interface SyncRepository {
  acceptWebhook: (
    event: WebhookEvent,
    receivedAt: string,
  ) => Promise<WebhookReceipt>;
  admit: (
    key: string,
    input: OperationInput,
    now: Date,
  ) => Promise<AdmissionResult>;
  cancel: (id: string) => Promise<void>;
  claim: (id: string) => Promise<boolean>;
  compact: () => Promise<void>;
  fingerprint: (value: unknown) => Promise<string>;
  finish: (
    id: string,
    status: FinishedOperationStatus,
    error: boolean,
  ) => Promise<void>;
  markDispatched: (id: string) => Promise<void>;
  migrationOverlaps: (input: MigrationRequest) => Promise<number>;
  needsDispatch: (id: string) => Promise<boolean>;
  operations: (dispatched: boolean) => Promise<OperationHandle[]>;
  read: (id: string) => Promise<Operation>;
  start: (key: string, input: OperationInput) => Promise<Operation>;
  state: (id: string) => Promise<OperationState>;
  states: (ids: string[]) => Promise<OperationState[]>;
}
export type StoredEntity = typeof entities.$inferSelect;
export type Checkpoint = typeof checkpoints.$inferSelect;
export type ConnectedItem = typeof items.$inferSelect;
export type StoredEvent = typeof inbox.$inferSelect;
export type SourcePage = Awaited<ReturnType<FinancialSource["page"]>>;
export type ParentEntity = Pick<
  StoredEntity,
  "normalized" | "relevant_hash"
> | null;
export type EntityPreparer = (input: {
  identity: Identity;
  source: ProviderRecord;
  parent: FinanceRecord | undefined;
  operation: Pick<
    Operation,
    "id" | "input" | "reference_day" | "rules_revision"
  >;
  engine: RuleEngine;
  observedAt?: string;
  legacyProjection?: FinanceRecord;
}) => Promise<PreparedEntity>;
export interface CollectionIdentity {
  itemId: string;
  operationId: string;
  parentId: string;
  resource: Resource;
}
export interface ExecutionRepository {
  account: (itemId: string, accountId: string) => Promise<FinanceRecord | null>;
  acquire: (id: string) => Promise<boolean>;
  checkpoint: (identity: CollectionIdentity) => Promise<Checkpoint>;
  commitMigration: (
    rows: { prepared: PreparedEntity; sourceKey: string; digest: string }[],
  ) => Promise<void>;
  commitPage: (input: {
    identity: CollectionIdentity;
    key: string;
    prepared: PreparedEntity[];
    progress: Progress;
    page: SourcePage;
    maximum: string | null;
    collected: number;
    parentSignature: string | null;
    deleteMissing: boolean;
    coverageStatus: CoverageStatus;
  }) => Promise<void>;
  commitReapplication: (input: {
    op: Operation;
    key: string;
    changes: { identity: Identity; derived: Derived }[];
    progress: Progress;
    outcome: PageCommit;
  }) => Promise<void>;
  commitResolved: (input: {
    operationId: string;
    itemId: string;
    accountId: string;
    prepared: PreparedEntity[];
    missingIds: string[];
    progress: Progress;
    receipt?: { key: string; outcome: PageCommit; processedIds?: string[] };
  }) => Promise<void>;
  completeEvent: (id: string) => Promise<void>;
  connectionSource: (itemId: string) => Promise<ProviderRecord | null>;
  continuationUsed: (
    identity: CollectionIdentity,
    next: string,
  ) => Promise<boolean>;
  coverage: (
    itemId: string,
    resource: Resource,
    parentId: string,
  ) => Promise<{
    bootstrap_complete: number;
    confirmed_created_at: string | null;
    parent_signature: string | null;
  } | null>;
  createCheckpoint: (
    identity: CollectionIdentity,
    floor: string | null,
  ) => Promise<void>;
  current: (identity: Identity) => Promise<FinanceRecord | null>;
  defer: (id: string, retryAfterSeconds: number) => Promise<void>;
  event: (id: string) => Promise<StoredEvent>;
  eventCursorUsed: (operationId: string, next: string) => Promise<boolean>;
  finish: (
    op: Operation,
    status: FinishedOperationStatus,
    error?: boolean | FaultCode,
  ) => Promise<void>;
  imported: (sourceKey: string, digest: string) => Promise<boolean>;
  items: (ids: string[]) => Promise<ConnectedItem[]>;
  mature: (op: Operation) => Promise<void>;
  parents: (itemId: string, resource: Resource) => Promise<StoredEntity[]>;
  pending: (
    operationId: string,
  ) => Promise<{ item_id: string; parent_id: string; id: string }[]>;
  read: (id: string) => Promise<Operation>;
  reapplicationTargets: (operationId: string) => Promise<StoredEntity[]>;
  receipt: (operationId: string, key: string) => Promise<PageCommit | null>;
  rules: (revision: string) => Promise<RuleEngine>;
  selectPending: (operationId: string, itemIds: string[]) => Promise<void>;
  selectReapplication: (op: Operation) => Promise<void>;
  setCoverage: (
    itemId: string,
    resource: Resource,
    status: CoverageStatus,
  ) => Promise<void>;
  sourceFailure: (
    identity: CollectionIdentity,
    status: CoverageStatus,
    countError: boolean,
  ) => Promise<void>;
}
export interface ExecutionDependencies {
  observePhase?: <T>(
    phase: ExecutionPhase,
    callback: () => Promise<T>,
    detail?: ExecutionPhaseDetail,
  ) => Promise<T>;
  onOutcome?: (outcome: ExecutionOutcome) => void;
  onSourceFailure?: (status: CoverageStatus) => void;
  prepare: EntityPreparer;
  repository: ExecutionRepository;
}

export const ExecutionResult = {
  cancelled: "cancelled",
  completed: "completed",
  deferred: "deferred",
  failed: "failed",
  noop: "noop",
  partial: "partial",
  replayed: "replayed",
} as const;
export type ExecutionResult =
  (typeof ExecutionResult)[keyof typeof ExecutionResult];

export interface ExecutionPhaseDetail {
  outcome?: () => ExecutionResult;
  processed?: number;
  resource?: Resource;
}

export interface ExecutionOutcome {
  error?: Error;
  operationKind?: OperationKind;
  outcome: ExecutionResult;
  phase?: ExecutionPhase;
  progress?: Progress;
}

export { ExecutionPhase } from "../../../domain";
