import { AccountSyncOutcome } from "@/domain/account.entity";

import type { WizardState } from "./wizard.types";

export { AccountSyncOutcome };

export const AccountStep = { connect: 1, assistant: 2 } as const;
export type AccountStep = (typeof AccountStep)[keyof typeof AccountStep];

export interface AccountDiagnostic extends WizardState {
  issue: null;
}

export interface AccountPanel {
  initialStep: AccountStep;
  sync: AccountSyncOutcome;
  polling: { intervalMs: number; retryIntervalMs: number } | null;
  support: { diagnostic: AccountDiagnostic; connectorId: number };
}

export interface ConnectConfiguration {
  connectorIds: number[];
  selectedConnectorId: number;
  includeSandbox: boolean;
}

export interface AccountConnectToken {
  accessToken: string;
  configuration: ConnectConfiguration;
}

export interface InstallationChecks {
  database: boolean;
  workflow: boolean;
  oauth: boolean;
  migrations: boolean;
}

export interface AccountResponse {
  status: WizardState;
  panel: AccountPanel;
  checks: InstallationChecks;
  items: { id: string }[];
  latest: { status: string; phase: string; updated_at: string } | null;
  csrf: string;
  origin: string;
  checkedAt: string;
}
