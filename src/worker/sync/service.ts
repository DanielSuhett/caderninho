import {
  assertPersonalConnector,
  normalizeAccount,
  normalizeTransaction,
} from "../../domain";
import { hash, tryCatch } from "../../shared";
import type {
  ImportDependencies,
  SyncRepository,
  SyncRun,
  WorkflowPort,
} from "./entity";
import { importFailure } from "./entity";

async function unique<T extends { id: string }>(records: T[]) {
  const hashes = await Promise.all(records.map((row) => hash(row)));
  const seen = new Map<string, string>();
  return records.filter((row, index) => {
    const digest = hashes[index];
    if (!digest) {
      throw new Error("INVALID_RESPONSE");
    }
    const prior = seen.get(row.id);
    if (prior && prior !== digest) {
      throw new Error("DUPLICATE_CHANGED");
    }
    seen.set(row.id, digest);
    return !prior;
  });
}
async function catalog(
  source: ImportDependencies["source"],
  connectionId: string,
) {
  return (await unique(await source.accounts(connectionId)))
    .map((row) => normalizeAccount(row, connectionId))
    .sort((left, right) =>
      left.id < right.id ? -1 : Number(left.id > right.id),
    );
}
function afterTransactions(
  source: ImportDependencies["source"],
): SyncRun["checkpoint"]["phase"] {
  return source.products ? "investments" : "finish";
}
async function importAccounts(
  { repository, source, now }: ImportDependencies,
  run: SyncRun,
) {
  const connection = await source.connection(run.connectionId);
  if (connection.id !== run.connectionId) {
    throw new Error("SOURCE_IDENTITY_MISMATCH");
  }
  assertPersonalConnector(connection.connector?.id);
  const prepared = await catalog(source, run.connectionId);
  const [first] = prepared;
  return repository.publish({
    accounts: prepared,
    done: false,
    next: {
      accountId: first?.id ?? null,
      cursor: null,
      phase: first ? "transactions" : afterTransactions(source),
    },
    now: now(),
    run,
  });
}
async function importTransactions(
  { repository, source, now }: ImportDependencies,
  run: SyncRun,
) {
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
      phase: following ? "transactions" : afterTransactions(source),
    },
    now: now(),
    run,
    transactions: prepared,
  });
}
async function importProducts(
  { repository, source, now }: ImportDependencies,
  run: SyncRun,
) {
  const { phase } = run.checkpoint;
  if (!(source.products && ["investments", "loans", "bills"].includes(phase))) {
    throw new Error("INVALID_CHECKPOINT");
  }
  if (phase !== "investments" && phase !== "loans" && phase !== "bills") {
    throw new Error("INVALID_CHECKPOINT");
  }
  const page = Number(run.checkpoint.cursor ?? "1");
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("INVALID_CHECKPOINT");
  }
  const id = phase === "bills" ? run.checkpoint.accountId : run.connectionId;
  if (!id) {
    throw new Error("INVALID_CHECKPOINT");
  }
  const products = await source.products({
    id,
    kind: phase,
    observedAt: now(),
    page,
  });
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
  if (phase === "investments") {
    next = { accountId: null, cursor: null, phase: "loans" };
  } else {
    const saved = await repository.connectionAccounts(run.connectionId);
    const cards = Object.entries(saved)
      .filter(([, a]) => a.type === "CREDIT")
      .map(([key]) => key)
      .sort();
    const following = cards.find((key) => phase === "loans" || key > id);
    next = {
      accountId: following ?? null,
      cursor: null,
      phase: following ? "bills" : "finish",
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
      done: replay.status === "succeeded" || replay.status === "failed",
      sequence: replay.sequence,
    };
  }
  if (
    replay.id !== run.id ||
    replay.sequence !== run.sequence ||
    replay.status !== "running"
  ) {
    throw new Error("STALE_COMMIT");
  }
  switch (run.checkpoint.phase) {
    case "accounts":
      return importAccounts(dependencies, run);
    case "transactions":
      return importTransactions(dependencies, run);
    case "investments":
    case "loans":
    case "bills":
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
    if (run.status !== "running") {
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
export function createSyncService(
  repository: SyncRepository,
  workflow: WorkflowPort,
  now: () => Date = () => new Date(),
  report: (counts: {
    dispatchPending: number;
    statusUnavailable: number;
    failed: number;
  }) => void = () => undefined,
) {
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
          run.status === "pending" && (await dispatch(run.id)) ? 1 : 0,
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
    async request(ids?: string[]) {
      const admissions = await repository.admit(ids, now().toISOString());
      const pending = await Promise.all(
        admissions.map((admission) =>
          admission.importId &&
          (admission.status === "started" || admission.status === "working")
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
