import type {
  AccountSyncOutcome,
  AdmissionStatus,
  WizardState,
} from "../domain";

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
  freshness?:
    | {
        nextAutomaticAt: string;
        items: {
          id: string;
          lastImportAt: string | null;
          lastAdmissionAt: string | null;
          nextEligibleAt: string | null;
          operationId: string | null;
          status?: AdmissionStatus | undefined;
        }[];
      }
    | undefined;
  items: { id: string }[];
  latest: { status: string; phase: string; updated_at: string } | null;
  localApplications?:
    | { operationId: string; batch: number; totalProcessed: number }[]
    | undefined;
  origin: string;
  panel: AccountPanel;
  status: WizardState;
}
