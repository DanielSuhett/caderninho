import { OperationPhase, OperationStatus } from "./operation.entity";

export const WizardIssue = {
  connector: "connector",
  credentials: "credentials",
  item: "item",
  rate: "rate",
  session: "session",
  unavailable: "unavailable",
  unknown: "unknown",
} as const;

export type WizardIssue = (typeof WizardIssue)[keyof typeof WizardIssue];

export const WizardSyncState = {
  cancelled: "cancelled",
  completed: "completed",
  error: "error",
  waiting: "waiting",
  working: "working",
} as const;
export type WizardSyncState =
  (typeof WizardSyncState)[keyof typeof WizardSyncState];

export interface WizardState {
  connected: boolean;
  coverage: { total: number; complete: number };
  credentials: boolean;
  paused: boolean;
  sync: WizardSyncState;
}

export const AccountSyncOutcome = {
  cancelled: "cancelled",
  complete: "complete",
  failed: "failed",
  partial: "partial",
  paused: "paused",
  preparing: "preparing",
} as const;
export type AccountSyncOutcome =
  (typeof AccountSyncOutcome)[keyof typeof AccountSyncOutcome];

export interface AccountEvidence {
  configured: boolean;
  connected: boolean;
  coverage: { total: number; complete: number | null };
  latest: { phase: OperationPhase; status: OperationStatus } | null;
  syncEnabled: boolean;
}

export function accountState({
  configured,
  connected,
  syncEnabled,
  latest,
  coverage,
}: AccountEvidence): WizardState {
  const sync =
    latest?.phase === OperationPhase.error ||
    latest?.status === OperationStatus.failed
      ? WizardSyncState.error
      : (latest?.status ?? WizardSyncState.waiting);
  return {
    connected,
    coverage: { complete: coverage.complete ?? 0, total: coverage.total },
    credentials: configured,
    paused: !syncEnabled && connected,
    sync,
  };
}

export function accountSyncOutcome(state: WizardState): AccountSyncOutcome {
  if (state.sync === WizardSyncState.error) {
    return AccountSyncOutcome.failed;
  }
  if (state.sync === WizardSyncState.cancelled) {
    return AccountSyncOutcome.cancelled;
  }
  if (state.paused && state.sync !== WizardSyncState.working) {
    return AccountSyncOutcome.paused;
  }
  if (state.sync !== WizardSyncState.completed) {
    return AccountSyncOutcome.preparing;
  }
  if (
    !state.coverage.total ||
    state.coverage.complete !== state.coverage.total
  ) {
    return AccountSyncOutcome.partial;
  }
  return AccountSyncOutcome.complete;
}
