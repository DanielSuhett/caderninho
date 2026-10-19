import type { ReapplicationInput, ReapplicationResult } from "../../domain";
import { txContext } from "../../domain/rules";
import { tryCatch } from "../../shared";
import {
  type ExecutionDependencies,
  ExecutionPhase,
  type LocalReapplication,
  type ReapplicationObservation,
  type ReapplicationRepository,
} from "./entity";

export function createReapplicationService(
  repository: ReapplicationRepository,
  observation?: ReapplicationObservation,
) {
  const phase: NonNullable<ExecutionDependencies["observePhase"]> =
    observation?.phase ?? ((_phase, callback) => callback());
  return async (input: ReapplicationInput): Promise<ReapplicationResult> => {
    if (input.renormalize) {
      throw new Error("RENORMALIZE_REQUIRES_RECONCILIATION");
    }
    const run = await repository.begin(input);
    return observation
      ? observation.batch(
          { batch: run.batch, operationId: run.operation.id },
          () => applyBatch(run, input),
        )
      : applyBatch(run, input);
  };

  async function applyBatch(
    run: LocalReapplication,
    input: ReapplicationInput,
  ): Promise<ReapplicationResult> {
    const saved = await repository.receipt(run.operation.id, run.batch);
    if (saved) {
      return saved;
    }
    if (!(await repository.acquire(run.operation.id))) {
      throw new Error("FINANCIAL_EXECUTOR_BUSY_RETRY_BATCH");
    }
    try {
      const selected = await repository.select(run);
      if (selected.length > 5 && !input.batches) {
        throw new Error("REAPPLICATION_TOO_LARGE_USE_BATCHES");
      }
      const engine = await repository.rules(run.operation.rules_revision);
      const prepare = () =>
        Promise.all(
          selected.slice(0, 5).map(async (entity) => ({
            derived: await engine.evaluate(txContext(entity.normalized)),
            identity: {
              id: entity.id,
              itemId: entity.item_id,
              parentId: entity.parent_id,
              resource: entity.resource,
            },
          })),
        );
      const changes = await phase(ExecutionPhase.process, prepare, {
        processed: Math.min(selected.length, 5),
      });
      const after = lastIdentity(changes.at(-1)?.identity, run.after);
      const result: ReapplicationResult = {
        continuation:
          selected.length > 5
            ? { batch: run.batch + 1, operationId: run.operation.id }
            : null,
        operationId: run.operation.id,
        processed: changes.length,
        status: selected.length > 5 ? "partial" : "completed",
        totalProcessed:
          (run.operation.progress.classified ?? 0) + changes.length,
      };
      const commit = () => repository.commit(run, changes, result, after);
      const { data: _data, error } = await tryCatch(() =>
        phase(ExecutionPhase.publish, commit, {
          processed: changes.length,
        }),
      );
      if (error) {
        const replay = await repository.receipt(run.operation.id, run.batch);
        if (replay) {
          return replay;
        }
        throw new Error("REAPPLICATION_CONFLICT_START_NEW_REQUEST", {
          cause: error,
        });
      }
      return result;
    } finally {
      await repository.release(run.operation.id);
    }
  }
}

function lastIdentity(
  identity:
    | { itemId: string; resource: string; parentId: string; id: string }
    | undefined,
  previous: string[],
) {
  if (!identity) {
    return previous;
  }
  return [identity.itemId, identity.resource, identity.parentId, identity.id];
}
