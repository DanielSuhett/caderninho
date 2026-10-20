import type { InstallationState } from "../../../contracts";
import type { ProviderConnection } from "../../../domain";
export interface StatusSelection {
  connectionIds?: string[] | undefined;
}
export interface InstallationRepository {
  register: (connection: ProviderConnection) => Promise<void>;
  state: (selection?: StatusSelection) => Promise<InstallationState>;
}
export interface InstallationSource {
  configured: boolean;
  connection: (id: string) => Promise<ProviderConnection>;
  token: (id?: string) => Promise<{ accessToken: string }>;
}
