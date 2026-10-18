import assert from "node:assert/strict";
import test from "node:test";

import { FaultCode } from "@/domain/enums";
import { Fault } from "@/domain/fault.entity";

import { tryCatch } from "../result";

await test("tryCatch preserves falsy successes and normalizes rejected or synchronously thrown values", async () => {
  for (const value of [null, 0, false, ""] as const) {
    const { data, error } = await tryCatch(() => Promise.resolve(value));
    assert.equal(data, value);
    assert.equal(error, null);
  }

  for (const [caught, expected] of [
    ["failure", "failure"],
    [null, "null"],
    [7, "7"],
    [{ reason: "synthetic" }, "[object Object]"],
  ] as const) {
    for (const operation of [
      () => Promise.reject(caught),
      () => {
        throw caught;
      },
    ]) {
      const { data, error } = await tryCatch(operation);
      assert.equal(data, null);
      assert.ok(error instanceof Error);
      assert.equal(error.message, expected);
    }
  }

  const fault = new Fault(FaultCode.UPSTREAM_RATE_LIMIT);
  fault.details = { retryAfterSeconds: 42 };
  const { data, error } = await tryCatch(Promise.reject(fault));
  assert.equal(data, null);
  assert.equal(error, fault);
  assert.deepEqual(error.details, { retryAfterSeconds: 42 });
});
