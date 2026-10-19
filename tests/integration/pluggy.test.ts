import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import { Fault } from "../../src/domain";
import { tryCatch } from "../../src/shared";
import {
  connectToken,
  createPluggyAdapter,
  financialSource,
  PersonalPluggyClient,
  providerRetries,
  readAccount,
} from "../../src/worker/pluggy";
import { required, sourceUrl } from "../support";
import { mockNetwork, syntheticJwt } from "../support/network";

const pluggyAccountNotConfiguredPattern = /PLUGGY_ACCOUNT_NOT_CONFIGURED/;
const upstreamAuthPattern = /UPSTREAM_AUTH/;
const invalidResponsePattern = /INVALID_RESPONSE/;
const upstreamRedirectPattern = /UPSTREAM_REDIRECT/;
const upstreamTooLargePattern = /UPSTREAM_TOO_LARGE/;
const connectTokenFailedPattern = /CONNECT_TOKEN_FAILED/;
const upstreamTimeoutPattern = /UPSTREAM_TIMEOUT/;
const invalidCursorPattern = /INVALID_CURSOR/;
const cursorScopeMismatchPattern = /CURSOR_SCOPE_MISMATCH/;
const cursorLoopPattern = /CURSOR_LOOP/;
const sourceIdentityMismatchPattern = /SOURCE_IDENTITY_MISMATCH/;
const sourceSelectionMismatchPattern = /SOURCE_SELECTION_MISMATCH/;

const credentials = {
  clientId: "synthetic-client",
  clientSecret: "synthetic-secret",
};
const origin = "https://api.pluggy.ai";
const client = () => new PersonalPluggyClient(credentials);
const auth = () => Response.json({ apiKey: syntheticJwt() });

beforeEach(() =>
  mockNetwork(() => Promise.reject(new Error("Unexpected synthetic request"))),
);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("Pluggy adapter stays lazy and reports missing deployment credentials", async () => {
  const missing = createPluggyAdapter({
    clientId: undefined,
    clientSecret: undefined,
  });
  assert.equal(missing.account.configured, false);
  await [
    () => missing.account.application(),
    () => missing.financialSource(),
    () => missing.readAccount("synthetic-account"),
  ].reduce(async (priorCase, use) => {
    await priorCase;
    await assert.rejects(use(), pluggyAccountNotConfiguredPattern);
  }, Promise.resolve());
});

