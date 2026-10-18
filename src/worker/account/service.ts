import { z } from "zod/v4";

import type { InstallationChecks } from "#contracts/portal-contract.ts";
import type { WizardState } from "#contracts/wizard-contract.ts";
import {
  isPersonalConnector,
  MAX_PERSONAL_CONNECTIONS,
} from "#domain/connection-policy.ts";
import type { Credentials } from "#domain/pluggy-credentials.ts";
import type {
  createAccountRepository,
  readPortalStatus,
} from "#worker/account/repository.ts";

export interface ConnectionSource {
  readItem(
    credentials: Credentials,
    itemId: string,
  ): Promise<{ id: string; connector?: { id: number | string } }>;
}

export function wizardState(
  evidence: Awaited<ReturnType<typeof readPortalStatus>>,
  configured: boolean,
): WizardState {
  const { config, latest, items, coverage } = evidence;
  let sync: WizardState["sync"] = "waiting";
  if (latest?.phase === "error" || latest?.status === "failed") {
    sync = "error";
  } else if (latest) {
    sync = latest.status;
  }
  return {
    credentials: configured,
    connected: items.length > 0,
    sync,
    coverage: { total: coverage.total, complete: coverage.complete ?? 0 },
    paused: config.sync_enabled === 0 && items.length > 0,
  };
}

interface AccountDependencies {
  repository: ReturnType<typeof createAccountRepository>;
  source: ConnectionSource;
  configured(): boolean;
  credentials(): Promise<Credentials>;
  connectToken(
    credentials: Credentials,
    itemId?: string,
  ): Promise<{ accessToken: string }>;
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
        status: wizardState(evidence, deps.configured()),
        checks,
        items: evidence.items,
        latest: evidence.latest,
        checkedAt: deps.now().toISOString(),
      };
    },
    async wizardState() {
      return wizardState(await deps.repository.status(), deps.configured());
    },
    async connectItem(itemId: string) {
      const id = z.uuid().parse(itemId),
        credentials = await deps.credentials();
      const access = await deps.repository.connection.itemAccess(id);
      if (access.count >= MAX_PERSONAL_CONNECTIONS && !access.exists) {
        throw new Error("ITEM_LIMIT");
      }
      const item = await deps.source.readItem(credentials, id);
      if (!isPersonalConnector(item.connector?.id)) {
        throw new Error("MEU_PLUGGY_REQUIRED");
      }
      if (item.id !== id) {
        throw new Error("SOURCE_SCOPE_MISMATCH");
      }
      await deps.repository.connection.connect(
        id,
        credentials.clientId,
        deps.now().toISOString(),
      );
    },
    async token(itemId?: string) {
      if (itemId) {
        await deps.repository.authorizeItems([z.uuid().parse(itemId)]);
      }
      return deps.connectToken(await deps.credentials(), itemId);
    },
    pause: () => deps.repository.pause(),
    async resume() {
      await deps.credentials();
      await deps.repository.resume(deps.now().toISOString());
    },
    requestSync: () => deps.repository.requestSync(deps.now()),
  };
}
