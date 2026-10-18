import {
  type MigrationRequest,
  OperationKind,
  OperationStatus,
  type WebhookEvent,
} from "../../contracts";
import {
  assertWebhookEvent,
  MigrationDecision,
  migrationDecision,
  nextSyncSchedule,
} from "../../domain";
import { tryCatch } from "../../shared";
import type {
  OperationHandle,
  SchedulingStore,
  SyncRecoveryNotice,
  SyncRepository,
  WorkflowDispatcher,
} from "./entity";

export async function scheduleSync(
  store: SchedulingStore,
  dispatch: (operation: OperationHandle) => Promise<void>,
  now: Date,
  onRecovery?: (notice: SyncRecoveryNotice) => void,
) {
  const due = await store.due(now.toISOString());
  if (!due) {
    return;
  }
  // A failed dispatch is recoverable through the durable outbox.
  const { data, error } = await tryCatch(async () => {
    const schedule = nextSyncSchedule({
      now,
      reconcileAfter: due.reconcile_after,
    });
    const op = await store.enqueue(
      due,
      schedule.kind,
      schedule.next,
      schedule.reconcileAfter,
    );
    if (op) {
      await dispatch(op);
    }
  });
  if (error) {
    onRecovery?.({ error, phase: "schedule" });
    return;
  }
  return data;
}

export function createSyncService(
  repository: SyncRepository,
  workflow: WorkflowDispatcher,
  now: () => Date = () => new Date(),
  onRecovery?: (notice: SyncRecoveryNotice) => void,
) {
  const dispatch = async (op: OperationHandle) => {
    if (
      op.status !== OperationStatus.working ||
      !(await repository.needsDispatch(op.id)) ||
      !(await repository.claim(op.id))
    ) {
      return;
    }
    const { data: _data, error } = await tryCatch(() => workflow.create(op.id));
    if (error) {
      const { data: _status, error: statusError } = await tryCatch(() =>
        workflow.status(op.id),
      );
      if (statusError) {
        throw error;
      }
    }
    await repository.markDispatched(op.id);
  };
  return {
    async acceptWebhook(event: WebhookEvent) {
      assertWebhookEvent(event);
      return await repository.acceptWebhook(event, now().toISOString());
    },
    cancel: (id: string) => repository.cancel(id),
    compact: repository.compact,
    dispatch,
    async migrate(input: MigrationRequest) {
      const overlaps = await repository.migrationOverlaps(input);
      if (!input.apply) {
        return {
          body: {
            applied: false,
            overlaps,
            policy: input.policy,
            records: input.rows.length,
          },
          status: 200 as const,
        };
      }
      if (
        migrationDecision({ conflicting: !!overlaps, policy: input.policy }) ===
        MigrationDecision.refuse
      ) {
        return {
          body: { error: "MIGRATION_OVERLAP_REQUIRES_POLICY", overlaps },
          status: 409 as const,
        };
      }
      const op = await repository.start(
        `migration:${await repository.fingerprint(input)}`,
        {
          itemIds: [input.itemId],
          kind: OperationKind.migration,
          migration: input.rows,
          migrationPolicy: input.policy,
        },
      );
      // The committed outbox remains pending if dispatch fails.
      const { data: _dispatched, error } = await tryCatch(() => dispatch(op));
      if (error) {
        onRecovery?.({ error, operationId: op.id, phase: "dispatch" });
      }
      return {
        body: { applied: false, operationId: op.id, status: op.status },
        status: 200 as const,
      };
    },
    read: repository.read,
    async recover() {
      await (await repository.operations(true)).reduce(async (previous, op) => {
        await previous;
        const { data, error } = await tryCatch(() => workflow.status(op.id));
        if (error) {
          onRecovery?.({ error, operationId: op.id, phase: "status" });
          return;
        }
        if (["errored", "terminated"].includes(data)) {
          await repository.finish(
            op.id,
            data === "terminated"
              ? OperationStatus.cancelled
              : OperationStatus.completed,
            data === "errored",
          );
        }
      }, Promise.resolve());
      await (await repository.operations(false)).reduce(
        async (previous, op) => {
          await previous;
          // The committed outbox remains pending if dispatch fails.
          const { data: _dispatched, error } = await tryCatch(() =>
            dispatch(op),
          );
          if (error) {
            onRecovery?.({ error, operationId: op.id, phase: "dispatch" });
          }
        },
        Promise.resolve(),
      );
    },
    start: (key: string, input: Parameters<SyncRepository["start"]>[1]) =>
      repository.admit(key, input, now()),
    state: repository.state,
    states: repository.states,
  };
}
