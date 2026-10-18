import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";
import { z } from "zod/v4";

import { createLogger } from "../../src/shared/logger";
import worker from "../../src/worker";
import { withObservation } from "../../src/worker/observability";
import {
  cookies,
  fixture,
  login,
  origin,
  settings,
  testMigrations,
} from "./personal-fixture";
import {
  applyD1Migrations,
  createExecutionContext,
  reset,
} from "cloudflare:test";
import { env as bindings } from "cloudflare:workers";

beforeEach(async () => {
  await reset();
  await applyD1Migrations(bindings.DB, testMigrations);
});
afterEach(() => vi.unstubAllGlobals());

test("100 polls, expired sessions and incomplete installations remain quiet at warn", async () => {
  const config = settings();
  const cookie = cookies(await login(fixture(config)));
  const lines: string[] = [];
  const output = createLogger({
    destination: { write: (line) => lines.push(line) },
    level: "warn",
    name: "synthetic-worker",
  });
  await withObservation({ output }, async () => {
    await Promise.all(
      Array.from({ length: 100 }, async () => {
        const poll = await worker.fetch(
          new Request(`${origin}/api/account`, { headers: { Cookie: cookie } }),
          config,
          createExecutionContext(),
        );
        assert.equal(poll.status, 200);
        const expired = await worker.fetch(
          new Request(`${origin}/api/account`, {
            headers: { "X-Request-ID": "private-untrusted-correlation" },
          }),
          config,
          createExecutionContext(),
        );
        assert.equal(expired.status, 401);
        const unconfigured = await worker.fetch(
          new Request(`${origin}/account/login`),
          { ...config, ADMIN_PASSWORD: "" },
          createExecutionContext(),
        );
        assert.equal(unconfigured.status, 503);
        assert.notEqual(
          expired.headers.get("X-Request-ID"),
          "private-untrusted-correlation",
        );
      }),
    );
  });
  assert.deepEqual(lines, []);
});

test("a transformed account failure emits one safe correlated diagnostic and ends failed action spans", async () => {
  const config = settings();
  const cookie = cookies(await login(fixture(config)));
  const privateMarker = "private-bank-password-account-url-marker";
  const broken = {
    ...config,
    DB: new Proxy(config.DB, {
      get(target, property, receiver) {
        if (property === "prepare") {
          return () => {
            throw new Error(privateMarker);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    }),
  };
  const lines: string[] = [];
  const spans: object[] = [];
  const output = createLogger({
    destination: { write: (line) => lines.push(line) },
    level: "warn",
    name: "synthetic-worker",
  });
  const responses = await withObservation(
    { onSpan: (span) => spans.push(span), output },
    () =>
      Promise.all(
        Array.from({ length: 2 }, () =>
          worker.fetch(
            new Request(`${origin}/api/account?secret=${privateMarker}`, {
              headers: { Cookie: cookie, "X-Request-ID": privateMarker },
            }),
            broken,
            createExecutionContext(),
          ),
        ),
      ),
  );
  assert.deepEqual(
    responses.map(({ status }) => status),
    [500, 500],
  );
  assert.deepEqual(
    await Promise.all(responses.map((response) => response.json())),
    [{ issue: "unknown" }, { issue: "unknown" }],
  );
  assert.equal(lines.length, 2);
  const diagnostics = lines.map((line) =>
    z
      .object({
        action: z.literal("read"),
        correlation: z.string(),
        durationMs: z.number(),
        event: z.literal("HTTP_REQUEST"),
        failure: z.literal("INTERNAL_ERROR"),
        level: z.literal(50),
        name: z.literal("synthetic-worker"),
        outcome: z.literal("failed"),
        phase: z.literal("account.action"),
        recovery: z.literal("none"),
        status: z.literal(500),
        time: z.number(),
      })
      .strict()
      .parse(JSON.parse(line)),
  );
  const correlations = new Set(
    responses.map((response) => response.headers.get("X-Request-ID")),
  );
  assert.equal(correlations.size, 2);
  assert.deepEqual(
    new Set(diagnostics.map(({ correlation }) => correlation)),
    correlations,
  );
  const actionSpans = z
    .array(
      z
        .object({
          correlation: z.string(),
          name: z.string(),
          outcome: z.string(),
          parent: z.string().optional(),
        })
        .passthrough(),
    )
    .parse(spans)
    .filter(({ name }) => name === "account.action");
  assert.equal(actionSpans.length, 2);
  assert.deepEqual(
    new Set(actionSpans.map(({ correlation }) => correlation)),
    correlations,
  );
  assert.ok(
    actionSpans.every(
      ({ parent, outcome }) =>
        parent === "auth.request" && outcome === "failed",
    ),
  );
  assert.ok(!JSON.stringify({ lines, spans }).includes(privateMarker));
});
