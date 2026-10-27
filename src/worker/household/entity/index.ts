import type {
  ConnectionOwner,
  Institution,
  Person,
  PluggyProfile,
} from "../../../domain";
export interface HouseholdRepository {
  assign: (connectionId: string, personId: string) => Promise<void>;
  bindDefault: (fingerprint: string) => Promise<void>;
  getProfile: (id: string) => Promise<PluggyProfile | undefined>;
  institution: (
    connectionId: string,
    institution: Institution | null,
  ) => Promise<void>;
  person: (person: Person) => Promise<void>;
  profile: (profile: PluggyProfile, person?: Person) => Promise<void>;
  read: () => Promise<{
    people: Person[];
    profiles: PluggyProfile[];
    owners: ConnectionOwner[];
  }>;
}
export interface CredentialVault {
  get: (ref: string) => Promise<{ clientId: string; clientSecret: string }>;
  put: (credentials: {
    clientId: string;
    clientSecret: string;
  }) => Promise<string>;
}
