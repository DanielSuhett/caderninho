import {
  assertConnectionCapacity,
  assertPersonalConnector,
  PERSONAL_CONNECTOR_ID,
} from "../../domain";
import type { InstallationRepository, InstallationSource } from "./entity";
export function createInstallationService({
  repository,
  source,
}: {
  repository: InstallationRepository;
  source: InstallationSource;
}) {
  return {
    configured: source.configured,
    async connect(id: string) {
      const connection = await source.connection(id);
      if (connection.id !== id) {
        throw new Error("SOURCE_IDENTITY_MISMATCH");
      }
      assertPersonalConnector(connection.connector?.id);
      const state = await repository.state();
      assertConnectionCapacity({
        count: state.connections.length,
        exists: state.connections.some((row) => row.id === id),
      });
      await repository.register(id);
    },
    state: repository.state,
    async token(id?: string) {
      if (
        id &&
        !(await repository.state()).connections.some((c) => c.id === id)
      ) {
        throw new Error("NOT_FOUND");
      }
      return {
        ...(await source.token(id)),
        configuration: {
          connectorIds: [PERSONAL_CONNECTOR_ID],
          includeSandbox: false,
          selectedConnectorId: PERSONAL_CONNECTOR_ID,
        },
      };
    },
  };
}
