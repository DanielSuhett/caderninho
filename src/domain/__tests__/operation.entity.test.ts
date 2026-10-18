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
} from "..";

const syncFilterNotSupportedUseItemScopePattern =
  /SYNC_FILTER_NOT_SUPPORTED_USE_ITEM_SCOPE/;
const renormalizeRequiresReconciliationPattern =
  /RENORMALIZE_REQUIRES_RECONCILIATION/;
const idempotencyConflictPattern = /IDEMPOTENCY_CONFLICT/;
const missingCreationFloorPattern = /MISSING_CREATION_FLOOR/;
const missingTransactionIdsPattern = /MISSING_TRANSACTION_IDS/;
const creationCheckpointMissingReconcileRequiredPattern =
  /CREATION_CHECKPOINT_MISSING_RECONCILE_REQUIRED/;
const sourceTotalChangedReconcileRequiredPattern =
  /SOURCE_TOTAL_CHANGED_RECONCILE_REQUIRED/;
const sourcePageCountIncompletePattern = /SOURCE_PAGE_COUNT_INCOMPLETE/;

await test("operation policy restricts filters and renormalization independently of the caller", () => {
  const scope = {
    filter: { tag: "budget", value: "house" },
    itemIds: ["synthetic-item"],
  };
  assert.doesNotThrow(() =>
    assertOperationInput({ ...scope, kind: "reapply" }),
  );
  for (const kind of ["sync", "reconcile"] as const) {
    assert.throws(
      () => assertOperationInput({ ...scope, kind }),
      syncFilterNotSupportedUseItemScopePattern,
    );
  }
  assert.doesNotThrow(() =>
    assertOperationInput({
      itemIds: scope.itemIds,
      kind: "reconcile",
      renormalize: true,
    }),
  );
  assert.throws(
    () =>
      assertOperationInput({
        itemIds: scope.itemIds,
        kind: "reapply",
        renormalize: true,
      }),
    renormalizeRequiresReconciliationPattern,
  );
  for (const kind of [
    "sync",
    "reconcile",
    "reapply",
  ] satisfies OperationKind[]) {
    assert.doesNotThrow(() =>
      assertOperationInput({ itemIds: scope.itemIds, kind }),
    );
  }
  assert.doesNotThrow(() =>
    assertIdempotency({ actual: "same", expected: "same" }),
  );
  assert.throws(
    () => assertIdempotency({ actual: "changed", expected: "committed" }),
    idempotencyConflictPattern,
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
    accountId: "synthetic-account",
    eventId: "synthetic-event",
    itemId: "synthetic-item",
  };
  assert.throws(
    () =>
      assertWebhookEvent({
        ...scope,
        event: "transactions/created",
        transactionIds: ["synthetic-tx"],
      }),
    missingCreationFloorPattern,
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
      missingTransactionIdsPattern,
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
    coverage: {
      complete: true,
      confirmedCreatedAt: "2026-10-01T00:00:00.000Z",
    },
    kind: "sync" as const,
    resource: "transactions" as const,
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
    creationCheckpointMissingReconcileRequiredPattern,
  );
});

await test("missing flow records are deleted only after complete reconciliation; card bills require a credit parent", () => {
  for (const resource of ["transactions", "investment_transactions"] as const) {
    assert.equal(
      deleteMissingAfterPage({ kind: "sync", next: null, resource }),
      false,
    );
    assert.equal(
      deleteMissingAfterPage({ kind: "reconcile", next: "next", resource }),
      false,
    );
    assert.equal(
      deleteMissingAfterPage({ kind: "reconcile", next: null, resource }),
      true,
    );
  }
  assert.equal(
    deleteMissingAfterPage({ kind: "sync", next: null, resource: "accounts" }),
    true,
  );
  assert.equal(
    resourceParentAllowed({ parentType: "BANK", resource: "bills" }),
    false,
  );
  assert.equal(
    resourceParentAllowed({ parentType: "CREDIT", resource: "bills" }),
    true,
  );
  assert.equal(
    resourceParentAllowed({ parentType: "BANK", resource: "statements" }),
    true,
  );
});

await test("coverage and source totals distinguish missing evidence, zero records and incomplete pagination", () => {
  assert.equal(
    pageCoverage({ next: "next", previousPages: 0, records: 0 }),
    "partial",
  );
  assert.equal(
    pageCoverage({ next: null, previousPages: 0, records: 0 }),
    "empty",
  );
  assert.equal(
    pageCoverage({ next: null, previousPages: 1, records: 0 }),
    "available",
  );
  assert.equal(
    pageCoverage({ next: null, previousPages: 0, records: 1 }),
    "available",
  );
  assert.equal(sourceFailureCoverage("UPSTREAM_FORBIDDEN"), "not_authorized");
  assert.equal(sourceFailureCoverage("UPSTREAM_NOT_FOUND"), "unavailable");
  assert.equal(sourceFailureCoverage("UPSTREAM_ERROR"), "partial");
  assert.doesNotThrow(() => assertSourceTotal({ actual: 0, expected: null }));
  assert.doesNotThrow(() => assertSourceTotal({ actual: 0, expected: 0 }));
  assert.throws(
    () => assertSourceTotal({ actual: undefined, expected: 0 }),
    sourceTotalChangedReconcileRequiredPattern,
  );
  assert.doesNotThrow(() =>
    assertCollectionComplete({ collected: 3, next: null, total: undefined }),
  );
  assert.doesNotThrow(() =>
    assertCollectionComplete({ collected: 1, next: "next", total: 3 }),
  );
  assert.throws(
    () => assertCollectionComplete({ collected: 1, next: null, total: 3 }),
    sourcePageCountIncompletePattern,
  );
  assert.doesNotThrow(() =>
    assertCollectionComplete({ collected: 0, next: null, total: 0 }),
  );
});

await test("creation watermark normalizes timezone offsets and never moves backwards", () => {
  const maximum = "2026-10-18T12:00:00.000Z";
  assert.equal(latestCreatedAt({ created: null, maximum }), maximum);
  assert.equal(
    latestCreatedAt({ created: "2026-10-18T08:00:00-03:00", maximum }),
    maximum,
  );
  assert.equal(
    latestCreatedAt({ created: "2026-10-18T10:00:00-03:00", maximum }),
    "2026-10-18T13:00:00.000Z",
  );
  assert.equal(
    latestCreatedAt({ created: "2026-10-18T09:00:00-03:00", maximum: null }),
    maximum,
  );
});
