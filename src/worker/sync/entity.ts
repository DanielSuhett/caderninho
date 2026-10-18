import type {
  FinishedOperationStatus,
  MigrationRequest,
  OperationInput,
  OperationKind,
  OperationStatus,
  WebhookEvent,
} from "@/contracts/operation.types";
import type { Identity } from "@/contracts/queries.types";
import type { CoverageStatus, Resource } from "@/domain/enums";
import type { FinanceRecord } from "@/domain/finance.entity";
import type { ProviderRecord } from "@/domain/provider.entity";
import type { Derived, RuleEngine } from "@/domain/rules";
import type { PreparedEntity } from "@/worker/finance/entity";

import type {
  checkpoints,
  entities,
  inbox,
  items,
  operations,
} from "../schema";

export type Operation = typeof operations.$inferSelect;
export type Progress = {
  pages: number;
  received: number;
  new: number;
  changed: number;
  unchanged: number;
  classified: number;
  resources: number;
  errors: number;
  duplicates: number;
};
export type PageCommit = {
  done: boolean;
  cancelled: boolean;
  next?: string | null;
  nextCursor?: string | null;
  resource?: string;
  parent?: string;
  item?: string;
};

export function progressWithDefaults(saved: Partial<Progress>): Progress {
  return {
    pages: 0,
    received: 0,
    new: 0,
    changed: 0,
    unchanged: 0,
    classified: 0,
    resources: 0,
    errors: 0,
    duplicates: 0,
    ...saved,
  };
}

export interface OperationHandle {
  id: string;
  status: OperationStatus;
}

export interface FinancialSource {
  page(input: {
    resource: Resource;
    item: string;
    parent: string;
    cursor: string | null;
    floor: string | null;
    connectorId?: string | undefined;
  }): Promise<{
    records: ProviderRecord[];
    next: string | null;
    total?: number;
  }>;
  ids(account: string, ids: string[]): Promise<ProviderRecord[]>;
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
  do<T extends StepValue<T>>(
    name: string,
    callback: () => Promise<T>,
  ): Promise<T>;
  sleep(name: string, duration: string): Promise<void>;
}
export interface SynchronizationDependencies extends ExecutionDependencies {
  source(): Promise<FinancialSource>;
}

export interface DueSchedule {
  next_sync_at: string;
  reconcile_after: string;
}
export interface SchedulingStore {
  due(now: string): Promise<DueSchedule | null>;
  enqueue(
    account: DueSchedule,
    kind: typeof OperationKind.sync | typeof OperationKind.reconcile,
    next: string,
    reconcileAfter: string,
  ): Promise<OperationHandle | null>;
}

export interface OperationState {
  id: string;
  status: OperationStatus;
  createdAt: string;
  updatedAt: string;
  summary: string;
  result?: NonNullable<Operation["result"]>;
  error?: NonNullable<Operation["error"]>;
}
export interface SyncRepository {
  markDispatched(id: string): Promise<void>;
  needsDispatch(id: string): Promise<boolean>;
  operations(dispatched: boolean): Promise<OperationHandle[]>;
  inbox(): Promise<{ event_id: string; item_id: string }[]>;
  linkEvent(eventId: string, id: string): Promise<void>;
  start(key: string, input: OperationInput): Promise<Operation>;
  read(id: string): Promise<Operation>;
  state(id: string): Promise<OperationState>;
  states(ids: string[]): Promise<OperationState[]>;
  compact(): Promise<void>;
  finish(
    id: string,
    status: FinishedOperationStatus,
    error: boolean,
  ): Promise<void>;
  cancel(id: string): Promise<void>;
  acceptWebhook(event: WebhookEvent, receivedAt: string): Promise<boolean>;
  migrationOverlaps(input: MigrationRequest): Promise<number>;
  fingerprint(value: unknown): Promise<string>;
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
  operationId: string;
  itemId: string;
  resource: Resource;
  parentId: string;
}
export interface ExecutionRepository {
  read(id: string): Promise<Operation>;
  items(ids: string[]): Promise<ConnectedItem[]>;
  rules(revision: string): Promise<RuleEngine>;
  acquire(id: string): Promise<boolean>;
  mature(op: Operation): Promise<void>;
  finish(
    op: Operation,
    status: FinishedOperationStatus,
    error?: boolean,
  ): Promise<void>;
  receipt(operationId: string, key: string): Promise<PageCommit | null>;
  checkpoint(identity: CollectionIdentity): Promise<Checkpoint>;
  connectionSource(itemId: string): Promise<ProviderRecord | null>;
  parents(itemId: string, resource: Resource): Promise<StoredEntity[]>;
  coverage(
    itemId: string,
    resource: Resource,
    parentId: string,
  ): Promise<{
    bootstrap_complete: number;
    confirmed_created_at: string | null;
    parent_signature: string | null;
  } | null>;
  setCoverage(
    itemId: string,
    resource: Resource,
    status: CoverageStatus,
  ): Promise<void>;
  sourceFailure(
    identity: CollectionIdentity,
    status: CoverageStatus,
    countError: boolean,
  ): Promise<void>;
  createCheckpoint(
    identity: CollectionIdentity,
    floor: string | null,
  ): Promise<void>;
  continuationUsed(
    identity: CollectionIdentity,
    next: string,
  ): Promise<boolean>;
  eventCursorUsed(operationId: string, next: string): Promise<boolean>;
  commitPage(input: {
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
  }): Promise<void>;
  event(id: string): Promise<StoredEvent>;
  completeEvent(id: string): Promise<void>;
  account(itemId: string, accountId: string): Promise<FinanceRecord | null>;
  commitResolved(input: {
    operationId: string;
    itemId: string;
    accountId: string;
    prepared: PreparedEntity[];
    missingIds: string[];
    progress: Progress;
    receipt?: { key: string; outcome: PageCommit; processedIds?: string[] };
  }): Promise<void>;
  selectPending(operationId: string, itemIds: string[]): Promise<void>;
  pending(
    operationId: string,
  ): Promise<{ item_id: string; parent_id: string; id: string }[]>;
  selectReapplication(op: Operation): Promise<void>;
  reapplicationTargets(operationId: string): Promise<StoredEntity[]>;
  commitReapplication(input: {
    op: Operation;
    key: string;
    changes: { identity: Identity; derived: Derived }[];
    progress: Progress;
    outcome: PageCommit;
  }): Promise<void>;
  imported(sourceKey: string, digest: string): Promise<boolean>;
  current(identity: Identity): Promise<FinanceRecord | null>;
  commitMigration(
    rows: { prepared: PreparedEntity; sourceKey: string; digest: string }[],
  ): Promise<void>;
}
export interface ExecutionDependencies {
  repository: ExecutionRepository;
  prepare: EntityPreparer;
}
