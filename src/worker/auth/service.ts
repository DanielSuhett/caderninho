import { hash, secretsEqual } from "../../shared";
import type { AdminAccess } from "./entity";

const accessHashPattern = /^[a-f0-9]{64}$/;
const accessKeyPattern = /^cad_[a-f0-9]{64}$/;

export function adminAccess({
  password,
  accessHash,
}: {
  password: string | undefined;
  accessHash: string | undefined;
}): AdminAccess | null {
  if (adminConfigured(password)) {
    return { generated: false, secret: password ?? "" };
  }
  return accessHash && accessHashPattern.test(accessHash)
    ? { generated: true, secret: accessHash }
    : null;
}

export function accessKeyHash(key: string) {
  return hash({ key, purpose: "caderninho-admin-access" });
}

export async function generateAdminAccess() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = `cad_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return { hash: await accessKeyHash(key), key };
}

export async function verifyAdminAccess(
  access: AdminAccess | null,
  supplied: string,
) {
  if (!access) {
    return false;
  }
  if (!access.generated) {
    return verifyPassword(access.secret, supplied);
  }
  return (
    accessKeyPattern.test(supplied) &&
    secretsEqual({
      expected: access.secret,
      supplied: await accessKeyHash(supplied),
    })
  );
}

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
