import {
  type MigrationRequest,
  OperationKind,
  OperationStatus,
  type WebhookEvent,
} from "@/contracts/operation.types";
import {
  assertWebhookEvent,
  MigrationDecision,
  migrationDecision,
  nextSyncSchedule,
} from "@/domain/operation.entity";
import { tryCatch } from "@/shared/result";

import type {
  OperationHandle,
  SchedulingStore,
  SyncRepository,
} from "./entity";

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
  return error ? undefined : data;
}

export function createSyncService(
  repository: SyncRepository,
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
    start: repository.start,
    read: repository.read,
    state: repository.state,
    states: repository.states,
    compact: repository.compact,
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
      assertWebhookEvent(event);
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
      if (
        migrationDecision({ conflicting: !!overlaps, policy: input.policy }) ===
        MigrationDecision.refuse
      ) {
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
