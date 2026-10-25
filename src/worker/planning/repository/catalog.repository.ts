import { eq, sql } from "drizzle-orm";

import { compareRules, PlanningError } from "../../../domain";
import { database } from "../../database";
import {
  planningCategories,
  planningCategoryGroups,
  planningRules,
  planningSpaces,
  planningTags,
} from "../../schema";

export function createCatalogRepository(binding: D1Database) {
  const db = database(binding);
  return {
    async read(spaceId: string) {
      const [spaces, categories, rules, tags, categoryGroups] = await db.batch([
        db.select({ data: planningSpaces.data }).from(planningSpaces),
        db
          .select({ data: planningCategories.data })
          .from(planningCategories)
          .where(
            eq(
              sql`json_extract(${planningCategories.data},'$.spaceId')`,
              spaceId,
            ),
          ),
        db
          .select({ data: planningRules.data })
          .from(planningRules)
          .where(
            eq(sql`json_extract(${planningRules.data},'$.spaceId')`, spaceId),
          ),
        db
          .select({ data: planningTags.data })
          .from(planningTags)
          .where(
            eq(sql`json_extract(${planningTags.data},'$.spaceId')`, spaceId),
          ),
        db
          .select({ data: planningCategoryGroups.data })
          .from(planningCategoryGroups)
          .where(
            eq(
              sql`json_extract(${planningCategoryGroups.data},'$.spaceId')`,
              spaceId,
            ),
          ),
      ]);
      if (!spaces.some((s) => s.data.id === spaceId)) {
        throw new Error(PlanningError.NOT_FOUND);
      }
      return {
        categories: categories.map((s) => s.data),
        categoryGroups: categoryGroups.map((s) => s.data),
        rules: rules.map((s) => s.data).sort(compareRules),
        spaces: spaces.map((s) => s.data),
        tags: tags.map((s) => s.data),
      };
    },
  };
}
