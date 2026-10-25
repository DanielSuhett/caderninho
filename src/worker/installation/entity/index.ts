import type { InstallationState, PortalResponse } from "../../../contracts";
import type { ProviderConnection } from "../../../domain";
export type InstallationCatalog = Pick<PortalResponse, "people" | "profiles">;
export interface StatusSelection {
  connectionIds?: string[] | undefined;
}
export interface InstallationRepository {
  register: (id: string, profileId?: string) => Promise<void>;
  state: (selection?: StatusSelection) => Promise<InstallationState>;
}
export interface InstallationSource {
  connection: (id: string) => Promise<ProviderConnection>;
  token: (id?: string, profileId?: string) => Promise<{ accessToken: string }>;
}
