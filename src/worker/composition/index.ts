import {
  CoverageStatus,
  Fault,
  FaultCode,
  type ReapplicationInput,
} from "../../domain";
import type { Rules } from "../../domain/rules";
import { hash, tryCatch } from "../../shared";
import { createAccountService } from "../account";
import {
  createAccountRepository,
  migrationsReady,
} from "../account/repository";
import { createAuthService } from "../auth";
import { revokeAssistantGrants } from "../auth/grants";
import { createAuthRepository } from "../auth/repository";
import type { Bindings } from "../bindings";
import {
  createFinancialService,
  type FinancialQueries,
  prepareEntity as prepareFinancialEntity,
} from "../finance";
import {
  activateRules,
  aggregateEntities,
  correctRecord,
  entityReader,
  explainRecord,
  listRules,
  previewSelection,
  queryEntities,
  readRules,
  readStatus,
  revision,
  rulesFor,
  saveRules,
  subscriptionRecords,
} from "../finance/repository";
import {
  classifyFailure,
  DiagnosticEvent,
  FailureCode,
  Outcome,
  observeSpan,
  Phase,
  Recovery,
  reportDiagnostic,
  type SafeFields,
  SpanName,
  withObservation,
} from "../observability";
import { createPluggyAdapter } from "../pluggy";
import {
  createReapplicationService,
  createSyncService,
  scheduleSync as runSchedule,
  type SynchronizationDependencies,
} from "../sync";
import {
  observedSyncService,
  observeRecoveries,
} from "../sync/dispatch.adapter";
import type {
  EntityPreparer,
  ExecutionOutcome,
  ExecutionPhaseDetail,
  OperationState,
} from "../sync/entity";
import {
  admissionStates,
  createExecutionRepository,
  createReapplicationRepository,
  createSyncRepository,
  schedulingStore,
} from "../sync/repository";

export function synchronizationDependencies(
  env: Bindings,
  attempt?: () => Pick<SafeFields, "attempt" | "retries">,
): SynchronizationDependencies {
  const pluggy = pluggyAdapter(env);
  let sourceUnauthorized = 0;
  let sourceUnavailable = 0;
  return {
    observePhase: (phase, callback, detail) =>
      observeExecutionPhase(phase, callback, { ...detail, ...attempt?.() }),
    onOutcome(result) {
      const failure = executionFailure(result, {
        sourceUnauthorized,
        sourceUnavailable,
      });
      let recovery: Recovery = Recovery.none;
      if (result.outcome === Outcome.deferred) {
        recovery = Recovery.scheduled;
      } else if (
        result.phase === Phase.acquire &&
        result.error?.message === "FINANCIAL_EXECUTOR_BUSY_RESUME_DISPATCH"
      ) {
        recovery = Recovery.resume;
      }
      reportDiagnostic({
        ...attempt?.(),
        event: DiagnosticEvent.operation,
        failed:
          result.progress?.errors ??
          sourceUnauthorized + sourceUnavailable + (result.error ? 1 : 0),
        outcome: result.outcome,
        recovery,
        sourceUnauthorized,
        sourceUnavailable,
        ...(result.operationKind && { operationKind: result.operationKind }),
        ...(result.phase && { phase: result.phase }),
        ...(failure && { failure }),
        ...(result.progress && {
          pages: result.progress.pages,
          processed: result.progress.received,
        }),
        ...(result.error instanceof Fault &&
          result.outcome === Outcome.deferred && {
            deferred: 1,
            delayMs: (result.error.details?.retryAfterSeconds ?? 0) * 1000,
          }),
      });
      sourceUnauthorized = 0;
      sourceUnavailable = 0;
    },
    onSourceFailure(status) {
      if (status === CoverageStatus.not_authorized) {
        sourceUnauthorized += 1;
      } else {
        sourceUnavailable += 1;
      }
    },
    prepare: (input) => prepareEntity(env.DB, input),
    repository: createExecutionRepository(env.DB),
    source: () => pluggy.financialSource(),
  };
}

