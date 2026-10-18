import { OperationPhase, OperationStatus } from "#contracts/operation.types.ts";
import type { InstallationChecks } from "#contracts/portal.types.ts";
import { type WizardState, WizardSyncState } from "#contracts/wizard.types.ts";
import {
  isPersonalConnector,
  MAX_PERSONAL_CONNECTIONS,
} from "#domain/connection-policy.ts";
import type { AccountSource } from "#worker/account/account.types.ts";
import type {
  createAccountRepository,
  readPortalStatus,
} from "#worker/account/repository.ts";

export function wizardState(
  evidence: Awaited<ReturnType<typeof readPortalStatus>>,
  configured: boolean,
): WizardState {
  const { config, latest, items, coverage } = evidence;
  const connected = !!items.length;
  let sync: WizardState["sync"] = WizardSyncState.waiting;
  if (
    latest?.phase === OperationPhase.error ||
    latest?.status === OperationStatus.failed
  ) {
    sync = WizardSyncState.error;
  } else if (latest) {
    sync = latest.status;
  }
  return {
    credentials: configured,
    connected,
    sync,
    coverage: { total: coverage.total, complete: coverage.complete ?? 0 },
    paused: config.sync_enabled === 0 && connected,
  };
}

interface AccountDependencies {
  repository: ReturnType<typeof createAccountRepository>;
  source: AccountSource;
  disconnectAssistants(): Promise<void>;
  installation(): Promise<InstallationChecks>;
  now(): Date;
}

export function createAccountService(deps: AccountDependencies) {
  return {
    async state() {
      const [evidence, checks] = await Promise.all([
        deps.repository.status(),
        deps.installation(),
      ]);
      return {
        status: wizardState(evidence, deps.source.configured),
        checks,
        items: evidence.items,
        latest: evidence.latest,
        checkedAt: deps.now().toISOString(),
      };
    },
    async wizardState() {
      return wizardState(
        await deps.repository.status(),
        deps.source.configured,
      );
    },
    async connectItem(itemId: string) {
      const application = await deps.source.application();
      const access = await deps.repository.connection.itemAccess(itemId);
      if (access.count >= MAX_PERSONAL_CONNECTIONS && !access.exists) {
        throw new Error("ITEM_LIMIT");
      }
      const item = await application.readItem(itemId);
      if (!isPersonalConnector(item.connector?.id)) {
        throw new Error("MEU_PLUGGY_REQUIRED");
      }
      await deps.repository.connection.connect(
        itemId,
        application.clientId,
        deps.now().toISOString(),
      );
    },
    async token(itemId?: string) {
      if (itemId) {
        await deps.repository.authorizeItems([itemId]);
      }
      return (await deps.source.application()).token(itemId);
    },
    pause: () => deps.repository.pause(),
    async resume() {
      await deps.source.application();
      await deps.repository.resume(deps.now().toISOString());
    },
    requestSync: () => deps.repository.requestSync(deps.now()),
    disconnectAssistants: () => deps.disconnectAssistants(),
  };
}
