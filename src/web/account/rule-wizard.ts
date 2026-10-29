import type { WorkspaceCatalog } from "../../contracts";
import {
  documentDigits,
  RuleOperator,
  TransactionDirection,
  type TransactionIdentification,
  transactionCounterparty,
} from "../../domain";
import { randomId } from "../random-id";
import {
  type DraftAlternative,
  type DraftCondition,
  initialAlternatives,
  rulePresets,
} from "./rule-draft";
import { formatDocument } from "./rule-presentation";

type Rule = WorkspaceCatalog["rules"][number];

export const RuleJourney = {
  advanced: "advanced",
  counterparty: "counterparty",
  description: "description",
  preset: "preset",
} as const;
export type RuleJourney = (typeof RuleJourney)[keyof typeof RuleJourney];

export const RuleStep = {
  apply: "apply",
  category: "category",
  conditions: "conditions",
  start: "start",
} as const;
export type RuleStep = (typeof RuleStep)[keyof typeof RuleStep];

export const ruleStepLabels: Record<RuleStep, string> = {
  apply: "Salvar",
  category: "Categoria",
  conditions: "Condições",
  start: "Início",
};

export function ruleSteps(editing: boolean): RuleStep[] {
  const steps: RuleStep[] = [
    RuleStep.conditions,
    RuleStep.category,
    RuleStep.apply,
  ];
  return editing ? steps : [RuleStep.start, ...steps];
}

export const CounterpartyKey = {
  document: "document",
  name: "name",
} as const;
export type CounterpartyKey =
  (typeof CounterpartyKey)[keyof typeof CounterpartyKey];

export interface JourneyDraft {
  alternatives: DraftAlternative[];
  counterparty: { key: CounterpartyKey; document: string; name: string };
  // Simple journeys restrict to outgoing money unless the person opts out.
  debitOnly: boolean;
  description: { operator: string; text: string };
  journey: RuleJourney;
  preset: string;
}

export interface RuleSeed {
  accountId: string;
  category: string | null;
  currency: string;
  description: string;
  direction: string;
  identification?: TransactionIdentification | null | undefined;
}

const textOperators = new Set<string>([
  RuleOperator.contains,
  RuleOperator.equals,
  RuleOperator.starts_with,
]);
const debit = {
  field: "direction",
  operator: RuleOperator.equals,
  value: TransactionDirection.DEBIT,
};

function blankDraft(): JourneyDraft {
  return {
    alternatives: initialAlternatives(),
    counterparty: { document: "", key: CounterpartyKey.document, name: "" },
    debitOnly: true,
    description: { operator: RuleOperator.contains, text: "" },
    journey: RuleJourney.counterparty,
    preset: "",
  };
}

function seedDraft(seed: RuleSeed): JourneyDraft {
  const draft = blankDraft();
  const counterparty = transactionCounterparty(seed.identification);
  draft.debitOnly = seed.direction === TransactionDirection.DEBIT;
  draft.description = {
    operator:
      seed.description.length > 160
        ? RuleOperator.starts_with
        : RuleOperator.equals,
    text: seed.description.slice(0, 160),
  };
  draft.counterparty = {
    document: counterparty.document
      ? formatDocument(counterparty.document)
      : "",
    key: counterparty.document
      ? CounterpartyKey.document
      : CounterpartyKey.name,
    name: counterparty.name?.slice(0, 160) ?? "",
  };
  draft.journey =
    counterparty.document || counterparty.name
      ? RuleJourney.counterparty
      : RuleJourney.description;
  draft.alternatives = initialAlternatives(undefined, seed.description);
  return draft;
}

// Legacy scope fields apply to every alternative, so folding them into each
// one keeps the rule's behaviour and leaves a single shape to edit.
function foldedAlternatives(rule: Rule) {
  const scope = [
    ...(rule.accountId
      ? [condition("accountId", RuleOperator.equals, rule.accountId)]
      : []),
    ...(rule.direction
      ? [condition("direction", RuleOperator.equals, rule.direction)]
      : []),
    ...(rule.filter && rule.text
      ? [condition("description", RuleOperator.contains, rule.text)]
      : []),
  ];
  return initialAlternatives(rule).map((alternative) => ({
    ...alternative,
    conditions: [
      ...alternative.conditions,
      ...scope.map((c) => ({ ...c, id: randomId() })),
    ],
  }));
}

