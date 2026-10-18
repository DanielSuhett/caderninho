import type { Resource } from "#domain/enums.ts";
import type { Filter } from "#domain/filter.types.ts";
import type { FinanceRecord } from "#domain/finance.types.ts";

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

export interface OperationScope {
  itemIds: string[];
  filter?: Filter | undefined;
  renormalize?: boolean | undefined;
}

export type OperationInput = OperationScope &
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
