import { z } from "zod/v4";

import {
  RULE_JOB_CHUNK_RULES,
  RULE_JOB_MAX_CHUNKS,
  type RuleJob as RuleJobEntity,
  RuleJobKind,
  RuleJobPhase,
  type RuleJobSkip,
  RuleJobStatus,
} from "../domain";
import {
  RULE_IMPORT_MAX_BYTES,
  RULE_IMPORT_MAX_RULES,
  RuleImportCategorySchema,
  RuleImportKeySchema,
  type RuleImportPackage,
  RuleImportRuleSchema,
} from "./rule-import";

const id = z.string().min(1).max(160);
const csrf = z.string();
const count = z.number().int().nonnegative();
const skip = z.object({ key: z.string(), reason: z.string() });

export const RuleJobCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create_import"),
      chunks: z.number().int().min(1).max(RULE_JOB_MAX_CHUNKS),
      csrf,
      pack: z
        .object({
          categories: z.array(z.unknown()).max(5000),
          id: RuleImportKeySchema,
          version: z.number().int().positive(),
        })
        .strict(),
      received: count,
      spaceId: id,
    })
    .strict(),
  z
    .object({
      action: z.literal("append"),
      csrf,
      id,
      rules: z.array(z.unknown()).min(1).max(RULE_JOB_CHUNK_RULES),
      seq: z.number().int().nonnegative().max(RULE_JOB_MAX_CHUNKS),
    })
    .strict(),
  z.object({ action: z.literal("start"), csrf, id }).strict(),
  z.object({ action: z.literal("reapply"), csrf, spaceId: id }).strict(),
]);
export type RuleJobCommand = z.infer<typeof RuleJobCommandSchema>;
export const RuleJobSelectionSchema = z.union([
  z.object({ id }).strict(),
  z.object({ spaceId: id }).strict(),
]);

export const RuleJobSchema = z.object({
  applied: z.object({ changed: count, examined: count, passes: count }),
  chunks: count,
  createdAt: z.string(),
  error: z.string().nullable(),
  id: z.string(),
  imported: z.object({
    categoriesCreated: count,
    chunks: count,
    rulesCreated: count,
    rulesExisting: count,
    skipped: z.array(skip),
    skippedTotal: count,
  }),
  kind: z.enum([RuleJobKind.import, RuleJobKind.reapply]),
  pack: z.object({ id: z.string(), version: z.number() }).nullable(),
  phase: z.enum([
    RuleJobPhase.upload,
    RuleJobPhase.import,
    RuleJobPhase.apply,
    RuleJobPhase.done,
  ]),
  received: count,
  spaceId: z.string(),
  status: z.enum([
    RuleJobStatus.uploading,
    RuleJobStatus.queued,
    RuleJobStatus.running,
    RuleJobStatus.succeeded,
    RuleJobStatus.failed,
  ]),
  updatedAt: z.string(),
}) satisfies z.ZodType<RuleJobEntity>;
export const RuleJobResponseSchema = z.object({
  job: RuleJobSchema.nullable(),
});
export type RuleJob = z.infer<typeof RuleJobSchema>;

type Batch = Pick<RuleImportPackage, "categories" | "rules">;
const batchBytes = RULE_IMPORT_MAX_BYTES - 4096;
const KeyedSchema = z.object({ key: z.string() });
// Skip reasons are shown to the owner, so schema messages use the app locale.
const ptBR = z.locales.ptBR().localeError;
function rawKey(value: unknown, index: number) {
  const parsed = KeyedSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data.key.slice(0, 64);
  }
  return `#${index + 1}`;
}

// Validate each rule on its own so one bad entry never rejects the file. Valid
// rules are split into native packs that respect the import_rules limits.
export function prepareRuleJobChunk(input: {
  categories: unknown[];
  rules: unknown[];
  offset: number;
}): { batches: Batch[]; skipped: RuleJobSkip[] } {
  const categories = new Map<string, Batch["categories"][number]>();
  for (const value of input.categories) {
    const parsed = RuleImportCategorySchema.safeParse(value);
    if (parsed.success && !categories.has(parsed.data.key)) {
      categories.set(parsed.data.key, parsed.data);
    }
  }
  const skipped: RuleJobSkip[] = [];
  const keys = new Set<string>();
  const batches: Batch[] = [];
  let current: Batch = { categories: [], rules: [] };
  let bytes = 0;
  input.rules.forEach((value, index) => {
    const key = rawKey(value, input.offset + index);
    const parsed = RuleImportRuleSchema.safeParse(value, { error: ptBR });
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      const field = issue?.path.join(".");
      const message = issue?.message ?? "Regra inválida.";
      skipped.push({ key, reason: field ? `${field}: ${message}` : message });
      return;
    }
    const rule = parsed.data;
    const category = categories.get(rule.categoryKey);
    if (!category) {
      skipped.push({ key, reason: "Categoria não declarada no arquivo." });
      return;
    }
    if (keys.has(rule.key)) {
      skipped.push({ key, reason: "Chave repetida no arquivo." });
      return;
    }
    keys.add(rule.key);
    const size = new TextEncoder().encode(JSON.stringify(rule)).length;
    const known = current.categories.some((c) => c.key === category.key);
    if (
      current.rules.length >= RULE_IMPORT_MAX_RULES ||
      (!known && current.categories.length >= 50) ||
      bytes + size > batchBytes
    ) {
      batches.push(current);
      current = { categories: [], rules: [] };
      bytes = 0;
    }
    if (!current.categories.some((c) => c.key === category.key)) {
      current.categories.push(category);
    }
    current.rules.push(rule);
    bytes += size;
  });
  if (current.rules.length) {
    batches.push(current);
  }
  return { batches, skipped };
}
