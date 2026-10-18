import { secretsEqual } from "@/shared/crypto";

import type { AuthRepository } from "./entity";

export function adminConfigured(password: string | undefined) {
  return !!password && password.length >= 16 && password.length <= 256;
}

export async function verifyPassword(
  expected: string | undefined,
  supplied: string,
) {
  if (!adminConfigured(expected) || !adminConfigured(supplied)) {
    return false;
  }
  return secretsEqual({ expected: expected ?? "", supplied });
}

export function returnPath(value: string | undefined) {
  if (!value || value.length > 4096 || !value.startsWith("/authorize?")) {
    return "/account";
  }
  const url = new URL(value, "https://internal.test");
  return url.origin === "https://internal.test" && url.pathname === "/authorize"
    ? url.pathname + url.search
    : "/account";
}

export const token = () => crypto.randomUUID() + crypto.randomUUID();

export function createAuthService(
  repository: AuthRepository,
  version: string,
  now: () => number = Date.now,
) {
  return {
    compact: repository.compact,
    async readSession(id: string) {
      if (id.length > 100) {
        return null;
      }
      const session = await repository.session(id, now());
      return session?.auth_version === version ? session : null;
    },
    async createSession(prior?: string) {
      const id = token();
      await repository.saveSession({
        id,
        csrf: token(),
        expires: now() + 28800000,
        version,
        ...(prior !== undefined && { prior }),
      });
      return id;
    },
    allowLoginAttempt: () => repository.allowLoginAttempt(now()),
    revokeSession: (id: string) => repository.revokeSession(id),
  };
}
