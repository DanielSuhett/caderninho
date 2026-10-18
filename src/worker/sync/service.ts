import {
  type FinishedOperationStatus,
  MigrationPolicy,
  type MigrationRequest,
  type OperationInput,
  OperationKind,
  OperationPhase,
  OperationStatus,
  type WebhookEvent,
  WebhookEventType,
} from "#contracts/operation.types.ts";
import type { Resource } from "#domain/enums.ts";
import type { ProviderRecord } from "#domain/provider.types.ts";
import { tryCatch } from "#shared/result.ts";
import type { createSyncRepository } from "#worker/sync/repository.ts";

export interface OperationHandle {
  id: string;
  status: OperationStatus;
}

export interface FinancialSource {
  page(input: {
    resource: Resource;
    item: string;
    parent: string;
    cursor: string | null;
    floor: string | null;
    connectorId?: string | undefined;
  }): Promise<{
    records: ProviderRecord[];
    next: string | null;
    total?: number;
  }>;
  ids(account: string, ids: string[]): Promise<ProviderRecord[]>;
}
// Durable checkpoints carry plain serializable data, independent of the host SDK.
export type StepValue<T> =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<T extends ReadonlyArray<infer U> ? StepValue<U> : never>
  | { [K in keyof T]: K extends string | number ? StepValue<T[K]> : never };
export interface Steps {
  do<T extends StepValue<T>>(
    name: string,
    callback: () => Promise<T>,
  ): Promise<T>;
  sleep(name: string, duration: string): Promise<void>;
}
export interface SynchronizationSession {
  operation: OperationHandle & {
    kind: OperationInput["kind"];
  };
  cancelled(): Promise<boolean>;
  acquire(): Promise<boolean>;
  mature(): Promise<{ phase: OperationPhase }>;
  migrate(step: Steps): Promise<void>;
  reapply(step: Steps): Promise<boolean>;
  resolveEvent(source: FinancialSource, step: Steps): Promise<boolean>;
  synchronize(source: FinancialSource, step: Steps): Promise<boolean>;
  hasErrors(): Promise<boolean>;
  finish(status: FinishedOperationStatus, isError?: boolean): Promise<void>;
}
export interface SynchronizationDependencies {
  open(id: string): Promise<SynchronizationSession>;
  source(): Promise<FinancialSource>;
}

export async function runOperation(
  dependencies: SynchronizationDependencies,
  id: string,
  step: Steps,
) {
  const session = await dependencies.open(id);
  const op = session.operation;
  if (op.status !== OperationStatus.working) {
    return;
  }
  for (let n = 0; ; n++) {
    if (await session.cancelled()) {
      await session.finish(OperationStatus.cancelled);
      return;
    }
    if (await step.do(`acquire-${n}`, () => session.acquire())) {
      break;
    }
    await step.sleep(`queued-${n}`, "10 seconds");
  }
  const { data, error } = await tryCatch(async () => {
    let scoped: Promise<FinancialSource> | undefined;
    const resolveSource = () => (scoped ??= dependencies.source());
    const source: FinancialSource = {
      page: async (...args) => (await resolveSource()).page(...args),
      ids: async (...args) => (await resolveSource()).ids(...args),
    };
    await step.do("mature", () => session.mature());
    const strategies = {
      [OperationKind.migration]: async () => {
        await session.migrate(step);
        return false;
      },
      [OperationKind.reapply]: () => session.reapply(step),
      [OperationKind.webhook]: () => session.resolveEvent(source, step),
      [OperationKind.sync]: () => session.synchronize(source, step),
      [OperationKind.reconcile]: () => session.synchronize(source, step),
    } satisfies Record<OperationKind, () => Promise<boolean>>;
    const cancelled = await strategies[op.kind]();
    if (cancelled) {
      await session.finish(OperationStatus.cancelled);
      return;
    }
    await step.do("finish", async () => {
      await session.finish(
        OperationStatus.completed,
        await session.hasErrors(),
      );
      return { phase: OperationPhase.completed };
    });
  });
  if (error) {
    await session.finish(OperationStatus.completed, true);
    throw error;
  }
  return data;
}

