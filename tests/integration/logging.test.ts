import assert from "node:assert/strict";

import { afterEach, beforeEach, test, vi } from "vitest";

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

test("100 account polls and 100 expired sessions remain quiet at warn", async () => {
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
        assert.notEqual(
          expired.headers.get("X-Request-ID"),
          "private-untrusted-correlation",
        );
      }),
    );
  });
  assert.deepEqual(lines, []);
});
