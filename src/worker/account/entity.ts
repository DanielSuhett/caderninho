import type {
  OperationPhase,
  OperationStatus,
} from "@/contracts/operation.types";
import { type AccountPanel, AccountStep } from "@/contracts/portal.types";
import {
  WizardIssue,
  type WizardState,
  WizardSyncState,
} from "@/contracts/wizard.types";
import { accountSyncOutcome } from "@/domain/account.entity";
import { PERSONAL_CONNECTOR_ID } from "@/domain/connection.entity";
import { FaultCode } from "@/domain/enums";

export interface AccountSource {
  readonly configured: boolean;
  application(): Promise<{
    readItem(
      itemId: string,
    ): Promise<{ id: string; connector?: { id: number | string } }>;
    token(itemId?: string): Promise<{ accessToken: string }>;
  }>;
}

export interface AccountRepository {
  connection: {
    connectionCount(
      itemId: string,
    ): Promise<{ count: number; exists: boolean }>;
    connect(itemId: string, now: string): Promise<void>;
  };
  status(): Promise<{
    config: { sync_enabled: number; connected_at: string };
    latest: {
      status: OperationStatus;
      phase: OperationPhase;
      updated_at: string;
    } | null;
    items: { id: string }[];
    coverage: { total: number; complete: number | null };
  }>;
  pause(): Promise<void>;
  resume(now: string): Promise<void>;
  requestSync(now: Date): Promise<boolean>;
}

export function accountPanel(state: WizardState): AccountPanel {
  const active =
    state.sync === WizardSyncState.waiting ||
    state.sync === WizardSyncState.working;
  return {
    initialStep: state.connected ? AccountStep.assistant : AccountStep.connect,
    sync: accountSyncOutcome(state),
    polling:
      state.connected && !state.paused && active
        ? { intervalMs: 5000, retryIntervalMs: 30000 }
        : null,
    support: {
      // Explicit allowlist: no names, credentials, identifiers or provider messages.
      diagnostic: {
        credentials: state.credentials,
        connected: state.connected,
        sync: state.sync,
        paused: state.paused,
        coverage: {
          total: state.coverage.total,
          complete: state.coverage.complete,
        },
        issue: null,
      },
      connectorId: PERSONAL_CONNECTOR_ID,
    },
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
