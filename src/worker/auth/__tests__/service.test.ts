import assert from "node:assert/strict";
import test from "node:test";

import type { AuthRepository } from "../entity";
import { createAuthService } from "../service";

await test("authentication use case checks installation version before exposing a stored session", async () => {
  const reads: number[] = [];
  const repository: AuthRepository = {
    allowLoginAttempt: async () => true,
    compact: () => Promise.resolve(),
    revokeSession: () => Promise.resolve(),
    saveSession: () => Promise.resolve(),
    session: (_id, now) => {
      reads.push(now);
      return Promise.resolve({
        auth_version: "current",
        csrf: "synthetic-csrf",
        expires: 10_000,
      });
    },
  };
  assert.equal(
    await createAuthService(repository, "previous", () => 100).readSession(
      "session",
    ),
    null,
  );
  assert.equal(
    (
      await createAuthService(repository, "current", () => 200).readSession(
        "session",
      )
    )?.csrf,
    "synthetic-csrf",
  );
  assert.equal(
    await createAuthService(repository, "current").readSession("x".repeat(101)),
    null,
  );
  assert.deepEqual(reads, [100, 200]);
});
