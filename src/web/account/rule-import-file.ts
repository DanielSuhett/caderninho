import { z } from "zod/v4";

import { RuleImportKeySchema } from "../../contracts";
import { RULE_JOB_CHUNK_RULES, RULE_JOB_MAX_CHUNKS } from "../../domain";

const bom = /^﻿/;
const diacritics = /\p{M}/gu;
const invalidKey = /[^a-zA-Z0-9._-]+/g;
const edges = /^[^a-zA-Z0-9]+|-+$/g;
const extension = /\.[^.]+$/;
const RuleFileSchema = z.object({
  categories: z.array(z.unknown()).max(5000).default([]),
  id: z.unknown().optional(),
  rules: z.array(z.unknown()).min(1, "O arquivo não tem regras."),
  version: z.unknown().optional(),
});
const VersionSchema = z.number().int().positive();

export interface RuleJobFile {
  categories: unknown[];
  chunks: unknown[][];
  id: string;
  rules: number;
  version: number;
}

function fileKey(name: string) {
  const key = name
    .replace(extension, "")
    .normalize("NFD")
    .replace(diacritics, "")
    .replace(invalidKey, "-")
    .replace(edges, "")
    .slice(0, 64);
  return key || "regras";
}

// Only the envelope is read in the browser. Each rule is validated by the job,
// so one invalid entry is reported instead of rejecting the whole file.
export function parseRuleJobText(text: string, name: string): RuleJobFile {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(bom, ""));
  } catch (cause) {
    throw new Error(
      "JSON inválido. Confira vírgulas, aspas e chaves do arquivo.",
      { cause },
    );
  }
  const parsed = RuleFileSchema.safeParse(value);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    throw new Error(
      `Arquivo inválido em ${issue?.path.join(".") || "JSON"}: ${issue?.message ?? "confira os campos"}`,
    );
  }
  const { categories, id, rules, version } = parsed.data;
  const chunks = Array.from(
    { length: Math.ceil(rules.length / RULE_JOB_CHUNK_RULES) },
    (_, index) =>
      rules.slice(
        index * RULE_JOB_CHUNK_RULES,
        (index + 1) * RULE_JOB_CHUNK_RULES,
      ),
  );
  if (chunks.length > RULE_JOB_MAX_CHUNKS) {
    throw new Error("O arquivo tem regras demais para uma única importação.");
  }
  const key = RuleImportKeySchema.safeParse(id);
  const revision = VersionSchema.safeParse(version);
  return {
    categories,
    chunks,
    id: key.success ? key.data : fileKey(name),
    rules: rules.length,
    version: revision.success ? revision.data : 1,
  };
}
export async function readRuleJobFile(file: Pick<File, "name" | "text">) {
  return parseRuleJobText(await file.text(), file.name);
}
