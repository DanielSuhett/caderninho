import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSourceIdentity,
  assertSourceRecords,
  assertTransactionSelection,
} from "../provider.entity";

const sourceIdentityMismatchPattern = /SOURCE_IDENTITY_MISMATCH/;
const sourceSelectionMismatchPattern = /SOURCE_SELECTION_MISMATCH/;

await test("source identity and context match requested Items, parent accounts and investments", () => {
  assert.doesNotThrow(() =>
    assertSourceIdentity({ expected: "expected", id: "expected" }),
  );
  assert.throws(
    () => assertSourceIdentity({ expected: "200", id: 200 }),
    sourceIdentityMismatchPattern,
  );
  const context = {
    item: "synthetic-item",
    parent: "synthetic-account",
    resource: "transactions" as const,
  };
  assert.doesNotThrow(() =>
    assertSourceRecords({
      context,
      records: [
        { accountId: context.parent, id: "synthetic-tx", itemId: context.item },
      ],
    }),
  );
  for (const record of [
    { itemId: "foreign" },
    { accountId: "foreign" },
    { itemId: null },
  ]) {
    assert.throws(
      () => assertSourceRecords({ context, records: [record] }),
      sourceIdentityMismatchPattern,
    );
  }
  // Some provider resources omit context fields; absence is not an identity mismatch.
  assert.doesNotThrow(() =>
    assertSourceRecords({ context, records: [{ id: "synthetic-tx" }] }),
  );
  assert.throws(
    () =>
      assertSourceRecords({
        context: { ...context, resource: "investment_transactions" },
        records: [{ investmentId: "foreign" }],
      }),
    sourceIdentityMismatchPattern,
  );
  assert.doesNotThrow(() =>
    assertSourceRecords({
      context: {
        connectorId: "200",
        item: context.item,
        resource: "connectors",
      },
      records: [{ id: 200 }],
    }),
  );
  assert.throws(
    () =>
      assertSourceRecords({
        context: { item: context.item, resource: "connections" },
        records: [{ id: "foreign" }],
      }),
    sourceIdentityMismatchPattern,
  );
});

await test("transaction selection rejects unrequested IDs and another account even when the ID was requested", () => {
  const input = { account: "synthetic-account", ids: ["first", "second"] };
  assert.doesNotThrow(() =>
    assertTransactionSelection({
      ...input,
      records: [{ accountId: input.account, id: "second" }],
    }),
  );
  assert.throws(
    () =>
      assertTransactionSelection({
        ...input,
        records: [{ accountId: input.account, id: "foreign" }],
      }),
    sourceSelectionMismatchPattern,
  );
  assert.throws(
    () =>
      assertTransactionSelection({
        ...input,
        records: [{ accountId: "foreign", id: "first" }],
      }),
    sourceSelectionMismatchPattern,
  );
});
