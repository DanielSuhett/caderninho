import assert from "node:assert/strict";
import test from "node:test";

import { FaultCode } from "#domain/enums.ts";
import { Fault } from "#domain/fault.ts";
import { tryCatch } from "#shared/result.ts";

await test("tryCatch discriminates null success and normalizes thrown values", async () => {
  assert.deepEqual(await tryCatch(Promise.resolve(null)), {
    data: null,
    error: null,
  });

  for (const [caught, expected] of [
    ["failure", "failure"],
    [null, "null"],
    [7, "7"],
    [{ reason: "synthetic" }, "[object Object]"],
  ] as const) {
    const result = await tryCatch(Promise.reject(caught));
    assert.equal(result.data, null);
    assert.ok(result.error instanceof Error);
    assert.equal(result.error.message, expected);
  }

  const fault = new Fault(FaultCode.UPSTREAM_RATE_LIMIT);
  fault.details = { retryAfterSeconds: 42 };
  assert.equal((await tryCatch(Promise.reject(fault))).error, fault);
});
