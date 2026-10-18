import { AccountType, CoverageStatus, FaultCode, Resource } from "./enums";
import type { FinanceRecord } from "./finance.entity";
import type { Filter } from "./query.entity";

export const MigrationPolicy = {
  refuse_conflicts: "refuse-conflicts",
  keep_current: "keep-current",
  prefer_bundle: "prefer-bundle",
} as const;
export type MigrationPolicy =
  (typeof MigrationPolicy)[keyof typeof MigrationPolicy];

export const OperationKind = {
  sync: "sync",
  reconcile: "reconcile",
  reapply: "reapply",
  webhook: "webhook",
  migration: "migration",
} as const;
export type OperationKind = (typeof OperationKind)[keyof typeof OperationKind];
export type LongOperationKind =
  | typeof OperationKind.sync
  | typeof OperationKind.reconcile
  | typeof OperationKind.reapply;

export const OperationStatus = {
  working: "working",
  completed: "completed",
  cancelled: "cancelled",
  failed: "failed",
} as const;
export type OperationStatus =
  (typeof OperationStatus)[keyof typeof OperationStatus];
export type FinishedOperationStatus =
  | typeof OperationStatus.completed
  | typeof OperationStatus.cancelled;

export const OperationPhase = {
  queued: "queued",
  matured: "matured",
  checkpoint: "checkpoint",
  pending_selected: "pending-selected",
  selected: "selected",
  reapply: "reapply",
  resolve_changes: "resolve-changes",
  event_resolved: "event-resolved",
  completed: "completed",
  cancelled: "cancelled",
  error: "error",
} as const;
export type OperationPhase =
  | (typeof OperationPhase)[keyof typeof OperationPhase]
  | Resource;

export const WebhookEventType = {
  transactions_created: "transactions/created",
  transactions_updated: "transactions/updated",
  transactions_deleted: "transactions/deleted",
} as const;
export type WebhookEventType =
  (typeof WebhookEventType)[keyof typeof WebhookEventType];

export interface MigrationRow {
  sourceKey: string;
  readAt: string;
  resource: Resource;
  parentId: string;
  record: FinanceRecord;
}

export interface OperationSelection {
  itemIds: string[];
  filter?: Filter | undefined;
  renormalize?: boolean | undefined;
}

export type OperationInput = OperationSelection &
  (
    | { kind: typeof OperationKind.sync }
    | { kind: typeof OperationKind.reconcile }
    | { kind: typeof OperationKind.reapply }
    | { kind: typeof OperationKind.webhook; eventId: string }
    | {
        kind: typeof OperationKind.migration;
        migration: MigrationRow[];
        migrationPolicy?: MigrationPolicy | undefined;
      }
  );

export interface MigrationRequest {
  itemId: string;
  rows: MigrationRow[];
  policy: MigrationPolicy;
  apply: boolean;
}

export interface WebhookEvent {
  [field: string]: unknown;
  eventId: string;
  event: WebhookEventType;
  itemId: string;
  accountId: string;
  transactionIds?: string[] | undefined;
  transactionsCreatedAtFrom?: string | undefined;
}

export const MigrationDecision = {
  import: "import",
  keep: "keep",
  refuse: "refuse",
} as const;

export function migrationDecision({
  conflicting,
  policy,
}: {
  conflicting: boolean;
  policy: MigrationPolicy | undefined;
}) {
  if (!conflicting) {
    return MigrationDecision.import;
  }
  if (!policy || policy === MigrationPolicy.refuse_conflicts) {
    return MigrationDecision.refuse;
  }
  return policy === MigrationPolicy.keep_current
    ? MigrationDecision.keep
    : MigrationDecision.import;
}

export function assertOperationInput(input: OperationInput) {
  if (input.kind !== OperationKind.reapply && input.filter) {
    throw new Error("SYNC_FILTER_NOT_SUPPORTED_USE_ITEM_SCOPE");
  }
  if (input.renormalize && input.kind !== OperationKind.reconcile) {
    throw new Error("RENORMALIZE_REQUIRES_RECONCILIATION");
  }
}

