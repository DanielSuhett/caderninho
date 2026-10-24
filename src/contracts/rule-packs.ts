import { z } from "zod/v4";

import brasil from "./rule-packs/brasil.json";
import { RuleFilterSchema } from "./rules";

export const RulePackCategoryKeySchema = z.enum([
  "farmacia",
  "pets",
  "corridas",
  "assinaturas",
  "mercado",
  "restaurantes",
  "compras",
  "academia",
  "educacao",
]);
export const RulePackOriginSchema = z.object({
  id: z.literal("brasil"),
  key: z.string(),
  version: z.number().int().positive(),
});
// Validate the bundled JSON once at the boundary; matching stays in the engine.
export const brasilRulePack = z
  .object({
    categories: z.array(
      z
        .object({
          key: RulePackCategoryKeySchema,
          kind: z.literal("expense"),
          name: z.string().min(1),
        })
        .strict(),
    ),
    id: z.literal("brasil"),
    rules: z.array(
      z
        .object({
          accountId: z.null(),
          categoryKey: RulePackCategoryKeySchema,
          direction: z.literal("DEBIT"),
          enabled: z.boolean(),
          filter: RuleFilterSchema,
          key: z.string().min(1),
          name: z.string().min(1).max(240),
          priority: z.number().int().min(0).max(1000),
          text: z.string().max(240),
        })
        .strict(),
    ),
    version: z.literal(1),
  })
  .strict()
  .parse(brasil);
