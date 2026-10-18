import type { Rules } from "@/domain/rules";
import { hash } from "@/shared/crypto";
import { createPluggyAdapter } from "@/worker/pluggy/adapter";

import { createAccountService } from "./account";
import { createAccountRepository, migrationsReady } from "./account/repository";
import { createAuthService } from "./auth";
import { revokeAssistantGrants } from "./auth/grants.adapter";
import { createAuthRepository } from "./auth/repository";
import type { Bindings } from "./bindings";
import {
  createFinancialService,
  type FinancialQueries,
  prepareEntity as prepareFinancialEntity,
} from "./finance";
import {
  correctRecord,
  entityReader,
  explainRecord,
} from "./finance/entities.repository";
import {
  aggregateEntities,
  previewSelection,
  queryEntities,
  readStatus,
  revision,
  subscriptionRecords,
} from "./finance/repository";
import {
  activateRules,
  listRules,
  readRules,
  rulesFor,
  saveRules,
} from "./finance/rules.repository";
import {
  createSyncService,
  scheduleSync as runSchedule,
  type SynchronizationDependencies,
} from "./sync";
import type { EntityPreparer } from "./sync/entity";
import { createExecutionRepository } from "./sync/execution.repository";
import { openSynchronization } from "./sync/execution.service";
import { createSyncRepository, schedulingStore } from "./sync/repository";

export function synchronizationDependencies(
  env: Bindings,
): SynchronizationDependencies {
  const pluggy = pluggyAdapter(env);
  return {
    open: (id) =>
      openSynchronization(
        {
          repository: createExecutionRepository(env.DB),
          prepare: (input) => prepareEntity(env.DB, input),
        },
        id,
      ),
    source: () => pluggy.financialSource(),
  };
}

export function prepareEntity(
  db: D1Database,
  input: Parameters<EntityPreparer>[0],
) {
  return prepareFinancialEntity(
    {
      repository: entityReader(db),
      hash,
      evaluate: input.engine.evaluate,
    },
    {
      identity: input.identity,
      source: input.source,
      parent: input.parent,
      operationId: input.operation.id,
      referenceDay: input.operation.reference_day,
      rulesRevision: input.operation.rules_revision,
      renormalize: input.operation.input.renormalize ?? false,
      observedAt: input.observedAt ?? new Date().toISOString(),
      ...(input.legacyProjection && {
        legacyProjection: input.legacyProjection,
      }),
    },
  );
}

export function financialQueries(env: Bindings): FinancialQueries {
  const pluggy = pluggyAdapter(env);
  return createFinancialService({
    setupStatus: () => accountService(env).wizardState(),
    repository: {
      query: (input) => queryEntities(env.DB, input),
      aggregate: (input) => aggregateEntities(env.DB, input),
      readStatus: () => readStatus(env.DB),
      correct: (identity, change) => correctRecord(env.DB, identity, change),
      explain: (input) => explainRecord(env.DB, input),
      preview: (input, before) => previewSelection(env.DB, input, before),
      subscriptions: (input) => subscriptionRecords(env.DB, input),
      revision: () => revision(env.DB),
      rules: (revision) => rulesFor(env.DB, revision),
    },
    actions: ruleActions(env),
    readAccount: (accountId) => pluggy.readAccount(accountId),
    now: () => new Date(),
  });
}

export function accountService(env: Bindings) {
  return createAccountService({
    repository: createAccountRepository(env.DB),
    source: pluggyAdapter(env).account,
    disconnectAssistants: () => revokeAssistantGrants(env.OAUTH_PROVIDER),
    installation: async () => ({
      database: !!env.DB,
      workflow: !!env.FINANCE,
      oauth: !!env.OAUTH_KV,
      migrations: !!env.DB && (await migrationsReady(env.DB)),
    }),
    now: () => new Date(),
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
    read: (revision: string) => readRules(env.DB, revision),
    list: () => listRules(env.DB),
    activate: (revision: string) => activateRules(env.DB, revision),
    save: (document: Rules, activate = false) =>
      saveRules(env.DB, document, activate),
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

function pluggyAdapter(env: Bindings) {
  return createPluggyAdapter({
    clientId: env.PLUGGY_CLIENT_ID,
    clientSecret: env.PLUGGY_CLIENT_SECRET,
  });
}
