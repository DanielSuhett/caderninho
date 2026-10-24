import { z } from "zod/v4";

import {
  assertPersonalConnector,
  CLASSIFICATION_VERSION,
  CLEF_MIN_CONFIDENCE,
  classificationState,
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
  dependencies: ImportDependencies,
): SyncRun["checkpoint"]["phase"] {
  if (dependencies.source.products) {
    return "investments";
  }
  return dependencies.classifier ? "classification" : "finish";
}
async function importAccounts(dependencies: ImportDependencies, run: SyncRun) {
  const { repository, source, now } = dependencies;
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
      phase: first ? "transactions" : afterTransactions(dependencies),
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
      phase: following ? "transactions" : afterTransactions(dependencies),
    },
    now: now(),
    run,
    transactions: prepared,
  });
}
function afterProducts(
  classifier: ImportDependencies["classifier"],
): SyncRun["checkpoint"]["phase"] {
  return classifier ? "classification" : "finish";
}
async function importProducts(
  { repository, source, now, classifier }: ImportDependencies,
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
      phase: following ? "bills" : afterProducts(classifier),
    };
  }
  return repository.publish({ done: false, next, now: now(), products, run });
}
const ClassificationCursorSchema = z.object({
  date: z.string(),
  id: z.string(),
});
async function classifyPage(
  page: import("../../domain").TransactionProjection[],
  classifier: NonNullable<ImportDependencies["classifier"]>,
) {
  const classifications: NonNullable<
    import("./entity").Publication["classifications"]
  > = [];
  const decisions = new Map<
    string,
    Awaited<ReturnType<NonNullable<ImportDependencies["classifier"]>>>
  >();
  const inputs = await Promise.all(
    page.map(async (row) => {
      const state = classificationState(row);
      return { inputHash: await hash(state), row, state };
    }),
  );
  // Sequential, bounded page: avoid issuing a burst of inference requests.
  async function next(index: number): Promise<void> {
    const input = inputs[index];
    if (!input) {
      return;
    }
    const { row, state, inputHash } = input;
    if (
      row.classification?.inputHash === inputHash &&
      row.classification.version === CLASSIFICATION_VERSION
    ) {
      return next(index + 1);
    }
    if (!decisions.has(inputHash)) {
      // AI is optional enrichment. Financial publication remains successful on
      // inference failures; projection applies deterministic Pluggy rules.
      const { data, error } = await tryCatch(() => classifier(state));
      decisions.set(inputHash, error ? null : data);
    }
    const decision = decisions.get(inputHash);
    if (decision && decision.confidence >= CLEF_MIN_CONFIDENCE) {
      classifications.push({
        classification: {
          ...decision,
          inputHash,
          model: "clef-flash",
          version: CLASSIFICATION_VERSION,
        },
        id: row.id,
      });
    }
    return next(index + 1);
  }
  await next(0);
  return classifications;
}
async function classifyTransactions(
  { repository, classifier, now }: ImportDependencies,
  run: SyncRun,
) {
  const accountIds = Object.keys(
    await repository.connectionAccounts(run.connectionId),
  ).sort();
  const accountId = run.checkpoint.accountId ?? accountIds[0];
  const classifications: NonNullable<
    import("./entity").Publication["classifications"]
  > = [];
  let next: SyncRun["checkpoint"] = {
    accountId: null,
    cursor: null,
    phase: "finish",
  };
  if (accountId && classifier) {
    const after = run.checkpoint.cursor
      ? ClassificationCursorSchema.parse(JSON.parse(run.checkpoint.cursor))
      : null;
    const page = await repository.classificationPage(accountId, after);
    classifications.push(...(await classifyPage(page, classifier)));
    const last = page.at(-1);
    const following = accountIds.find((id) => id > accountId);
    if (last) {
      next = {
        accountId,
        cursor: JSON.stringify({ date: last.date, id: last.id }),
        phase: "classification",
      };
    } else if (following) {
      next = { accountId: following, cursor: null, phase: "classification" };
    }
  }
  return repository.publish({
    classifications,
    done: false,
    next,
    now: now(),
    run,
  });
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
    case "classification":
      return classifyTransactions(dependencies, run);
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
    async request(ids?: string[], initialOnly = false) {
      const admissions = await repository.admit(
        ids,
        now().toISOString(),
        initialOnly,
      );
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