test("SDK/Fetch in workerd preserve numeric lexemes and date strings on auth, reads and mutations", async () => {
  const urls: URL[] = [];
  mockNetwork((input) => {
    const url = sourceUrl(input);
    urls.push(url);
    assert.equal(url.origin, origin);
    if (url.pathname === "/auth") {
      return Promise.resolve(auth());
    }
    return Promise.resolve(
      new Response(
        '{"id":"account","balance":9007199254740993.29,"quantity":1.234567890123456789,"updatedAt":"2026-10-01T01:02:03-03:00","accessToken":"synthetic-connect"}',
      ),
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
  mockNetwork((input, init) => {
    if (sourceUrl(input).pathname === "/auth") {
      authentications += 1;
      return Promise.resolve(
        Response.json({ apiKey: syntheticJwt(String(authentications)) }),
      );
    }
    reads += 1;
    tokens.push(new Headers(init?.headers).get("X-API-KEY") ?? "");
    if (reads === 2) {
      return Promise.resolve(
        new Response("private unauthorized body", { status: 401 }),
      );
    }
    return Promise.resolve(Response.json({ id: "account" }));
  });
  const alice = client();
  const bob = new PersonalPluggyClient({
    clientId: "other-client",
    clientSecret: "other-secret",
  });
  await alice.fetchAccount("account");
  await assert.rejects(readAccount(alice, "account"), upstreamAuthPattern);
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
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await (
    [
      [400, "private invalid request", "UPSTREAM_INVALID_REQUEST"],
      [401, "", "UPSTREAM_AUTH"],
      [403, "private forbidden", "UPSTREAM_FORBIDDEN"],
      [404, "private missing", "UPSTREAM_NOT_FOUND"],
      [429, "<html>private rate limit</html>", "UPSTREAM_RATE_LIMIT"],
      [503, "private unavailable", "UPSTREAM_ERROR"],
    ] satisfies [number, string, string][]
  ).reduce(async (priorCase, [status, body, code]) => {
    await priorCase;
    let requests = 0;
    mockNetwork((input) => {
      requests += 1;
      if (sourceUrl(input).pathname === "/auth") {
        return Promise.resolve(auth());
      }
      return Promise.resolve(
        new Response(body, { headers: { "Retry-After": "42" }, status }),
      );
    });
    const sdk = client();
    await assert.rejects(sdk.fetchAccounts("item"), (error) => {
      const original = z
        .object({
          response: z.object({
            headers: z.object({ "retry-after": z.string() }),
            statusCode: z.number(),
          }),
        })
        .parse(error);
      assert.equal(original.response.statusCode, status);
      assert.equal(original.response.headers["retry-after"], "42");
      return true;
    });
    await assert.rejects(
      financialSource(sdk).page({
        cursor: null,
        floor: null,
        item: "item",
        parent: "",
        resource: "accounts",
      }),
      (error) =>
        error instanceof Fault &&
        error.code === code &&
        required(error.details).retryAfterSeconds === 42 &&
        !JSON.stringify(error).includes("private"),
    );
    assert.equal(requests, status === 401 ? 4 : 3);
  }, Promise.resolve());
  assert.equal(log.mock.calls.length, 0);
  mockNetwork(async (input) =>
    sourceUrl(input).pathname === "/auth"
      ? auth()
      : new Response("malformed success"),
  );
  await assert.rejects(
    readAccount(client(), "account"),
    invalidResponsePattern,
  );
});

test("redirects are rejected before reading their body or forwarding API keys", async () => {
  await ["/auth", "/accounts/account", "/connect_token"].reduce(
    async (priorCase, redirectAt) => {
      await priorCase;
      let calls = 0;
      mockNetwork((input) => {
        calls += 1;
        const { pathname: path } = sourceUrl(input);
        if (path === "/auth" && redirectAt !== path) {
          return Promise.resolve(auth());
        }
        assert.equal(path, redirectAt);
        return Promise.resolve(
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array([65]));
              },
            }),
            {
              headers: { Location: "https://private.invalid/forbidden" },
              status: 302,
            },
          ),
        );
      });
      const sdk = client();
      await assert.rejects(
        redirectAt === "/connect_token"
          ? sdk.createConnectToken()
          : readAccount(sdk, "account"),
        upstreamRedirectPattern,
      );
      assert.equal(calls, redirectAt === "/auth" ? 1 : 2);
    },
    Promise.resolve(),
  );
});

test("byte limits stop streaming reads regardless of missing or dishonest Content-Length", async () => {
  await [
    new Headers(),
    new Headers({ "Content-Length": "1" }),
    new Headers({ "Content-Length": "5000000" }),
  ].reduce(async (priorCase, headers) => {
    await priorCase;
    let chunks = 0;
    mockNetwork((input) => {
      if (sourceUrl(input).pathname === "/auth") {
        return Promise.resolve(auth());
      }
      return Promise.resolve(
        new Response(
          new ReadableStream({
            pull(controller) {
              chunks += 1;
              // Endless input proves rejection happens during reading, not after EOF.
              controller.enqueue(new Uint8Array(1_000_000));
            },
          }),
          { headers },
        ),
      );
    });
    await assert.rejects(
      readAccount(client(), "account"),
      upstreamTooLargePattern,
    );
    assert.ok(chunks < 10, `stream stopped after ${chunks} chunks`);
  }, Promise.resolve());
  await ["/auth", "/connect_token"].reduce(async (priorCase, path) => {
    await priorCase;
    mockNetwork((input) => {
      if (sourceUrl(input).pathname === "/auth" && path !== "/auth") {
        return Promise.resolve(auth());
      }
      return Promise.resolve(new Response("x".repeat(16_385)));
    });
    await assert.rejects(
      new PersonalPluggyClient(credentials, 16_384).createConnectToken(),
      upstreamTooLargePattern,
    );
    await assert.rejects(connectToken(credentials), connectTokenFailedPattern);
  }, Promise.resolve());
});

test("Fetch request timeout covers a stalled response body and does not retry", async () => {
  let calls = 0;
  mockNetwork((input) => {
    calls += 1;
    if (sourceUrl(input).pathname === "/auth") {
      return Promise.resolve(auth());
    }
    return Promise.resolve(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([123]));
          },
        }),
      ),
    );
  });
  const sdk = new PersonalPluggyClient(credentials, 4_000_000, 30);
  await assert.rejects(readAccount(sdk, "account"), upstreamTimeoutPattern);
  assert.equal(calls, 2);
});

