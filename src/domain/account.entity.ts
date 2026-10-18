import { OperationPhase, OperationStatus } from "./operation.entity";

export const WizardIssue = {
  credentials: "credentials",
  rate: "rate",
  unavailable: "unavailable",
  item: "item",
  connector: "connector",
  session: "session",
  unknown: "unknown",
} as const;

export type WizardIssue = (typeof WizardIssue)[keyof typeof WizardIssue];

export const WizardSyncState = {
  waiting: "waiting",
  working: "working",
  completed: "completed",
  error: "error",
  cancelled: "cancelled",
} as const;
export type WizardSyncState =
  (typeof WizardSyncState)[keyof typeof WizardSyncState];

export interface WizardState {
  credentials: boolean;
  connected: boolean;
  sync: WizardSyncState;
  coverage: { total: number; complete: number };
  paused: boolean;
}

export const AccountSyncOutcome = {
  preparing: "preparing",
  failed: "failed",
  cancelled: "cancelled",
  paused: "paused",
  partial: "partial",
  complete: "complete",
} as const;
export type AccountSyncOutcome =
  (typeof AccountSyncOutcome)[keyof typeof AccountSyncOutcome];

export interface AccountEvidence {
  configured: boolean;
  connected: boolean;
  syncEnabled: boolean;
  latest: { phase: OperationPhase; status: OperationStatus } | null;
  coverage: { total: number; complete: number | null };
}

export function accountState({
  configured,
  connected,
  syncEnabled,
  latest,
  coverage,
}: AccountEvidence): WizardState {
  let sync: WizardState["sync"] = WizardSyncState.waiting;
  if (
    latest?.phase === OperationPhase.error ||
    latest?.status === OperationStatus.failed
  ) {
    sync = WizardSyncState.error;
  } else if (latest) {
    sync = latest.status;
  }
  return {
    credentials: configured,
    connected,
    sync,
    coverage: { total: coverage.total, complete: coverage.complete ?? 0 },
    paused: !syncEnabled && connected,
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
