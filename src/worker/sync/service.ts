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
async function importAccounts(
  { repository, source, now }: ImportDependencies,
  run: SyncRun,
) {
  const connection = await source.connection(run.connectionId);
  if (connection.id !== run.connectionId) {
    throw new Error("SOURCE_IDENTITY_MISMATCH");
  }
  assertPersonalConnector(connection.connector?.id);
  const prepared = (await unique(await source.accounts(run.connectionId)))
    .map((row) => normalizeAccount(row, run.connectionId))
    .sort((left, right) =>
      left.id < right.id ? -1 : Number(left.id > right.id),
    );
  const [first] = prepared;
  return repository.publish({
    accounts: prepared,
    connection,
    done: false,
    next: {
      accountId: first?.id ?? null,
      cursor: null,
      phase: first ? "transactions" : "finish",
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
  const account = await repository.account(run.connectionId, accountId);
  const page = await source.transactions(accountId, cursor);
  const prepared = (await unique(page.records)).map((row) =>
    normalizeTransaction(row, account),
  );
  const following = page.next
    ? accountId
    : await repository.nextAccount(run, accountId);
  return repository.publish({
    now: now(),
    run,
    transactions: prepared,
    ...(!page.next && { completeAccountId: accountId }),
    done: false,
    next: {
      accountId: following,
      cursor: page.next,
      phase: following ? "transactions" : "finish",
    },
  });
}
async function importPage(dependencies: ImportDependencies, run: SyncRun) {
  const { repository, now } = dependencies;
  const replay = await repository.read(run.id);
  if (
    replay.lastCommitId === `${run.id}:${run.sequence}` &&
    replay.lastResult
  ) {
    return replay.lastResult;
  }
  if (replay.sequence !== run.sequence || replay.status !== "running") {
    throw new Error("STALE_COMMIT");
  }
  switch (run.checkpoint.phase) {
    case "accounts":
      return importAccounts(dependencies, run);
    case "transactions":
      return importTransactions(dependencies, run);
    default:
      return repository.publish({
        done: true,
        next: run.checkpoint,
        now: now(),
        run,
      });
  }
}
export async function runImport(
  dependencies: ImportDependencies,
  id: string,
): Promise<void> {
  const { repository, steps, now } = dependencies;
  await repository.start(id, now());
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
  await repository.fail(id, importFailure(error), now());
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
      await repository.fail(run.id, "EXECUTOR_TERMINATED", now().toISOString());
    }
    return {
      dispatchPending: 0,
      failed: ["errored", "terminated", "complete"].includes(data) ? 1 : 0,
      statusUnavailable: 0,
    };
  }
  return {
    compact: () =>
      repository.compact(
        new Date(now().getTime() - 30 * 86_400_000).toISOString(),
      ),
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
          admission.runId &&
          (admission.status === "started" || admission.status === "working")
            ? dispatch(admission.runId)
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