export function prepareEntity(
  db: D1Database,
  input: Parameters<EntityPreparer>[0],
) {
  return prepareFinancialEntity(
    {
      evaluate: input.engine.evaluate,
      hash,
      repository: entityReader(db),
    },
    {
      identity: input.identity,
      observedAt: input.observedAt ?? new Date().toISOString(),
      operationId: input.operation.id,
      parent: input.parent,
      referenceDay: input.operation.reference_day,
      renormalize: input.operation.input.renormalize ?? false,
      rulesRevision: input.operation.rules_revision,
      source: input.source,
      ...(input.legacyProjection && {
        legacyProjection: input.legacyProjection,
      }),
    },
  );
}

export function financialQueries(env: Bindings): FinancialQueries {
  const pluggy = pluggyAdapter(env);
  return createFinancialService({
    actions: ruleActions(env),
    now: () => new Date(),
    readAccount: (accountId) => pluggy.readAccount(accountId),
    repository: {
      aggregate: (input) => aggregateEntities(env.DB, input),
      correct: (identity, change) => correctRecord(env.DB, identity, change),
      explain: (input) => explainRecord(env.DB, input),
      preview: (input, before) => previewSelection(env.DB, input, before),
      query: (input) => queryEntities(env.DB, input),
      readStatus: async () => {
        const status = await readStatus(env.DB);
        return {
          ...status,
          freshness: await admissionStates(
            env.DB,
            status.items.map((item) => item.id),
            new Date(),
          ),
        };
      },
      revision: () => revision(env.DB),
      rules: (id) => rulesFor(env.DB, id),
      subscriptions: (input) => subscriptionRecords(env.DB, input),
    },
    setupStatus: () => accountService(env).wizardState(),
  });
}

export function accountService(env: Bindings) {
  return createAccountService({
    admissions: (ids, now) => admissionStates(env.DB, ids, now),
    disconnectAssistants: () => revokeAssistantGrants(env.OAUTH_PROVIDER),
    dispatchSync: () => scheduleSync(env),
    installation: async () => ({
      database: !!env.DB,
      migrations:
        !!env.DB &&
        (await migrationsReady(env.DB, (error) => {
          reportDiagnostic({
            action: "readiness",
            event: DiagnosticEvent.maintenance,
            failure: classifyFailure(error),
            outcome: Outcome.partial,
            phase: SpanName.maintenance,
            recovery: Recovery.retry,
          });
        })),
      oauth: !!env.OAUTH_KV,
      workflow: !!env.FINANCE,
    }),
    now: () => new Date(),
    recover: () => syncService(env).recover(),
    repository: createAccountRepository(env.DB),
    source: pluggyAdapter(env).account,
  });
}

export function scheduleSync(env: Bindings, now = new Date()) {
  return observeRecoveries(SpanName.scheduled, (notice) =>
    runSchedule(
      schedulingStore(env.DB),
      (operation) =>
        createSyncService(
          createSyncRepository(env.DB),
          workflowDispatcher(env),
        ).dispatch(operation),
      now,
      notice,
    ),
  );
}

export function authService(env: Bindings) {
  return createAuthService(
    createAuthRepository(env.DB),
    env.CF_VERSION_METADATA.id,
  );
}

export function ruleActions(env: Bindings) {
  return {
    activate: (id: string) => activateRules(env.DB, id),
    list: () => listRules(env.DB),
    read: (id: string) => readRules(env.DB, id),
    save: (document: Rules, activate = false) =>
      saveRules(env.DB, document, activate),
  };
}

export function syncService(env: Bindings) {
  return observedSyncService(
    createSyncRepository(env.DB),
    workflowDispatcher(env),
  );
}

