import type {
  MigrationRequest,
  WebhookEvent,
  OperationInput,
  OperationStatus,
} from "#contracts/operation.ts";
import type { Resource } from "#domain/enums.ts";
import type { ProviderRecord } from "#domain/schemas.ts";
import { tryCatch } from "#shared/result.ts";
import type { createSyncRepository } from "#worker/sync/repository.ts";

export interface OperationHandle {
  id: string;
  status: OperationStatus;
}

export interface FinancialSource {
  page(
    resource: Resource,
    item: string,
    parent: string,
    cursor: string | null,
    floor: string | null,
    connectorId?: string,
  ): Promise<{
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
    principal: string;
    kind: OperationInput["kind"];
  };
  cancelled(): Promise<boolean>;
  acquire(): Promise<boolean>;
  mature(): Promise<{ phase: string }>;
  migrate(step: Steps): Promise<void>;
  reapply(step: Steps): Promise<boolean>;
  resolveEvent(source: FinancialSource, step: Steps): Promise<boolean>;
  synchronize(source: FinancialSource, step: Steps): Promise<boolean>;
  hasErrors(): Promise<boolean>;
  finish(status: "completed" | "cancelled", isError?: boolean): Promise<void>;
}
export interface SynchronizationDependencies {
  open(id: string): Promise<SynchronizationSession>;
  source(principal: string): Promise<FinancialSource>;
}

export async function runOperation(
  dependencies: SynchronizationDependencies,
  id: string,
  step: Steps,
  suppliedProvider?: FinancialSource,
) {
  const session = await dependencies.open(id);
  const op = session.operation;
  if (op.status !== "working") return;
  for (let n = 0; ; n++) {
    if (await session.cancelled()) {
      await session.finish("cancelled");
      return;
    }
    if (await step.do(`acquire-${n}`, () => session.acquire())) break;
    await step.sleep(`queued-${n}`, "10 seconds");
  }
  const execution = await tryCatch(
    (async () => {
      let scoped: Promise<FinancialSource> | undefined;
      const resolveSource = () =>
        (scoped ??= dependencies.source(op.principal));
      const source: FinancialSource = suppliedProvider ?? {
        page: async (...args) => (await resolveSource()).page(...args),
        ids: async (...args) => (await resolveSource()).ids(...args),
      };
      await step.do("mature", () => session.mature());
      let cancelled = false;
      switch (op.kind) {
        case "migration":
          await session.migrate(step);
          break;
        case "reapply":
          cancelled = await session.reapply(step);
          break;
        case "webhook":
          cancelled = await session.resolveEvent(source, step);
          break;
        case "sync":
        case "reconcile":
          cancelled = await session.synchronize(source, step);
          break;
      }
      if (cancelled) {
        await session.finish("cancelled");
        return;
      }
      await step.do("finish", async () => {
        await session.finish("completed", await session.hasErrors());
        return { phase: "completed" };
      });
    })(),
  );
  if (execution.error) {
    await session.finish("completed", true);
    throw execution.error;
  }
}

export interface DueAccount {
  principal: string;
  next_sync_at: string;
  reconcile_after: string;
}
export interface SchedulingStore {
  due(now: string): Promise<DueAccount[]>;
  enqueue(
    account: DueAccount,
    kind: "sync" | "reconcile",
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
  for (const account of due) {
    const result = await tryCatch(
      (async () => {
        const reconcile = account.reconcile_after <= now.toISOString();
        const op = await store.enqueue(
          account,
          reconcile ? "reconcile" : "sync",
          new Date(now.getTime() + 86400000).toISOString(),
          reconcile
            ? new Date(now.getTime() + 7 * 86400000).toISOString()
            : account.reconcile_after,
        );
        if (op) await dispatch(op);
      })(),
    );
    // Each failed account remains recoverable through the durable outbox.
    if (result.error) continue;
  }
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
    if (op.status !== "working" || !(await repository.needsDispatch(op.id)))
      return;
    const created = await tryCatch(workflow.create(op.id));
    if (created.error) {
      const existing = await tryCatch(workflow.status(op.id));
      if (existing.error) throw created.error;
    }
    await repository.markDispatched(op.id);
  };
  return {
    dispatch,
    async recover() {
      for (const op of await repository.operations(false))
        await tryCatch(dispatch(op));
      for (const op of await repository.operations(true)) {
        const state = await tryCatch(workflow.status(op.id));
        if (!state.error && ["errored", "terminated"].includes(state.data))
          await repository.finish(
            op.id,
            state.data === "terminated" ? "cancelled" : "completed",
            state.data === "errored",
          );
      }
      for (const event of await repository.inbox()) {
        const op = await repository.start(
          event.principal,
          "webhook:" + event.event_id,
          {
            kind: "webhook",
            itemIds: [event.item_id],
            eventId: event.event_id,
          },
        );
        await repository.linkEvent(event.event_id, op.id);
        await tryCatch(dispatch(op));
      }
    },
    cancel: (principal: string, id: string) => repository.cancel(principal, id),
    async acceptWebhook(event: WebhookEvent) {
      if (
        event.event === "transactions/created" &&
        !event.transactionsCreatedAtFrom
      )
        throw new Error("MISSING_CREATION_FLOOR");
      if (
        event.event !== "transactions/created" &&
        !event.transactionIds?.length
      )
        throw new Error("MISSING_TRANSACTION_IDS");
      return repository.acceptWebhook(event, now().toISOString());
    },
    async migrate(principal: string, input: MigrationRequest) {
      const overlaps = await repository.migrationOverlaps(principal, input);
      if (!input.apply)
        return {
          status: 200 as const,
          body: {
            records: input.rows.length,
            overlaps,
            policy: input.policy,
            applied: false,
          },
        };
      if (overlaps && input.policy === "refuse-conflicts")
        return {
          status: 409 as const,
          body: { error: "MIGRATION_OVERLAP_REQUIRES_POLICY", overlaps },
        };
      const op = await repository.start(
        principal,
        "migration:" + (await repository.fingerprint(input)),
        {
          kind: "migration",
          itemIds: [input.itemId],
          migration: input.rows,
          migrationPolicy: input.policy,
        },
      );
      await tryCatch(dispatch(op));
      return {
        status: 200 as const,
        body: { operationId: op.id, status: op.status, applied: false },
      };
    },
  };
}
