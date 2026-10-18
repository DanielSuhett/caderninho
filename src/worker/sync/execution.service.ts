import {
  OperationKind,
  OperationPhase,
  OperationStatus,
} from "@/contracts/operation.types";
import { CoverageStatus, FaultCode, Resource } from "@/domain/enums";
import type { FinanceRecord } from "@/domain/finance.entity";
import { DEFINITIONS } from "@/domain/finance-model";
import {
  assertCollectionComplete,
  assertSourceTotal,
  deleteMissingAfterPage,
  latestCreatedAt,
  MigrationDecision,
  migrationDecision,
  pageCoverage,
  resourceParentAllowed,
  sourceFailureCoverage,
  transactionCreationFloor,
} from "@/domain/operation.entity";
import { itemInfo, productState } from "@/domain/provider.entity";
import type { RuleEngine } from "@/domain/rules";
import { txContext } from "@/domain/rules";
import { hash } from "@/shared/crypto";
import { tryCatch } from "@/shared/result";
import type { PreparedEntity } from "@/worker/finance/entity";

import type {
  CollectionIdentity,
  ExecutionDependencies,
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
import { progressWithDefaults } from "./entity";

interface Execution extends ExecutionDependencies {
  op: Operation;
  engine: RuleEngine;
  step: Steps;
}

export async function runOperation(
  dependencies: SynchronizationDependencies,
  id: string,
  step: Steps,
) {
  const { repository } = dependencies;
  const op = await repository.read(id);
  if (op.status !== OperationStatus.working) {
    return;
  }
  const engine = await repository.rules(op.rules_revision);
  const execution = { ...dependencies, op, engine, step };
  for (let n = 0; ; n++) {
    if ((await repository.read(id)).cancel_requested) {
      await repository.finish(op, OperationStatus.cancelled);
      return;
    }
    if (await step.do(`acquire-${n}`, () => repository.acquire(id))) {
      break;
    }
    await step.sleep(`queued-${n}`, "10 seconds");
  }
  const { data, error } = await tryCatch(async () => {
    let sourcePromise: Promise<FinancialSource> | undefined;
    const resolveSource = () => (sourcePromise ??= dependencies.source());
    const source: FinancialSource = {
      page: async (...args) => (await resolveSource()).page(...args),
      ids: async (...args) => (await resolveSource()).ids(...args),
    };
    await step.do("mature", async () => {
      await repository.mature(op);
      return { phase: OperationPhase.matured };
    });
    if (await executeOperation(execution, source)) {
      await repository.finish(op, OperationStatus.cancelled);
      return;
    }
    await step.do("finish", async () => {
      const progress = progressWithDefaults(
        (await repository.read(id)).progress,
      );
      await repository.finish(
        op,
        OperationStatus.completed,
        progress.errors > 0,
      );
      return { phase: OperationPhase.completed };
    });
  });
  if (error) {
    await repository.finish(op, OperationStatus.completed, true);
    throw error;
  }
  return data;
}

function executeOperation(execution: Execution, source: FinancialSource) {
  const input = execution.op.input;
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
  }
}

async function reapplyRules({ repository, op, engine, step }: Execution) {
  await step.do("select-reapply", async () => {
    await repository.selectReapplication(op);
    return { phase: OperationPhase.selected };
  });
  for (let batch = 0; ; batch++) {
    const key = `reapply-${batch}`;
    const result = await step.do(key, async () => {
      const saved = await repository.receipt(op.id, key);
      if (saved) {
        return saved;
      }
      if ((await repository.read(op.id)).cancel_requested) {
        return { done: true, cancelled: true };
      }
      const selected = await repository.reapplicationTargets(op.id);
      const changes = [];
      for (const entity of selected) {
        changes.push({
          identity: {
            itemId: entity.item_id,
            resource: entity.resource,
            parentId: entity.parent_id,
            id: entity.id,
          },
          derived: await engine.evaluate(txContext(entity.normalized)),
        });
      }
      const progress = progressWithDefaults(
        (await repository.read(op.id)).progress,
      );
      progress.classified += selected.length;
      progress.received += selected.length;
      const outcome = { done: selected.length < 20, cancelled: false };
      await repository.commitReapplication({
        op,
        key,
        changes,
        progress,
        outcome,
      });
      return outcome;
    });
    if (result.cancelled) {
      return true;
    }
    if (result.done) {
      break;
    }
  }
  return false;
}

