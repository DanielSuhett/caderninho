import assert from "node:assert/strict";
import test from "node:test";

import { metricFor } from "../finance-model";
import {
  assertCursorScope,
  assertReadRevision,
  filterOperand,
} from "../query.entity";

const invalidAmountFilterPattern = /Invalid amount filter/;
const canonicalIntegerErrorPattern = /canonical integer/;
const containsOnlySupportsDescriptionPattern =
  /contains only supports description/;
const unknownMetricPattern = /UNKNOWN_METRIC/;
const restartRequiredPattern = /RESTART_REQUIRED/;
const cursorScopeMismatchPattern = /CURSOR_SCOPE_MISMATCH/;

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
    invalidAmountFilterPattern,
  );
  assert.throws(
    () => filterOperand({ field: "amountMinor", op: "eq", value: "01" }),
    canonicalIntegerErrorPattern,
  );
  assert.throws(
    () => filterOperand({ field: "currency", op: "contains", value: "BR" }),
    containsOnlySupportsDescriptionPattern,
  );
});

await test("metrics are scoped to the resource and never accept inherited object members as definitions", () => {
  assert.equal(
    metricFor({ metric: undefined, resource: "transactions" }),
    undefined,
  );
  assert.equal(
    metricFor({ metric: "cashFlow", resource: "transactions" })?.field,
    "signedFlowMinor",
  );
  for (const metric of ["toString", "__proto__", "missing", "cashFlow"]) {
    assert.throws(
      () => metricFor({ metric, resource: "accounts" }),
      unknownMetricPattern,
    );
  }
});

await test("reads preserve revision zero and reject mixed revisions or foreign cursor scope", () => {
  assert.doesNotThrow(() => assertReadRevision({ actual: 0, expected: 0 }));
  assert.throws(
    () => assertReadRevision({ actual: 1, expected: 0 }),
    restartRequiredPattern,
  );
  assert.throws(
    () => assertReadRevision({ actual: 1, expected: 2 }),
    restartRequiredPattern,
  );
  assert.doesNotThrow(() =>
    assertCursorScope({ actual: "same", expected: "same" }),
  );
  assert.throws(
    () => assertCursorScope({ actual: "other", expected: "first" }),
    cursorScopeMismatchPattern,
  );
});
