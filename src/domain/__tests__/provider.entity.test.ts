import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSourceIdentity,
  assertSourceRecords,
  assertTransactionSelection,
} from "../provider.entity";

await test("source identity and context match requested Items, parent accounts and investments", () => {
  assert.doesNotThrow(() =>
    assertSourceIdentity({ id: "expected", expected: "expected" }),
  );
  assert.throws(
    () => assertSourceIdentity({ id: 200, expected: "200" }),
    /SOURCE_IDENTITY_MISMATCH/,
  );
  const context = {
    resource: "transactions" as const,
    item: "synthetic-item",
    parent: "synthetic-account",
  };
  assert.doesNotThrow(() =>
    assertSourceRecords({
      records: [
        { id: "synthetic-tx", itemId: context.item, accountId: context.parent },
      ],
      context,
    }),
  );
  for (const record of [
    { itemId: "foreign" },
    { accountId: "foreign" },
    { itemId: null },
  ]) {
    assert.throws(
      () => assertSourceRecords({ records: [record], context }),
      /SOURCE_IDENTITY_MISMATCH/,
    );
  }
  // Some provider resources omit context fields; absence is not an identity mismatch.
  assert.doesNotThrow(() =>
    assertSourceRecords({ records: [{ id: "synthetic-tx" }], context }),
  );
  assert.throws(
    () =>
      assertSourceRecords({
        records: [{ investmentId: "foreign" }],
        context: { ...context, resource: "investment_transactions" },
      }),
    /SOURCE_IDENTITY_MISMATCH/,
  );
  assert.doesNotThrow(() =>
    assertSourceRecords({
      records: [{ id: 200 }],
      context: {
        resource: "connectors",
        item: context.item,
        connectorId: "200",
      },
    }),
  );
  assert.throws(
    () =>
      assertSourceRecords({
        records: [{ id: "foreign" }],
        context: { resource: "connections", item: context.item },
      }),
    /SOURCE_IDENTITY_MISMATCH/,
  );
});

await test("transaction selection rejects unrequested IDs and another account even when the ID was requested", () => {
  const input = { account: "synthetic-account", ids: ["first", "second"] };
  assert.doesNotThrow(() =>
    assertTransactionSelection({
      ...input,
      records: [{ id: "second", accountId: input.account }],
    }),
  );
  assert.throws(
    () =>
      assertTransactionSelection({
        ...input,
        records: [{ id: "foreign", accountId: input.account }],
      }),
    /SOURCE_SELECTION_MISMATCH/,
  );
  assert.throws(
    () =>
      assertTransactionSelection({
        ...input,
        records: [{ id: "first", accountId: "foreign" }],
      }),
    /SOURCE_SELECTION_MISMATCH/,
  );
});
