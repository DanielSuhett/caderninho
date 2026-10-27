import type {
  PlanningTransaction,
  Rule,
  TransactionEdit,
} from "./planning.entity";
import { activeRules, ruleMatches } from "./rules.entity";

export const RULE_APPLICATION_LIMIT = 500;

export function categoryOverrides(
  edits: TransactionEdit[],
  preserveManual: boolean,
) {
  return new Map(
    edits.flatMap((edit) => {
      if (
        edit.category === undefined ||
        (preserveManual && !!edit.categoryRuleId)
      ) {
        return [];
      }
      return [[edit.id, edit.category] as const];
    }),
  );
}
type ApplicationRow = Pick<
  PlanningTransaction,
  | "id"
  | "accountId"
  | "amountMinor"
  | "currency"
  | "date"
  | "description"
  | "direction"
  | "personId"
  | "status"
  | "ignored"
  | "category"
>;
type ApplicationRule = Omit<Rule, "spaceId">;

export function ruleApplication(input: {
  row: ApplicationRow;
  rules: readonly ApplicationRule[];
  categoryOverride: string | null | undefined;
  preserveManual: boolean;
}) {
  const { row, rules, categoryOverride, preserveManual } = input;
  if (preserveManual && (row.ignored || categoryOverride !== undefined)) {
    return { preserved: true, rule: null };
  }
  const rule = rules.find((candidate) => ruleMatches(row, candidate));
  if (!rule || (rule.pack && categoryOverride !== undefined)) {
    return { preserved: categoryOverride !== undefined, rule: null };
  }
  return { preserved: false, rule };
}

// Manual-preserving applications examine the whole selection and write at most
// RULE_APPLICATION_LIMIT changes; applied rows stop differing, so repeating the
// call converges until `truncated` is false. Legacy applications examine at most
// RULE_APPLICATION_LIMIT rows.
export function planRuleApplication(input: {
  rows: ApplicationRow[];
  rules: ApplicationRule[];
  categoryOverrides: ReadonlyMap<string, string | null>;
  preserveManual: boolean;
}) {
  const rules = activeRules(input.rules);
  const assignments: { id: string; categoryId: string; ruleId: string }[] = [];
  const changes: { id: string; categoryId: string; ruleId: string }[] = [];
  const samples: {
    id: string;
    description: string;
    date: string;
    previousCategory: string | null;
    categoryId: string;
    ruleName: string;
  }[] = [];
  let examined = 0;
  let matched = 0;
  let preserved = 0;
  let truncated = false;
  for (const row of input.rows) {
    if (!input.preserveManual && examined >= RULE_APPLICATION_LIMIT) {
      truncated = true;
      break;
    }
    examined += 1;
    const decision = ruleApplication({
      categoryOverride: input.categoryOverrides.get(row.id),
      preserveManual: input.preserveManual,
      row,
      rules,
    });
    preserved += Number(decision.preserved);
    if (!decision.rule) {
      continue;
    }
    matched += 1;
    const change = {
      categoryId: decision.rule.categoryId,
      id: row.id,
      ruleId: decision.rule.id,
    };
    if (!input.preserveManual) {
      assignments.push(change);
    }
    if (row.category === decision.rule.categoryId) {
      continue;
    }
    if (changes.length >= RULE_APPLICATION_LIMIT) {
      truncated = true;
      continue;
    }
    changes.push(change);
    if (samples.length < 10) {
      samples.push({
        categoryId: decision.rule.categoryId,
        date: row.date,
        description: row.description,
        id: row.id,
        previousCategory: row.category,
        ruleName: decision.rule.name,
      });
    }
  }
  return {
    assignments,
    changed: changes.length,
    changes,
    examined,
    matched,
    preserved,
    samples,
    truncated,
  };
}
