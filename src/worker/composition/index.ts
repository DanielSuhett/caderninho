import type { Bindings } from "../bindings";
import { createFinancialService } from "../finance";
import { createFinancialRepository } from "../finance/repository";
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
import { createPluggyAdapter } from "../pluggy";
import { createSyncService } from "../sync";
import { createSyncRepository } from "../sync/repository";

function source(env: Bindings) {
  const adapter = createPluggyAdapter({
    clientId: env.PLUGGY_CLIENT_ID,
    clientSecret: env.PLUGGY_CLIENT_SECRET,
  });
  return {
    accounts: (id: string) =>
      observeSpan(SpanName.providerRead, () => adapter.accounts(id), {
        resource: "accounts",
      }),
    configured: adapter.configured,
    connection: (id: string) =>
      observeSpan(SpanName.providerRead, () => adapter.connection(id), {
        resource: "connections",
      }),
    token: (id?: string) =>
      observeSpan(SpanName.accountAction, () => adapter.token(id), {
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
  const service = createSyncService(
    {
      ...repository,
      admit: (ids, time) =>
        observeSpan(SpanName.admission, () => repository.admit(ids, time)),
    },
    {
      create: async (id) => {
        await env.FINANCE.create({ id, params: { runId: id } });
      },
      status: async (id) => (await (await env.FINANCE.get(id)).status()).status,
    },
    now,
    (counts) => {
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
  );
  return {
    recover: () => observeSpan(SpanName.recovery, () => service.recover()),
    request: (ids?: string[]) =>
      observeSpan(SpanName.dispatch, () => {
        if (!source(env).configured) {
          throw new Error("NOT_CONFIGURED");
        }
        return service.request(ids);
      }),
  };
}
