import type { RuleImportPackage, RuleImportResult } from "../../../contracts";
import type { Category, RuleJob, RuleJobChunkResult } from "../../../domain";

export interface RuleJobRepository {
  // Stores a chunk once; repeating the same sequence keeps the first upload.
  append: (jobId: string, seq: number, rules: unknown[]) => Promise<void>;
  categories: (jobId: string) => Promise<unknown[]>;
  chunk: (
    jobId: string,
    seq: number,
  ) => Promise<{ result: RuleJobChunkResult | null; rules: unknown[] } | null>;
  create: (job: RuleJob, categories: unknown[]) => Promise<void>;
  finishChunk: (
    jobId: string,
    seq: number,
    result: RuleJobChunkResult,
  ) => Promise<RuleJobChunkResult[]>;
  latest: (spaceId: string) => Promise<RuleJob | null>;
  read: (id: string) => Promise<RuleJob | null>;
  uploaded: (jobId: string) => Promise<number>;
  write: (job: RuleJob) => Promise<void>;
}

export interface RulePlanning {
  applyRules: (input: {
    key: string;
    spaceId: string;
  }) => Promise<{ changed: number; examined: number; truncated: boolean }>;
  categories: (spaceId: string) => Promise<Category[]>;
  importRules: (input: {
    categoryIds: Record<string, string>;
    key: string;
    pack: RuleImportPackage;
    spaceId: string;
  }) => Promise<RuleImportResult>;
}

export interface RuleJobDispatcher {
  create: (id: string) => Promise<void>;
}
