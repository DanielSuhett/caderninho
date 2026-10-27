import { z } from "zod/v4";

import {
  RuleImportResultSchema,
  type RulePreviewInput,
  type SyncHistorySelection,
} from "../../contracts";
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
import { createRuleJobService } from "../rules";
import { createRuleJobRepository } from "../rules/repository";
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
    resolveInstitution: async (profileId, id) => {
      const institution = (await source(env).institutions(profileId)).find(
        (row) => row.id === id,
      );
      if (!institution) {
        throw new Error("NOT_FOUND");
      }
      return institution;
    },
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
export function institutionCatalog(env: Bindings, profileId: string) {
  return source(env).institutions(profileId);
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

const PreviewImportSchema = z.object({ data: RuleImportResultSchema });
const AppliedSchema = z.object({
  changed: z.number().int(),
  count: z.number().int(),
  truncated: z.boolean(),
});
// Planning results are untyped records at this boundary; parse only the fields
// the job consumes.
export function ruleJobService(env: Bindings) {
  const planning = planningService(env);
  return createRuleJobService({
    dispatcher: {
      create: async (id) => {
        await env.RULES.create({ id, params: { jobId: id } });
      },
    },
    now: () => new Date().toISOString(),
    planning: {
      async applyRules({ key, spaceId }) {
        const applied = AppliedSchema.parse(
          await planning.execute({
            confirmed: true,
            from: "1900-01-01",
            idempotency_key: key,
            preserveManual: true,
            spaceId,
            to: "9999-12-31",
            tool: "apply_rules",
          }),
        );
        return {
          changed: applied.changed,
          examined: applied.count,
          truncated: applied.truncated,
        };
      },
      categories: async (spaceId) =>
        (await workspaceCatalog(env, spaceId)).categories,
      async importRules({ categoryIds, key, pack, spaceId }) {
        const preview = PreviewImportSchema.parse(
          await planning.execute({
            categoryIds,
            pack,
            spaceId,
            tool: "preview_rule_import",
          }),
        );
        return RuleImportResultSchema.parse(
          await planning.execute({
            categoryIds,
            confirmed: true,
            idempotency_key: `${key}:${preview.data.revision}`,
            pack,
            revision: preview.data.revision,
            spaceId,
            tool: "import_rules",
          }),
        );
      },
    },
    repository: createRuleJobRepository(env.DB),
  });
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
