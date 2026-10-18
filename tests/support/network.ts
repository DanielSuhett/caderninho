import { vi } from "vitest";

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

// Both Ky and workerd's node:http client use Fetch. Normalize their Request forms
// so fixtures exercise the real clients without network access or private data.
export function mockNetwork(handler: typeof fetch) {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      return handler(request.url, {
        headers: request.headers,
        method: request.method,
        ...(request.body
          ? { body: new TextDecoder().decode(await request.arrayBuffer()) }
          : {}),
        signal: request.signal,
      });
    },
  );
}
