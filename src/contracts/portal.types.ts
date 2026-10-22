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
  personId?: string | undefined;
  personName?: string | undefined;
  profileId?: string | undefined;
  profileName?: string | undefined;
}
export interface InstallationState {
  connections: ConnectionInfo[];
}
export interface PortalResponse extends InstallationState {
  configured: boolean;
  csrf: string;
  origin: string;
  people: { id: string; name: string }[];
  profiles: {
    id: string;
    name: string;
    personId: string;
    enabled: boolean;
    configured: boolean;
    connectionCount: number;
  }[];
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
