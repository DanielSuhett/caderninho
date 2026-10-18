import {
  OperationKind,
  OperationPhase,
  OperationStatus,
} from "../../contracts";
import type { FinanceRecord } from "../../domain";
import {
  assertCollectionComplete,
  assertSourceTotal,
  CoverageStatus,
  DEFINITIONS,
  deleteMissingAfterPage,
  Fault,
  FaultCode,
  itemInfo,
  latestCreatedAt,
  MigrationDecision,
  migrationDecision,
  pageCoverage,
  productState,
  Resource,
  resourceParentAllowed,
  sourceFailureCoverage,
  transactionCreationFloor,
} from "../../domain";
import type { RuleEngine } from "../../domain/rules";
import { txContext } from "../../domain/rules";
import { hash, tryCatch } from "../../shared";
import type { PreparedEntity } from "../finance/entity";
import type {
  CollectionIdentity,
  ExecutionDependencies,
  ExecutionPhaseDetail,
  ExecutionRepository,
  FinancialSource,
  Operation,
  PageCommit,
  ParentEntity,
  Progress,
  SourcePage,
  Steps,
  StoredEvent,
  SynchronizationDependencies,
} from "./entity";
import {
  type ExecutionOutcome,
  ExecutionPhase,
  ExecutionResult,
  progressWithDefaults,
} from "./entity";

interface Execution extends ExecutionDependencies {
  engine: RuleEngine;
  op: Operation;
  step: Steps;
}

export async function runOperation(
  dependencies: SynchronizationDependencies,
  id: string,
  step: Steps,
) {
  const summary: ExecutionOutcome = {
    outcome: ExecutionResult.noop,
    phase: ExecutionPhase.select,
  };
  const { data: _data, error } = await tryCatch(async () => {
    const { repository } = dependencies;
    const op = await repository.read(id);
    summary.operationKind = op.kind;
    if (op.status !== OperationStatus.working) {
      return;
    }
    summary.phase = ExecutionPhase.select;
    const engine = await repository.rules(op.rules_revision);
    const execution = {
      ...dependencies,
      engine,
      observePhase<T>(
        phase: ExecutionPhase,
        callback: () => Promise<T>,
        detail?: ExecutionPhaseDetail,
      ) {
        summary.phase = phase;
        return (
          dependencies.observePhase?.(phase, callback, detail) ?? callback()
        );
      },
      op,
      step,
    };
    async function acquire(attempt: number): Promise<boolean> {
      if ((await repository.read(id)).cancel_requested) {
        await repository.finish(op, OperationStatus.cancelled);
        summary.outcome = ExecutionResult.cancelled;
        return false;
      }
      if (
        await step.do(`acquire-${attempt}`, () =>
          observePhase(execution, ExecutionPhase.acquire, () =>
            repository.acquire(id),
          ),
        )
      ) {
        return true;
      }
      throw new Error("FINANCIAL_EXECUTOR_BUSY_RESUME_DISPATCH");
    }
    summary.phase = ExecutionPhase.acquire;
    if (!(await acquire(0))) {
      return;
    }
    const { data, error: executionError } = await tryCatch(async () => {
      let sourcePromise: Promise<FinancialSource> | undefined;
      const resolveSource = () => {
        sourcePromise ??= dependencies.source();
        return sourcePromise;
      };
      const source: FinancialSource = {
        ids: (account, ids) =>
          observePhase(
            execution,
            ExecutionPhase.collect,
            async () => (await resolveSource()).ids(account, ids),
            { resource: Resource.transactions },
          ),
        page: (input) =>
          observePhase(
            execution,
            ExecutionPhase.collect,
            async () => (await resolveSource()).page(input),
            { resource: input.resource },
          ),
      };
      summary.phase = ExecutionPhase.mature;
      await step.do("mature", () =>
        observePhase(execution, ExecutionPhase.mature, async () => {
          await repository.mature(op);
          return { phase: OperationPhase.matured };
        }),
      );
      summary.phase = ExecutionPhase.process;
      if (await executeOperation(execution, source)) {
        await repository.finish(op, OperationStatus.cancelled);
        summary.outcome = ExecutionResult.cancelled;
        return;
      }
      summary.phase = ExecutionPhase.complete;
      // A replayed finish callback performs no new work and has no fresh counters.
      summary.outcome = ExecutionResult.replayed;
      await step.do("finish", () =>
        observePhase(
          execution,
          ExecutionPhase.complete,
          async () => {
            const progress = progressWithDefaults(
              (await repository.read(id)).progress,
            );
            await repository.finish(
              op,
              OperationStatus.completed,
              progress.errors > 0,
            );
            summary.progress = progress;
            summary.outcome =
              progress.errors > 0
                ? ExecutionResult.partial
                : ExecutionResult.completed;
            return { phase: OperationPhase.completed };
          },
          { outcome: () => summary.outcome },
        ),
      );
    });
    if (executionError) {
      const deferred =
        executionError instanceof Fault &&
        [FaultCode.UPSTREAM_RATE_LIMIT, FaultCode.UPSTREAM_TIMEOUT].some(
          (code) => code === executionError.code,
        );
      if (deferred && executionError instanceof Fault) {
        await repository.defer(
          op.id,
          executionError.details?.retryAfterSeconds ?? 0,
        );
      }
      await repository.finish(op, OperationStatus.completed, true);
      if (deferred) {
        summary.outcome = ExecutionResult.deferred;
      }
      throw executionError;
    }
    return data;
  });
  if (error) {
    summary.error = error;
    if (summary.outcome !== ExecutionResult.deferred) {
      summary.outcome = ExecutionResult.failed;
    }
  }
  dependencies.onOutcome?.(summary);
  if (error) {
    throw error;
  }
}

