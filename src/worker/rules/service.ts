import { prepareRuleJobChunk, type RuleJobCommand } from "../../contracts";
import {
  type Category,
  importedTotals,
  PlanningError,
  RULE_JOB_CHUNK_RULES,
  type RuleJob,
  type RuleJobChunkResult,
  RuleJobKind,
  RuleJobPhase,
  RuleJobStatus,
  ruleImportCategoryMapping,
  ruleJobActive,
} from "../../domain";
import { tryCatch } from "../../shared";
import type {
  RuleJobDispatcher,
  RuleJobRepository,
  RulePlanning,
} from "./entity";

type Batch = ReturnType<typeof prepareRuleJobChunk>["batches"][number];
const planningErrors = new Set<string>(Object.values(PlanningError));
const skipReasons = new Map<string, string>([
  [PlanningError.INVALID_RULE, "Regra incompleta ou com condições inválidas."],
  [
    PlanningError.INVALID_RULE_IMPORT_CATEGORY,
    "Categoria do arquivo ambígua ou inválida neste grupo.",
  ],
  [PlanningError.NOT_FOUND, "Conta ou categoria não encontrada."],
  [PlanningError.SPACE_MISMATCH, "A regra aponta para outro grupo."],
  [PlanningError.SYSTEM_CATEGORY, "Categorias do sistema não recebem regras."],
]);
// Validation failures of imported content are skipped; concurrency and
// infrastructure failures propagate so the Workflow step retries.
function rejected(error: Error) {
  return (
    planningErrors.has(error.message) &&
    error.message !== PlanningError.RESTART_REQUIRED
  );
}

interface BatchImport {
  categories: Category[];
  pack: NonNullable<RuleJob["pack"]>;
  planning: RulePlanning;
  result: RuleJobChunkResult;
  spaceId: string;
}
// Sequential: each native import needs the revision left by the previous one.
async function importSequence(
  context: BatchImport,
  batches: { batch: Batch; key: string }[],
): Promise<void> {
  const [next, ...rest] = batches;
  if (!next) {
    return;
  }
  await importBatch(context, next);
  return importSequence(context, rest);
}
async function importBatch(
  context: BatchImport,
  { batch, key }: { batch: Batch; key: string },
): Promise<void> {
  const { result } = context;
  const { data: imported, error } = await tryCatch(() =>
    context.planning.importRules({
      categoryIds: ruleImportCategoryMapping(
        context.categories,
        batch.categories,
      ),
      key,
      pack: { ...context.pack, ...batch },
      spaceId: context.spaceId,
    }),
  );
  if (error) {
    if (!rejected(error)) {
      throw error;
    }
    const [single] = batch.rules;
    if (batch.rules.length === 1 && single) {
      result.skipped.push({
        key: single.key,
        reason:
          skipReasons.get(error.message) ??
          `Regra recusada pelo Caderninho (${error.message}).`,
      });
      return;
    }
    // One invalid reference rejects the native batch; isolate each rule.
    return importSequence(
      context,
      batch.rules.map((rule, index) => ({
        batch: {
          categories: batch.categories.filter(
            (category) => category.key === rule.categoryKey,
          ),
          rules: [rule],
        },
        key: `${key}:${index}`,
      })),
    );
  }
  result.categoriesCreated += imported.categoriesCreated;
  result.rulesCreated += imported.rulesCreated;
  result.rulesExisting += imported.rulesExisting;
  for (const rule of imported.rules) {
    if (rule.status === "blocked") {
      result.skipped.push({
        key: rule.key,
        reason: "Categoria indisponível neste grupo.",
      });
    }
  }
}

// Bounds a single job so a rule set that keeps changing cannot loop forever.
const MAX_APPLY_PASSES = 1000;

