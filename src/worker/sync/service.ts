import {
  type AccountProjection,
  AccountType,
  accountCompes,
  accountHolderKey,
  assertPersonalConnector,
  connectorInstitution,
  detectInstitution,
  ImportPhase,
  type Institution,
  isDuplicateConnection,
  normalizeAccount,
  normalizeTransaction,
  type ProductPage,
  type ProviderAccount,
  type ProviderConnection,
  RunStatus,
} from "../../domain";
import { hash, tryCatch } from "../../shared";
import {
  AdmissionStatus,
  type ImportDependencies,
  InstitutionIssue,
  importFailure,
  type SyncRun,
  type SyncServiceDependencies,
} from "./entity";

async function unique<T extends { id: string }>(records: T[]) {
  const seen = new Map<string, T>();
  const result: T[] = [];
  const comparisons: Promise<boolean>[] = [];
  for (const row of records) {
    const prior = seen.get(row.id);
    if (prior) {
      comparisons.push(
        Promise.all([hash(prior), hash(row)]).then(
          ([before, after]) => before === after,
        ),
      );
      continue;
    }
    seen.set(row.id, row);
    result.push(row);
  }
  if ((await Promise.all(comparisons)).includes(false)) {
    throw new Error("DUPLICATE_CHANGED");
  }
  return result;
}
function providerAccounts(
  source: ImportDependencies["source"],
  connectionId: string,
) {
  return source.accounts(connectionId).then(unique);
}
function projectedAccounts(
  accounts: ProviderAccount[],
  connectionId: string,
  connector?: ProviderConnection["connector"],
) {
  return accounts
    .map((row) => normalizeAccount(row, connectionId, connector))
    .sort((left, right) =>
      left.id < right.id ? -1 : Number(left.id > right.id),
    );
}
async function catalog(
  source: ImportDependencies["source"],
  connectionId: string,
  connector?: ProviderConnection["connector"],
) {
  return projectedAccounts(
    await providerAccounts(source, connectionId),
    connectionId,
    connector,
  );
}
function afterTransactions(
  dependencies: ImportDependencies,
): SyncRun["checkpoint"]["phase"] {
  if (dependencies.source.products) {
    return ImportPhase.investments;
  }
  return ImportPhase.finish;
}
async function savedInstitution(
  { repository }: ImportDependencies,
  connectionId: string,
) {
  const saved = Object.values(
    await repository.connectionAccounts(connectionId),
  );
  return (
    saved.find((account) => account.identity?.institution)?.identity
      ?.institution ?? null
  );
}
// Meu Pluggy reports its own connector, so the bank comes from the COMPE in the
// bank accounts' transfer number, then from the names the provider gives to
// accounts. One item is one bank: conflicting codes leave it unknown. An
// unavailable or unrecognizing catalog keeps what the previous import found.
async function detectedInstitution(
  dependencies: ImportDependencies,
  connectionId: string,
  accounts: ProviderAccount[],
): Promise<Institution | null> {
  const { institutions, reportInstitution } = dependencies;
  const compes = accountCompes(accounts);
  if (compes.size > 1) {
    reportInstitution(InstitutionIssue.conflict);
    return null;
  }
  const { data, error } = await tryCatch(async () => {
    const [compe] = compes;
    const byCode = compe ? await institutions.find(compe) : null;
    if (byCode) {
      return byCode;
    }
    return detectInstitution({
      catalog: await institutions.list(),
      evidence: accounts.map((account) => account.name),
    });
  });
  if (error) {
    reportInstitution(InstitutionIssue.unavailable);
    return savedInstitution(dependencies, connectionId);
  }
  if (!data) {
    reportInstitution(InstitutionIssue.unrecognized);
    return savedInstitution(dependencies, connectionId);
  }
  return data;
}
// Another item of the same bank account would import every transaction twice.
// Accounts are compared by hashed COMPE/agency/account, never by provider ids.
async function rejectDuplicateConnection(
  { repository }: ImportDependencies,
  connectionId: string,
  accounts: ProviderAccount[],
  prepared: AccountProjection[],
) {
  const keyed = await Promise.all(
    accounts.map(async (account) => {
      const key = accountHolderKey(account.bankData?.transferNumber);
      return { holderKey: key && (await hash(key)), id: account.id };
    }),
  );
  const incoming: string[] = [];
  for (const { holderKey, id } of keyed) {
    const projection = prepared.find((account) => account.id === id);
    if (holderKey && projection) {
      projection.holderKey = holderKey;
      incoming.push(holderKey);
    }
  }
  const existing = new Set(await repository.otherHolderKeys(connectionId));
  if (isDuplicateConnection(incoming, existing)) {
    throw new Error("ACCOUNT_ALREADY_CONNECTED");
  }
}
async function importAccounts(dependencies: ImportDependencies, run: SyncRun) {
  const { repository, source, now } = dependencies;
  const connection = await source.connection(run.connectionId);
  if (connection.id !== run.connectionId) {
    throw new Error("SOURCE_IDENTITY_MISMATCH");
  }
  assertPersonalConnector(connection.connector?.id);
  const accounts = await providerAccounts(source, run.connectionId);
  const prepared = projectedAccounts(
    accounts,
    run.connectionId,
    connection.connector,
  );
  await rejectDuplicateConnection(
    dependencies,
    run.connectionId,
    accounts,
    prepared,
  );
  const institution = prepared.some((account) => !account.identity?.institution)
    ? await detectedInstitution(dependencies, run.connectionId, accounts)
    : null;
  for (const account of prepared) {
    if (institution && !account.identity?.institution) {
      account.identity = { cardBrand: null, ...account.identity, institution };
    }
  }
  const [first] = prepared;
  return repository.publish({
    accounts: prepared,
    done: false,
    next: {
      accountId: first?.id ?? null,
      cursor: null,
      phase: first ? ImportPhase.transactions : afterTransactions(dependencies),
    },
    now: now(),
    run,
  });
}
async function importTransactions(
  dependencies: ImportDependencies,
  run: SyncRun,
) {
  const { repository, source, now } = dependencies;
  const { accountId, cursor } = run.checkpoint;
  if (!accountId) {
    throw new Error("INVALID_CHECKPOINT");
  }
  const page = await source.transactions(accountId, cursor);
  const prepared = (await unique(page.records)).map((row) =>
    normalizeTransaction(row, accountId),
  );
  let following: string | null = accountId;
  if (!page.next) {
    // Missing known accounts are partial even if a later catalog restores them.
    const [current, saved] = await Promise.all([
      catalog(source, run.connectionId),
      repository.connectionAccounts(run.connectionId),
    ]);
    if (
      current.length !== Object.keys(saved).length ||
      current.some((account) => !saved[account.id])
    ) {
      throw new Error("SOURCE_ACCOUNTS_CHANGED");
    }
    following = current.find((account) => account.id > accountId)?.id ?? null;
  }
  return repository.publish({
    done: false,
    next: {
      accountId: following,
      cursor: page.next,
      phase: following
        ? ImportPhase.transactions
        : afterTransactions(dependencies),
    },
    now: now(),
    run,
    transactions: prepared,
  });
}
async function identifyInvestments(
  dependencies: ImportDependencies,
  connectionId: string,
  products: ProductPage,
) {
  if (products.kind !== ImportPhase.investments) {
    return;
  }
  const connection = await dependencies.source.connection(connectionId);
  if (connection.id !== connectionId) {
    throw new Error("SOURCE_IDENTITY_MISMATCH");
  }
  const { connector } = connection;
  const named = products.records.filter(
    (investment) => investment.identity?.institution,
  );
  // Provider institutions carry a CNPJ and no logo; resolve them through the
  // catalog so investments group with the accounts of the same bank.
  const { data: institutions, error } = await tryCatch(() =>
    named.length ? dependencies.institutions.list() : Promise.resolve([]),
  );
  if (error) {
    dependencies.reportInstitution(InstitutionIssue.unavailable);
  }
  for (const investment of named) {
    const institution =
      institutions &&
      detectInstitution({
        catalog: institutions,
        evidence: [investment.identity?.institution?.name ?? ""],
      });
    if (institution) {
      investment.identity = { cardBrand: null, institution };
    }
  }
  // Positions without an issuer belong to the bank of the item they came from.
  const unnamed = products.records.filter(
    (investment) => !investment.identity?.institution,
  );
  const inherited = unnamed.length
    ? await savedInstitution(dependencies, connectionId)
    : null;
  const own = inherited ?? connectorInstitution(connector);
  for (const investment of unnamed) {
    investment.identity = { cardBrand: null, institution: own };
  }
}
async function importProducts(dependencies: ImportDependencies, run: SyncRun) {
  const { repository, source, now } = dependencies;
  const { phase } = run.checkpoint;
  if (
    !source.products ||
    (phase !== ImportPhase.investments &&
      phase !== ImportPhase.loans &&
      phase !== ImportPhase.bills)
  ) {
    throw new Error("INVALID_CHECKPOINT");
  }
  const page = Number(run.checkpoint.cursor ?? "1");
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("INVALID_CHECKPOINT");
  }
  const id =
    phase === ImportPhase.bills ? run.checkpoint.accountId : run.connectionId;
  if (!id) {
    throw new Error("INVALID_CHECKPOINT");
  }
  const products = await source.products({
    id,
    kind: phase,
    observedAt: now(),
    page,
  });
  await identifyInvestments(dependencies, run.connectionId, products);
  if (products.kind !== phase) {
    throw new Error("SOURCE_IDENTITY_MISMATCH");
  }
  if (products.next !== null && products.next !== page + 1) {
    throw new Error("INVALID_PAGINATION");
  }
  let next: SyncRun["checkpoint"] = {
    ...run.checkpoint,
    cursor: products.next === null ? null : String(products.next),
  };
  if (products.next !== null) {
    return repository.publish({ done: false, next, now: now(), products, run });
  }
  if (phase === ImportPhase.investments) {
    next = { accountId: null, cursor: null, phase: ImportPhase.loans };
  } else {
    const saved = await repository.connectionAccounts(run.connectionId);
    const cards = Object.entries(saved)
      .filter(([, a]) => a.type === AccountType.CREDIT)
      .map(([key]) => key)
      .sort();
    const following = cards.find(
      (key) => phase === ImportPhase.loans || key > id,
    );
    next = {
      accountId: following ?? null,
      cursor: null,
      phase: following ? ImportPhase.bills : ImportPhase.finish,
    };
  }
  return repository.publish({ done: false, next, now: now(), products, run });
}
async function importPage(dependencies: ImportDependencies, run: SyncRun) {
  const { repository, now } = dependencies;
  const replay = await repository.read(run.id);
  if (replay.id === run.id && replay.sequence === run.sequence + 1) {
    return {
      checkpoint: replay.checkpoint,
      done:
        replay.status === RunStatus.succeeded ||
        replay.status === RunStatus.failed,
      sequence: replay.sequence,
    };
  }
  if (
    replay.id !== run.id ||
    replay.sequence !== run.sequence ||
    replay.status !== RunStatus.running
  ) {
    throw new Error("STALE_COMMIT");
  }
  switch (run.checkpoint.phase) {
    case ImportPhase.accounts:
      return importAccounts(dependencies, run);
    case ImportPhase.transactions:
      return importTransactions(dependencies, run);
    case ImportPhase.investments:
    case ImportPhase.loans:
    case ImportPhase.bills:
      return importProducts(dependencies, run);
    default: {
      const [current, saved] = await Promise.all([
        catalog(dependencies.source, run.connectionId),
        repository.connectionAccounts(run.connectionId),
      ]);
      const complete =
        current.length === Object.keys(saved).length &&
        current.every((account) => !!saved[account.id]);
      return repository.publish({
        ...(!complete && { error: "SOURCE_ACCOUNTS_CHANGED" }),
        done: true,
        next: run.checkpoint,
        now: now(),
        run,
      });
    }
  }
}
export async function runImport(
  dependencies: ImportDependencies,
  id: string,
): Promise<void> {
  const { repository, steps } = dependencies;
  await repository.start(id);
  async function next(): Promise<void> {
    const run = await repository.read(id);
    if (run.status !== RunStatus.running) {
      return;
    }
    await steps.do(`page-${run.sequence}`, () => importPage(dependencies, run));
    return next();
  }
  const { data: _data, error } = await tryCatch(next);
  if (!error || error.message === "STALE_COMMIT") {
    return;
  }
  await repository.fail(id, importFailure(error));
  throw error;
}
export function createSyncService({
  assertConfigured,
  repository,
  workflow,
  now = () => new Date(),
  report = () => undefined,
}: SyncServiceDependencies) {
  async function dispatch(id: string) {
    const { data: _data, error } = await tryCatch(() => workflow.create(id));
    if (!error) {
      return false;
    }
    const { data: _status, error: statusError } = await tryCatch(() =>
      workflow.status(id),
    );
    return !!statusError;
  }
  async function recoverRun(run: SyncRun) {
    const { data, error } = await tryCatch(() => workflow.status(run.id));
    if (error) {
      return {
        dispatchPending:
          run.status === RunStatus.pending && (await dispatch(run.id)) ? 1 : 0,
        failed: 0,
        statusUnavailable: 1,
      };
    }
    if (["errored", "terminated", "complete"].includes(data)) {
      await repository.fail(run.id, "EXECUTOR_TERMINATED");
    }
    return {
      dispatchPending: 0,
      failed: ["errored", "terminated", "complete"].includes(data) ? 1 : 0,
      statusUnavailable: 0,
    };
  }
  return {
    async recover() {
      const results = await Promise.all(
        (await repository.active()).map(recoverRun),
      );
      report(
        results.reduce(
          (total, row) => ({
            dispatchPending: total.dispatchPending + row.dispatchPending,
            failed: total.failed + row.failed,
            statusUnavailable: total.statusUnavailable + row.statusUnavailable,
          }),
          { dispatchPending: 0, failed: 0, statusUnavailable: 0 },
        ),
      );
    },
    async request(ids?: string[], initialOnly = false) {
      await assertConfigured(ids);
      const admissions = await repository.admit(
        ids,
        now().toISOString(),
        initialOnly,
      );
      const pending = await Promise.all(
        admissions.map((admission) =>
          admission.importId &&
          (admission.status === AdmissionStatus.started ||
            admission.status === AdmissionStatus.working)
            ? dispatch(admission.importId)
            : false,
        ),
      );
      report({
        dispatchPending: pending.filter(Boolean).length,
        failed: 0,
        statusUnavailable: 0,
      });
      return { connections: admissions };
    },
  };
}
