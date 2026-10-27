import {
  DEFAULT_PROFILE,
  type FinancialSource,
  type PluggyProfile,
  ProductKind,
  scopedSourceId,
  sourceIdentity,
} from "../../domain";
import { hash } from "../../shared";
import type { CredentialVault, HouseholdRepository } from "../household";
import { createPluggyAdapter } from "./adapter";
export function createProfileSource(input: {
  repository: HouseholdRepository;
  vault: CredentialVault;
  defaults: { clientId: string | undefined; clientSecret: string | undefined };
}) {
  const clients = new Map<string, ReturnType<typeof createPluggyAdapter>>();
  async function bindEnvironment(profile: PluggyProfile) {
    if (
      profile.id !== DEFAULT_PROFILE ||
      profile.credentialRef ||
      !input.defaults.clientId ||
      !input.defaults.clientSecret
    ) {
      return;
    }
    const fingerprint = await hash(input.defaults.clientId);
    if (
      profile.clientFingerprint &&
      profile.clientFingerprint !== fingerprint
    ) {
      throw new Error("APPLICATION_CHANGE_REQUIRES_NEW_PROFILE");
    }
    if (!profile.clientFingerprint) {
      await input.repository.bindDefault(fingerprint);
    }
  }
  async function adapter(profileId: string) {
    const profile = await input.repository.getProfile(profileId);
    if (!profile) {
      throw new Error("NOT_FOUND");
    }
    if (!profile.enabled) {
      throw new Error("PROFILE_DISABLED");
    }
    await bindEnvironment(profile);
    const key = `${profileId}:${profile.credentialRef ?? "environment"}`;
    const cached = clients.get(key);
    if (cached) {
      return cached;
    }
    const fallback = profileId === DEFAULT_PROFILE ? input.defaults : undefined;
    const credentials = profile.credentialRef
      ? await input.vault.get(profile.credentialRef)
      : fallback;
    if (!credentials) {
      throw new Error("NOT_CONFIGURED");
    }
    const result = createPluggyAdapter(credentials);
    clients.set(key, result);
    return result;
  }
  const source: FinancialSource = {
    async accounts(id) {
      const { profileId, upstreamId } = sourceIdentity(id);
      const rows = await (await adapter(profileId)).accounts(upstreamId);
      return rows.map((row) => {
        if (row.itemId !== upstreamId) {
          throw new Error("SOURCE_IDENTITY_MISMATCH");
        }
        return { ...row, id: scopedSourceId(profileId, row.id), itemId: id };
      });
    },
    async connection(id) {
      const { profileId, upstreamId } = sourceIdentity(id);
      const row = await (await adapter(profileId)).connection(upstreamId);
      return { ...row, id: scopedSourceId(profileId, row.id) };
    },
    async institutionCatalog(id) {
      return (await adapter(sourceIdentity(id).profileId)).institutions();
    },
    async products(request) {
      const { profileId, upstreamId } = sourceIdentity(request.id);
      const page = await (await adapter(profileId)).products({
        ...request,
        id: upstreamId,
      });
      if (page.kind === ProductKind.bills) {
        return {
          ...page,
          records: page.records.map((row) => ({
            ...row,
            accountId: request.id,
            id: scopedSourceId(profileId, row.id),
          })),
        };
      }
      if (page.kind === ProductKind.investments) {
        return {
          ...page,
          records: page.records.map((row) => ({
            ...row,
            connectionId: request.id,
            id: scopedSourceId(profileId, row.id),
          })),
        };
      }
      return {
        ...page,
        records: page.records.map((row) => ({
          ...row,
          connectionId: request.id,
          id: scopedSourceId(profileId, row.id),
        })),
      };
    },
    async transactions(id, cursor) {
      const { profileId, upstreamId } = sourceIdentity(id);
      const page = await (await adapter(profileId)).transactions(
        upstreamId,
        cursor,
      );
      return {
        ...page,
        records: page.records.map((row) => {
          if (row.accountId !== upstreamId) {
            throw new Error("SOURCE_IDENTITY_MISMATCH");
          }
          return {
            ...row,
            accountId: id,
            id: scopedSourceId(profileId, row.id),
            ...(row.creditCardMetadata && {
              creditCardMetadata: {
                ...row.creditCardMetadata,
                ...(row.creditCardMetadata.billId && {
                  billId: scopedSourceId(
                    profileId,
                    row.creditCardMetadata.billId,
                  ),
                }),
              },
            }),
          };
        }),
      };
    },
  };
  return {
    ...source,
    async institutions(profileId = DEFAULT_PROFILE) {
      return (await adapter(profileId)).institutions();
    },
    async token(id?: string, selectedProfile = DEFAULT_PROFILE) {
      const identity = id
        ? sourceIdentity(id)
        : { profileId: selectedProfile, upstreamId: undefined };
      if (id && selectedProfile !== identity.profileId) {
        throw new Error("SOURCE_IDENTITY_MISMATCH");
      }
      return (await adapter(identity.profileId)).token(identity.upstreamId);
    },
  };
}
