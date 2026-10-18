import assert from "node:assert/strict";
import test from "node:test";

import {
  assertEntityIdentity,
  type CorrectionInput,
  entityChange,
  projectEntity,
  recordChange,
} from "../finance.entity";

const sourceIdMismatchPattern = /SOURCE_ID_MISMATCH/;
const ignoredFlagErrorPattern = /ignored requires 0 or 1/;

await test("unchanged data is observed without classification; resurrection and explicit renormalization remain changes", () => {
  const input = { digest: "synthetic-hash", renormalize: false };
  const previous = { deleted: false, relevantHash: input.digest };
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
    entityChange({ ...input, digest: "changed-hash", previous }),
    "changed",
  );
  assert.doesNotThrow(() =>
    assertEntityIdentity({
      expectedId: "resource",
      source: { resourceId: "resource" },
    }),
  );
  assert.throws(
    () =>
      assertEntityIdentity({
        expectedId: "resource",
        source: { id: "foreign", resourceId: "resource" },
      }),
    sourceIdMismatchPattern,
  );
});

await test("maturity is inclusive, retains zero money and never promotes future or pending records", () => {
  const legacyProjection = {
    accountingDate: "2026-10-18",
    amountMinor: "0",
    currencyCode: "BRL",
    id: "synthetic-tx",
  };
  const input = {
    legacyProjection,
    parent: undefined,
    raw: { id: legacyProjection.id },
    referenceDay: "2026-10-18",
    resource: "transactions" as const,
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
    id: "transaction",
    itemId: "synthetic-item",
    parentId: "account",
    resource: "transactions",
  } satisfies Omit<CorrectionInput, "field" | "value">;

  assert.throws(() =>
    recordChange({ ...reference, field: "tag", value: "personal" }),
  );
  assert.throws(
    () => recordChange({ ...reference, field: "ignored", value: "true" }),
    ignoredFlagErrorPattern,
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