export function createRuleJobService(dependencies: {
  dispatcher: RuleJobDispatcher;
  now: () => string;
  planning: RulePlanning;
  repository: RuleJobRepository;
}) {
  const { dispatcher, now, planning, repository } = dependencies;
  async function found(id: string) {
    const job = await repository.read(id);
    if (!job) {
      throw new Error("NOT_FOUND");
    }
    return job;
  }
  async function update(job: RuleJob, patch: Partial<RuleJob>) {
    const next = { ...job, ...patch, updatedAt: now() };
    await repository.write(next);
    return next;
  }
  async function admit(spaceId: string) {
    const active = await repository.latest(spaceId);
    if (ruleJobActive(active)) {
      throw new Error("JOB_ACTIVE");
    }
  }
  function blank(
    input: Pick<RuleJob, "kind" | "spaceId"> & Partial<RuleJob>,
  ): RuleJob {
    const at = now();
    return {
      applied: { changed: 0, examined: 0, passes: 0 },
      chunks: 0,
      createdAt: at,
      error: null,
      id: crypto.randomUUID(),
      imported: importedTotals([]),
      pack: null,
      phase: RuleJobPhase.upload,
      received: 0,
      status: RuleJobStatus.uploading,
      updatedAt: at,
      ...input,
    };
  }
  async function start(job: RuleJob) {
    const queued = await update(job, {
      phase:
        job.kind === RuleJobKind.import
          ? RuleJobPhase.import
          : RuleJobPhase.apply,
      status: RuleJobStatus.queued,
    });
    await dispatcher.create(queued.id);
    return queued;
  }
  return {
    async applyPass(id: string, pass: number) {
      const job = await found(id);
      if (pass >= MAX_APPLY_PASSES) {
        throw new Error("RULE_APPLICATION_UNSTABLE");
      }
      const applied = await planning.applyRules({
        key: `rule-job:${id}:apply:${pass}`,
        spaceId: job.spaceId,
      });
      // A replayed pass returns the stored receipt; count it only once.
      if (job.applied.passes === pass) {
        await update(job, {
          applied: {
            changed: job.applied.changed + applied.changed,
            examined: applied.examined,
            passes: pass + 1,
          },
          phase: RuleJobPhase.apply,
        });
      }
      return { done: !applied.truncated };
    },
    // Workflow steps. Each one is idempotent: planning receipts are keyed by job,
    // chunk/pass and batch, and chunk results are stored before totals.
    async begin(id: string) {
      const job = await found(id);
      if (job.status === RuleJobStatus.queued) {
        return update(job, { status: RuleJobStatus.running });
      }
      return job;
    },
    async command(input: RuleJobCommand): Promise<RuleJob> {
      switch (input.action) {
        case "create_import": {
          await admit(input.spaceId);
          const job = blank({
            chunks: input.chunks,
            kind: RuleJobKind.import,
            pack: { id: input.pack.id, version: input.pack.version },
            received: input.received,
            spaceId: input.spaceId,
          });
          await repository.create(job, input.pack.categories);
          return job;
        }
        case "append": {
          const job = await found(input.id);
          if (
            job.status !== RuleJobStatus.uploading ||
            input.seq >= job.chunks
          ) {
            throw new Error("INVALID_REQUEST");
          }
          await repository.append(job.id, input.seq, input.rules);
          return job;
        }
        case "start": {
          const job = await found(input.id);
          if (job.status !== RuleJobStatus.uploading) {
            return job;
          }
          if ((await repository.uploaded(job.id)) !== job.chunks) {
            throw new Error("INVALID_REQUEST");
          }
          return start(job);
        }
        case "reapply": {
          await admit(input.spaceId);
          const job = blank({
            kind: RuleJobKind.reapply,
            spaceId: input.spaceId,
          });
          await repository.create(job, []);
          return start(job);
        }
        default:
          throw new Error("INVALID_REQUEST");
      }
    },
    async fail(id: string, code: string) {
      const job = await repository.read(id);
      if (job) {
        await update(job, { error: code, status: RuleJobStatus.failed });
      }
    },
    async finish(id: string) {
      await update(await found(id), {
        phase: RuleJobPhase.done,
        status: RuleJobStatus.succeeded,
      });
    },
    async importChunk(id: string, seq: number) {
      const job = await found(id);
      const chunk = await repository.chunk(id, seq);
      if (!(chunk && job.pack)) {
        throw new Error("NOT_FOUND");
      }
      if (chunk.result) {
        return null;
      }
      const prepared = prepareRuleJobChunk({
        categories: await repository.categories(id),
        offset: seq * RULE_JOB_CHUNK_RULES,
        rules: chunk.rules,
      });
      const result: RuleJobChunkResult = {
        categoriesCreated: 0,
        rulesCreated: 0,
        rulesExisting: 0,
        skipped: prepared.skipped,
      };
      await importSequence(
        {
          categories: await planning.categories(job.spaceId),
          pack: job.pack,
          planning,
          result,
          spaceId: job.spaceId,
        },
        prepared.batches.map((batch, index) => ({
          batch,
          key: `rule-job:${id}:${seq}:${index}`,
        })),
      );
      const results = await repository.finishChunk(id, seq, result);
      await update(job, { imported: importedTotals(results) });
      return null;
    },
    latest: (spaceId: string) => repository.latest(spaceId),
    read: (id: string) => repository.read(id),
  };
}
export type RuleJobService = ReturnType<typeof createRuleJobService>;