async function migrateLegacy({
  repository,
  op,
  engine,
  prepare,
  step,
}: Execution) {
  const input = op.input;
  if (input.kind !== OperationKind.migration) {
    throw new Error("OPERATION_KIND_MISMATCH");
  }
  const result = await step.do("import-legacy", async () => {
    if ((await repository.read(op.id)).cancel_requested) {
      return { cancelled: true };
    }
    const itemId = input.itemIds[0];
    if (!itemId) {
      throw new Error(FaultCode.INVALID_ITEM_ID);
    }
    const rows = [];
    for (const row of input.migration) {
      const identity = {
        itemId,
        resource: row.resource,
        parentId: row.parentId,
        id: row.record.id,
      };
      const digest = await hash(row);
      if (await repository.imported(row.sourceKey, digest)) {
        continue;
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
        continue;
      }
      const prepared = await prepare({
        identity,
        source: {
          id: row.record.id,
          resourceId: row.record.id,
          legacyProjection: row.record,
          legacySourceKey: row.sourceKey,
        },
        parent: undefined,
        operation: op,
        engine,
        legacyProjection: row.record,
      });
      rows.push({ prepared, sourceKey: row.sourceKey, digest });
    }
    await repository.commitMigration(rows);
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
  for (const item of items) {
    for (const resource of resourceOrder) {
      if (await synchronizeItemResource(execution, source, item.id, resource)) {
        return true;
      }
    }
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
  for (const parent of parents) {
    if (
      parent &&
      !resourceParentAllowed({ resource, parentType: parent.normalized.type })
    ) {
      continue;
    }
    const parentId = parent?.id ?? "";
    const identity = { operationId: op.id, itemId, resource, parentId };
    if (
      resource === Resource.investment_transactions &&
      op.input.kind === OperationKind.sync
    ) {
      const previous = await repository.coverage(itemId, resource, parentId);
      if (
        previous?.bootstrap_complete === 1 &&
        previous.parent_signature === (parent?.relevant_hash ?? null)
      ) {
        continue;
      }
    }
    if (await synchronizeCollection(execution, source, { identity, parent })) {
      return true;
    }
  }
  return false;
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
      resource,
      kind: op.input.kind,
      coverage: coverage && {
        complete: !!coverage.bootstrap_complete,
        confirmedCreatedAt: coverage.confirmed_created_at,
      },
    });
    await repository.createCheckpoint(identity, floor);
    return { phase: OperationPhase.checkpoint };
  });
  for (let pageIndex = 0; ; pageIndex++) {
    const name = `page-${itemId}-${resource}-${parentId}-${pageIndex}`;
    const result = await step.do(name, () =>
      publishPage(execution, source, { identity, name, parent }),
    );
    if (result.cancelled) {
      return true;
    }
    if (result.done) {
      break;
    }
    await step.sleep(`pause-${name}`, "1 second");
  }
  return false;
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
  await step.do("select-pending", async () => {
    await repository.selectPending(op.id, itemIds);
    return { phase: OperationPhase.pending_selected };
  });
  for (let batch = 0; ; batch++) {
    const key = `pending-${batch}`;
    const outcome = await step.do(key, async () => {
      const committed = await repository.receipt(op.id, key);
      if (committed) {
        return committed;
      }
      if ((await repository.read(op.id)).cancel_requested) {
        return { done: true, cancelled: true };
      }
      const selected = await repository.pending(op.id);
      const first = selected[0];
      if (!first) {
        return { done: true, cancelled: false };
      }
      const group = selected.filter(
        (entry) =>
          entry.item_id === first.item_id &&
          entry.parent_id === first.parent_id,
      );
      const ids = group.map((entry) => entry.id);
      const records = await source.ids(first.parent_id, ids);
      const outcome = { done: false, cancelled: false };
      await publishResolved(execution, {
        itemId: first.item_id,
        accountId: first.parent_id,
        ids,
        records,
        receipt: { key, outcome, processedIds: ids },
      });
      return outcome;
    });
    if (outcome.cancelled) {
      return true;
    }
    if (outcome.done) {
      break;
    }
    await step.sleep(`pending-pause-${batch}`, "1 second");
  }
  return false;
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
      resource: Resource.transactions,
      parentId: input.accountId,
    },
    records: input.records,
    parent: parent ?? undefined,
    progress,
  });
  const receivedIds = new Set(
    prepared.map((entry) => entry.mutation.value.identity.id),
  );
  await repository.commitResolved({
    operationId: op.id,
    itemId: input.itemId,
    accountId: input.accountId,
    prepared,
    missingIds: input.ids.filter((id) => !receivedIds.has(id)),
    progress,
    ...(input.receipt && { receipt: input.receipt }),
  });
}

async function resolveEvent(
  execution: Execution,
  source: FinancialSource,
  eventId: string,
) {
  const { repository, op, step } = execution;
  const event = await repository.event(eventId);
  let cursor: string | null = null;
  for (let batch = 0; ; batch++) {
    const key = `event-${batch}`,
      previous = cursor;
    const result: { done: boolean; cancelled: boolean; next: string | null } =
      await step.do(key, async () => {
        const saved = await repository.receipt(op.id, key);
        if (saved) {
          return { ...saved, next: saved.next ?? null };
        }
        if ((await repository.read(op.id)).cancel_requested) {
          return { done: true, cancelled: true, next: null };
        }
        const { ids, page, done } = await readEventPage(source, event, {
          batch,
          cursor: previous,
        });
        if (page.next && (await repository.eventCursorUsed(op.id, page.next))) {
          throw new Error(FaultCode.CURSOR_LOOP);
        }
        const outcome = {
          done,
          cancelled: false,
          next: page.next,
        };
        await publishResolved(execution, {
          itemId: event.item_id,
          accountId: event.account_id,
          ids,
          records: page.records,
          receipt: { key, outcome },
        });
        return outcome;
      });
    if (result.cancelled) {
      return true;
    }
    if (result.done) {
      break;
    }
    cursor = result.next;
    await step.sleep(`event-pause-${batch}`, "1 second");
  }
  await step.do("event-receipt-complete", async () => {
    await repository.completeEvent(eventId);
    return { phase: OperationPhase.event_resolved };
  });
  return false;
}

