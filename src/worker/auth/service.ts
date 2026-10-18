import { z } from "zod/v4";

import type { createAuthRepository } from "#worker/auth/repository.ts";

export interface OwnerSettings {
  OWNER_GITHUB_ID?: string;
  OWNER_ID?: string;
}
export interface InstallationSettings extends OwnerSettings {
  PUBLIC_ORIGIN: string;
  CREDENTIAL_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  ADMIN_KEY_SHA256?: string;
  database: boolean;
  workflow: boolean;
  oauth: boolean;
}

export function ownerPrincipal(env: OwnerSettings) {
  const id = z
    .string()
    .regex(/^[1-9]\d{0,19}$/)
    .safeParse(env.OWNER_GITHUB_ID);
  // An existing GitHub identity always wins; invalid configured IDs fail closed.
  if (env.OWNER_GITHUB_ID) return id.success ? "github:" + id.data : null;
  const owner = z.uuid().safeParse(env.OWNER_ID);
  return owner.success ? "instance:" + owner.data : null;
}
export function isOwner(env: OwnerSettings, principal: string) {
  return ownerPrincipal(env) === principal;
}
export function installationChecks(
  env: InstallationSettings,
  currentOrigin: string,
) {
  const origin = z.url().safeParse(env.PUBLIC_ORIGIN);
  const originReady =
    origin.success &&
    origin.data === currentOrigin &&
    currentOrigin.startsWith("https://") &&
    !currentOrigin.endsWith(".example.com");
  const keyReady =
    typeof env.CREDENTIAL_KEY === "string" &&
    /^[A-Za-z0-9+/]{43}=$/.test(env.CREDENTIAL_KEY);
  const githubReady = Boolean(
    env.GITHUB_CLIENT_ID &&
    !env.GITHUB_CLIENT_ID.startsWith("configure-") &&
    env.GITHUB_CLIENT_SECRET &&
    !env.GITHUB_CLIENT_SECRET.startsWith("replace-"),
  );
  return {
    owner: Boolean(ownerPrincipal(env)),
    origin: originReady,
    github: githubReady,
    access: githubReady || /^[a-f0-9]{64}$/.test(env.ADMIN_KEY_SHA256 ?? ""),
    vault: keyReady,
    database: env.database,
    workflow: env.workflow,
    oauth: env.oauth,
  };
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function adminConfigured(env: { ADMIN_KEY_SHA256?: string }) {
  return /^[a-f0-9]{64}$/.test(env.ADMIN_KEY_SHA256 ?? "");
}

export async function verifyAdminKey(
  env: { ADMIN_KEY_SHA256?: string },
  key: string,
) {
  if (!adminConfigured(env) || !/^[a-f0-9]{64}$/.test(key)) return false;
  const digest = await adminKeyDigest(key);
  const expected = env.ADMIN_KEY_SHA256 ?? "";
  let diff = digest.length ^ expected.length;
  for (let i = 0; i < expected.length; i++)
    diff |= digest.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function returnPath(value: string | undefined) {
  if (!value || value.length > 4096 || !value.startsWith("/authorize?"))
    return "/account";
  const url = new URL(value, "https://internal.test");
  return url.origin === "https://internal.test" && url.pathname === "/authorize"
    ? url.pathname + url.search
    : "/account";
}

export async function adminKeyDigest(key: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export const token = () => crypto.randomUUID() + crypto.randomUUID();

export function createAuthService(
  repository: ReturnType<typeof createAuthRepository>,
  settings: OwnerSettings & { ADMIN_KEY_SHA256?: string },
  now: () => number = Date.now,
) {
  return {
    async readSession(id: string) {
      if (id.length > 100) return null;
      const session = await repository.session(id, now());
      if (!session || !isOwner(settings, session.principal)) return null;
      if (
        session.auth_version &&
        session.auth_version !== settings.ADMIN_KEY_SHA256
      )
        return null;
      return session;
    },
    async createSession(principal: string, version: string, prior?: string) {
      const id = token();
      await repository.saveSession({
        id,
        principal,
        csrf: token(),
        expires: now() + 28800000,
        version,
        ...(prior === undefined ? {} : { prior }),
      });
      return id;
    },
    allowLoginAttempt: () => repository.allowLoginAttempt(now()),
    async beginLogin() {
      const state = "portal." + token(),
        browser = token(),
        verifier = token();
      await repository.saveLogin(state, browser, verifier, now() + 600000);
      return { state, browser, verifier };
    },
    consumeLogin: (state: string, browser: string) =>
      repository.consumeLogin(state, browser, now()),
    revokeSession: (id: string) => repository.revokeSession(id),
    principalExists: (principal: string) =>
      repository.principalExists(principal),
  };
}