function observePhase<T>(
  dependencies: ExecutionDependencies,
  phase: ExecutionPhase,
  callback: () => Promise<T>,
  detail?: ExecutionPhaseDetail,
): Promise<T> {
  return dependencies.observePhase?.(phase, callback, detail) ?? callback();
}

function executeOperation(execution: Execution, source: FinancialSource) {
  const { input } = execution.op;
  switch (input.kind) {
    case OperationKind.migration:
      return migrateLegacy(execution);
    case OperationKind.reapply:
      return reapplyRules(execution);
    case OperationKind.webhook:
      return resolveEvent(execution, source, input.eventId);
    case OperationKind.sync:
    case OperationKind.reconcile:
      return synchronizeResources(execution, source);
    default: {
      const unexpected: never = input;
      throw new Error(`UNSUPPORTED_OPERATION: ${unexpected}`);
    }
  }
}

async function reapplyRules(execution: Execution) {
  const { repository, op, engine, step } = execution;
  await step.do("select-reapply", () =>
    observePhase(execution, ExecutionPhase.select, async () => {
      await repository.selectReapplication(op);
      return { phase: OperationPhase.selected };
    }),
  );
  return applyBatch(0);

  async function applyBatch(batch: number): Promise<boolean> {
    const key = `reapply-${batch}`;
    const result = await step.do(key, async () => {
      const saved = await repository.receipt(op.id, key);
      if (saved) {
        return saved;
      }
      if ((await repository.read(op.id)).cancel_requested) {
        return { cancelled: true, done: true };
      }
      const selected = await repository.reapplicationTargets(op.id);
      const changes: Parameters<
        ExecutionRepository["commitReapplication"]
      >[0]["changes"] = [];
      await observePhase(
        execution,
        ExecutionPhase.process,
        () =>
          selected.reduce(async (previous, entity) => {
            await previous;
            changes.push({
              derived: await engine.evaluate(txContext(entity.normalized)),
              identity: {
                id: entity.id,
                itemId: entity.item_id,
                parentId: entity.parent_id,
                resource: entity.resource,
              },
            });
          }, Promise.resolve()),
        { processed: selected.length },
      );
      const progress = progressWithDefaults(
        (await repository.read(op.id)).progress,
      );
      progress.classified += selected.length;
      progress.received += selected.length;
      const outcome = { cancelled: false, done: selected.length < 20 };
      await observePhase(execution, ExecutionPhase.publish, () =>
        repository.commitReapplication({
          changes,
          key,
          op,
          outcome,
          progress,
        }),
      );
      return outcome;
    });
    if (result.cancelled) {
      return true;
    }
    if (result.done) {
      return false;
    }
    return applyBatch(batch + 1);
  }
}

