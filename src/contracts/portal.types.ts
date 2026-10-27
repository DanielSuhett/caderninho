import type { AccountMap, Checkpoint, Person, RunStatus } from "../domain";
export const AccountFailureCode = {
  APPLICATION_CHANGE_REQUIRES_NEW_PROFILE:
    "APPLICATION_CHANGE_REQUIRES_NEW_PROFILE",
  CREDENTIALS_REQUIRED: "CREDENTIALS_REQUIRED",
  NOT_FOUND: "NOT_FOUND",
  PROFILE_DISABLED: "PROFILE_DISABLED",
  PROFILE_EXISTS: "PROFILE_EXISTS",
  PROFILE_OWNER_IMMUTABLE: "PROFILE_OWNER_IMMUTABLE",
  SOURCE_IDENTITY_MISMATCH: "SOURCE_IDENTITY_MISMATCH",
  UPSTREAM_AUTH: "UPSTREAM_AUTH",
  UPSTREAM_FORBIDDEN: "UPSTREAM_FORBIDDEN",
  UPSTREAM_RATE_LIMIT: "UPSTREAM_RATE_LIMIT",
  UPSTREAM_TIMEOUT: "UPSTREAM_TIMEOUT",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
} as const;
export type AccountFailureCode =
  (typeof AccountFailureCode)[keyof typeof AccountFailureCode];
export interface ConnectionInfo {
  accounts: AccountMap;
  hasTransactions?: boolean | undefined;
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
  people: Person[];
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
