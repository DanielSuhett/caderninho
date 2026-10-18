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
import { createSyncRepository, schedulingStore } from "./sync/repository";

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
      readStatus: () => readStatus(env.DB),
      revision: () => revision(env.DB),
      rules: (id) => rulesFor(env.DB, id),
      subscriptions: (input) => subscriptionRecords(env.DB, input),
    },
    setupStatus: () => accountService(env).wizardState(),
  });
}

export function accountService(env: Bindings) {
  return createAccountService({
    disconnectAssistants: () => revokeAssistantGrants(env.OAUTH_PROVIDER),
    installation: async () => ({
      database: !!env.DB,
      migrations: !!env.DB && (await migrationsReady(env.DB)),
      oauth: !!env.OAUTH_KV,
      workflow: !!env.FINANCE,
    }),
    now: () => new Date(),
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
    activate: (id: string) => activateRules(env.DB, id),
    list: () => listRules(env.DB),
    read: (id: string) => readRules(env.DB, id),
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
