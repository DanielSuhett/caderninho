import type { CollectionStatusType, RunStatus } from "../domain";
export interface ConnectionInfo {
  id: string;
  lastAdmittedAt: string | null;
  lastSuccessAt: string | null;
  name: string;
  nextImportAt: string | null;
  observedAt: string;
  status: string;
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
  accounts: AccountInfo[];
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
