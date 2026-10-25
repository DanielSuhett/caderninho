import { z } from "zod/v4";

import {
  type CommitResult,
  Fault,
  FaultCode,
  RunStatus,
} from "../../../domain";
import { rateLimitRetry, tryCatch } from "../../../shared";
import type { Bindings } from "../../bindings";
import { synchronizationDependencies } from "../../composition";
import {
  classifyFailure,
  DiagnosticEvent,
  markFailure,
  Outcome,
  observeSpan,
  Recovery,
  reportDiagnostic,
  SpanName,
  withObservation,
} from "../../observability";
import { importFailure, type Steps } from "../entity";
import { runImport } from "../service";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

const retryableFaults = new Set<string>([
  FaultCode.UPSTREAM_RATE_LIMIT,
  FaultCode.UPSTREAM_TIMEOUT,
  FaultCode.UPSTREAM_UNAVAILABLE,
  FaultCode.UPSTREAM_ERROR,
]);
// Errors crossing the Workflow RPC boundary lose custom properties. Persist only a
// small failure result, then sleep outside step.do; provider Retry-After stays exact.
export function workflowSteps(step: WorkflowStep): Steps {
  return {
    do(name, operation) {
      async function attempt(index: number): Promise<CommitResult> {
        const outcome = await step.do(
          `${name}-attempt-${index}`,
          { retries: { delay: 1, limit: 0 }, timeout: "5 minutes" },
          async () => {
            const { data, error } = await tryCatch(operation);
            if (!error) {
              return { kind: "success" as const, value: data };
            }
            const code =
              error instanceof z.ZodError
                ? FaultCode.INVALID_RESPONSE
                : importFailure(error);
            const retryable =
              retryableFaults.has(code) || code === "IMPORT_FAILED";
            return {
              code,
              delayMs:
                1000 *
                rateLimitRetry.delay({
                  attempt: index,
                  ...(error instanceof Fault &&
                    error.details?.retryAfterSeconds !== undefined && {
                      retryAfterSeconds: error.details.retryAfterSeconds,
                    }),
                }),
              kind: "failure" as const,
              retryable,
            };
          },
        );
        if (outcome.kind === "success") {
          return outcome.value;
        }
        if (!outcome.retryable || index >= 3) {
          throw new Error(outcome.code);
        }
        await step.sleep(`${name}-retry-${index}`, outcome.delayMs);
        return attempt(index + 1);
      }
      return attempt(0);
    },
  };
}
export class FinanceWorkflow extends WorkflowEntrypoint<
  Bindings,
  { runId: string }
> {
  run(event: WorkflowEvent<{ runId: string }>, step: WorkflowStep) {
    return withObservation(
      { operationId: event.payload.runId, runId: event.instanceId },
      () =>
        observeSpan(SpanName.phase, async (span) => {
          const dependencies = synchronizationDependencies(this.env);
          const { data: _data, error } = await tryCatch(() =>
            runImport(
              {
                ...dependencies,
                steps: workflowSteps(step),
              },
              event.payload.runId,
            ),
          );
          if (error) {
            markFailure(error, { phase: SpanName.phase });
            span.annotate({
              failure: classifyFailure(error),
              outcome: Outcome.failed,
            });
            reportDiagnostic({
              event: DiagnosticEvent.operation,
              outcome: Outcome.failed,
            });
            throw error;
          }
          const state = await dependencies.repository.read(event.payload.runId);
          let outcome: Outcome = Outcome.deferred;
          if (state.status === RunStatus.succeeded) {
            outcome = Outcome.completed;
          }
          if (state.status === RunStatus.failed) {
            outcome = Outcome.failed;
          }
          span.annotate({ outcome });
          reportDiagnostic({
            event: DiagnosticEvent.operation,
            outcome,
            recovery:
              outcome === Outcome.deferred ? Recovery.scheduled : Recovery.none,
          });
        }),
    );
  }
}
