import { providerRetries } from "@/worker/pluggy/source";

import type { Bindings } from "../bindings";
import { synchronizationDependencies } from "../composition";
import { runOperation } from "./execution.service";
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
