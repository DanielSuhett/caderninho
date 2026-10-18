import assert from "node:assert/strict";
import test from "node:test";

import { Resource } from "@/domain/enums";
import { compileValidatedRules, EMPTY_RULES } from "@/domain/rules";

import type { EntityInput } from "../entity";
import { prepareEntity } from "../service";

const input: EntityInput = {
  identity: {
    itemId: "item",
    resource: Resource.transactions,
    parentId: "account",
    id: "tx",
  },
  source: { id: "tx" },
  parent: undefined,
  operationId: "operation",
  referenceDay: "2026-10-18",
  rulesRevision: "revision",
  renormalize: false,
  observedAt: "2026-10-18T12:00:00Z",
  legacyProjection: {
    id: "tx",
    accountingDate: "2026-10-18",
    amountMinor: "900719925474099329",
    currencyCode: "BRL",
  },
};

await test("preparation returns a typed publication plan with exact money and no database builders", async () => {
  const engine = compileValidatedRules(EMPTY_RULES);
  const prepared = await prepareEntity(
    {
      repository: { read: async () => undefined },
      hash: async () => "digest",
      evaluate: engine.evaluate,
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
      repository: {
        read: async () => ({
          relevant_hash: "digest",
          deleted: 0,
          seen_operation: "operation",
        }),
      },
      hash: async () => "digest",
      evaluate: async () => {
        throw new Error("UNCHANGED_MUST_NOT_EVALUATE");
      },
    },
    input,
  );
  assert.equal(prepared.state, "unchanged");
  assert.equal(prepared.seenInOperation, true);
  assert.equal(prepared.classified, 0);
  assert.equal(prepared.mutation.kind, "observe");
});
