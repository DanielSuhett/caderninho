import { RuleJobKind } from "../../../domain";
import { tryCatch } from "../../../shared";
import type { Bindings } from "../../bindings";
import { ruleJobService } from "../../composition";
import { markFailure, SpanName, withObservation } from "../../observability";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
  type WorkflowStepConfig,
} from "cloudflare:workers";

const stepConfig = {
  retries: { backoff: "exponential", delay: "5 seconds", limit: 4 },
  timeout: "5 minutes",
} satisfies WorkflowStepConfig;
// Only stable codes reach the stored job; messages never carry financial data.
const knownFailures = new Set([
  "NOT_FOUND",
  "RESTART_REQUIRED",
  "RULE_APPLICATION_UNSTABLE",
]);

// Each chunk and each application pass is its own step: a long file or history
// never runs in one invocation, and a retried step replays committed receipts.
export class RulesWorkflow extends WorkflowEntrypoint<
  Bindings,
  { jobId: string }
> {
  run(event: WorkflowEvent<{ jobId: string }>, step: WorkflowStep) {
    const id = event.payload.jobId;
    const service = ruleJobService(this.env);
    async function imports(seq: number, chunks: number): Promise<void> {
      if (seq >= chunks) {
        return;
      }
      await step.do(`import-${seq}`, stepConfig, () =>
        service.importChunk(id, seq),
      );
      return imports(seq + 1, chunks);
    }
    async function passes(pass: number): Promise<void> {
      const { done } = await step.do(`apply-${pass}`, stepConfig, () =>
        service.applyPass(id, pass),
      );
      if (!done) {
        return passes(pass + 1);
      }
    }
    return withObservation(
      { operationId: id, runId: event.instanceId },
      async () => {
        const { error } = await tryCatch(async () => {
          const job = await step.do("begin", stepConfig, () =>
            service.begin(id),
          );
          if (job.kind === RuleJobKind.import) {
            await imports(0, job.chunks);
          }
          await passes(0);
          await step.do("finish", stepConfig, () => service.finish(id));
        });
        if (!error) {
          return;
        }
        markFailure(error, { phase: SpanName.phase });
        const code = knownFailures.has(error.message)
          ? error.message
          : "RULE_JOB_FAILED";
        await step.do("fail", stepConfig, () => service.fail(id, code));
      },
    );
  }
}
