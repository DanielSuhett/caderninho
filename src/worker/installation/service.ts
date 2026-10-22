import {
  assertPersonalConnector,
  DEFAULT_PROFILE,
  PERSONAL_CONNECTOR_ID,
  scopedSourceId,
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
    async connect(upstreamId: string, profileId = DEFAULT_PROFILE) {
      const id = scopedSourceId(profileId, upstreamId);
      const connection = await source.connection(id);
      if (connection.id !== id) {
        throw new Error("SOURCE_IDENTITY_MISMATCH");
      }
      assertPersonalConnector(connection.connector?.id);
      await repository.register(id, profileId);
    },
    state: repository.state,
    async token(id?: string, profileId = DEFAULT_PROFILE) {
      if (
        id &&
        !(await repository.state()).connections.some((c) => c.id === id)
      ) {
        throw new Error("NOT_FOUND");
      }
      return {
        ...(await source.token(id, profileId)),
        configuration: {
          connectorIds: [PERSONAL_CONNECTOR_ID],
          includeSandbox: false,
          selectedConnectorId: PERSONAL_CONNECTOR_ID,
        },
      };
    },
  };
}
