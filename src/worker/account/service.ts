import type {
  AccountConnectToken,
  InstallationChecks,
} from "@/contracts/portal.types";
import { accountState } from "@/domain/account.entity";
import {
  assertConnectionCapacity,
  assertPersonalConnector,
  PERSONAL_CONNECTOR_ID,
} from "@/domain/connection.entity";

import {
  type AccountRepository,
  type AccountSource,
  accountPanel,
} from "./entity";

interface AccountDependencies {
  repository: AccountRepository;
  source: AccountSource;
  disconnectAssistants(): Promise<void>;
  installation(): Promise<InstallationChecks>;
  now(): Date;
}

export function createAccountService(deps: AccountDependencies) {
  async function readState() {
    const evidence = await deps.repository.status();
    const status = accountState({
      configured: deps.source.configured,
      connected: !!evidence.items.length,
      syncEnabled: evidence.config.sync_enabled !== 0,
      latest: evidence.latest,
      coverage: evidence.coverage,
    });
    return { evidence, status };
  }
  return {
    async state() {
      const [{ evidence, status }, checks] = await Promise.all([
        readState(),
        deps.installation(),
      ]);
      return {
        status,
        panel: accountPanel(status),
        checks,
        items: evidence.items,
        latest: evidence.latest,
        checkedAt: deps.now().toISOString(),
      };
    },
    async wizardState() {
      return (await readState()).status;
    },
    async connectItem(itemId: string) {
      const application = await deps.source.application();
      const connections =
        await deps.repository.connection.connectionCount(itemId);
      assertConnectionCapacity(connections);
      const item = await application.readItem(itemId);
      assertPersonalConnector(item.connector?.id);
      await deps.repository.connection.connect(
        itemId,
        deps.now().toISOString(),
      );
    },
    async token(itemId?: string): Promise<AccountConnectToken> {
      const application = await deps.source.application();
      const token = await application.token(itemId);
      return {
        accessToken: token.accessToken,
        configuration: {
          connectorIds: [PERSONAL_CONNECTOR_ID],
          selectedConnectorId: PERSONAL_CONNECTOR_ID,
          includeSandbox: false,
        },
      };
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
