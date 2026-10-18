import assert from "node:assert/strict";
import test from "node:test";

import {
  recordChange,
  type CorrectionInput,
} from "#domain/record-correction.ts";

await test("local correction requires an explicit tag key and exact ignored flags, while null restores inheritance", () => {
  const reference = {
    itemId: "synthetic-item",
    resource: "transactions",
    parentId: "account",
    id: "transaction",
  } satisfies Omit<CorrectionInput, "field" | "value">;

  assert.throws(() =>
    recordChange({ ...reference, field: "tag", value: "personal" }),
  );
  assert.throws(
    () => recordChange({ ...reference, field: "ignored", value: "true" }),
    /ignored requires 0 or 1/,
  );
  assert.deepEqual(
    recordChange({ ...reference, field: "ignored", value: "1" }),
    { field: "ignored", value: "1" },
  );
  assert.deepEqual(
    recordChange({ ...reference, field: "category", value: null }),
    { field: "category", value: null },
  );
});