test("SDK pages preserve encoded cursors, creation floor, response scope and explicit IDs", async () => {
  const floor = "2026-10-01T00:00:00.000Z";
  const cursor = "a+/=x";
  const paths: URL[] = [];
  mockNetwork((input) => {
    const url = sourceUrl(input);
    if (url.pathname === "/auth") {
      return Promise.resolve(auth());
    }
    paths.push(url);
    assert.equal(url.pathname, "/v2/transactions");
    if (url.searchParams.has("ids")) {
      return Promise.resolve(
        Response.json({
          next: null,
          results: [{ accountId: "account", id: "tx" }],
        }),
      );
    }
    return Promise.resolve(
      Response.json({
        next:
          paths.length === 1
            ? `?accountId=account&after=${encodeURIComponent(cursor)}`
            : null,
        results: [],
      }),
    );
  });
  const source = financialSource(client());
  const first = await source.page({
    cursor: null,
    floor,
    item: "item",
    parent: "account",
    resource: "transactions",
  });
  assert.equal(first.next, cursor);
  await source.page({
    cursor: first.next,
    floor,
    item: "item",
    parent: "account",
    resource: "transactions",
  });
  assert.equal(required(paths[1]).searchParams.get("after"), cursor);
  assert.equal(required(paths[0]).searchParams.get("createdAtFrom"), floor);
  assert.equal(required(paths[1]).searchParams.get("createdAtFrom"), floor);
  assert.equal(required((await source.ids("account", ["tx"]))[0]).id, "tx");
  assert.equal(required(paths[2]).searchParams.get("ids"), "tx");
  await (
    [
      ["https://evil.invalid", invalidCursorPattern],
      ["?accountId=other&after=a", cursorScopeMismatchPattern],
      ["?accountId=account&after=a&after=b", cursorScopeMismatchPattern],
      [
        "?accountId=account&after=a&createdAtFrom=wrong",
        cursorScopeMismatchPattern,
      ],
      ["?accountId=account&after=a&ids=tx", cursorScopeMismatchPattern],
      ["?accountId=account&after=previous", cursorLoopPattern],
    ] satisfies [string, RegExp][]
  ).reduce(async (priorCase, [value, code]) => {
    await priorCase;
    mockNetwork(async (input) =>
      sourceUrl(input).pathname === "/auth"
        ? auth()
        : Response.json({ next: value, results: [] }),
    );
    await assert.rejects(
      financialSource(client()).page({
        cursor: "previous",
        floor,
        item: "item",
        parent: "account",
        resource: "transactions",
      }),
      code,
    );
  }, Promise.resolve());
  mockNetwork(async (input) =>
    sourceUrl(input).pathname === "/auth"
      ? auth()
      : Response.json({
          next: null,
          results: [{ accountId: "other", id: "tx" }],
        }),
  );
  await assert.rejects(
    financialSource(client()).page({
      cursor: null,
      floor,
      item: "item",
      parent: "account",
      resource: "transactions",
    }),
    sourceIdentityMismatchPattern,
  );
  await assert.rejects(
    financialSource(client()).ids("account", ["tx"]),
    sourceSelectionMismatchPattern,
  );
  mockNetwork(async (input) =>
    sourceUrl(input).pathname === "/auth"
      ? auth()
      : Response.json({ balance: "10.00", id: "another-account" }),
  );
  await assert.rejects(
    readAccount(client(), "account"),
    sourceIdentityMismatchPattern,
  );
});

test("429 and timeout stop the current cycle outside the durable step without retry", async () => {
  await ["UPSTREAM_RATE_LIMIT", "UPSTREAM_TIMEOUT"].reduce(
    async (previous, code) => {
      await previous;
      const attempts: string[] = [];
      const sleeps: string[] = [];
      const steps = providerRetries({
        async do(name, callback) {
          attempts.push(name);
          return await callback();
        },
        sleep(name) {
          sleeps.push(name);
          return Promise.resolve();
        },
      });
      const fault = new Fault(
        code === "UPSTREAM_TIMEOUT"
          ? "UPSTREAM_TIMEOUT"
          : "UPSTREAM_RATE_LIMIT",
      );
      fault.details = { retryAfterSeconds: 90 };
      await assert.rejects(
        steps.do("source", () => Promise.reject(fault)),
        (error) =>
          error instanceof Fault &&
          error.code === code &&
          error.details?.retryAfterSeconds === 90,
      );
      assert.deepEqual(attempts, ["source-attempt-0"]);
      assert.deepEqual(sleeps, []);
    },
    Promise.resolve(),
  );
});