async function migrateLegacy(execution: Execution) {
  const { repository, op, engine, prepare, step } = execution;
  const { input } = op;
  if (input.kind !== OperationKind.migration) {
    throw new Error("OPERATION_KIND_MISMATCH");
  }
  const result = await step.do("import-legacy", async () => {
    if ((await repository.read(op.id)).cancel_requested) {
      return { cancelled: true };
    }
    const [itemId] = input.itemIds;
    if (!itemId) {
      throw new Error(FaultCode.INVALID_ITEM_ID);
    }
    const rows: Parameters<ExecutionRepository["commitMigration"]>[0] = [];
    await observePhase(
      execution,
      ExecutionPhase.process,
      () =>
        input.migration.reduce(async (previous, row) => {
          await previous;
          const identity = {
            id: row.record.id,
            itemId,
            parentId: row.parentId,
            resource: row.resource,
          };
          const digest = await hash(row);
          if (await repository.imported(row.sourceKey, digest)) {
            return;
          }
          const existing = await repository.current(identity);
          const conflicting =
            !!existing && (await hash(existing)) !== (await hash(row.record));
          const decision = migrationDecision({
            conflicting,
            policy: input.migrationPolicy,
          });
          if (decision === MigrationDecision.refuse) {
            throw new Error("MIGRATION_OVERLAP_REQUIRES_POLICY");
          }
          if (decision === MigrationDecision.keep) {
            return;
          }
          const prepared = await prepare({
            engine,
            identity,
            legacyProjection: row.record,
            operation: op,
            parent: undefined,
            source: {
              id: row.record.id,
              legacyProjection: row.record,
              legacySourceKey: row.sourceKey,
              resourceId: row.record.id,
            },
          });
          rows.push({ digest, prepared, sourceKey: row.sourceKey });
        }, Promise.resolve()),
      { processed: input.migration.length },
    );
    await observePhase(
      execution,
      ExecutionPhase.publish,
      () => repository.commitMigration(rows),
      { processed: rows.length },
    );
    return { imported: input.migration.length };
  });
  return !!result.cancelled;
}

const resourceOrder: Resource[] = [
  Resource.connections,
  Resource.consents,
  Resource.resources,
  Resource.connectors,
  Resource.categories,
  Resource.accounts,
  Resource.investments,
  Resource.loans,
  Resource.identity,
  Resource.transactions,
  Resource.bills,
  Resource.investment_transactions,
  Resource.statements,
];

async function synchronizeResources(
  execution: Execution,
  source: FinancialSource,
) {
  const items = await execution.repository.items(execution.op.input.itemIds);
  const collections = items.flatMap((item) =>
    resourceOrder.map((resource) => ({ itemId: item.id, resource })),
  );
  const cancelled = await collections.reduce(async (previous, collection) => {
    if (await previous) {
      return true;
    }
    return synchronizeItemResource(
      execution,
      source,
      collection.itemId,
      collection.resource,
    );
  }, Promise.resolve(false));
  if (cancelled) {
    return true;
  }
  return resolvePendingTransactions(
    execution,
    source,
    items.map((item) => item.id),
  );
}

async function synchronizeItemResource(
  execution: Execution,
  source: FinancialSource,
  itemId: string,
  resource: Resource,
) {
  const { repository, op } = execution;
  const def = DEFINITIONS[resource];
  if (await recordUnavailableResource(execution, itemId, resource)) {
    return false;
  }
  const parents = def.parent
    ? await repository.parents(itemId, def.parent)
    : [null];
  return parents.reduce(async (previous, parent) => {
    if (await previous) {
      return true;
    }
    if (
      parent &&
      !resourceParentAllowed({ parentType: parent.normalized.type, resource })
    ) {
      return false;
    }
    const parentId = parent?.id ?? "";
    const identity = { itemId, operationId: op.id, parentId, resource };
    if (
      resource === Resource.investment_transactions &&
      op.input.kind === OperationKind.sync
    ) {
      const coverage = await repository.coverage(itemId, resource, parentId);
      if (
        coverage?.bootstrap_complete === 1 &&
        coverage.parent_signature === (parent?.relevant_hash ?? null)
      ) {
        return false;
      }
    }
    return synchronizeCollection(execution, source, { identity, parent });
  }, Promise.resolve(false));
}

