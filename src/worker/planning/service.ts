import type { PlanningCommand } from "../../contracts";
import { planningDefinitions } from "../../contracts";
import { hash, tryCatch } from "../../shared";
import type { PlanningRepository } from "./entity";
import { planningMutation } from "./mutations.service";
import { planningQuery } from "./queries.service";

const reads = new Set<string>(
  planningDefinitions.filter((d) => d.readOnly).map((d) => d.name),
);
export function createPlanningService(
  repository: PlanningRepository,
  now: () => Date = () => new Date(),
) {
  async function receipt(key: string, digest: string) {
    const prior = await repository.receipt(key);
    if (prior && prior.digest !== digest) {
      throw new Error("IDEMPOTENCY_CONFLICT");
    }
    return prior;
  }
  async function recover(input: {
    key: string;
    digest: string;
    revision: number;
    error: Error;
  }) {
    const prior = await receipt(input.key, input.digest);
    if (prior) {
      return prior.result;
    }
    if ((await repository.revision()) !== input.revision) {
      throw new Error("RESTART_REQUIRED");
    }
    throw input.error;
  }
  return {
    async execute(input: PlanningCommand): Promise<unknown> {
      const digest = await hash(input);
      if ("idempotency_key" in input) {
        const prior = await receipt(input.idempotency_key, digest);
        if (prior) {
          return prior.result;
        }
      }
      const snapshot = await repository.read();
      if (reads.has(input.tool)) {
        const result = await planningQuery(input, snapshot, repository, now());
        if ((await repository.revision()) !== snapshot.revision) {
          throw new Error("RESTART_REQUIRED");
        }
        return {
          data: result,
          partial: snapshot.partial,
          revision: snapshot.revision,
        };
      }
      if (!("idempotency_key" in input)) {
        throw new Error("CONFIRMATION_REQUIRED");
      }
      const state = structuredClone(snapshot.state);
      const result = await planningMutation(input, {
        now: now().toISOString(),
        repository,
        snapshot,
        state,
      });
      const { data: _data, error } = await tryCatch(() =>
        repository.commit({
          before: snapshot,
          digest,
          key: input.idempotency_key,
          now: now().toISOString(),
          result,
          state,
        }),
      );
      if (error) {
        return recover({
          digest,
          error,
          key: input.idempotency_key,
          revision: snapshot.revision,
        });
      }
      return result;
    },
  };
}
