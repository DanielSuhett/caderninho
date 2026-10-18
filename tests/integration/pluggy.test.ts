import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import { Fault } from "#domain/fault.ts";
import { required, sourceUrl } from "#testing/helpers.ts";
import { mockNetwork, syntheticJwt } from "#testing/network.ts";
import { PersonalPluggyClient } from "#worker/pluggy/client.adapter.ts";
import {
  connectToken,
  financialSource,
  pluggyClient,
  providerRetries,
  readAccount,
} from "#worker/pluggy/source.ts";

const credentials = {
  clientId: "synthetic-client",
  clientSecret: "synthetic-secret",
};
const origin = "https://api.pluggy.ai";
const client = () => pluggyClient(credentials);
const auth = () => Response.json({ apiKey: syntheticJwt() });

beforeEach(() =>
  mockNetwork(async () => {
    throw new Error("Unexpected synthetic request");
  }),
);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("SDK/Fetch in workerd preserve numeric lexemes and date strings on auth, reads and mutations", async () => {
  const urls: URL[] = [];
  mockNetwork(async (input) => {
    const url = sourceUrl(input);
    urls.push(url);
    assert.equal(url.origin, origin);
    if (url.pathname === "/auth") {
      return auth();
    }
    return new Response(
      '{"id":"account","balance":9007199254740993.29,"quantity":1.234567890123456789,"updatedAt":"2026-10-01T01:02:03-03:00","accessToken":"synthetic-connect"}',
    );
  });
  const sdk = client();
  const read = await readAccount(sdk, "account");
  assert.equal(read.balance, "9007199254740993.29");
  assert.equal(
    z.object({ updatedAt: z.string() }).parse(read).updatedAt,
    "2026-10-01T01:02:03-03:00",
  );
  const mutation = z
    .object({ quantity: z.string() })
    .parse(await sdk.createConnectToken());
  assert.equal(mutation.quantity, "1.234567890123456789");
  assert.equal(urls.filter((url) => url.pathname === "/auth").length, 1);
});

test("tokens are reused only inside a client and invalidated after a 401 without hidden retries", async () => {
  let authentications = 0;
  let reads = 0;
  const tokens: string[] = [];
  mockNetwork(async (input, init) => {
    if (sourceUrl(input).pathname === "/auth") {
      authentications++;
      return Response.json({ apiKey: syntheticJwt(String(authentications)) });
    }
    reads++;
    tokens.push(new Headers(init?.headers).get("X-API-KEY") ?? "");
    if (reads === 2) {
      return new Response("private unauthorized body", { status: 401 });
    }
    return Response.json({ id: "account" });
  });
  const alice = client();
  const bob = pluggyClient({
    clientId: "other-client",
    clientSecret: "other-secret",
  });
  await alice.fetchAccount("account");
  await assert.rejects(readAccount(alice, "account"), /UPSTREAM_AUTH/);
  assert.equal(reads, 2);
  await bob.fetchAccount("account");
  await alice.fetchAccount("account");
  await alice.fetchAccount("account");
  assert.equal(authentications, 3);
  assert.equal(tokens[0], tokens[1]);
  assert.notEqual(tokens[0], tokens[2]);
  assert.notEqual(tokens[2], tokens[3]);
  assert.equal(tokens[3], tokens[4]);
});

test("HTTP errors keep original status and headers, map non-JSON safely, and never log private data", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const [status, body, code] of [
    [401, "", "UPSTREAM_AUTH"],
    [403, "private forbidden", "UPSTREAM_FORBIDDEN"],
    [404, "private missing", "UPSTREAM_NOT_FOUND"],
    [429, "<html>private rate limit</html>", "UPSTREAM_RATE_LIMIT"],
    [503, "private unavailable", "UPSTREAM_ERROR"],
  ] satisfies [number, string, string][]) {
    let requests = 0;
    mockNetwork(async (input) => {
      requests++;
      if (sourceUrl(input).pathname === "/auth") {
        return auth();
      }
      return new Response(body, { status, headers: { "Retry-After": "42" } });
    });
    const sdk = client();
    await assert.rejects(sdk.fetchAccounts("item"), (error) => {
      const original = z
        .object({
          response: z.object({
            statusCode: z.number(),
            headers: z.object({ "retry-after": z.string() }),
          }),
        })
        .parse(error);
      assert.equal(original.response.statusCode, status);
      assert.equal(original.response.headers["retry-after"], "42");
      return true;
    });
    await assert.rejects(
      financialSource(sdk).page({
        resource: "accounts",
        item: "item",
        parent: "",
        cursor: null,
        floor: null,
      }),
      (error) =>
        error instanceof Fault &&
        error.code === code &&
        required(error.details).retryAfterSeconds === 42 &&
        !JSON.stringify(error).includes("private"),
    );
    assert.equal(requests, status === 401 ? 4 : 3);
  }
  assert.equal(log.mock.calls.length, 0);
  mockNetwork(async (input) =>
    sourceUrl(input).pathname === "/auth"
      ? auth()
      : new Response("malformed success"),
  );
  await assert.rejects(readAccount(client(), "account"), /INVALID_RESPONSE/);
});

