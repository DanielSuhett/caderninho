import type { Rules } from "../../domain/rules";
import { hash } from "../../shared";
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
import { observeSpan, SpanName } from "../observability";
import { createPluggyAdapter } from "../pluggy";
import {
  createReapplicationService,
  createSyncService,
  scheduleSync as runSchedule,
  type SynchronizationDependencies,
} from "../sync";
import type { EntityPreparer, OperationState } from "../sync/entity";
import {
  admissionStates,
  createExecutionRepository,
  createReapplicationRepository,
  createSyncRepository,
  schedulingStore,
} from "../sync/repository";

export function synchronizationDependencies(
  env: Bindings,
): SynchronizationDependencies {
  const pluggy = pluggyAdapter(env);
  return {
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
  const service = createFinancialService({
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
  return {
    ...service,
    aggregate: (input) =>
      observeSpan(SpanName.financeAction, () => service.aggregate(input), {
        action: "aggregate",
        resource: input.resource,
      }),
    correctRecord: (input) =>
      observeSpan(SpanName.financeAction, () => service.correctRecord(input), {
        action: "correct",
        resource: input.resource,
      }),
    explainRecord: (input) =>
      observeSpan(SpanName.financeAction, () => service.explainRecord(input), {
        action: "explain",
        resource: input.resource,
      }),
    manageRules: (input) =>
      observeSpan(SpanName.financeAction, () => service.manageRules(input), {
        action: "rules",
      }),
    previewRules: (input) =>
      observeSpan(SpanName.financeAction, () => service.previewRules(input), {
        action: "preview",
      }),
    query: (input) =>
      observeSpan(SpanName.financeAction, () => service.query(input), {
        action: "query",
        resource: input.resource,
      }),
    readAccount: (accountId) =>
      observeSpan(
        SpanName.financeAction,
        () => service.readAccount(accountId),
        {
          action: "live_balance",
        },
      ),
    readStatus: () =>
      observeSpan(SpanName.financeAction, () => service.readStatus(), {
        action: "status",
      }),
    readSubscriptions: (input) =>
      observeSpan(
        SpanName.financeAction,
        () => service.readSubscriptions(input),
        {
          action: "subscriptions",
        },
      ),
    setupStatus: () =>
      observeSpan(SpanName.financeAction, () => service.setupStatus(), {
        action: "setup_status",
      }),
  };
}

export function accountService(env: Bindings) {
  return createAccountService({
    admissions: (ids, now) => admissionStates(env.DB, ids, now),
    disconnectAssistants: () => revokeAssistantGrants(env.OAUTH_PROVIDER),
    dispatchSync: () => scheduleSync(env),
    installation: async () => ({
      database: !!env.DB,
      migrations: !!env.DB && (await migrationsReady(env.DB)),
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
  return runSchedule(
    schedulingStore(env.DB),
    async (operation) => {
      await syncService(env).dispatch(operation);
    },
    now,
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
    activate: (id: string) =>
      observeSpan(SpanName.financeAction, () => activateRules(env.DB, id), {
        action: "rules_activate",
      }),
    list: () =>
      observeSpan(SpanName.financeAction, () => listRules(env.DB), {
        action: "rules_list",
      }),
    read: (id: string) =>
      observeSpan(SpanName.financeAction, () => readRules(env.DB, id), {
        action: "rules_read",
      }),
    save: (document: Rules, activate = false) =>
      observeSpan(
        SpanName.financeAction,
        () => saveRules(env.DB, document, activate),
        { action: "rules_save" },
      ),
  };
}

export function syncService(env: Bindings) {
  return createSyncService(createSyncRepository(env.DB), {
    async create(id) {
      await env.FINANCE.create({ id, params: { operationId: id } });
    },
    async status(id) {
      return (await (await env.FINANCE.get(id)).status()).status;
    },
  });
}

export function reapplyRules(env: Bindings) {
  return createReapplicationService(createReapplicationRepository(env.DB));
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
