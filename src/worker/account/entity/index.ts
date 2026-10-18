import type { OperationPhase, OperationStatus } from "../../../contracts";
import {
  type AccountPanel,
  AccountStep,
  WizardIssue,
  type WizardState,
  WizardSyncState,
} from "../../../contracts";
import {
  accountSyncOutcome,
  FaultCode,
  PERSONAL_CONNECTOR_ID,
} from "../../../domain";

export interface AccountSource {
  application: () => Promise<{
    readItem: (
      itemId: string,
    ) => Promise<{ id: string; connector?: { id: number | string } }>;
    token: (itemId?: string) => Promise<{ accessToken: string }>;
  }>;
  readonly configured: boolean;
}

export interface AccountRepository {
  connection: {
    connectionCount: (
      itemId: string,
    ) => Promise<{ count: number; exists: boolean }>;
    connect: (itemId: string, now: string) => Promise<void>;
  };
  pause: () => Promise<void>;
  requestSync: (now: Date) => Promise<boolean>;
  resume: (now: string) => Promise<void>;
  status: () => Promise<{
    localApplications: {
      operationId: string;
      batch: number;
      totalProcessed: number;
    }[];
    config: { sync_enabled: number; connected_at: string };
    latest: {
      status: OperationStatus;
      phase: OperationPhase;
      updated_at: string;
      dispatched: number;
    } | null;
    items: {
      id: string;
      last_import_at: string | null;
      next_import_at: string | null;
      last_admitted_at: string | null;
      cycle_id: string | null;
    }[];
    coverage: { total: number; complete: number | null };
  }>;
}

export function accountPanel(
  state: WizardState,
  dispatched = true,
): AccountPanel {
  const active = state.sync === WizardSyncState.working;
  return {
    initialStep: state.connected ? AccountStep.assistant : AccountStep.connect,
    polling:
      state.connected && !state.paused && active && dispatched
        ? { intervalMs: 5000, retryIntervalMs: 30_000 }
        : null,
    support: {
      connectorId: PERSONAL_CONNECTOR_ID,
      // Explicit allowlist: no names, credentials, identifiers or provider messages.
      diagnostic: {
        connected: state.connected,
        coverage: {
          complete: state.coverage.complete,
          total: state.coverage.total,
        },
        credentials: state.credentials,
        issue: null,
        paused: state.paused,
        sync: state.sync,
      },
    },
    sync: accountSyncOutcome(state),
  };
}

const issuesByCode = new Map<string, WizardIssue>([
  [FaultCode.UPSTREAM_AUTH, WizardIssue.credentials],
  [FaultCode.UPSTREAM_FORBIDDEN, WizardIssue.credentials],
  ["PLUGGY_ACCOUNT_NOT_CONFIGURED", WizardIssue.credentials],
  [FaultCode.UPSTREAM_RATE_LIMIT, WizardIssue.rate],
  ["CONNECT_RATE_LIMIT", WizardIssue.rate],
  ["MEU_PLUGGY_REQUIRED", WizardIssue.connector],
  ["SOURCE_IDENTITY_MISMATCH", WizardIssue.item],
  [FaultCode.UPSTREAM_NOT_FOUND, WizardIssue.item],
  ["ITEM_LIMIT", WizardIssue.item],
  [FaultCode.UPSTREAM_ERROR, WizardIssue.unavailable],
  ["CONNECT_TOKEN_FAILED", WizardIssue.unavailable],
  [FaultCode.UPSTREAM_TIMEOUT, WizardIssue.unavailable],
  ["UPSTREAM_NETWORK", WizardIssue.unavailable],
  [FaultCode.UPSTREAM_UNAVAILABLE, WizardIssue.unavailable],
]);

export function wizardIssue(error: Error): WizardIssue {
  const code = "code" in error ? String(error.code) : error.message;
  return issuesByCode.get(code) ?? WizardIssue.unknown;
}
