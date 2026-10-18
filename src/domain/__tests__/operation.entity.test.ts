import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCollectionComplete,
  assertIdempotency,
  assertOperationInput,
  assertSourceTotal,
  assertWebhookEvent,
  deleteMissingAfterPage,
  latestCreatedAt,
  type MigrationPolicy,
  migrationDecision,
  nextSyncSchedule,
  type OperationKind,
  pageCoverage,
  resourceParentAllowed,
  sourceFailureCoverage,
  transactionCreationFloor,
} from "../operation.entity";

await test("operation policy restricts filters and renormalization independently of the caller", () => {
  const scope = {
    itemIds: ["synthetic-item"],
    filter: { tag: "budget", value: "house" },
  };
  assert.doesNotThrow(() =>
    assertOperationInput({ ...scope, kind: "reapply" }),
  );
  for (const kind of ["sync", "reconcile"] as const) {
    assert.throws(
      () => assertOperationInput({ ...scope, kind }),
      /SYNC_FILTER_NOT_SUPPORTED_USE_ITEM_SCOPE/,
    );
  }
  assert.doesNotThrow(() =>
    assertOperationInput({
      kind: "reconcile",
      itemIds: scope.itemIds,
      renormalize: true,
    }),
  );
  assert.throws(
    () =>
      assertOperationInput({
        kind: "reapply",
        itemIds: scope.itemIds,
        renormalize: true,
      }),
    /RENORMALIZE_REQUIRES_RECONCILIATION/,
  );
  for (const kind of [
    "sync",
    "reconcile",
    "reapply",
  ] satisfies OperationKind[]) {
    assert.doesNotThrow(() =>
      assertOperationInput({ kind, itemIds: scope.itemIds }),
    );
  }
  assert.doesNotThrow(() =>
    assertIdempotency({ expected: "same", actual: "same" }),
  );
  assert.throws(
    () => assertIdempotency({ expected: "committed", actual: "changed" }),
    /IDEMPOTENCY_CONFLICT/,
  );
});

await test("migration conflicts require an explicit policy and never skip identical records", () => {
  for (const [policy, expected] of [
    [undefined, "refuse"],
    ["refuse-conflicts", "refuse"],
    ["keep-current", "keep"],
    ["prefer-bundle", "import"],
  ] satisfies [MigrationPolicy | undefined, string][]) {
    assert.equal(migrationDecision({ conflicting: true, policy }), expected);
    assert.equal(migrationDecision({ conflicting: false, policy }), "import");
  }
});

await test("creation events require a watermark and update/delete events require transaction IDs", () => {
  const scope = {
    eventId: "synthetic-event",
    itemId: "synthetic-item",
    accountId: "synthetic-account",
  };
  assert.throws(
    () =>
      assertWebhookEvent({
        ...scope,
        event: "transactions/created",
        transactionIds: ["synthetic-tx"],
      }),
    /MISSING_CREATION_FLOOR/,
  );
  assert.doesNotThrow(() =>
    assertWebhookEvent({
      ...scope,
      event: "transactions/created",
      transactionsCreatedAtFrom: "2026-10-01T00:00:00Z",
    }),
  );
  for (const event of [
    "transactions/updated",
    "transactions/deleted",
  ] as const) {
    assert.throws(
      () => assertWebhookEvent({ ...scope, event, transactionIds: [] }),
      /MISSING_TRANSACTION_IDS/,
    );
    assert.doesNotThrow(() =>
      assertWebhookEvent({ ...scope, event, transactionIds: ["synthetic-tx"] }),
    );
  }
});

await test("daily sync preserves a future reconciliation deadline and weekly reconciliation is inclusive", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  assert.deepEqual(
    nextSyncSchedule({ now, reconcileAfter: "2026-10-19T12:00:00.000Z" }),
    {
      kind: "sync",
      next: "2026-10-19T12:00:00.000Z",
      reconcileAfter: "2026-10-19T12:00:00.000Z",
    },
  );
  assert.deepEqual(
    nextSyncSchedule({ now, reconcileAfter: now.toISOString() }),
    {
      kind: "reconcile",
      next: "2026-10-19T12:00:00.000Z",
      reconcileAfter: "2026-10-25T12:00:00.000Z",
    },
  );
});

