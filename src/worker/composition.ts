import {
  createAccountRepository,
  installationReadiness,
} from "#worker/account/repository.ts";
import { createAccountService } from "#worker/account/service.ts";
import { createAuthRepository, clientAccess } from "#worker/auth/repository.ts";
import { createAuthService, ownerPrincipal } from "#worker/auth/service.ts";
import type { Bindings } from "#worker/bindings.ts";
import {
  authorizeAccount,
  correctRecord,
  explainRecord,
} from "#worker/finance/entities.repository.ts";
import {
  readStatus,
  previewSelection,
  subscriptionRecords,
  revision,
  queryEntities,
  aggregateEntities,
} from "#worker/finance/repository.ts";
import {
  readRules,
  listRules,
  activateRules,
  saveRules,
  rulesFor,
} from "#worker/finance/rules.repository.ts";
import {
  correctFinancialRecord,
  manageRules,
  previewRules,
  readSubscriptions,
  type FinancialQueries,
} from "#worker/finance/service.ts";
import {
  rotateCredentials,
  providerFor,
  credentialsFor,
} from "#worker/pluggy/credentials.ts";
import {
  connectToken,
  connectionSource,
  readAccount,
  financialSource,
} from "#worker/pluggy/source.ts";
import {
  createSyncRepository,
  schedulingStore,
  openSynchronization,
} from "#worker/sync/repository.ts";
import {
  createSyncService,
  scheduleSync as runSchedule,
  type SynchronizationDependencies,
} from "#worker/sync/service.ts";

export function synchronizationDependencies(
  env: Bindings,
): SynchronizationDependencies {
  return {
    open: (id) => openSynchronization(env.DB, id),
    source: async (principal) =>
      financialSource(await providerFor(env, principal)),
  };
}

export function financialQueries(
  env: Bindings,
  principal: string,
): FinancialQueries {
  return {
    setupStatus: () => accountService(env, principal).wizardState(),
    query: (input) => queryEntities(env.DB, principal, input),
    aggregate: (input) => aggregateEntities(env.DB, principal, input),
    readStatus: () => readStatus(env.DB, principal),
    manageRules: (call) => manageRules(ruleActions(env, principal), call),
    correctRecord: (input) =>
      correctFinancialRecord(
        (identity, change) => correctRecord(env.DB, identity, change),
        principal,
        input,
      ),
    explainRecord: (input) => explainRecord(env.DB, { ...input, principal }),
    previewRules: (call) =>
      previewRules(
        {
          select: (before) => previewSelection(env.DB, principal, call, before),
          rules: () => rulesFor(env.DB, principal, call.revision),
          revision: () => revision(env.DB, principal),
        },
        call.revision,
      ),
    readSubscriptions: (call) =>
      readSubscriptions(
        {
          select: () => subscriptionRecords(env.DB, principal, call),
          revision: () => revision(env.DB, principal),
          now: () => new Date(),
        },
        call,
      ),
    authorizeAccount: (input) => authorizeAccount(env.DB, principal, input),
    readAccount: async (accountId) =>
      readAccount(await providerFor(env, principal), accountId),
    now: () => new Date().toISOString(),
  };
}

export function accountService(env: Bindings, principal: string) {
  return createAccountService({
    repository: createAccountRepository(env, principal),
    source: connectionSource,
    credentials: () => credentialsFor(env, principal, false),
    connectToken,
    installation: () => installationReadiness(env, env.PUBLIC_ORIGIN),
    access: (cursor) => clientAccess(env, principal, cursor),
    rotate: () => rotateCredentials(env, principal),
    now: () => new Date(),
  });
}

export function scheduleSync(env: Bindings, now = new Date()) {
  return runSchedule(
    schedulingStore(env.DB, ownerPrincipal(env)),
    async (operation) => {
      await syncService(env).dispatch(operation);
    },
    now,
  );
}

export function authService(env: Bindings) {
  return createAuthService(createAuthRepository(env), env);
}

export function ruleActions(env: Bindings, principal: string) {
  return {
    read: (revision: string) => readRules(env.DB, principal, revision),
    list: () => listRules(env.DB, principal),
    activate: (revision: string) => activateRules(env.DB, principal, revision),
    save: (document: unknown, activate = false) =>
      saveRules(env.DB, principal, document, activate),
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
