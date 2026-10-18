import type { Bindings } from "../../bindings";
import { synchronizationDependencies } from "../../composition";
import { withObservation } from "../../observability";
import { providerRetries } from "../../pluggy";
import { runOperation } from "../execution.service";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

const retryDelayPattern = /^\d+ seconds?$/;

export class FinanceWorkflow extends WorkflowEntrypoint<
  Bindings,
  { operationId: string }
> {
  async run(event: WorkflowEvent<{ operationId: string }>, step: WorkflowStep) {
    let attempt: number | undefined;
    let retries = 0;
    const dependencies = synchronizationDependencies(this.env, () => ({
      ...(attempt !== undefined && { attempt }),
      retries,
    }));
    return await withObservation(
      {
        operationId: event.payload.operationId,
        runId: crypto.randomUUID(),
      },
      () =>
        runOperation(
          dependencies,
          event.payload.operationId,
          providerRetries({
            do: (name, fn) =>
              step.do(
                name,
                {
                  retries: {
                    backoff: "exponential",
                    delay: "10 seconds",
                    limit: 2,
                  },
                  timeout: "5 minutes",
                },
                (context) => {
                  ({ attempt } = context);
                  if (context.attempt > 1) {
                    retries += 1;
                  }
                  return fn();
                },
              ),
            sleep: (name, duration) => {
              if (!retryDelayPattern.test(duration)) {
                throw new Error("INVALID_STEP_DURATION");
              }
              return step.sleep(name, Number(duration.split(" ")[0]) * 1000);
            },
          }),
        ),
    );
  }
}