async function synchronizeCollection(
  execution: Execution,
  source: FinancialSource,
  { identity, parent }: { identity: CollectionIdentity; parent: ParentEntity },
) {
  const { repository, op, step } = execution;
  const { itemId, resource, parentId } = identity;
  await step.do(`checkpoint-${itemId}-${resource}-${parentId}`, async () => {
    const coverage = await repository.coverage(itemId, resource, parentId);
    const floor = transactionCreationFloor({
      coverage: coverage && {
        complete: !!coverage.bootstrap_complete,
        confirmedCreatedAt: coverage.confirmed_created_at,
      },
      kind: op.input.kind,
      resource,
    });
    await repository.createCheckpoint(identity, floor);
    return { phase: OperationPhase.checkpoint };
  });
  return nextPage(0);

  async function nextPage(pageIndex: number): Promise<boolean> {
    const name = `page-${itemId}-${resource}-${parentId}-${pageIndex}`;
    const result = await step.do(name, () =>
      publishPage(execution, source, { identity, name, parent }),
    );
    if (result.cancelled) {
      return true;
    }
    if (result.done) {
      return false;
    }
    await step.sleep(`pause-${name}`, "1 second");
    return nextPage(pageIndex + 1);
  }
}

async function recordUnavailableResource(
  { repository, step }: Execution,
  itemId: string,
  resource: Resource,
) {
  if (resource === Resource.connections) {
    return false;
  }
  const source = await repository.connectionSource(itemId);
  if (!source) {
    return false;
  }
  const consents = await repository.parents(itemId, Resource.consents);
  const availability = productState(
    resource,
    itemInfo(source),
    consents.map((entry) => entry.normalized),
    Date.now(),
  );
  if (!availability) {
    return false;
  }
  await step.do(`availability-${itemId}-${resource}`, async () => {
    await repository.setCoverage(itemId, resource, availability);
    return { availability };
  });
  return true;
}

async function resolvePendingTransactions(
  execution: Execution,
  source: FinancialSource,
  itemIds: string[],
) {
  const { repository, op, step } = execution;
  await step.do("select-pending", () =>
    observePhase(execution, ExecutionPhase.select, async () => {
      await repository.selectPending(op.id, itemIds);
      return { phase: OperationPhase.pending_selected };
    }),
  );
  return nextBatch(0);

  async function nextBatch(batch: number): Promise<boolean> {
    const key = `pending-${batch}`;
    const outcome = await step.do(key, async () => {
      const committed = await repository.receipt(op.id, key);
      if (committed) {
        return committed;
      }
      if ((await repository.read(op.id)).cancel_requested) {
        return { cancelled: true, done: true };
      }
      const selected = await repository.pending(op.id);
      const [first] = selected;
      if (!first) {
        return { cancelled: false, done: true };
      }
      const group = selected.filter(
        (entry) =>
          entry.item_id === first.item_id &&
          entry.parent_id === first.parent_id,
      );
      const ids = group.map((entry) => entry.id);
      const fetchedRecords = await source.ids(first.parent_id, ids);
      const pageOutcome = { cancelled: false, done: false };
      await publishResolved(execution, {
        accountId: first.parent_id,
        ids,
        itemId: first.item_id,
        receipt: { key, outcome: pageOutcome, processedIds: ids },
        records: fetchedRecords,
      });
      return pageOutcome;
    });
    if (outcome.cancelled) {
      return true;
    }
    if (outcome.done) {
      return false;
    }
    await step.sleep(`pending-pause-${batch}`, "1 second");
    return nextBatch(batch + 1);
  }
}

async function publishResolved(
  execution: Execution,
  input: {
    itemId: string;
    accountId: string;
    ids: string[];
    records: SourcePage["records"];
    receipt?: { key: string; outcome: PageCommit; processedIds?: string[] };
  },
) {
  const { repository, op } = execution;
  const parent = await repository.account(input.itemId, input.accountId);
  const progress = progressWithDefaults(
    (await repository.read(op.id)).progress,
  );
  const prepared = await prepareRecords(execution, {
    identity: {
      itemId: input.itemId,
      parentId: input.accountId,
      resource: Resource.transactions,
    },
    parent: parent ?? undefined,
    progress,
    records: input.records,
  });
  const receivedIds = new Set(
    prepared.map((entry) => entry.mutation.value.identity.id),
  );
  await observePhase(execution, ExecutionPhase.publish, () =>
    repository.commitResolved({
      accountId: input.accountId,
      itemId: input.itemId,
      missingIds: input.ids.filter((id) => !receivedIds.has(id)),
      operationId: op.id,
      prepared,
      progress,
      ...(input.receipt && { receipt: input.receipt }),
    }),
  );
}