function workflowDispatcher(env: Bindings) {
  return {
    async create(id: string) {
      await env.FINANCE.create({ id, params: { operationId: id } });
    },
    async status(id: string) {
      return (await (await env.FINANCE.get(id)).status()).status;
    },
  };
}

export function reapplyRules(env: Bindings) {
  return (input: ReapplicationInput) => {
    const repository = createReapplicationRepository(env.DB);
    let replayed = false;
    return createReapplicationService(
      {
        ...repository,
        async receipt(id, batch) {
          const saved = await repository.receipt(id, batch);
          replayed = !!saved;
          return saved;
        },
      },
      {
        batch: ({ operationId, batch }, callback) =>
          withObservation({ operationId }, () =>
            observeSpan(
              SpanName.reapplication,
              async (span) => {
                const result = await callback();
                span.annotate({
                  batches: replayed ? 0 : 1,
                  outcome: replayed ? Outcome.replayed : Outcome.completed,
                  processed: replayed ? 0 : result.processed,
                });
                return result;
              },
              { batch },
            ),
          ),
        phase: observeExecutionPhase,
      },
    )(input);
  };
}

export async function reapplicationTask(
  env: Bindings,
  operationId: string,
  batch: number,
): Promise<OperationState> {
  const result = await createReapplicationRepository(env.DB).receipt(
    operationId,
    batch,
  );
  if (!result) {
    throw new Error("LOCAL_RECEIPT_NOT_FOUND");
  }
  const op = await syncService(env).read(operationId);
  return {
    createdAt: op.created_at,
    id: `${operationId}/batch/${batch}`,
    result: {
      content: [{ text: JSON.stringify(result), type: "text" }],
      isError: false,
    },
    status: "completed",
    summary: result.status,
    updatedAt: op.created_at,
  };
}

function pluggyAdapter(env: Bindings) {
  return createPluggyAdapter({
    clientId: env.PLUGGY_CLIENT_ID,
    clientSecret: env.PLUGGY_CLIENT_SECRET,
  });
}

function observeExecutionPhase<T>(
  phase: Phase,
  callback: () => Promise<T>,
  detail?: ExecutionPhaseDetail & Pick<SafeFields, "attempt" | "retries">,
) {
  const { outcome, ...fields } = detail ?? {};
  let name: SpanName = SpanName.phase;
  if (phase === Phase.collect) {
    name = SpanName.source;
  } else if (phase === Phase.publish) {
    name = SpanName.publication;
  }
  return observeSpan(
    name,
    async (span) => {
      const { data, error } = await tryCatch(callback);
      if (error) {
        if (
          phase === Phase.collect &&
          error instanceof Fault &&
          [FaultCode.UPSTREAM_RATE_LIMIT, FaultCode.UPSTREAM_TIMEOUT].some(
            (code) => code === error.code,
          )
        ) {
          span.annotate({
            delayMs: (error.details?.retryAfterSeconds ?? 0) * 1000,
            outcome: Outcome.deferred,
            recovery: Recovery.scheduled,
          });
        }
        throw error;
      }
      if (outcome) {
        span.annotate({ outcome: outcome() });
      }
      if (phase === Phase.acquire && data === false) {
        span.annotate({
          failure: FailureCode.EXECUTOR_BUSY,
          outcome: Outcome.failed,
          recovery: Recovery.resume,
        });
      }
      return data;
    },
    { phase, ...fields },
  );
}

function executionFailure(
  result: ExecutionOutcome,
  counts: { sourceUnauthorized: number; sourceUnavailable: number },
) {
  if (result.error) {
    return classifyFailure(result.error);
  }
  if (counts.sourceUnauthorized) {
    return FaultCode.UPSTREAM_FORBIDDEN;
  }
  if (counts.sourceUnavailable) {
    return FaultCode.UPSTREAM_NOT_FOUND;
  }
  if (result.outcome === Outcome.partial) {
    return FaultCode.UPSTREAM_ERROR;
  }
}
