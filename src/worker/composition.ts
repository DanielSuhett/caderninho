import type { Identity } from "#contracts/queries.ts";
import { PluggyCredentialsSchema } from "#domain/pluggy-credentials.ts";
import type { Rules } from "#domain/rules/rules.ts";
import type { FinanceRecord, ProviderRecord } from "#domain/schemas.ts";
import {
  assertPluggyApplication,
  createAccountRepository,
  installationReadiness,
} from "#worker/account/repository.ts";
import { createAccountService } from "#worker/account/service.ts";
import { createAuthRepository } from "#worker/auth/repository.ts";
import { createAuthService } from "#worker/auth/service.ts";
import type { Bindings } from "#worker/bindings.ts";
import { hash } from "#worker/database.ts";
import {
  authorizeAccount,
  correctRecord,
  entityPersistence,
  explainRecord,
} from "#worker/finance/entities.repository.ts";
import { prepareEntity as prepareFinancialEntity } from "#worker/finance/entity-preparation.ts";
import {
  aggregateEntities,
  previewSelection,
  queryEntities,
  readStatus,
  revision,
  subscriptionRecords,
} from "#worker/finance/repository.ts";
import {
  activateRules,
  listRules,
  readRules,
  rulesFor,
  saveRules,
} from "#worker/finance/rules.repository.ts";
import {
  correctFinancialRecord,
  type FinancialQueries,
  manageRules,
  previewRules,
  readSubscriptions,
} from "#worker/finance/service.ts";
import {
  connectionSource,
  connectToken,
  financialSource,
  pluggyClient,
  readAccount,
} from "#worker/pluggy/source.ts";
import type { Operation } from "#worker/sync/operation-storage.ts";
import {
  createSyncRepository,
  openSynchronization,
  schedulingStore,
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
    open: (id) =>
      openSynchronization(env.DB, id, (input) => prepareEntity(env.DB, input)),
    source: async () =>
      financialSource(pluggyClient(await configuredCredentials(env))),
  };
}

export function prepareEntity(
  db: D1Database,
  input: {
    identity: Identity;
    source: ProviderRecord;
    parent: FinanceRecord | undefined;
    operation: Pick<
      Operation,
      "id" | "input" | "reference_day" | "rules_revision"
    >;
    engine: Awaited<ReturnType<typeof rulesFor>>;
    observedAt?: string;
    legacyProjection?: FinanceRecord;
  },
) {
  return prepareFinancialEntity(
    {
      repository: entityPersistence(db),
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
      renormalize: input.operation.input.renormalize === true,
      observedAt: input.observedAt ?? new Date().toISOString(),
      ...(input.legacyProjection === undefined
        ? {}
        : { legacyProjection: input.legacyProjection }),
    },
  );
}

export type EntityPreparer = (
  input: Parameters<typeof prepareEntity>[1],
) => ReturnType<typeof prepareEntity>;

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

async function configuredCredentials(env: Bindings) {
  const parsed = PluggyCredentialsSchema.safeParse({
    clientId: env.PLUGGY_CLIENT_ID,
    clientSecret: env.PLUGGY_CLIENT_SECRET,
  });
  if (!parsed.success) {
    throw new Error("PLUGGY_ACCOUNT_NOT_CONFIGURED");
  }
  await assertPluggyApplication(env.DB, parsed.data.clientId);
  return parsed.data;
}