async function resolveEvent(
  execution: Execution,
  source: FinancialSource,
  eventId: string,
) {
  const { repository, op, step } = execution;
  const event = await repository.event(eventId);
  if (await nextBatch(0, null)) {
    return true;
  }
  await step.do("event-receipt-complete", async () => {
    await repository.completeEvent(eventId);
    return { phase: OperationPhase.event_resolved };
  });
  return false;

  async function nextBatch(
    batch: number,
    cursor: string | null,
  ): Promise<boolean> {
    const key = `event-${batch}`;
    const result: { done: boolean; cancelled: boolean; next: string | null } =
      await step.do(key, async () => {
        const saved = await repository.receipt(op.id, key);
        if (saved) {
          return { ...saved, next: saved.next ?? null };
        }
        if ((await repository.read(op.id)).cancel_requested) {
          return { cancelled: true, done: true, next: null };
        }
        const { ids, page, done } = await readEventPage(source, event, {
          batch,
          cursor,
        });
        if (page.next && (await repository.eventCursorUsed(op.id, page.next))) {
          throw new Error(FaultCode.CURSOR_LOOP);
        }
        const outcome = {
          cancelled: false,
          done,
          next: page.next,
        };
        await publishResolved(execution, {
          accountId: event.account_id,
          ids,
          itemId: event.item_id,
          receipt: { key, outcome },
          records: page.records,
        });
        return outcome;
      });
    if (result.cancelled) {
      return true;
    }
    if (result.done) {
      return false;
    }
    await step.sleep(`event-pause-${batch}`, "1 second");
    return nextBatch(batch + 1, result.next);
  }
}

async function readEventPage(
  source: FinancialSource,
  event: StoredEvent,
  { batch, cursor }: { batch: number; cursor: string | null },
) {
  const { payload } = event;
  if (!(payload.transactionIds || payload.transactionsCreatedAtFrom)) {
    throw new Error("CREATED_EVENT_WATERMARK_MISSING");
  }
  if (payload.transactionIds) {
    const ids = payload.transactionIds.slice(batch * 20, (batch + 1) * 20);
    const page = {
      next: null,
      records: await source.ids(event.account_id, ids),
    };
    return {
      done: (batch + 1) * 20 >= payload.transactionIds.length,
      ids,
      page,
    };
  }
  const page = await source.page({
    cursor,
    floor: payload.transactionsCreatedAtFrom ?? null,
    item: event.item_id,
    parent: event.account_id,
    resource: Resource.transactions,
  });
  return { done: !page.next, ids: [], page };
}

