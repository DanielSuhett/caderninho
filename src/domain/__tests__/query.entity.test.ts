import assert from "node:assert/strict";
import test from "node:test";

import { metricFor } from "../finance-model";
import {
  assertCursorScope,
  assertReadRevision,
  filterOperand,
} from "../query.entity";

await test("filter operands retain canonical zero/negative amounts and false; contains remains description-only", () => {
  assert.deepEqual(
    filterOperand({ field: "amountMinor", op: "gte", value: "0" }),
    { kind: "amount", value: "0" },
  );
  assert.deepEqual(
    filterOperand({
      field: "amountMinor",
      op: "lte",
      value: "-900719925474099329",
    }),
    { kind: "amount", value: "-900719925474099329" },
  );
  assert.deepEqual(
    filterOperand({ field: "ignored", op: "eq", value: false }),
    { kind: "scalar", value: false },
  );
  assert.deepEqual(
    filterOperand({
      field: "effective.description",
      op: "contains",
      value: "",
    }),
    { kind: "scalar", value: "" },
  );
  assert.throws(
    () => filterOperand({ field: "amountMinor", op: "eq", value: false }),
    /Invalid amount filter/,
  );
  assert.throws(
    () => filterOperand({ field: "amountMinor", op: "eq", value: "01" }),
    /canonical integer/,
  );
  assert.throws(
    () => filterOperand({ field: "currency", op: "contains", value: "BR" }),
    /contains only supports description/,
  );
});

await test("metrics are scoped to the resource and never accept inherited object members as definitions", () => {
  assert.equal(
    metricFor({ resource: "transactions", metric: undefined }),
    undefined,
  );
  assert.equal(
    metricFor({ resource: "transactions", metric: "cashFlow" })?.field,
    "signedFlowMinor",
  );
  for (const metric of ["toString", "__proto__", "missing", "cashFlow"]) {
    assert.throws(
      () => metricFor({ resource: "accounts", metric }),
      /UNKNOWN_METRIC/,
    );
  }
});

await test("reads preserve revision zero and reject mixed revisions or foreign cursor scope", () => {
  assert.doesNotThrow(() => assertReadRevision({ expected: 0, actual: 0 }));
  assert.throws(
    () => assertReadRevision({ expected: 0, actual: 1 }),
    /RESTART_REQUIRED/,
  );
  assert.throws(
    () => assertReadRevision({ expected: 2, actual: 1 }),
    /RESTART_REQUIRED/,
  );
  assert.doesNotThrow(() =>
    assertCursorScope({ expected: "same", actual: "same" }),
  );
  assert.throws(
    () => assertCursorScope({ expected: "first", actual: "other" }),
    /CURSOR_SCOPE_MISMATCH/,
  );
});
