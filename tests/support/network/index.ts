import { vi } from "vitest";

export { syntheticJwt } from "../helpers";

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