export async function publishPage(
  execution: Execution,
  source: FinancialSource,
  {
    identity,
    name,
    parent,
  }: { identity: CollectionIdentity; name: string; parent: ParentEntity },
) {
  const { repository, op } = execution;
  const committed = await repository.receipt(op.id, name);
  if (committed) {
    return { cancelled: committed.cancelled, done: committed.done };
  }
  if ((await repository.read(op.id)).cancel_requested) {
    return { cancelled: true, done: true };
  }
  const cp = await repository.checkpoint(identity);
  if (cp.done) {
    return { cancelled: false, done: true };
  }
  const page = await fetchSourcePage(execution, source, { cp, identity });
  if (!page) {
    return { cancelled: false, done: true };
  }
  assertSourceTotal({ actual: page.total, expected: cp.expected_total });
  if (page.next && (await repository.continuationUsed(identity, page.next))) {
    throw new Error(FaultCode.CURSOR_LOOP);
  }
  const progress = progressWithDefaults(
    (await repository.read(op.id)).progress,
  );
  const prepared = await prepareRecords(execution, {
    identity,
    parent: parent?.normalized,
    progress,
    records: page.records,
  });
  let { collected } = cp;
  let { maximum_created_at: maximum } = cp;
  for (const entry of prepared) {
    if (!entry.seenInOperation) {
      collected += 1;
    }
    if (identity.resource === Resource.transactions) {
      maximum = latestCreatedAt({
        created: entry.mutation.value.source.createdAt,
        maximum,
      });
    }
  }
  assertCollectionComplete({ collected, next: page.next, total: page.total });
  // Empty initial accounts receive an inclusive creation watermark fixed at
  // operation start, only after complete pagination.
  if (identity.resource === Resource.transactions && !maximum && !page.next) {
    maximum = op.created_at;
  }
  if (!page.next) {
    progress.resources += 1;
  }
  await observePhase(
    execution,
    ExecutionPhase.publish,
    () =>
      repository.commitPage({
        collected,
        coverageStatus: pageCoverage({
          next: page.next,
          previousPages: cp.page,
          records: page.records.length,
        }),
        deleteMissing: deleteMissingAfterPage({
          kind: op.input.kind,
          next: page.next,
          resource: identity.resource,
        }),
        identity,
        key: name,
        maximum,
        page,
        parentSignature: parent?.relevant_hash ?? null,
        prepared,
        progress,
      }),
    { processed: prepared.length, resource: identity.resource },
  );
  return { cancelled: false, done: !page.next };
}

async function fetchSourcePage(
  execution: Execution,
  source: FinancialSource,
  {
    identity,
    cp,
  }: {
    identity: CollectionIdentity;
    cp: Awaited<ReturnType<ExecutionRepository["checkpoint"]>>;
  },
) {
  const { repository } = execution;
  let connectorId: string | undefined;
  if (identity.resource === Resource.connectors) {
    const connection = await repository.connectionSource(identity.itemId);
    if (!connection?.connector?.id) {
      throw new Error("CONNECTOR_MISSING");
    }
    connectorId = String(connection.connector.id);
  }
  const { data, error } = await tryCatch(() =>
    source.page({
      cursor: cp.cursor,
      floor: cp.creation_floor,
      item: identity.itemId,
      parent: identity.parentId,
      resource: identity.resource,
      ...(connectorId && { connectorId }),
    }),
  );
  if (error) {
    const code =
      "code" in error ? String(error.code) : FaultCode.UPSTREAM_ERROR;
    const state = sourceFailureCoverage(code);
    const recoverable =
      state === CoverageStatus.not_authorized ||
      state === CoverageStatus.unavailable;
    await repository.sourceFailure(identity, state, recoverable);
    if (recoverable) {
      execution.onSourceFailure?.(state);
      return null;
    }
    throw error;
  }
  return data;
}

function prepareRecords(
  execution: Execution,
  {
    identity,
    parent,
    records,
    progress,
  }: {
    identity: Pick<CollectionIdentity, "itemId" | "resource" | "parentId">;
    parent: FinanceRecord | undefined;
    records: SourcePage["records"];
    progress: Progress;
  },
) {
  const { op, engine, prepare } = execution;
  return observePhase(
    execution,
    ExecutionPhase.process,
    async () => {
      const prepared: PreparedEntity[] = [];
      progress.pages += 1;
      progress.received += records.length;
      const identities = new Map<string, string>();
      await records.reduce(async (previous, record) => {
        await previous;
        const id =
          identity.resource === Resource.resources
            ? record.resourceId
            : record.id;
        if (id === null || id === undefined) {
          throw new Error("SOURCE_ID_MISSING");
        }
        const recordId = String(id);
        const contentHash = await hash(record);
        const duplicate = identities.get(recordId);
        if (duplicate) {
          if (duplicate !== contentHash) {
            throw new Error("DUPLICATE_SOURCE_ID_CHANGED_IN_PAGE");
          }
          progress.duplicates += 1;
          return;
        }
        identities.set(recordId, contentHash);
        const entry = await prepare({
          engine,
          identity: {
            id: recordId,
            itemId: identity.itemId,
            parentId: identity.parentId,
            resource: identity.resource,
          },
          operation: op,
          parent,
          source: record,
        });
        prepared.push(entry);
        progress[entry.state] += 1;
        progress.classified += entry.classified;
      }, Promise.resolve());
      return prepared;
    },
    { processed: records.length, resource: identity.resource },
  );
}
