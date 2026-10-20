import type { AccountMap, Checkpoint, RunStatus } from "../domain";
export interface ConnectionInfo {
  accounts: AccountMap;
  id: string;
  importCheckpoint: Pick<Checkpoint, "accountId" | "phase"> | null;
  importError: string | null;
  importStatus: RunStatus | null;
  lastSuccessAt: string | null;
  nextEligibleAt: string | null;
  partial: boolean;
}
export interface InstallationState {
  connections: ConnectionInfo[];
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
