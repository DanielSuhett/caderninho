import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod/v4";

import {
  HttpRequestError,
  httpClient,
  httpResponseFailure,
  rateLimitRetry,
  requestJson,
} from "..";

await test("HTTP failures classify authorization, redirects and rate limits without reading bodies or retrying commands", async () => {
  await Promise.all(
    ["GET", "POST"].map(async (method) => {
      await Promise.all(
        (
          [
            [401, "unauthorized"],
            [403, "forbidden"],
            [302, "redirect"],
            [404, "not_found"],
            [429, "rate_limit"],
            [503, "server"],
            [422, "invalid_request"],
          ] as const
        ).map(async ([status, kind]) => {
          let calls = 0;
          let cancelled = false;
          const client = httpClient.extend({
            fetch: () => {
              calls += 1;
              return Promise.resolve(
                new Response(
                  new ReadableStream({
                    cancel() {
                      cancelled = true;
                    },
                    pull() {
                      throw new Error("Failure bodies must not be read");
                    },
                    start(controller) {
                      controller.enqueue(
                        new TextEncoder().encode("private unfinished response"),
                      );
                    },
                  }),
                  { headers: { "Retry-After": "42" }, status },
                ),
              );
            },
          });
          await assert.rejects(
            requestJson({
              client,
              input: "https://private.test/?secret=synthetic",
              options: { method, totalTimeout: 1000 },
            }),
            (error) => {
              assert.ok(error instanceof HttpRequestError);
              assert.equal(error.failure.kind, kind);
              assert.equal(error.failure.status, status);
              assert.equal(error.failure.retryAfter, "42");
              assert.ok(!JSON.stringify(error).includes("private"));
              return true;
            },
          );
          assert.equal(calls, 1);
          assert.equal(cancelled, true);
        }),
      );
    }),
  );
  assert.deepEqual(httpResponseFailure({ status: 0, type: "opaqueredirect" }), {
    kind: "redirect",
    status: 0,
  });
});

await test("JSON validation and custom HTTP failure translation share one request", async () => {
  let calls = 0;
  const schema = z.object({ value: z.number() });
  const client = httpClient.extend({
    fetch: () => {
      calls += 1;
      return Promise.resolve(Response.json({ private: "discarded", value: 0 }));
    },
  });
  assert.deepEqual(
    await requestJson({ client, input: "https://synthetic.test", schema }),
    { value: 0 },
  );
  assert.equal(calls, 1);
  await Promise.all(
    ["invalid JSON", JSON.stringify({ value: false })].map(async (body) => {
      await assert.rejects(
        requestJson({
          client: client.extend({ fetch: async () => new Response(body) }),
          input: "https://synthetic.test",
          schema,
        }),
        (error) =>
          error instanceof HttpRequestError &&
          error.failure.kind === "invalid_response",
      );
    }),
  );
  const mapped = new Error("application failure");
  await assert.rejects(
    requestJson({
      client: client.extend({
        fetch: () => {
          calls += 1;
          return Promise.resolve(
            Response.json(
              { issue: "rate", private: "discarded" },
              { status: 429 },
            ),
          );
        },
      }),
      input: "https://synthetic.test",
      async onHttpFailure({ failure, request }) {
        assert.equal(failure.kind, "rate_limit");
        assert.deepEqual(
          await request.json(z.object({ issue: z.literal("rate") })),
          { issue: "rate" },
        );
        return mapped;
      },
    }),
    (error) => error === mapped,
  );
  assert.equal(calls, 2);
});

await test("transport failure normalization covers network, response size and a stalled body deadline", async () => {
  await assert.rejects(
    requestJson({
      client: httpClient.extend({
        fetch: () => Promise.reject(new TypeError("Failed to fetch")),
      }),
      input: "https://synthetic.test",
    }),
    (error) =>
      error instanceof HttpRequestError && error.failure.kind === "network",
  );
  await assert.rejects(
    requestJson({
      client: httpClient.extend({
        fetch: async () =>
          new Response("x".repeat(40), { headers: { "Content-Length": "40" } }),
      }),
      input: "https://synthetic.test",
      options: { maxResponseSize: 20 },
    }),
    (error) =>
      error instanceof HttpRequestError && error.failure.kind === "too_large",
  );
  let calls = 0;
  const client = httpClient.extend({
    fetch: (input) => {
      calls += 1;
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("{"));
              input.signal.addEventListener(
                "abort",
                () => controller.error(input.signal.reason),
                { once: true },
              );
            },
          }),
        ),
      );
    },
  });
  await assert.rejects(
    requestJson({
      client,
      input: "https://synthetic.test",
      options: { totalTimeout: 30 },
    }),
    (error) =>
      error instanceof HttpRequestError && error.failure.kind === "timeout",
  );
  assert.equal(calls, 1);
});

await test("Retry-After preserves zero, handles HTTP dates and bounds the durable retry delay", ({
  mock,
}) => {
  mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-10-18T12:00:00Z"),
  });
  for (const [retryAfter, expected] of [
    ["0", 0],
    ["42", 42],
    ["9999999", 86_400],
    ["Sun, 18 Oct 2026 12:01:30 GMT", 90],
    ["Sun, 18 Oct 2026 11:59:00 GMT", 0],
    ["invalid", undefined],
    [null, undefined],
  ] as const) {
    assert.equal(
      httpResponseFailure({ retryAfter, status: 429 })?.retryAfterSeconds,
      expected,
    );
    if (retryAfter !== null && retryAfter !== undefined) {
      assert.equal(
        httpResponseFailure({ retryAfter, status: 429 })?.retryAfter,
        retryAfter,
      );
    }
  }
  assert.equal(rateLimitRetry.delay({ attempt: 0 }), 10);
  assert.equal(rateLimitRetry.delay({ attempt: 2 }), 40);
  assert.equal(rateLimitRetry.delay({ attempt: 2, retryAfterSeconds: 0 }), 1);
  assert.equal(rateLimitRetry.delay({ attempt: 2, retryAfterSeconds: 42 }), 42);
  assert.equal(
    rateLimitRetry.delay({ attempt: 2, retryAfterSeconds: 9_999_999 }),
    86_400,
  );
});
