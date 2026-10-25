import type { RulePreviewInput, SyncHistorySelection } from "../../contracts";
import { createAuditRepository } from "../audit/repository";
import type { Bindings } from "../bindings";
import { createFinancialService } from "../finance";
import { createFinancialRepository } from "../finance/repository";
import { createHouseholdService } from "../household";
import { createHouseholdRepository } from "../household/repository";
import { createCredentialVault } from "../household/vault.adapter";
import { createInstallationService } from "../installation";
import { createInstallationRepository } from "../installation/repository";
import {
  DiagnosticEvent,
  FailureCode,
  Outcome,
  observeSpan,
  Recovery,
  reportDiagnostic,
  SpanName,
} from "../observability";
import { createPlanningService, previewRule } from "../planning";
import { createPlanningRepository } from "../planning/repository";
import { createCatalogRepository } from "../planning/repository/catalog.repository";
import { createPluggyAdapter, createProfileSource } from "../pluggy";
import { createSyncService } from "../sync";
import { createClefClassifier } from "../sync/clef.adapter";
import { createSyncRepository } from "../sync/repository";
import { createSyncHistoryRepository } from "../sync/repository/history.repository";

export function householdService(env: Bindings) {
  return createHouseholdService({
    defaultClientId:
      env.PLUGGY_CLIENT_ID && env.PLUGGY_CLIENT_SECRET
        ? env.PLUGGY_CLIENT_ID
        : undefined,
    repository: createHouseholdRepository(env.DB),
    validate: (credentials) => createPluggyAdapter(credentials).token(),
    vault: createCredentialVault(env.OAUTH_KV),
  });
}
function source(env: Bindings) {
  const adapter = createProfileSource({
    defaults: {
      clientId: env.PLUGGY_CLIENT_ID,
      clientSecret: env.PLUGGY_CLIENT_SECRET,
    },
    repository: createHouseholdRepository(env.DB),
    vault: createCredentialVault(env.OAUTH_KV),
  });
  return {
    ...adapter,
    accounts: (id: string) =>
      observeSpan(SpanName.providerRead, () => adapter.accounts(id), {
        resource: "accounts",
      }),
    connection: (id: string) =>
      observeSpan(SpanName.providerRead, () => adapter.connection(id), {
        resource: "connections",
      }),
    token: (id?: string, profileId?: string) =>
      observeSpan(SpanName.accountAction, () => adapter.token(id, profileId), {
        action: "token",
      }),
    transactions: (id: string, cursor: string | null) =>
      observeSpan(
        SpanName.providerRead,
        () => adapter.transactions(id, cursor),
        { resource: "transactions" },
      ),
  };
}
export function installationService(env: Bindings) {
  return createInstallationService({
    catalog: householdService(env).catalog,
    repository: createInstallationRepository(env.DB),
    source: source(env),
  });
}
export function financialService(env: Bindings) {
  const service = createFinancialService(createFinancialRepository(env.DB));
  return {
    aggregate: (input: Parameters<typeof service.aggregate>[0]) =>
      observeSpan(SpanName.financeAction, () => service.aggregate(input), {
        action: "aggregate",
      }),
    query: (input: Parameters<typeof service.query>[0]) =>
      observeSpan(SpanName.financeAction, () => service.query(input), {
        action: "query",
      }),
  };
}
export function synchronizationDependencies(env: Bindings) {
  const repository = createSyncRepository(env.DB);
  return {
    ...(env.CLEF_ENABLED === "true" &&
      env.AI && { classifier: createClefClassifier(env.AI) }),
    now: () => new Date().toISOString(),
    repository: {
      ...repository,
      publish: (input: Parameters<typeof repository.publish>[0]) =>
        observeSpan(SpanName.publication, () => repository.publish(input), {
          phase: input.run.checkpoint.phase,
          processed:
            (input.accounts?.length ?? 0) + (input.transactions?.length ?? 0),
        }),
    },
    source: source(env),
  };
}
export function syncService(env: Bindings, now: () => Date = () => new Date()) {
  const repository = createSyncRepository(env.DB);
  const service = createSyncService({
    assertConfigured: householdService(env).assertConfigured,
    now,
    report: (counts) => {
      if (counts.dispatchPending || counts.statusUnavailable || counts.failed) {
        reportDiagnostic({
          ...counts,
          event: DiagnosticEvent.recovery,
          failure: counts.failed
            ? FailureCode.INTERNAL_ERROR
            : FailureCode.DISPATCH_UNCERTAIN,
          outcome: counts.failed ? Outcome.failed : Outcome.deferred,
          recovery: counts.failed ? Recovery.none : Recovery.scheduled,
        });
      }
    },
    repository: {
      ...repository,
      admit: (ids, time, initialOnly) =>
        observeSpan(SpanName.admission, () =>
          repository.admit(ids, time, initialOnly),
        ),
    },
    workflow: {
      create: async (id) => {
        await env.FINANCE.create({ id, params: { runId: id } });
      },
      status: async (id) => (await (await env.FINANCE.get(id)).status()).status,
    },
  });
  return {
    recover: () => observeSpan(SpanName.recovery, () => service.recover()),
    request: (ids?: string[], initialOnly = false) =>
      observeSpan(SpanName.dispatch, () => service.request(ids, initialOnly)),
  };
}

export function planningService(env: Bindings) {
  return createPlanningService(
    createPlanningRepository(env.DB, env.CLEF_ENABLED === "true"),
  );
}

export function synchronizationHistory(
  env: Bindings,
  selection: SyncHistorySelection,
) {
  return createSyncHistoryRepository(env.DB).query(selection);
}

export function workspaceCatalog(env: Bindings, spaceId: string) {
  return createCatalogRepository(env.DB).read(spaceId);
}

export function auditRepository(env: Bindings) {
  return createAuditRepository(env.DB);
}

export function rulePreview(env: Bindings, input: RulePreviewInput) {
  return previewRule(
    createPlanningRepository(env.DB, env.CLEF_ENABLED === "true"),
    input,
  );
}
