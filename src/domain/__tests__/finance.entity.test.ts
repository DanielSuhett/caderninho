import assert from "node:assert/strict";
import test from "node:test";

import {
  assertEntityIdentity,
  type CorrectionInput,
  entityChange,
  projectEntity,
  recordChange,
} from "../finance.entity";

await test("unchanged data is observed without classification; resurrection and explicit renormalization remain changes", () => {
  const input = { digest: "synthetic-hash", renormalize: false };
  const previous = { relevantHash: input.digest, deleted: false };
  assert.equal(entityChange({ ...input, previous: undefined }), "new");
  assert.equal(entityChange({ ...input, previous }), "unchanged");
  assert.equal(
    entityChange({ ...input, previous, renormalize: true }),
    "changed",
  );
  assert.equal(
    entityChange({ ...input, previous: { ...previous, deleted: true } }),
    "changed",
  );
  assert.equal(
    entityChange({ ...input, previous, digest: "changed-hash" }),
    "changed",
  );
  assert.doesNotThrow(() =>
    assertEntityIdentity({
      source: { resourceId: "resource" },
      expectedId: "resource",
    }),
  );
  assert.throws(
    () =>
      assertEntityIdentity({
        source: { id: "foreign", resourceId: "resource" },
        expectedId: "resource",
      }),
    /SOURCE_ID_MISMATCH/,
  );
});

await test("maturity is inclusive, retains zero money and never promotes future or pending records", () => {
  const legacyProjection = {
    id: "synthetic-tx",
    accountingDate: "2026-10-18",
    amountMinor: "0",
    currencyCode: "BRL",
  };
  const input = {
    resource: "transactions" as const,
    raw: { id: legacyProjection.id },
    parent: undefined,
    referenceDay: "2026-10-18",
    legacyProjection,
  };
  assert.equal(projectEntity(input).eligible, true);
  assert.equal(projectEntity(input).amountText, "0");
  assert.equal(
    projectEntity({ ...input, referenceDay: "2026-10-17" }).eligible,
    false,
  );
  assert.equal(
    projectEntity({
      ...input,
      legacyProjection: { ...legacyProjection, status: "PENDING" },
    }).eligible,
    false,
  );
  assert.equal(
    projectEntity({
      ...input,
      legacyProjection: { ...legacyProjection, accountingDate: null },
    }).eligible,
    false,
  );
});

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
