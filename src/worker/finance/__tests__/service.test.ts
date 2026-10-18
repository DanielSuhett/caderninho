import assert from "node:assert/strict";
import test from "node:test";

import { Resource } from "../../../domain";
import { compileValidatedRules, EMPTY_RULES } from "../../../domain/rules";
import { prepareEntity } from "..";
import type { EntityInput } from "../entity";

const input: EntityInput = {
  identity: {
    id: "tx",
    itemId: "item",
    parentId: "account",
    resource: Resource.transactions,
  },
  legacyProjection: {
    accountingDate: "2026-10-18",
    amountMinor: "900719925474099329",
    currencyCode: "BRL",
    id: "tx",
  },
  observedAt: "2026-10-18T12:00:00Z",
  operationId: "operation",
  parent: undefined,
  referenceDay: "2026-10-18",
  renormalize: false,
  rulesRevision: "revision",
  source: { id: "tx" },
};

await test("preparation returns a typed publication plan with exact money and no database builders", async () => {
  const engine = compileValidatedRules(EMPTY_RULES);
  const prepared = await prepareEntity(
    {
      evaluate: engine.evaluate,
      hash: async () => "digest",
      repository: { read: async () => undefined },
    },
    input,
  );
  assert.equal(prepared.state, "new");
  assert.equal(prepared.classified, 1);
  assert.equal(prepared.mutation.kind, "save");
  if (prepared.mutation.kind === "save") {
    assert.equal(
      prepared.mutation.value.projection.amountText,
      "900719925474099329",
    );
    assert.equal(prepared.mutation.value.operationId, "operation");
    assert.ok(prepared.mutation.value.derived);
  }
  assert.ok(!("statements" in prepared));
});

await test("unchanged observations bypass classification and keep the operation observation", async () => {
  const prepared = await prepareEntity(
    {
      evaluate: () => Promise.reject(new Error("UNCHANGED_MUST_NOT_EVALUATE")),
      hash: async () => "digest",
      repository: {
        read: async () => ({
          deleted: 0,
          relevant_hash: "digest",
          seen_operation: "operation",
        }),
      },
    },
    input,
  );
  assert.equal(prepared.state, "unchanged");
  assert.equal(prepared.seenInOperation, true);
  assert.equal(prepared.classified, 0);
  assert.equal(prepared.mutation.kind, "observe");
});
