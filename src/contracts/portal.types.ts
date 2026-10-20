import type { AccountMap, RunStatus } from "../domain";
export interface ConnectionInfo {
  accounts: AccountMap;
  id: string;
  lastAdmittedAt: string | null;
  lastSuccessAt: string | null;
  name: string;
  nextImportAt: string | null;
  observedAt: string;
  partial: boolean;
  status: string;
}
export interface RunInfo {
  connectionId: string;
  createdAt: string;
  error: string | null;
  id: string;
  records: number;
  status: RunStatus;
  updatedAt: string;
}
export interface InstallationState {
  connections: ConnectionInfo[];
  enabled: boolean;
  runs: RunInfo[];
}
export interface PortalResponse extends InstallationState {
  configured: boolean;
  csrf: string;
  origin: string;
}
export interface AccountConnectToken {
  accessToken: string;
  configuration: {
    connectorIds: number[];
    includeSandbox: boolean;
    selectedConnectorId: number;
  };
}
export const PortalIssue = { session: "session", unknown: "unknown" } as const;
