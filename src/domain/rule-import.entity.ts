import type { Category } from "./planning.entity";

export function resolveRuleImportCategory(input: {
  categories: Category[];
  kind: Category["kind"];
  mappedId: string | undefined;
  name: string;
  spaceId: string;
  stableId: string;
}): {
  category: Category | null;
  status: "ambiguous" | "invalid" | "existing" | "create";
} {
  let category: Category | undefined;
  if (input.mappedId) {
    category = input.categories.find((c) => c.id === input.mappedId);
  } else {
    category = input.categories.find((c) => c.id === input.stableId);
    if (!category) {
      const matches = input.categories.filter(
        (c) =>
          c.spaceId === input.spaceId &&
          c.kind === input.kind &&
          c.name.trim().toLocaleLowerCase("pt-BR") ===
            input.name.toLocaleLowerCase("pt-BR"),
      );
      if (matches.length > 1) {
        return { category: null, status: "ambiguous" };
      }
      [category] = matches;
    }
  }
  if (!category) {
    return { category: null, status: input.mappedId ? "invalid" : "create" };
  }
  if (
    category.spaceId !== input.spaceId ||
    category.kind !== input.kind ||
    category.hidden
  ) {
    return { category: null, status: "invalid" };
  }
  return { category, status: "existing" };
}
