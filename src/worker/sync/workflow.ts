import type { Bindings } from "#worker/bindings.ts";
import { synchronizationDependencies } from "#worker/composition.ts";
import { providerRetries } from "#worker/pluggy/source.ts";
import { runOperation } from "#worker/sync/service.ts";

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

export class FinanceWorkflow extends WorkflowEntrypoint<
  Bindings,
  { operationId: string }
> {
  async run(event: WorkflowEvent<{ operationId: string }>, step: WorkflowStep) {
    return runOperation(
      synchronizationDependencies(this.env),
      event.payload.operationId,
      providerRetries({
        do: (name, fn) =>
          step.do(
            name,
            {
              retries: {
                limit: 6,
                delay: "10 seconds",
                backoff: "exponential",
              },
              timeout: "5 minutes",
            },
            fn,
          ),
        sleep: (name, duration) => {
          if (!/^\d+ seconds?$/.test(duration)) {
            throw new Error("INVALID_STEP_DURATION");
          }
          return step.sleep(name, Number(duration.split(" ")[0]) * 1000);
        },
      }),
    );
  }
}
