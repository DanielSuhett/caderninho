import { secretsEqual } from "../../shared";

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
