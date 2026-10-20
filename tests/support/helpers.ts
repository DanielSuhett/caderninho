// Syntactically valid JWT for the official SDK's expiry check; not a real credential.
export function syntheticJwt(subject = "synthetic") {
  const encode = (value: string) =>
    btoa(value).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
  return (
    encode('{"alg":"HS256","typ":"JWT"}') +
    "." +
    encode(JSON.stringify({ exp: 4_102_444_800, sub: subject })) +
    ".synthetic"
  );
}

export function required<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("expected a present value");
  }
  return value;
}
export const sourceUrl = (input: Parameters<typeof fetch>[0]) =>
  new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
