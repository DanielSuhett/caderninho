import type { HouseholdCommand } from "../../contracts";
import {
  DEFAULT_PROFILE,
  type Institution,
  type PluggyProfile,
  profileConfigured,
} from "../../domain";
import { hash } from "../../shared";
import type { CredentialVault, HouseholdRepository } from "./entity";

type ProfileInput = Extract<HouseholdCommand, { action: "save_profile" }>;
export function createHouseholdService(dependencies: {
  repository: HouseholdRepository;
  vault: CredentialVault;
  validate: (credentials: {
    clientId: string;
    clientSecret: string;
  }) => Promise<unknown>;
  defaultClientId?: string | undefined;
  resolveInstitution?: (profileId: string, id: string) => Promise<Institution>;
}) {
  const { repository, vault } = dependencies;
  async function credentials(
    input: Pick<ProfileInput, "clientId" | "clientSecret">,
    existing: PluggyProfile | undefined,
    profiles: PluggyProfile[],
  ) {
    if (!(input.clientId && input.clientSecret)) {
      if (!existing) {
        throw new Error("CREDENTIALS_REQUIRED");
      }
      return {
        clientFingerprint: existing.clientFingerprint,
        credentialRef: existing.credentialRef,
      };
    }
    const fingerprint = await hash(input.clientId);
    const defaultFingerprint = dependencies.defaultClientId
      ? await hash(dependencies.defaultClientId)
      : null;
    const expected =
      existing?.clientFingerprint ??
      (existing?.id === DEFAULT_PROFILE ? defaultFingerprint : null);
    if (expected && expected !== fingerprint) {
      throw new Error("APPLICATION_CHANGE_REQUIRES_NEW_PROFILE");
    }
    if (
      profiles.some(
        (p) => p.id !== existing?.id && p.clientFingerprint === fingerprint,
      ) ||
      (existing?.id !== DEFAULT_PROFILE && fingerprint === defaultFingerprint)
    ) {
      throw new Error("PROFILE_EXISTS");
    }
    await dependencies.validate({
      clientId: input.clientId,
      clientSecret: input.clientSecret,
    });
    return {
      clientFingerprint: fingerprint,
      credentialRef: await vault.put({
        clientId: input.clientId,
        clientSecret: input.clientSecret,
      }),
    };
  }
  async function saveProfile(
    input: ProfileInput,
    state: Awaited<ReturnType<HouseholdRepository["read"]>>,
  ) {
    const existing = input.id
      ? state.profiles.find((p) => p.id === input.id)
      : undefined;
    if (input.id && !existing) {
      throw new Error("NOT_FOUND");
    }
    if (!state.people.some((p) => p.id === input.personId)) {
      throw new Error("NOT_FOUND");
    }
    if (existing && existing.personId !== input.personId) {
      throw new Error("PROFILE_OWNER_IMMUTABLE");
    }
    const id = existing?.id ?? crypto.randomUUID();
    const secret = await credentials(input, existing, state.profiles);
    await repository.profile({
      ...secret,
      enabled: input.enabled,
      id,
      name: input.name,
      personId: input.personId,
    });
    return { id };
  }
  async function createProfile(
    input: Extract<HouseholdCommand, { action: "create_profile" }>,
    state: Awaited<ReturnType<HouseholdRepository["read"]>>,
  ) {
    const owner = input.person;
    const person =
      "name" in owner
        ? { id: crypto.randomUUID(), name: owner.name }
        : state.people.find((p) => p.id === owner.id);
    if (!person) {
      throw new Error("NOT_FOUND");
    }
    const secret = await credentials(input, undefined, state.profiles);
    const id = crypto.randomUUID();
    await repository.profile(
      {
        ...secret,
        enabled: true,
        id,
        name: input.name,
        personId: person.id,
      },
      "name" in input.person ? person : undefined,
    );
    return { id, personId: person.id };
  }
  async function savePerson(
    input: Extract<HouseholdCommand, { action: "save_person" }>,
    state: Awaited<ReturnType<HouseholdRepository["read"]>>,
  ) {
    if (input.id && !state.people.some((p) => p.id === input.id)) {
      throw new Error("NOT_FOUND");
    }
    const person = {
      id: input.id ?? crypto.randomUUID(),
      name: input.name,
      photo:
        input.photo === undefined
          ? (state.people.find((row) => row.id === input.id)?.photo ?? null)
          : input.photo,
    };
    await repository.person(person);
    return person;
  }
  async function saveInstitution(
    input: Extract<HouseholdCommand, { action: "set_connection_institution" }>,
    state: Awaited<ReturnType<HouseholdRepository["read"]>>,
  ) {
    const owner = state.owners.find(
      (candidate) => candidate.connectionId === input.connectionId,
    );
    if (!owner) {
      throw new Error("NOT_FOUND");
    }
    let institution: Institution | null = null;
    if (input.institutionId) {
      if (!dependencies.resolveInstitution) {
        throw new Error("NOT_CONFIGURED");
      }
      institution = await dependencies.resolveInstitution(
        owner.profileId,
        input.institutionId,
      );
    }
    await repository.institution(input.connectionId, institution);
    return { ok: true };
  }
  return {
    async assertConfigured(ids?: string[]) {
      const state = await repository.read();
      const selected = state.owners.filter(
        (owner) => !ids || ids.includes(owner.connectionId),
      );
      for (const owner of selected) {
        const profile = state.profiles.find(
          (item) => item.id === owner.profileId,
        );
        if (
          profile?.enabled &&
          !profileConfigured(profile, !!dependencies.defaultClientId)
        ) {
          throw new Error("NOT_CONFIGURED");
        }
      }
    },
    async catalog() {
      const state = await repository.read();
      return {
        people: state.people,
        profiles: state.profiles.map((p) => ({
          configured: profileConfigured(p, !!dependencies.defaultClientId),
          connectionCount: state.owners.filter((o) => o.profileId === p.id)
            .length,
          enabled: p.enabled,
          id: p.id,
          name: p.name,
          personId: p.personId,
        })),
      };
    },
    async execute(input: HouseholdCommand) {
      const state = await repository.read();
      if (input.action === "set_connection_institution") {
        return saveInstitution(input, state);
      }
      if (input.action === "create_profile") {
        return createProfile(input, state);
      }
      if (input.action === "save_person") {
        return savePerson(input, state);
      }
      if (input.action === "assign_connection") {
        if (
          !(
            state.people.some((p) => p.id === input.personId) &&
            state.owners.some((o) => o.connectionId === input.connectionId)
          )
        ) {
          throw new Error("NOT_FOUND");
        }
        await repository.assign(input.connectionId, input.personId);
        return { ok: true };
      }
      return saveProfile(input, state);
    },
  };
}