export function assertIdempotency({
  expected,
  actual,
}: {
  expected: string;
  actual: string;
}) {
  if (expected !== actual) {
    throw new Error("IDEMPOTENCY_CONFLICT");
  }
}

export function assertWebhookEvent(event: WebhookEvent) {
  if (
    event.event === WebhookEventType.transactions_created &&
    !event.transactionsCreatedAtFrom
  ) {
    throw new Error("MISSING_CREATION_FLOOR");
  }
  if (
    event.event !== WebhookEventType.transactions_created &&
    !event.transactionIds?.length
  ) {
    throw new Error("MISSING_TRANSACTION_IDS");
  }
}

export const SYNC_POLICY = {
  intervalMs: 86400000,
  reconciliationIntervalMs: 7 * 86400000,
  manualIntervalMs: 900000,
} as const;

export function nextSyncSchedule({
  now,
  reconcileAfter,
}: {
  now: Date;
  reconcileAfter: string;
}) {
  const reconcile = reconcileAfter <= now.toISOString();
  return {
    kind: reconcile ? OperationKind.reconcile : OperationKind.sync,
    next: new Date(now.getTime() + SYNC_POLICY.intervalMs).toISOString(),
    reconcileAfter: reconcile
      ? new Date(
          now.getTime() + SYNC_POLICY.reconciliationIntervalMs,
        ).toISOString()
      : reconcileAfter,
  };
}

export function transactionCreationFloor({
  resource,
  kind,
  coverage,
}: {
  resource: Resource;
  kind: OperationKind;
  coverage: { complete: boolean; confirmedCreatedAt: string | null } | null;
}) {
  if (
    resource !== Resource.transactions ||
    kind !== OperationKind.sync ||
    !coverage?.complete
  ) {
    return null;
  }
  if (!coverage.confirmedCreatedAt) {
    throw new Error("CREATION_CHECKPOINT_MISSING_RECONCILE_REQUIRED");
  }
  return coverage.confirmedCreatedAt;
}

export function resourceParentAllowed({
  resource,
  parentType,
}: {
  resource: Resource;
  parentType: string | null | undefined;
}) {
  return resource !== Resource.bills || parentType === AccountType.CREDIT;
}

export function deleteMissingAfterPage({
  resource,
  kind,
  next,
}: {
  resource: Resource;
  kind: OperationKind;
  next: string | null;
}) {
  if (next) {
    return false;
  }
  return (
    kind === OperationKind.reconcile ||
    (resource !== Resource.transactions &&
      resource !== Resource.investment_transactions)
  );
}

export function pageCoverage({
  next,
  records,
  previousPages,
}: {
  next: string | null;
  records: number;
  previousPages: number;
}): CoverageStatus {
  if (next) {
    return CoverageStatus.partial;
  }
  return records || previousPages
    ? CoverageStatus.available
    : CoverageStatus.empty;
}

export function sourceFailureCoverage(code: string): CoverageStatus {
  if (code === FaultCode.UPSTREAM_FORBIDDEN) {
    return CoverageStatus.not_authorized;
  }
  if (code === FaultCode.UPSTREAM_NOT_FOUND) {
    return CoverageStatus.unavailable;
  }
  return CoverageStatus.partial;
}

export function assertSourceTotal({
  expected,
  actual,
}: {
  expected: number | null;
  actual: number | undefined;
}) {
  if (expected !== null && actual !== expected) {
    throw new Error("SOURCE_TOTAL_CHANGED_RECONCILE_REQUIRED");
  }
}

export function assertCollectionComplete({
  total,
  collected,
  next,
}: {
  total: number | undefined;
  collected: number;
  next: string | null;
}) {
  if (!next && total !== undefined && collected !== total) {
    throw new Error("SOURCE_PAGE_COUNT_INCOMPLETE");
  }
}

export function latestCreatedAt({
  maximum,
  created,
}: {
  maximum: string | null;
  created: string | undefined | null;
}) {
  if (!created) {
    return maximum;
  }
  const canonical = new Date(created).toISOString();
  return !maximum || canonical > maximum ? canonical : maximum;
}
