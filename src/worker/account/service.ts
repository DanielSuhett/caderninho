import type { AccountConnectToken, InstallationChecks } from "../../contracts";
import {
  accountState,
  assertConnectionCapacity,
  assertPersonalConnector,
  type ItemAdmission,
  nextAutomaticAttempt,
  PERSONAL_CONNECTOR_ID,
} from "../../domain";
import {
  type AccountRepository,
  type AccountSource,
  accountPanel,
} from "./entity";

interface AccountDependencies {
  admissions: (ids: string[], now: Date) => Promise<ItemAdmission[]>;
  disconnectAssistants: () => Promise<void>;
  dispatchSync: () => Promise<void>;
  installation: () => Promise<InstallationChecks>;
  now: () => Date;
  recover: () => Promise<void>;
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
      await deps.dispatchSync();
    },
    disconnectAssistants: () => deps.disconnectAssistants(),
    pause: () => deps.repository.pause(),
    async requestSync() {
      const eligible = await deps.repository.requestSync(deps.now());
      await deps.recover();
      if (eligible) {
        await deps.dispatchSync();
      }
      return eligible;
    },
    async resume() {
      await deps.source.application();
      await deps.repository.resume(deps.now().toISOString());
      await deps.dispatchSync();
    },
    async state() {
      const [{ evidence, status }, checks] = await Promise.all([
        readState(),
        deps.installation(),
      ]);
      const admissions = new Map(
        (
          await deps.admissions(
            evidence.items.map((item) => item.id),
            deps.now(),
          )
        ).map((item) => [item.itemId, item]),
      );
      return {
        checkedAt: deps.now().toISOString(),
        checks,
        freshness: {
          items: evidence.items.map((item) => {
            const admission = admissions.get(item.id);
            return {
              id: item.id,
              lastAdmissionAt: item.last_admitted_at,
              lastImportAt: item.last_import_at,
              nextEligibleAt: item.next_import_at,
              operationId: item.cycle_id,
              ...(admission && { status: admission.status }),
            };
          }),
          nextAutomaticAt: nextAutomaticAttempt(deps.now()),
        },
        items: evidence.items,
        latest: evidence.latest,
        localApplications: evidence.localApplications,
        panel: accountPanel(status, evidence.latest?.dispatched === 1),
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
