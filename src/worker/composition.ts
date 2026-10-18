import { PluggyCredentialsSchema } from "#domain/pluggy-credentials.ts";
import {
  createAccountRepository,
  installationReadiness,
  assertPluggyApplication,
} from "#worker/account/repository.ts";
import { createAccountService } from "#worker/account/service.ts";
import { createAuthRepository } from "#worker/auth/repository.ts";
import { createAuthService } from "#worker/auth/service.ts";
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
  connectToken,
  connectionSource,
  readAccount,
  financialSource,
  pluggyClient,
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
    source: async () =>
      financialSource(pluggyClient(await configuredCredentials(env))),
  };
}

export function financialQueries(env: Bindings): FinancialQueries {
  return {
    setupStatus: () => accountService(env).wizardState(),
    query: (input) => queryEntities(env.DB, input),
    aggregate: (input) => aggregateEntities(env.DB, input),
    readStatus: () => readStatus(env.DB),
    manageRules: (call) => manageRules(ruleActions(env), call),
    correctRecord: (input) =>
      correctFinancialRecord(
        (identity, change) => correctRecord(env.DB, identity, change),
        input,
      ),
    explainRecord: (input) => explainRecord(env.DB, { ...input }),
    previewRules: (call) =>
      previewRules(
        {
          select: (before) => previewSelection(env.DB, call, before),
          rules: () => rulesFor(env.DB, call.revision),
          revision: () => revision(env.DB),
        },
        call.revision,
      ),
    readSubscriptions: (call) =>
      readSubscriptions(
        {
          select: () => subscriptionRecords(env.DB, call),
          revision: () => revision(env.DB),
          now: () => new Date(),
        },
        call,
      ),
    authorizeAccount: (input) => authorizeAccount(env.DB, input),
    readAccount: async (accountId) =>
      readAccount(pluggyClient(await configuredCredentials(env)), accountId),
    now: () => new Date().toISOString(),
  };
}

export function accountService(env: Bindings) {
  return createAccountService({
    repository: createAccountRepository(env),
    source: connectionSource,
    credentials: () => configuredCredentials(env),
    configured: () =>
      PluggyCredentialsSchema.safeParse({
        clientId: env.PLUGGY_CLIENT_ID,
        clientSecret: env.PLUGGY_CLIENT_SECRET,
      }).success,
    connectToken,
    installation: () => installationReadiness(env),
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
    createAuthRepository(env),
    env.CF_VERSION_METADATA.id,
  );
}

export function ruleActions(env: Bindings) {
  return {
    read: (revision: string) => readRules(env.DB, revision),
    list: () => listRules(env.DB),
    activate: (revision: string) => activateRules(env.DB, revision),
    save: (document: unknown, activate = false) =>
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

async function configuredCredentials(env: Bindings) {
  const parsed = PluggyCredentialsSchema.safeParse({
    clientId: env.PLUGGY_CLIENT_ID,
    clientSecret: env.PLUGGY_CLIENT_SECRET,
  });
  if (!parsed.success) throw new Error("PLUGGY_ACCOUNT_NOT_CONFIGURED");
  await assertPluggyApplication(env.DB, parsed.data.clientId);
  return parsed.data;
}
