import { z } from "zod/v4";

import {
  CategoryKind,
  type RuleImportPackage as RuleImportPackageEntity,
  type RuleImportResult as RuleImportResultEntity,
} from "../domain";
import { RuleFieldsSchema } from "./rules";

export const RULE_IMPORT_MAX_BYTES = 65_536;
export const RULE_IMPORT_MAX_RULES = 100;
const key = z
  .string()
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/,
    "Use 1–64 letras, números, pontos, hífens ou sublinhados.",
  );
export const ImportedRuleOriginSchema = z.object({
  id: key,
  key,
  version: z.number().int().positive(),
});

export const RuleImportKeySchema = key;
export const RuleImportCategorySchema = z
  .object({
    key,
    kind: z.enum([
      CategoryKind.income,
      CategoryKind.expense,
      CategoryKind.transfer,
    ]),
    name: z.string().trim().min(1).max(240),
  })
  .strict();
export const RuleImportRuleSchema = RuleFieldsSchema.omit({ categoryId: true })
  .extend({
    categoryKey: key,
    key,
  })
  .strict()
  .refine(
    (rule) => !!(rule.text || rule.filter),
    "Adicione texto ou condições compostas à regra.",
  );
export const RuleImportPackageSchema = z
  .object({
    categories: z.array(RuleImportCategorySchema).min(1).max(50),
    id: key,
    rules: z.array(RuleImportRuleSchema).min(1).max(RULE_IMPORT_MAX_RULES),
    version: z.number().int().positive(),
  })
  .strict()
  .superRefine((pack, context) => {
    if (
      new TextEncoder().encode(JSON.stringify(pack)).length >
      RULE_IMPORT_MAX_BYTES
    ) {
      context.addIssue({ code: "custom", message: "O JSON excede 64 KiB." });
    }
    const categories = new Set(pack.categories.map((c) => c.key));
    if (categories.size !== pack.categories.length) {
      context.addIssue({
        code: "custom",
        message: "Chaves de categorias duplicadas.",
        path: ["categories"],
      });
    }
    if (new Set(pack.rules.map((r) => r.key)).size !== pack.rules.length) {
      context.addIssue({
        code: "custom",
        message: "Chaves de regras duplicadas.",
        path: ["rules"],
      });
    }
    pack.rules.forEach((rule, index) => {
      if (!categories.has(rule.categoryKey)) {
        context.addIssue({
          code: "custom",
          message: "Categoria não declarada no JSON.",
          path: ["rules", index, "categoryKey"],
        });
      }
    });
  }) satisfies z.ZodType<RuleImportPackageEntity>;
export const RuleImportFields = {
  categoryIds: z.record(key, z.string().min(1).max(160)).default({}),
  pack: RuleImportPackageSchema,
};
export const RuleImportResultSchema = z.object({
  categories: z.array(
    z.object({
      id: z.string().nullable(),
      key: z.string(),
      kind: z.enum([
        CategoryKind.income,
        CategoryKind.expense,
        CategoryKind.transfer,
      ]),
      name: z.string(),
      status: z.enum(["create", "existing", "ambiguous", "invalid", "unused"]),
    }),
  ),
  categoriesCreated: z.number().int(),
  packId: z.string(),
  revision: z.number().int(),
  rules: z.array(
    z.object({
      categoryName: z.string(),
      enabled: z.boolean(),
      key: z.string(),
      name: z.string(),
      priority: z.number(),
      status: z.enum(["create", "existing", "blocked"]),
    }),
  ),
  rulesCreated: z.number().int(),
  rulesExisting: z.number().int(),
  version: z.number().int(),
}) satisfies z.ZodType<RuleImportResultEntity>;
export type RuleImportPackage = z.infer<typeof RuleImportPackageSchema>;
export type RuleImportResult = z.infer<typeof RuleImportResultSchema>;
