import { OperationKind } from "../../contracts";
import { tryCatch } from "../../shared";
import {
  classifyFailure,
  DiagnosticEvent,
  FailureCode,
  type ObservedSpan,
  Outcome,
  observeSpan,
  Recovery,
  reportDiagnostic,
  type SafeFields,
  SpanName,
  withObservation,
} from "../observability";
import type {
  SyncRecoveryNotice,
  SyncRepository,
  WebhookReceipt,
  WorkflowDispatcher,
} from "./entity";
import { createSyncService } from "./service";

const receiptOutcomes: Record<WebhookReceipt, Outcome> = {
  changed: Outcome.success,
  noop: Outcome.noop,
  unknown: Outcome.rejected,
};

export function observeRecoveries<T>(
  phase:
    | typeof SpanName.recovery
    | typeof SpanName.scheduled
    | typeof SpanName.admission,
  work: (
    notice: (notice: SyncRecoveryNotice) => void,
    span: ObservedSpan,
  ) => Promise<T>,
  initialFields: SafeFields = {},
) {
  return withObservation({ independent: true }, () =>
    observeSpan(
      phase,
      async (span) => {
        let failure: FailureCode | undefined;
        let failed = 0;
        let operationId: string | undefined;
        const counts = {
          dispatchPending: 0,
          schedulePending: 0,
          statusUnavailable: 0,
        };
        const result = await work((notice) => {
          failure ??= classifyFailure(notice.error);
          failed += 1;
          operationId = failed === 1 ? notice.operationId : undefined;
          switch (notice.phase) {
            case "dispatch":
              counts.dispatchPending += 1;
              break;
            case "schedule":
              counts.schedulePending += 1;
              break;
            case "status":
              counts.statusUnavailable += 1;
              break;
            default: {
              const unexpected: never = notice.phase;
              throw new Error(`UNSUPPORTED_RECOVERY_PHASE: ${unexpected}`);
            }
          }
        }, span);
        if (failed) {
          const fields: SafeFields = {
            ...counts,
            failed,
            ...(failure && { failure }),
            outcome: Outcome.deferred,
            phase,
            recovery: Recovery.scheduled,
          };
          span.annotate(fields);
          withObservation({ ...(operationId && { operationId }) }, () =>
            reportDiagnostic({ ...fields, event: DiagnosticEvent.recovery }),
          );
        }
        return result;
      },
      initialFields,
    ),
  );
}

export function observedSyncService(
  repository: SyncRepository,
  workflow: WorkflowDispatcher,
) {
  const create = (notice?: (notice: SyncRecoveryNotice) => void) =>
    createSyncService(repository, workflow, () => new Date(), notice);
  const service = create();
  return {
    ...service,
    acceptWebhook: (event: Parameters<typeof service.acceptWebhook>[0]) =>
      observeSpan(SpanName.admission, (span) =>
        service.acceptWebhook(event, (receipt) => {
          span.annotate({ outcome: receiptOutcomes[receipt] });
        }),
      ),
    dispatch: (operation: Parameters<typeof service.dispatch>[0]) =>
      withObservation({ operationId: operation.id }, () =>
        observeSpan(SpanName.dispatch, async (span) => {
          const { data, error } = await tryCatch(() =>
            service.dispatch(operation),
          );
          if (error) {
            const fields = {
              failure: classifyFailure(error),
              outcome: Outcome.deferred,
              phase: SpanName.dispatch,
              recovery: Recovery.scheduled,
            };
            span.annotate(fields);
            reportDiagnostic({ ...fields, event: DiagnosticEvent.dispatch });
            throw error;
          }
          return data;
        }),
      ),
    migrate: (input: Parameters<typeof service.migrate>[0]) =>
      observeRecoveries(
        SpanName.admission,
        async (notice, span) => {
          const result = await create(notice).migrate(input);
          let outcome: Outcome = input.apply ? Outcome.success : Outcome.noop;
          if (result.status === 409) {
            outcome = Outcome.rejected;
          }
          span.annotate({
            outcome,
            status: result.status,
            ...(result.status === 409 && {
              failure: FailureCode.INVALID_REQUEST,
            }),
          });
          return result;
        },
        { operationKind: OperationKind.migration },
      ),
    recover: () =>
      observeRecoveries(SpanName.recovery, (notice) =>
        create(notice).recover(),
      ),
    start: (key: string, input: Parameters<typeof service.start>[1]) =>
      observeSpan(
        SpanName.admission,
        async (span) => {
          const result = await service.start(key, input);
          span.annotate({
            outcome: result.operation ? Outcome.success : Outcome.noop,
          });
          return result;
        },
        { operationKind: input.kind },
      ),
  };
}
