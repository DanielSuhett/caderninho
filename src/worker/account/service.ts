import type { AccountConnectToken, InstallationChecks } from "../../contracts";
import {
  accountState,
  assertConnectionCapacity,
  assertPersonalConnector,
  PERSONAL_CONNECTOR_ID,
} from "../../domain";
import {
  type AccountRepository,
  type AccountSource,
  accountPanel,
} from "./entity";

interface AccountDependencies {
  disconnectAssistants: () => Promise<void>;
  installation: () => Promise<InstallationChecks>;
  now: () => Date;
  repository: AccountRepository;
  source: AccountSource;
}

export function createAccountService(deps: AccountDependencies) {
  async function readState() {
    const evidence = await deps.repository.status();
    const status = accountState({
      configured: deps.source.configured,
      connected: !!evidence.items.length,
      coverage: evidence.coverage,
      latest: evidence.latest,
      syncEnabled: evidence.config.sync_enabled !== 0,
    });
    return { evidence, status };
  }
  return {
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
    disconnectAssistants: () => deps.disconnectAssistants(),
    pause: () => deps.repository.pause(),
    requestSync: () => deps.repository.requestSync(deps.now()),
    async resume() {
      await deps.source.application();
      await deps.repository.resume(deps.now().toISOString());
    },
    async state() {
      const [{ evidence, status }, checks] = await Promise.all([
        readState(),
        deps.installation(),
      ]);
      return {
        checkedAt: deps.now().toISOString(),
        checks,
        items: evidence.items,
        latest: evidence.latest,
        panel: accountPanel(status),
        status,
      };
    },
    async token(itemId?: string): Promise<AccountConnectToken> {
      const application = await deps.source.application();
      const token = await application.token(itemId);
      return {
        accessToken: token.accessToken,
        configuration: {
          connectorIds: [PERSONAL_CONNECTOR_ID],
          includeSandbox: false,
          selectedConnectorId: PERSONAL_CONNECTOR_ID,
        },
      };
    },
    async wizardState() {
      return (await readState()).status;
    },
  };
}