export interface DueSchedule {
  next_sync_at: string;
  reconcile_after: string;
}
export interface SchedulingStore {
  due(now: string): Promise<DueSchedule | null>;
  enqueue(
    account: DueSchedule,
    kind: typeof OperationKind.sync | typeof OperationKind.reconcile,
    next: string,
    reconcileAfter: string,
  ): Promise<OperationHandle | null>;
}
export async function scheduleSync(
  store: SchedulingStore,
  dispatch: (operation: OperationHandle) => Promise<void>,
  now: Date,
) {
  const due = await store.due(now.toISOString());
  if (!due) {
    return;
  }
  // A failed dispatch is recoverable through the durable outbox.
  const { data, error } = await tryCatch(async () => {
    const reconcile = due.reconcile_after <= now.toISOString();
    const op = await store.enqueue(
      due,
      reconcile ? OperationKind.reconcile : OperationKind.sync,
      new Date(now.getTime() + 86400000).toISOString(),
      reconcile
        ? new Date(now.getTime() + 7 * 86400000).toISOString()
        : due.reconcile_after,
    );
    if (op) {
      await dispatch(op);
    }
  });
  return error ? undefined : data;
}

export function createSyncService(
  repository: ReturnType<typeof createSyncRepository>,
  workflow: {
    create(id: string): Promise<void>;
    status(id: string): Promise<string>;
  },
  now: () => Date = () => new Date(),
) {
  const dispatch = async (op: OperationHandle) => {
    if (
      op.status !== OperationStatus.working ||
      !(await repository.needsDispatch(op.id))
    ) {
      return;
    }
    const { data: _data, error } = await tryCatch(() => workflow.create(op.id));
    if (error) {
      const { data: _data, error: statusError } = await tryCatch(() =>
        workflow.status(op.id),
      );
      if (statusError) {
        throw error;
      }
    }
    await repository.markDispatched(op.id);
  };
  return {
    dispatch,
    async recover() {
      for (const op of await repository.operations(false)) {
        // The committed outbox remains pending if dispatch fails.
        await tryCatch(() => dispatch(op)).then(({ data, error }) =>
          error ? undefined : data,
        );
      }
      for (const op of await repository.operations(true)) {
        const { data, error } = await tryCatch(() => workflow.status(op.id));
        if (!error && ["errored", "terminated"].includes(data)) {
          await repository.finish(
            op.id,
            data === "terminated"
              ? OperationStatus.cancelled
              : OperationStatus.completed,
            data === "errored",
          );
        }
      }
      for (const event of await repository.inbox()) {
        const op = await repository.start(`webhook:${event.event_id}`, {
          kind: OperationKind.webhook,
          itemIds: [event.item_id],
          eventId: event.event_id,
        });
        await repository.linkEvent(event.event_id, op.id);
        // The committed outbox remains pending if dispatch fails.
        await tryCatch(() => dispatch(op)).then(({ data, error }) =>
          error ? undefined : data,
        );
      }
    },
    cancel: (id: string) => repository.cancel(id),
    async acceptWebhook(event: WebhookEvent) {
      if (
        event.event === WebhookEventType.transactions_created &&
        !event.transactionsCreatedAtFrom
      ) {
        throw new Error("MISSING_CREATION_FLOOR");
      }
      if (
        event.event !== WebhookEventType.transactions_created &&
        !event.transactionIds?.length
      ) {
        throw new Error("MISSING_TRANSACTION_IDS");
      }
      return repository.acceptWebhook(event, now().toISOString());
    },
    async migrate(input: MigrationRequest) {
      const overlaps = await repository.migrationOverlaps(input);
      if (!input.apply) {
        return {
          status: 200 as const,
          body: {
            records: input.rows.length,
            overlaps,
            policy: input.policy,
            applied: false,
          },
        };
      }
      if (overlaps && input.policy === MigrationPolicy.refuse_conflicts) {
        return {
          status: 409 as const,
          body: { error: "MIGRATION_OVERLAP_REQUIRES_POLICY", overlaps },
        };
      }
      const op = await repository.start(
        `migration:${await repository.fingerprint(input)}`,
        {
          kind: OperationKind.migration,
          itemIds: [input.itemId],
          migration: input.rows,
          migrationPolicy: input.policy,
        },
      );
      // The committed outbox remains pending if dispatch fails.
      await tryCatch(() => dispatch(op)).then(({ data, error }) =>
        error ? undefined : data,
      );
      return {
        status: 200 as const,
        body: { operationId: op.id, status: op.status, applied: false },
      };
    },
  };
}
