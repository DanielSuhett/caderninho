import { AccountType, CoverageStatus, FaultCode, Resource } from "./enums";
import type { FinanceRecord } from "./finance.entity";
import type { Filter } from "./query.entity";

export const MigrationPolicy = {
  keep_current: "keep-current",
  prefer_bundle: "prefer-bundle",
  refuse_conflicts: "refuse-conflicts",
} as const;
export type MigrationPolicy =
  (typeof MigrationPolicy)[keyof typeof MigrationPolicy];

export const OperationKind = {
  migration: "migration",
  reapply: "reapply",
  reconcile: "reconcile",
  sync: "sync",
  webhook: "webhook",
} as const;
export type OperationKind = (typeof OperationKind)[keyof typeof OperationKind];
export type LongOperationKind =
  | typeof OperationKind.sync
  | typeof OperationKind.reconcile
  | typeof OperationKind.reapply;

export const ExecutionPhase = {
  acquire: "acquire",
  collect: "collect",
  complete: "complete",
  mature: "mature",
  process: "process",
  publish: "publish",
  select: "select",
} as const;
export type ExecutionPhase =
  (typeof ExecutionPhase)[keyof typeof ExecutionPhase];

export const OperationStatus = {
  cancelled: "cancelled",
  completed: "completed",
  failed: "failed",
  working: "working",
} as const;
export type OperationStatus =
  (typeof OperationStatus)[keyof typeof OperationStatus];
export type FinishedOperationStatus =
  | typeof OperationStatus.completed
  | typeof OperationStatus.cancelled;

export const OperationPhase = {
  cancelled: "cancelled",
  checkpoint: "checkpoint",
  completed: "completed",
  error: "error",
  event_resolved: "event-resolved",
  matured: "matured",
  pending_selected: "pending-selected",
  queued: "queued",
  reapply: "reapply",
  resolve_changes: "resolve-changes",
  selected: "selected",
} as const;
export type OperationPhase =
  | (typeof OperationPhase)[keyof typeof OperationPhase]
  | Resource;

export const WebhookEventType = {
  transactions_created: "transactions/created",
  transactions_deleted: "transactions/deleted",
  transactions_updated: "transactions/updated",
} as const;
export type WebhookEventType =
  (typeof WebhookEventType)[keyof typeof WebhookEventType];

export interface MigrationRow {
  parentId: string;
  readAt: string;
  record: FinanceRecord;
  resource: Resource;
  sourceKey: string;
}

export interface OperationSelection {
  filter?: Filter | undefined;
  itemIds: string[];
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
  apply: boolean;
  itemId: string;
  policy: MigrationPolicy;
  rows: MigrationRow[];
}

export interface WebhookEvent {
  accountId: string;
  event: WebhookEventType;
  eventId: string;
  itemId: string;
  transactionIds?: string[] | undefined;
  transactionsCreatedAtFrom?: string | undefined;
  [field: string]: unknown;
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
  intervalMs: 86_400_000,
  reconciliationIntervalMs: 7 * 86_400_000,
} as const;

export const AdmissionStatus = {
  cooldown: "cooldown",
  eligible: "eligible",
  paused: "paused",
  started: "started",
  working: "working",
} as const;
export type AdmissionStatus =
  (typeof AdmissionStatus)[keyof typeof AdmissionStatus];
export interface ItemAdmission {
  itemId: string;
  nextEligibleAt: string | null;
  operationId: string | null;
  status: AdmissionStatus;
}
export interface ReapplicationInput extends OperationSelection {
  batches?: boolean | undefined;
  continuation?: { operationId: string; batch: number } | undefined;
  requestKey: string;
}
export interface ReapplicationResult {
  continuation: { operationId: string; batch: number } | null;
  operationId: string;
  processed: number;
  status: "completed" | "partial";
  totalProcessed: number;
}

export function nextAutomaticAttempt(now: Date) {
  const next = new Date(now);
  next.setUTCHours(9, 0, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

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
