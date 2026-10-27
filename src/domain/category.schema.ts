import { z } from "zod/v4";

import { CategoryIcon, fixedCategories } from "./category.entity";

export const CategoryIconSchema = z.enum(CategoryIcon);
export const CategoryColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const FixedCategoryKeySchema = z.enum(
  fixedCategories.map((category) => category.key),
);
