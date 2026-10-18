import assert from "node:assert/strict";
import test from "node:test";

import type { AuthRepository } from "../entity";
import { createAuthService } from "../service";

await test("authentication use case checks installation version before exposing a stored session", async () => {
  const reads: number[] = [];
  const repository: AuthRepository = {
    compact: async () => {},
    session: async (_id, now) => {
      reads.push(now);
      return {
        csrf: "synthetic-csrf",
        expires: 10000,
        auth_version: "current",
      };
    },
    saveSession: async () => {},
    allowLoginAttempt: async () => true,
    revokeSession: async () => {},
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
