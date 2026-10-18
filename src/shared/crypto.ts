import type { SecretComparison } from "./crypto.types";

async function digest(value: string | undefined) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

export async function hash(value: unknown): Promise<string> {
  function stable(v: unknown): unknown {
    if (Array.isArray(v)) {
      return v.map(stable);
    }
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, stable(x)]),
      );
    }
    return v;
  }
  const bytes = await digest(JSON.stringify(stable(value)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function secretsEqual({
  expected,
  supplied,
}: SecretComparison): Promise<boolean> {
  const [left, right] = await Promise.all([digest(expected), digest(supplied)]);
  const compared = new DataView(
    right.buffer,
    right.byteOffset,
    right.byteLength,
  );
  let difference = 0;
  // Both digests have 32 bytes; compare every byte without an early return.
  for (const [index, value] of left.entries()) {
    difference |= value ^ compared.getUint8(index);
  }
  return difference === 0;
}