await test("only bootstrapped incremental transactions use a creation floor and missing evidence requires reconciliation", () => {
  const input = {
    resource: "transactions" as const,
    kind: "sync" as const,
    coverage: {
      complete: true,
      confirmedCreatedAt: "2026-10-01T00:00:00.000Z",
    },
  };
  assert.equal(
    transactionCreationFloor(input),
    input.coverage.confirmedCreatedAt,
  );
  assert.equal(transactionCreationFloor({ ...input, coverage: null }), null);
  assert.equal(
    transactionCreationFloor({
      ...input,
      coverage: { complete: false, confirmedCreatedAt: null },
    }),
    null,
  );
  assert.equal(transactionCreationFloor({ ...input, kind: "reconcile" }), null);
  assert.equal(
    transactionCreationFloor({ ...input, resource: "investment_transactions" }),
    null,
  );
  assert.throws(
    () =>
      transactionCreationFloor({
        ...input,
        coverage: { complete: true, confirmedCreatedAt: null },
      }),
    /CREATION_CHECKPOINT_MISSING_RECONCILE_REQUIRED/,
  );
});

await test("missing flow records are deleted only after complete reconciliation; card bills require a credit parent", () => {
  for (const resource of ["transactions", "investment_transactions"] as const) {
    assert.equal(
      deleteMissingAfterPage({ resource, kind: "sync", next: null }),
      false,
    );
    assert.equal(
      deleteMissingAfterPage({ resource, kind: "reconcile", next: "next" }),
      false,
    );
    assert.equal(
      deleteMissingAfterPage({ resource, kind: "reconcile", next: null }),
      true,
    );
  }
  assert.equal(
    deleteMissingAfterPage({ resource: "accounts", kind: "sync", next: null }),
    true,
  );
  assert.equal(
    resourceParentAllowed({ resource: "bills", parentType: "BANK" }),
    false,
  );
  assert.equal(
    resourceParentAllowed({ resource: "bills", parentType: "CREDIT" }),
    true,
  );
  assert.equal(
    resourceParentAllowed({ resource: "statements", parentType: "BANK" }),
    true,
  );
});

await test("coverage and source totals distinguish missing evidence, zero records and incomplete pagination", () => {
  assert.equal(
    pageCoverage({ next: "next", records: 0, previousPages: 0 }),
    "partial",
  );
  assert.equal(
    pageCoverage({ next: null, records: 0, previousPages: 0 }),
    "empty",
  );
  assert.equal(
    pageCoverage({ next: null, records: 0, previousPages: 1 }),
    "available",
  );
  assert.equal(
    pageCoverage({ next: null, records: 1, previousPages: 0 }),
    "available",
  );
  assert.equal(sourceFailureCoverage("UPSTREAM_FORBIDDEN"), "not_authorized");
  assert.equal(sourceFailureCoverage("UPSTREAM_NOT_FOUND"), "unavailable");
  assert.equal(sourceFailureCoverage("UPSTREAM_ERROR"), "partial");
  assert.doesNotThrow(() => assertSourceTotal({ expected: null, actual: 0 }));
  assert.doesNotThrow(() => assertSourceTotal({ expected: 0, actual: 0 }));
  assert.throws(
    () => assertSourceTotal({ expected: 0, actual: undefined }),
    /SOURCE_TOTAL_CHANGED_RECONCILE_REQUIRED/,
  );
  assert.doesNotThrow(() =>
    assertCollectionComplete({ total: undefined, collected: 3, next: null }),
  );
  assert.doesNotThrow(() =>
    assertCollectionComplete({ total: 3, collected: 1, next: "next" }),
  );
  assert.throws(
    () => assertCollectionComplete({ total: 3, collected: 1, next: null }),
    /SOURCE_PAGE_COUNT_INCOMPLETE/,
  );
  assert.doesNotThrow(() =>
    assertCollectionComplete({ total: 0, collected: 0, next: null }),
  );
});

await test("creation watermark normalizes timezone offsets and never moves backwards", () => {
  const maximum = "2026-10-18T12:00:00.000Z";
  assert.equal(latestCreatedAt({ maximum, created: null }), maximum);
  assert.equal(
    latestCreatedAt({ maximum, created: "2026-10-18T08:00:00-03:00" }),
    maximum,
  );
  assert.equal(
    latestCreatedAt({ maximum, created: "2026-10-18T10:00:00-03:00" }),
    "2026-10-18T13:00:00.000Z",
  );
  assert.equal(
    latestCreatedAt({ maximum: null, created: "2026-10-18T09:00:00-03:00" }),
    maximum,
  );
});