test("redirects are rejected before reading their body or forwarding API keys", async () => {
  for (const redirectAt of ["/auth", "/accounts/account", "/connect_token"]) {
    let calls = 0;
    mockNetwork(async (input) => {
      calls++;
      const path = sourceUrl(input).pathname;
      if (path === "/auth" && redirectAt !== path) {
        return auth();
      }
      assert.equal(path, redirectAt);
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([65]));
          },
        }),
        {
          status: 302,
          headers: { Location: "https://private.invalid/forbidden" },
        },
      );
    });
    const sdk = client();
    await assert.rejects(
      redirectAt === "/connect_token"
        ? sdk.createConnectToken()
        : readAccount(sdk, "account"),
      /UPSTREAM_REDIRECT/,
    );
    assert.equal(calls, redirectAt === "/auth" ? 1 : 2);
  }
});

test("byte limits stop streaming reads regardless of missing or dishonest Content-Length", async () => {
  for (const headers of [
    new Headers(),
    new Headers({ "Content-Length": "1" }),
    new Headers({ "Content-Length": "5000000" }),
  ]) {
    let chunks = 0;
    mockNetwork(async (input) => {
      if (sourceUrl(input).pathname === "/auth") {
        return auth();
      }
      return new Response(
        new ReadableStream({
          pull(controller) {
            chunks++;
            // Endless input proves rejection happens during reading, not after EOF.
            controller.enqueue(new Uint8Array(1000000));
          },
        }),
        { headers },
      );
    });
    await assert.rejects(
      readAccount(client(), "account"),
      /UPSTREAM_TOO_LARGE/,
    );
    assert.ok(chunks < 10, `stream stopped after ${chunks} chunks`);
  }
  for (const path of ["/auth", "/connect_token"]) {
    mockNetwork(async (input) => {
      if (sourceUrl(input).pathname === "/auth" && path !== "/auth") {
        return auth();
      }
      return new Response("x".repeat(16385));
    });
    await assert.rejects(
      pluggyClient(credentials, 16384).createConnectToken(),
      /UPSTREAM_TOO_LARGE/,
    );
    await assert.rejects(connectToken(credentials), /CONNECT_TOKEN_FAILED/);
  }
});

test("Fetch request timeout covers a stalled response body and does not retry", async () => {
  let calls = 0;
  mockNetwork(async (input) => {
    calls++;
    if (sourceUrl(input).pathname === "/auth") {
      return auth();
    }
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([123]));
        },
      }),
    );
  });
  const sdk = new PersonalPluggyClient(credentials, 4000000, 30);
  await assert.rejects(readAccount(sdk, "account"), /UPSTREAM_TIMEOUT/);
  assert.equal(calls, 2);
});

test("SDK pages preserve encoded cursors, creation floor, response scope and explicit IDs", async () => {
  const floor = "2026-10-01T00:00:00.000Z";
  const cursor = "a+/=x";
  const paths: URL[] = [];
  mockNetwork(async (input) => {
    const url = sourceUrl(input);
    if (url.pathname === "/auth") {
      return auth();
    }
    paths.push(url);
    assert.equal(url.pathname, "/v2/transactions");
    if (url.searchParams.has("ids")) {
      return Response.json({
        results: [{ id: "tx", accountId: "account" }],
        next: null,
      });
    }
    return Response.json({
      results: [],
      next:
        paths.length === 1
          ? `?accountId=account&after=${encodeURIComponent(cursor)}`
          : null,
    });
  });
  const source = financialSource(client());
  const first = await source.page({
    resource: "transactions",
    item: "item",
    parent: "account",
    cursor: null,
    floor: floor,
  });
  assert.equal(first.next, cursor);
  await source.page({
    resource: "transactions",
    item: "item",
    parent: "account",
    cursor: first.next,
    floor: floor,
  });
  assert.equal(required(paths[1]).searchParams.get("after"), cursor);
  assert.equal(required(paths[0]).searchParams.get("createdAtFrom"), floor);
  assert.equal(required(paths[1]).searchParams.get("createdAtFrom"), floor);
  assert.equal(required((await source.ids("account", ["tx"]))[0]).id, "tx");
  assert.equal(required(paths[2]).searchParams.get("ids"), "tx");
  for (const [value, code] of [
    ["https://evil.invalid", /INVALID_CURSOR/],
    ["?accountId=other&after=a", /CURSOR_SCOPE_MISMATCH/],
    ["?accountId=account&after=a&after=b", /CURSOR_SCOPE_MISMATCH/],
    ["?accountId=account&after=a&createdAtFrom=wrong", /CURSOR_SCOPE_MISMATCH/],
    ["?accountId=account&after=a&ids=tx", /CURSOR_SCOPE_MISMATCH/],
    ["?accountId=account&after=previous", /CURSOR_LOOP/],
  ] satisfies [string, RegExp][]) {
    mockNetwork(async (input) =>
      sourceUrl(input).pathname === "/auth"
        ? auth()
        : Response.json({ results: [], next: value }),
    );
    await assert.rejects(
      financialSource(client()).page({
        resource: "transactions",
        item: "item",
        parent: "account",
        cursor: "previous",
        floor: floor,
      }),
      code,
    );
  }
  mockNetwork(async (input) =>
    sourceUrl(input).pathname === "/auth"
      ? auth()
      : Response.json({
          results: [{ id: "tx", accountId: "other" }],
          next: null,
        }),
  );
  await assert.rejects(
    financialSource(client()).page({
      resource: "transactions",
      item: "item",
      parent: "account",
      cursor: null,
      floor: floor,
    }),
    /SOURCE_SCOPE_MISMATCH/,
  );
  await assert.rejects(
    financialSource(client()).ids("account", ["tx"]),
    /IDS_SCOPE_MISMATCH/,
  );
  mockNetwork(async (input) =>
    sourceUrl(input).pathname === "/auth"
      ? auth()
      : Response.json({ id: "another-account", balance: "10.00" }),
  );
  await assert.rejects(
    readAccount(client(), "account"),
    /SOURCE_SCOPE_MISMATCH/,
  );
});

