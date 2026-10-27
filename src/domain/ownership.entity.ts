import type { Institution } from "./financial-identity.entity";

export interface Person {
  id: string;
  name: string;
  photo?: string | null | undefined;
}
export interface PluggyProfile {
  clientFingerprint: string | null;
  credentialRef: string | null;
  enabled: boolean;
  id: string;
  name: string;
  personId: string;
}
export interface ConnectionOwner {
  connectionId: string;
  institution?: Institution | null | undefined;
  personId: string;
  profileId: string;
}
export const DEFAULT_PERSON = "self";
export const DEFAULT_PROFILE = "default";
export function sourceIdentity(id: string) {
  if (!id.startsWith("pluggy:")) {
    return { profileId: DEFAULT_PROFILE, upstreamId: id };
  }
  const [, profileId, encoded, extra] = id.split(":");
  if (!(profileId && encoded) || extra !== undefined) {
    throw new Error("INVALID_SOURCE_ID");
  }
  const upstreamId = decodeURIComponent(encoded);
  if (
    !upstreamId ||
    encodeURIComponent(upstreamId) !== encoded ||
    profileId === DEFAULT_PROFILE
  ) {
    throw new Error("INVALID_SOURCE_ID");
  }
  return { profileId, upstreamId };
}
export function scopedSourceId(profileId: string, id: string) {
  if (profileId === DEFAULT_PROFILE) {
    if (id.startsWith("pluggy:") || id.startsWith("local:")) {
      throw new Error("INVALID_SOURCE_ID");
    }
    return id;
  }
  return `pluggy:${profileId}:${encodeURIComponent(id)}`;
}

export function profileConfigured(
  profile: PluggyProfile,
  defaultConfigured: boolean,
) {
  return (
    !!profile.credentialRef ||
    (profile.id === DEFAULT_PROFILE && defaultConfigured)
  );
}
