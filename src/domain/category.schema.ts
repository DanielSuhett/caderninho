import { z } from "zod/v4";

import {
  CategoryIcon,
  fixedCategories,
  type TransactionClassification,
} from "./category.entity";

export const CategoryIconSchema = z.enum(CategoryIcon);
export const CategoryColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const FixedCategoryKeySchema = z.enum(
  fixedCategories.map((category) => category.key),
);
export const TransactionClassificationSchema = z.object({
  category: FixedCategoryKeySchema,
  confidence: z.number().min(0).max(1),
  inputHash: z.string(),
  model: z.literal("clef-flash"),
  version: z.number().int().nonnegative(),
}) satisfies z.ZodType<TransactionClassification>;