test("429 Retry-After is returned to the Workflow and waited outside a durable step", async () => {
  let reads = 0;
  mockNetwork(async (input) => {
    if (sourceUrl(input).pathname === "/auth") {
      return auth();
    }
    reads++;
    return reads === 1
      ? new Response("private", {
          status: 429,
          headers: { "Retry-After": "90" },
        })
      : Response.json({ id: "account" });
  });
  const sleeps: string[] = [];
  let inside = false;
  const steps = providerRetries({
    async do(_name, callback) {
      inside = true;
      const value = await callback();
      inside = false;
      return value;
    },
    async sleep(_name, duration) {
      assert.equal(inside, false);
      sleeps.push(duration);
      assert.equal(reads, 1);
    },
  });
  const sdk = client();
  assert.equal(
    await steps.do(
      "account",
      async () => (await readAccount(sdk, "account")).id,
    ),
    "account",
  );
  assert.deepEqual(sleeps, ["90 seconds"]);
  assert.equal(reads, 2);
});

test("every financial resource uses the public SDK operation with one-page checkpoints", async () => {
  const paths: URL[] = [];
  mockNetwork(async (input) => {
    const url = sourceUrl(input);
    if (url.pathname === "/auth") {
      return auth();
    }
    paths.push(url);
    if (url.pathname === "/items/item") {
      return Response.json({ id: "item" });
    }
    if (url.pathname === "/connectors/200") {
      return Response.json({ id: 200 });
    }
    if (url.pathname === "/identity") {
      return Response.json({ id: "identity", itemId: "item" });
    }
    return Response.json({
      results: [{ id: "record" }],
      page: url.searchParams.get("page") ?? 1,
      totalPages: url.searchParams.has("page") ? 2 : 1,
      total: 2,
    });
  });
  const source = financialSource(client());
  const operations = [
    ["connections", "/items/item"],
    ["resources", "/items/item/resources"],
    ["connectors", "/connectors/200"],
    ["consents", "/consents"],
    ["accounts", "/accounts"],
    ["investments", "/investments"],
    ["investment_transactions", "/investments/parent/transactions"],
    ["bills", "/bills"],
    ["loans", "/loans"],
    ["identity", "/identity"],
    ["categories", "/categories"],
    ["statements", "/accounts/parent/statements"],
  ] satisfies [Parameters<typeof source.page>[0]["resource"], string][];
  for (const [resource, path] of operations) {
    const before = paths.length;
    const page = await source.page({
      resource: resource,
      item: "item",
      parent: "parent",
      cursor: null,
      floor: null,
      connectorId: "200",
    });
    assert.equal(paths.length, before + 1);
    assert.equal(required(paths[before]).pathname, path);
    assert.equal(page.records.length, 1);
    if (required(paths[before]).searchParams.has("page")) {
      assert.equal(page.next, "2");
      const last = await source.page({
        resource: resource,
        item: "item",
        parent: "parent",
        cursor: page.next,
        floor: null,
        connectorId: "200",
      });
      assert.equal(last.next, null);
      assert.equal(required(paths[before + 1]).searchParams.get("page"), "2");
      assert.equal(
        required(paths[before + 1]).searchParams.get("pageSize"),
        "100",
      );
    }
  }
});