// Existing rules open in the simplest journey that represents them exactly.
function ruleDraft(rule: Rule): JourneyDraft {
  const draft = blankDraft();
  draft.alternatives = foldedAlternatives(rule);
  draft.journey = RuleJourney.advanced;
  const [alternative, ...others] = draft.alternatives;
  if (!alternative || others.length || rule.filter?.currency) {
    return draft;
  }
  const direction = alternative.conditions.filter(
    (c) => c.field === "direction",
  );
  const subjects = alternative.conditions.filter(
    (c) => c.field !== "direction",
  );
  const [subject] = subjects;
  if (
    !subject ||
    subjects.length > 1 ||
    direction.length > 1 ||
    direction.some((c) => c.value !== TransactionDirection.DEBIT)
  ) {
    return draft;
  }
  draft.debitOnly = direction.length === 1;
  if (subject.field === "receiverDocument") {
    draft.journey = RuleJourney.counterparty;
    draft.counterparty.document = formatDocument(subject.value);
    return draft;
  }
  if (
    subject.field === "receiverName" &&
    subject.operator === RuleOperator.contains
  ) {
    draft.journey = RuleJourney.counterparty;
    draft.counterparty = {
      ...draft.counterparty,
      key: CounterpartyKey.name,
      name: subject.value,
    };
    return draft;
  }
  if (subject.field === "description" && textOperators.has(subject.operator)) {
    draft.journey = RuleJourney.description;
    draft.description = { operator: subject.operator, text: subject.value };
  }
  return draft;
}

export function initialJourney(rule?: Rule, seed?: RuleSeed) {
  if (rule) {
    return ruleDraft(rule);
  }
  return seed ? seedDraft(seed) : blankDraft();
}

function condition(field: string, operator: string, value: string) {
  return { field, id: randomId(), operator, value } satisfies DraftCondition;
}

// Every journey ends as plain alternatives, the only shape the rule stores.
export function journeyAlternatives(draft: JourneyDraft): DraftAlternative[] {
  const direction = draft.debitOnly ? [{ ...debit, id: randomId() }] : [];
  if (draft.journey === RuleJourney.counterparty) {
    const subject =
      draft.counterparty.key === CounterpartyKey.document
        ? condition(
            "receiverDocument",
            RuleOperator.equals,
            documentDigits(draft.counterparty.document),
          )
        : condition(
            "receiverName",
            RuleOperator.contains,
            draft.counterparty.name.trim(),
          );
    return [{ conditions: [subject, ...direction], id: randomId() }];
  }
  if (draft.journey === RuleJourney.description) {
    return [
      {
        conditions: [
          condition(
            "description",
            draft.description.operator,
            draft.description.text.trim(),
          ),
          ...direction,
        ],
        id: randomId(),
      },
    ];
  }
  if (draft.journey === RuleJourney.preset) {
    const preset = rulePresets.find((p) => p.name === draft.preset);
    if (!preset) {
      return [
        {
          conditions: [condition("description", "contains", "")],
          id: randomId(),
        },
      ];
    }
    return preset.terms.map((term) => ({
      conditions: [
        condition("description", RuleOperator.contains, term),
        { ...preset.direction, id: randomId() },
      ],
      id: randomId(),
    }));
  }
  return draft.alternatives;
}

export function journeySubject(
  draft: JourneyDraft,
  sampleCounterparty: string | null,
) {
  if (draft.journey === RuleJourney.counterparty) {
    if (draft.counterparty.key === CounterpartyKey.name) {
      return draft.counterparty.name.trim();
    }
    return (
      sampleCounterparty ??
      formatDocument(documentDigits(draft.counterparty.document))
    );
  }
  if (draft.journey === RuleJourney.description) {
    return draft.description.text.trim();
  }
  return draft.journey === RuleJourney.preset ? draft.preset : "";
}
