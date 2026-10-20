import type { InstallationState } from "../../../contracts";
import type { ProviderConnection } from "../../../domain";
export interface StatusSelection {
  connectionIds?: string[] | undefined;
  runIds?: string[] | undefined;
}
export interface InstallationRepository {
  enable: (enabled: boolean) => Promise<void>;
  register: (connection: ProviderConnection, now: string) => Promise<void>;
  state: (selection?: StatusSelection) => Promise<InstallationState>;
}
export interface InstallationSource {
  configured: boolean;
  connection: (id: string) => Promise<ProviderConnection>;
  token: (id?: string) => Promise<{ accessToken: string }>;
}
