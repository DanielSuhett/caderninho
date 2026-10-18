import type { AccountSyncOutcome, WizardState } from "../domain";

export const AccountStep = { assistant: 2, connect: 1 } as const;
export type AccountStep = (typeof AccountStep)[keyof typeof AccountStep];

export interface AccountDiagnostic extends WizardState {
  issue: null;
}

export interface AccountPanel {
  initialStep: AccountStep;
  polling: { intervalMs: number; retryIntervalMs: number } | null;
  support: { diagnostic: AccountDiagnostic; connectorId: number };
  sync: AccountSyncOutcome;
}

export interface ConnectConfiguration {
  connectorIds: number[];
  includeSandbox: boolean;
  selectedConnectorId: number;
}

export interface AccountConnectToken {
  accessToken: string;
  configuration: ConnectConfiguration;
}

export interface InstallationChecks {
  database: boolean;
  migrations: boolean;
  oauth: boolean;
  workflow: boolean;
}

export interface AccountResponse {
  checkedAt: string;
  checks: InstallationChecks;
  csrf: string;
  items: { id: string }[];
  latest: { status: string; phase: string; updated_at: string } | null;
  origin: string;
  panel: AccountPanel;
  status: WizardState;
}
