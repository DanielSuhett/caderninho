import { secretsEqual } from "../../shared";
import type { AuthRepository } from "./entity";

export function adminConfigured(password: string | undefined) {
  return !!password && password.length >= 16 && password.length <= 256;
}

export async function verifyPassword(
  expected: string | undefined,
  supplied: string,
) {
  if (!(adminConfigured(expected) && adminConfigured(supplied))) {
    return false;
  }
  return await secretsEqual({ expected: expected ?? "", supplied });
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
    allowLoginAttempt: () => repository.allowLoginAttempt(now()),
    compact: repository.compact,
    async createSession(prior?: string) {
      const id = token();
      await repository.saveSession({
        csrf: token(),
        expires: now() + 28_800_000,
        id,
        version,
        ...(prior !== undefined && { prior }),
      });
      return id;
    },
    async readSession(id: string) {
      if (id.length > 100) {
        return null;
      }
      const session = await repository.session(id, now());
      return session?.auth_version === version ? session : null;
    },
    revokeSession: (id: string) => repository.revokeSession(id),
  };
}
