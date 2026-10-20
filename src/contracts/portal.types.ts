import type { Checkpoint, CollectionStatusType, RunStatus } from "../domain";
export interface ConnectionInfo {
  id: string;
  importCheckpoint: Pick<Checkpoint, "accountId" | "phase"> | null;
  importError: string | null;
  importStatus: RunStatus | null;
  lastSuccessAt: string | null;
  nextEligibleAt: string | null;
}
export interface AccountInfo {
  balanceMinor: string | null;
  collectionStatus: CollectionStatusType;
  connectionId: string;
  currency: string;
  error: string | null;
  id: string;
  lastAttemptAt: string | null;
  lastCompletedFrom: string | null;
  lastCompletedTo: string | null;
  lastSuccessAt: string | null;
  name: string;
  observedAt: string;
  observedFrom: string | null;
  observedTo: string | null;
  sourceUpdatedAt: string | null;
  type: "BANK" | "CREDIT";
}
export interface InstallationState {
  accounts: AccountInfo[];
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
