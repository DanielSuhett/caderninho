export const RuleJobKind = {
  import: "import",
  reapply: "reapply",
} as const;
export type RuleJobKind = (typeof RuleJobKind)[keyof typeof RuleJobKind];

export const RuleJobStatus = {
  failed: "failed",
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  uploading: "uploading",
} as const;
export type RuleJobStatus = (typeof RuleJobStatus)[keyof typeof RuleJobStatus];

export const RuleJobPhase = {
  apply: "apply",
  done: "done",
  import: "import",
  upload: "upload",
} as const;
export type RuleJobPhase = (typeof RuleJobPhase)[keyof typeof RuleJobPhase];

// Rules per uploaded chunk. Each chunk becomes native imports of at most this size.
export const RULE_JOB_CHUNK_RULES = 100;
export const RULE_JOB_MAX_CHUNKS = 2000;
export const RULE_JOB_SKIPPED_SAMPLE = 50;

export interface RuleJobSkip {
  key: string;
  reason: string;
}

export interface RuleJobChunkResult {
  categoriesCreated: number;
  rulesCreated: number;
  rulesExisting: number;
  skipped: RuleJobSkip[];
}

export interface RuleJob {
  applied: { changed: number; examined: number; passes: number };
  chunks: number;
  createdAt: string;
  error: string | null;
  id: string;
  imported: RuleJobChunkResult & { chunks: number; skippedTotal: number };
  kind: RuleJobKind;
  pack: { id: string; version: number } | null;
  phase: RuleJobPhase;
  received: number;
  spaceId: string;
  status: RuleJobStatus;
  updatedAt: string;
}

export function ruleJobActive(job: Pick<RuleJob, "status"> | null) {
  return (
    job?.status === RuleJobStatus.queued ||
    job?.status === RuleJobStatus.running
  );
}

// Totals are derived from per-chunk results, so replaying a committed chunk after
// a lost acknowledgement cannot count it twice.
export function importedTotals(
  results: RuleJobChunkResult[],
): RuleJob["imported"] {
  const skipped = results.flatMap((result) => result.skipped);
  return {
    categoriesCreated: results.reduce((sum, r) => sum + r.categoriesCreated, 0),
    chunks: results.length,
    rulesCreated: results.reduce((sum, r) => sum + r.rulesCreated, 0),
    rulesExisting: results.reduce((sum, r) => sum + r.rulesExisting, 0),
    skipped: skipped.slice(0, RULE_JOB_SKIPPED_SAMPLE),
    skippedTotal: skipped.length,
  };
}
