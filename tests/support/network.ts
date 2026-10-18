import { vi } from "vitest";

// Syntactically valid JWT for the official SDK's expiry check; not a real credential.
export function syntheticJwt(subject = "synthetic") {
  const encode = (value: string) =>
    btoa(value).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return (
    encode('{"alg":"HS256","typ":"JWT"}') +
    "." +
    encode(JSON.stringify({ sub: subject, exp: 4102444800 })) +
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
        method: request.method,
        headers: request.headers,
        ...(request.body
          ? { body: new TextDecoder().decode(await request.arrayBuffer()) }
          : {}),
        signal: request.signal,
      });
    },
  );
}