test("every financial resource uses the public SDK operation with one-page checkpoints", async () => {
  const paths: URL[] = [];
  mockNetwork((input) => {
    const url = sourceUrl(input);
    if (url.pathname === "/auth") {
      return Promise.resolve(auth());
    }
    paths.push(url);
    if (url.pathname === "/items/item") {
      return Promise.resolve(Response.json({ id: "item" }));
    }
    if (url.pathname === "/connectors/200") {
      return Promise.resolve(Response.json({ id: 200 }));
    }
    if (url.pathname === "/identity") {
      return Promise.resolve(Response.json({ id: "identity", itemId: "item" }));
    }
    return Promise.resolve(
      Response.json({
        page: url.searchParams.get("page") ?? 1,
        results: [{ id: "record", itemId: "item" }],
        total: 2,
        totalPages: url.searchParams.has("page") ? 2 : 1,
      }),
    );
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
  await operations.reduce(async (priorCase, [resource, path]) => {
    await priorCase;
    const { length: before } = paths;
    const page = await source.page({
      connectorId: "200",
      cursor: null,
      floor: null,
      item: "item",
      parent: "parent",
      resource,
    });
    assert.equal(paths.length, before + 1);
    assert.equal(required(paths[before]).pathname, path);
    assert.equal(page.records.length, 1);
    if (required(paths[before]).searchParams.has("page")) {
      assert.equal(page.next, "2");
      const last = await source.page({
        connectorId: "200",
        cursor: page.next,
        floor: null,
        item: "item",
        parent: "parent",
        resource,
      });
      assert.equal(last.next, null);
      assert.equal(required(paths[before + 1]).searchParams.get("page"), "2");
      assert.equal(
        required(paths[before + 1]).searchParams.get("pageSize"),
        "100",
      );
    }
  }, Promise.resolve());
});

test("MeuPluggy consent pagination keeps upstream identity inside the requested proxy scope", async () => {
  const paths: URL[] = [];
  mockNetwork((input) => {
    const url = sourceUrl(input);
    if (url.pathname === "/auth") {
      return Promise.resolve(auth());
    }
    paths.push(url);
    return Promise.resolve(
      Response.json({
        page: Number(url.searchParams.get("page")),
        results: [{ id: "consent", itemId: "upstream-item" }],
        total: 2,
        totalPages: 2,
      }),
    );
  });
  const source = financialSource(client());
  const selection = {
    connectorId: "200",
    cursor: null,
    floor: null,
    item: "proxy-item",
    parent: "",
    resource: "consents" as const,
  };
  const first = await source.page(selection);
  assert.equal(first.records[0]?.itemId, "upstream-item");
  assert.equal(first.next, "2");
  const second = await source.page({ ...selection, cursor: first.next });
  assert.equal(second.next, null);
  assert.deepEqual(
    paths.map((url) => url.searchParams.get("itemId")),
    ["proxy-item", "proxy-item"],
  );
  assert.deepEqual(
    paths.map((url) => url.searchParams.get("page")),
    ["1", "2"],
  );
  await assert.rejects(
    source.page({ ...selection, connectorId: "201" }),
    sourceIdentityMismatchPattern,
  );
});

test("consents reject missing, null and empty Item identities at the provider boundary", async () => {
  await [
    { id: "consent" },
    { id: "consent", itemId: null },
    { id: "consent", itemId: "" },
  ].reduce(async (previous, record) => {
    await previous;
    mockNetwork(async (input) =>
      sourceUrl(input).pathname === "/auth"
        ? auth()
        : Response.json({
            page: 1,
            results: [record],
            total: 1,
            totalPages: 1,
          }),
    );
    await assert.rejects(
      financialSource(client()).page({
        connectorId: "200",
        cursor: null,
        floor: null,
        item: "proxy-item",
        parent: "",
        resource: "consents",
      }),
      (error) => error instanceof z.ZodError,
    );
  }, Promise.resolve());
});

test("identity failures stop outside the durable step instead of consuming transient retries", async () => {
  let reads = 0;
  const wrapped = providerRetries({
    async do(_name, callback) {
      return await [1, 2].reduce(async (previous) => {
        const { data, error } = await tryCatch(previous);
        if (error) {
          return await callback();
        }
        return data;
      }, callback());
    },
    sleep: () => Promise.resolve(),
  });
  await assert.rejects(
    wrapped.do("source", () => {
      reads += 1;
      return Promise.reject(new Error("SOURCE_IDENTITY_MISMATCH"));
    }),
    sourceIdentityMismatchPattern,
  );
  assert.equal(reads, 1);
});