async function readEventPage(
  source: FinancialSource,
  event: StoredEvent,
  { batch, cursor }: { batch: number; cursor: string | null },
) {
  const payload = event.payload;
  if (!payload.transactionIds && !payload.transactionsCreatedAtFrom) {
    throw new Error("CREATED_EVENT_WATERMARK_MISSING");
  }
  if (payload.transactionIds) {
    const ids = payload.transactionIds.slice(batch * 20, (batch + 1) * 20);
    const page = {
      records: await source.ids(event.account_id, ids),
      next: null,
    };
    return {
      ids,
      page,
      done: (batch + 1) * 20 >= payload.transactionIds.length,
    };
  }
  const page = await source.page({
    resource: Resource.transactions,
    item: event.item_id,
    parent: event.account_id,
    cursor,
    floor: payload.transactionsCreatedAtFrom ?? null,
  });
  return { ids: [], page, done: !page.next };
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
    return { done: committed.done, cancelled: committed.cancelled };
  }
  if ((await repository.read(op.id)).cancel_requested) {
    return { done: true, cancelled: true };
  }
  const cp = await repository.checkpoint(identity);
  if (cp.done) {
    return { done: true, cancelled: false };
  }
  const page = await fetchSourcePage(repository, source, { identity, cp });
  if (!page) {
    return { done: true, cancelled: false };
  }
  assertSourceTotal({ expected: cp.expected_total, actual: page.total });
  if (page.next && (await repository.continuationUsed(identity, page.next))) {
    throw new Error(FaultCode.CURSOR_LOOP);
  }
  const progress = progressWithDefaults(
    (await repository.read(op.id)).progress,
  );
  const prepared = await prepareRecords(execution, {
    identity,
    parent: parent?.normalized,
    records: page.records,
    progress,
  });
  let collected = cp.collected;
  let maximum = cp.maximum_created_at;
  for (const entry of prepared) {
    if (!entry.seenInOperation) {
      collected++;
    }
    if (identity.resource === Resource.transactions) {
      maximum = latestCreatedAt({
        maximum,
        created: entry.mutation.value.source.createdAt,
      });
    }
  }
  assertCollectionComplete({ next: page.next, total: page.total, collected });
  // Empty initial accounts receive an inclusive creation watermark fixed at
  // operation start, only after complete pagination.
  if (identity.resource === Resource.transactions && !maximum && !page.next) {
    maximum = op.created_at;
  }
  if (!page.next) {
    progress.resources++;
  }
  await repository.commitPage({
    identity,
    key: name,
    prepared,
    progress,
    page,
    maximum,
    collected,
    parentSignature: parent?.relevant_hash ?? null,
    deleteMissing: deleteMissingAfterPage({
      resource: identity.resource,
      kind: op.input.kind,
      next: page.next,
    }),
    coverageStatus: pageCoverage({
      next: page.next,
      records: page.records.length,
      previousPages: cp.page,
    }),
  });
  return { done: !page.next, cancelled: false };
}

async function fetchSourcePage(
  repository: ExecutionRepository,
  source: FinancialSource,
  {
    identity,
    cp,
  }: {
    identity: CollectionIdentity;
    cp: Awaited<ReturnType<ExecutionRepository["checkpoint"]>>;
  },
) {
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
      resource: identity.resource,
      item: identity.itemId,
      parent: identity.parentId,
      cursor: cp.cursor,
      floor: cp.creation_floor,
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
      return null;
    }
    throw error;
  }
  return data;
}

async function prepareRecords(
  { op, engine, prepare }: Execution,
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
  const prepared: PreparedEntity[] = [];
  progress.pages++;
  progress.received += records.length;
  const identities = new Map<string, string>();
  for (const record of records) {
    const id =
      identity.resource === Resource.resources ? record.resourceId : record.id;
    if (id == null) {
      throw new Error("SOURCE_ID_MISSING");
    }
    const recordId = String(id);
    const contentHash = await hash(record);
    const duplicate = identities.get(recordId);
    if (duplicate) {
      if (duplicate !== contentHash) {
        throw new Error("DUPLICATE_SOURCE_ID_CHANGED_IN_PAGE");
      }
      progress.duplicates++;
      continue;
    }
    identities.set(recordId, contentHash);
    const entry = await prepare({
      identity: {
        itemId: identity.itemId,
        resource: identity.resource,
        parentId: identity.parentId,
        id: recordId,
      },
      source: record,
      parent,
      operation: op,
      engine,
    });
    prepared.push(entry);
    progress[entry.state]++;
    progress.classified += entry.classified;
  }
  return prepared;
}
