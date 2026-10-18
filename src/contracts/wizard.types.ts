export const WizardIssue = {
  credentials: "credentials",
  application: "application",
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
