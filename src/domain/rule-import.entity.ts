import type { Category, Rule } from "./planning.entity";

export interface RuleImportPackage {
  categories: { key: string; kind: Category["kind"]; name: string }[];
  id: string;
  rules: (Omit<Rule, "categoryId" | "id" | "pack" | "spaceId"> & {
    categoryKey: string;
    key: string;
  })[];
  version: number;
}

export interface RuleImportResult {
  categories: {
    id: string | null;
    key: string;
    kind: Category["kind"];
    name: string;
    status: "create" | "existing" | "ambiguous" | "invalid" | "unused";
  }[];
  categoriesCreated: number;
  packId: string;
  revision: number;
  rules: {
    categoryName: string;
    enabled: boolean;
    key: string;
    name: string;
    priority: number;
    status: "create" | "existing" | "blocked";
  }[];
  rulesCreated: number;
  rulesExisting: number;
  version: number;
}

interface RuleImportPlan<
  Definition extends RuleImportPackage["rules"][number],
> {
  categories: Required<Category>[];
  result: RuleImportResult;
  rules: (Omit<Definition, "categoryKey" | "key"> & {
    categoryId: string;
    id: string;
    pack: NonNullable<Rule["pack"]>;
    spaceId: string;
  })[];
}

// Compare only rule behavior. Names, priorities and pauses belong to the user.
// Project known fields so JSON property order cannot create duplicate rules.
function signature(
  rule: Pick<
    Rule,
    "accountId" | "categoryId" | "direction" | "filter" | "text"
  >,
) {
  const filter = rule.filter
    ? {
        alternatives: rule.filter.alternatives.map((alternative) => ({
          conditions: alternative.conditions.map((condition) => ({
            field: condition.field,
            operator: condition.operator,
            value: condition.value,
          })),
        })),
        currency: rule.filter.currency,
      }
    : null;
  return JSON.stringify({
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    direction: rule.direction,
    filter,
    text: rule.text,
  });
}

// Pure plan shared by the Worker and the synthetic session. Callers validate
// storage references and commit only after every proposed change is accepted.
export function prepareRuleImport<
  Definition extends RuleImportPackage["rules"][number],
>({
  categories,
  rules,
  pack,
  spaceId,
  categoryIds,
  revision,
  prefix,
}: {
  categories: readonly Category[];
  rules: readonly Rule[];
  pack: Omit<RuleImportPackage, "rules"> & { rules: Definition[] };
  spaceId: string;
  categoryIds: Record<string, string>;
  revision: number;
  prefix: string;
}): RuleImportPlan<Definition> {
  const plan: RuleImportPlan<Definition> = {
    categories: [],
    result: {
      categories: [],
      categoriesCreated: 0,
      packId: pack.id,
      revision,
      rules: [],
      rulesCreated: 0,
      rulesExisting: 0,
      version: pack.version,
    },
    rules: [],
  };
  const { result } = plan;
  const available = [...categories];
  const mappings = new Map(Object.entries(categoryIds));
  const existingRules = new Map(rules.map((rule) => [rule.id, rule]));
  const pending = new Set(
    pack.rules
      .filter((rule) => !existingRules.has(prefix + rule.key))
      .map((rule) => rule.categoryKey),
  );
  const resolvedIds = new Map<string, string>();
  function prepareCategory(target: RuleImportPackage["categories"][number]) {
    const base = {
      id: null,
      key: target.key,
      kind: target.kind,
      name: target.name,
    };
    if (!pending.has(target.key)) {
      result.categories.push({ ...base, status: "unused" });
      return;
    }
    const stableId = `${prefix}category:${target.key}`;
    const resolved = resolveRuleImportCategory({
      categories: available,
      kind: target.kind,
      mappedId: mappings.get(target.key),
      name: target.name,
      spaceId,
      stableId,
    });
    if (resolved.status === "ambiguous" || resolved.status === "invalid") {
      result.categories.push({ ...base, status: resolved.status });
      return;
    }
    let { category } = resolved;
    if (!category) {
      const created: Required<Category> = {
        color: "#64748b",
        groupId: null,
        hidden: false,
        icon: "shopping",
        id: stableId,
        kind: target.kind,
        limitMinor: null,
        name: target.name,
        spaceId,
        system: false,
      };
      plan.categories.push(created);
      available.push(created);
      category = created;
      result.categoriesCreated += 1;
    }
    resolvedIds.set(target.key, category.id);
    result.categories.push({
      ...base,
      id: category.id,
      name: category.name,
      status: resolved.status,
    });
  }
  pack.categories.forEach(prepareCategory);
  const fingerprints = new Set(
    rules.filter((rule) => rule.spaceId === spaceId).map(signature),
  );
  for (const definition of pack.rules) {
    const { key, categoryKey, ...native } = definition;
    const id = prefix + key;
    const categoryId = resolvedIds.get(categoryKey);
    const existing = existingRules.get(id);
    const categoryName =
      available.find(
        (category) => category.id === (existing?.categoryId ?? categoryId),
      )?.name ??
      pack.categories.find((category) => category.key === categoryKey)?.name ??
      categoryKey;
    const display = {
      categoryName,
      enabled: existing?.enabled ?? definition.enabled,
      key,
      name: existing?.name ?? definition.name,
      priority: existing?.priority ?? definition.priority,
    };
    const fingerprint = categoryId
      ? signature({ ...native, categoryId, filter: native.filter ?? null })
      : null;
    if (existing || (fingerprint && fingerprints.has(fingerprint))) {
      result.rules.push({ ...display, status: "existing" });
      result.rulesExisting += 1;
      continue;
    }
    if (!(categoryId && fingerprint)) {
      result.rules.push({ ...display, status: "blocked" });
      continue;
    }
    plan.rules.push({
      ...native,
      categoryId,
      id,
      pack: { id: pack.id, key, version: pack.version },
      spaceId,
    });
    fingerprints.add(fingerprint);
    result.rules.push({ ...display, status: "create" });
    result.rulesCreated += 1;
  }
  return plan;
}

function resolveRuleImportCategory(input: {
  categories: readonly Category[];
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
