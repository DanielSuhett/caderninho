import {
  Classification,
  FaultCode,
  Periodicity,
  RecurrenceClassification,
  RecurrenceStrength,
  TransactionStatus,
  TransactionType,
} from "./enums";
import { day, isMatureDate } from "./exact";
import { fail } from "./fault.entity";
import type { FinanceRecord } from "./finance.entity";

const whitespacePattern = /\s+/g;
const digitsPattern = /^\d+$/;

export interface RecurrenceOptions {
  asOfDay: string;
  currency: string;
  from: string;
  limit?: number;
  offset?: number;
  to: string;
}

export interface EligibleRecurrenceRecord extends FinanceRecord {
  absoluteAmountMinor: string;
  accountId: string;
  accountingDate: string;
  currencyCode: string;
}

export interface Exclusion {
  count: number;
  knownAmountMinor?: string;
  reason: string;
  recordIds: string[];
}

export interface Cadence {
  intervalDays: number[];
  missingCycles: number;
  multipleChargesPerMonth: boolean;
  observedPattern: Periodicity;
  periodicity: Periodicity;
}

export interface Payee {
  normalized: string;
  source: string;
  value: string;
}

export interface RecurrenceGroup {
  name: Payee;
  rows: EligibleRecurrenceRecord[];
}

export interface SubscriptionCandidate {
  accountId: string;
  amounts: {
    unit: "currency_minor";
    observedTotalMinor: string;
    lastChargeMinor: string;
    minimumMinor: string;
    maximumMinor: string;
    averageMinor: { numerator: string; denominator: string };
    pattern: "constant" | "variable";
    byMonth: Record<string, string>;
  };
  anchorRecordId: string;
  cadence: {
    missingCycles: number;
    intervalDays: number[];
    intervalsTruncated: boolean;
  };
  categories: string[];
  categoriesTruncated: boolean;
  classification: RecurrenceClassification;
  confirmed: false;
  currency: string;
  evidence: {
    recordIds: string[];
    referencesTruncated: boolean;
    charges: {
      id: string;
      date: string;
      amountMinor: string;
      classification?: Classification | undefined;
    }[];
  };
  firstChargeDate: string;
  lastChargeDate: string;
  observedPattern: Periodicity;
  occurrenceCount: number;
  payee: { name: string; normalizedName: string; source: string };
  periodicity: Periodicity;
  reasons: string[];
  recurrenceEvidenceStrength: RecurrenceStrength;
  warnings: string[];
}

export interface RecurrenceResult {
  analysis: {
    algorithm: "recurrence_candidates_v1";
    asOfDay: string;
    historyDays: number;
    historyAssessment: "short_window" | "multi_month_window";
    outcome:
      | "candidates_found"
      | "insufficient_history"
      | "no_candidates_in_snapshot"
      | "unavailable";
    scannedAllFilteredRecords: true;
    groupCount: number;
  };
  candidateCount: number;
  candidates: SubscriptionCandidate[];
  exclusions: (Exclusion & { referencesTruncated: boolean })[];
  pagination: { limit: number; offset: number; nextOffset: number | null };
  recordCount: number;
  totals: {
    unit: "currency_minor";
    kind: "observed_candidate_debits_not_confirmed_subscription_spending";
    allCandidatesMinor: string | null;
    byClassification: Record<RecurrenceClassification, string> | null;
    byMonth: Record<string, string> | null;
    byClassificationMonth: Record<
      RecurrenceClassification,
      Record<string, string>
    > | null;
    scope: "all candidates before pagination";
    refundsNetted: false;
    currentMonthlyEstimateMinor: null;
  };
}

// Pure, versioned heuristics over normalized snapshot records. No API, LLM or writes.

const SUBSCRIPTION_RULES = {
  algorithm: "recurrence_candidates_v1" as const,
  annualMinimumOccurrences: 2,
  confirmation:
    "Candidates only; cadence strength is not probability of a subscription.",
  grouping:
    "accountId + currency + name source + NFKC/whitespace/case-normalized payee; no fuzzy matching or cross-account deduplication",
  maxEvidencePerCandidate: 12,
  maxExclusionIds: 25,
  minimumOccurrences: 3,
  patterns: [
    Periodicity.weekly,
    Periodicity.monthly,
    Periodicity.quarterly,
    Periodicity.annual,
    Periodicity.irregular,
    Periodicity.insufficient_history,
  ],
  tolerances: {
    annualDays: 10,
    monthlyDays: 5,
    quarterlyDays: 7,
    weeklyDays: 2,
  },
};

const normalizeName = (name: string) =>
  name
    .normalize("NFKC")
    .trim()
    .replace(whitespacePattern, " ")
    .toLocaleLowerCase("pt-BR");

const ordinaryExpenses = new Set([
  "restaurants",
  "restaurantes",
  "groceries",
  "supermarkets",
  "supermercados",
  "fuel",
  "combustível",
  "rent",
  "aluguel",
  "electricity",
  "energia elétrica",
  "water",
  "água",
  "gas",
  "gás",
  "utilities",
  "insurance",
  "seguros",
  "taxes",
  "impostos",
]);

const excludedClassifications = new Set<Classification>([
  Classification.own_transfer,
  Classification.bill_payment,
  Classification.bill_payment_category,
  Classification.patrimonial_category,
  Classification.refund,
]);

const dateIndex = (date: string) =>
  Date.parse(`${date}T00:00:00Z`) / 86_400_000;

const monthIndex = (date: string) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;

const monthEnd = (date: string) =>
  Number(date.slice(8, 10)) ===
  new Date(
    Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0),
  ).getUTCDate();

const distanceInMonth = (a: string, b: string) =>
  monthEnd(a) && monthEnd(b)
    ? 0
    : Math.abs(Number(a.slice(8, 10)) - Number(b.slice(8, 10)));

const exactSum = (rows: { absoluteAmountMinor: string }[]) =>
  rows
    .reduce((total, row) => total + BigInt(row.absoluteAmountMinor), 0n)
    .toString();

interface CadenceEvidence {
  monthCount: number;
  multipleInMonth: boolean;
  occurrenceCount: number;
  pairs: { days: number; months: number; dayDistance: number }[];
}

// First match wins: regular patterns must take precedence over irregular history.
const cadencePatterns: {
  periodicity: Periodicity;
  minimumOccurrences: number;
  matches: (evidence: CadenceEvidence) => boolean;
}[] = [
  {
    matches: ({ pairs, multipleInMonth }) =>
      !multipleInMonth &&
      pairs.every(
        (p) =>
          p.months === 12 &&
          p.dayDistance <= SUBSCRIPTION_RULES.tolerances.annualDays,
      ),
    minimumOccurrences: SUBSCRIPTION_RULES.annualMinimumOccurrences,
    periodicity: Periodicity.annual,
  },
  {
    matches: ({ pairs, multipleInMonth }) =>
      !multipleInMonth &&
      pairs.every(
        (p) =>
          p.months === 3 &&
          p.dayDistance <= SUBSCRIPTION_RULES.tolerances.quarterlyDays,
      ),
    minimumOccurrences: SUBSCRIPTION_RULES.minimumOccurrences,
    periodicity: Periodicity.quarterly,
  },
  {
    matches: ({ pairs, multipleInMonth }) =>
      !multipleInMonth &&
      pairs.some((p) => p.months === 1) &&
      pairs.every(
        (p) =>
          p.months >= 1 &&
          p.months <= 3 &&
          p.dayDistance <= SUBSCRIPTION_RULES.tolerances.monthlyDays,
      ),
    minimumOccurrences: SUBSCRIPTION_RULES.minimumOccurrences,
    periodicity: Periodicity.monthly,
  },
  {
    matches: ({ pairs }) =>
      pairs.every(
        (p) => Math.abs(p.days - 7) <= SUBSCRIPTION_RULES.tolerances.weeklyDays,
      ),
    minimumOccurrences: SUBSCRIPTION_RULES.minimumOccurrences,
    periodicity: Periodicity.weekly,
  },
  {
    matches: ({ occurrenceCount, monthCount }) =>
      occurrenceCount >= 3 && monthCount >= 3,
    minimumOccurrences: SUBSCRIPTION_RULES.minimumOccurrences,
    periodicity: Periodicity.irregular,
  },
];

function cadence(rows: EligibleRecurrenceRecord[]): Cadence | null {
  const dates = rows.map((row) => row.accountingDate),
    months = new Set(dates.map((date) => date.slice(0, 7)));

  const pairs = dates.slice(1).map((date, i) => {
    const previous = dates[i];

    if (!previous) {
      fail(FaultCode.INVALID_RESPONSE);
    }

    return {
      dayDistance: distanceInMonth(previous, date),
      days: dateIndex(date) - dateIndex(previous),
      months: monthIndex(date) - monthIndex(previous),
    };
  });

  // A zero-day interval can be multiple plans or duplicated charges; never merge it into one contract.
  const multipleInMonth = months.size < dates.length;

  const evidence = {
    monthCount: months.size,
    multipleInMonth,
    occurrenceCount: rows.length,
    pairs,
  };
  const pattern = cadencePatterns.find((definition) =>
    definition.matches(evidence),
  );
  if (!pattern) {
    return null;
  }
  return {
    intervalDays: pairs.map((p) => p.days),
    missingCycles:
      pattern.periodicity === Periodicity.monthly
        ? pairs.reduce((n, p) => n + p.months - 1, 0)
        : 0,
    multipleChargesPerMonth:
      multipleInMonth && pattern.periodicity !== Periodicity.weekly,
    observedPattern: pattern.periodicity,
    periodicity:
      rows.length >= pattern.minimumOccurrences
        ? pattern.periodicity
        : Periodicity.insufficient_history,
  };
}

function nameFor(row: FinanceRecord) {
  for (const source of ["merchant.name", "counterparty"] as const) {
    const value = row[source];

    if (value?.trim()) {
      return { normalized: normalizeName(value), source, value };
    }
  }

  return null; // Descriptions and numeric/name suffixes are never stripped to invent a payee.
}

type RecurrenceEntry =
  | { reason: string }
  | { record: EligibleRecurrenceRecord; name: RecurrenceGroup["name"] };

function recurrenceEntry(
  row: FinanceRecord,
  asOfDay: string,
  dates: Map<FinanceRecord["accountingDate"], string | null>,
): RecurrenceEntry {
  if (row.type !== TransactionType.DEBIT) {
    return { reason: "credit_or_refund_not_netted" };
  }

  if (row.status !== TransactionStatus.POSTED) {
    return { reason: "not_posted" };
  }

  let accountingDate = dates.get(row.accountingDate);
  if (accountingDate === undefined) {
    try {
      accountingDate = day(row.accountingDate);
    } catch {
      accountingDate = null;
    }
    dates.set(row.accountingDate, accountingDate);
  }
  if (accountingDate === null) {
    return { reason: "missing_or_invalid_date" };
  }

  if (!isMatureDate({ date: accountingDate, referenceDay: asOfDay })) {
    return { reason: "future" };
  }

  if (row.classification && excludedClassifications.has(row.classification)) {
    return { reason: row.classification };
  }

  // Providers may omit totalInstallments. installmentNumber alone is already a warning.
  const installment = row["creditCardMetadata.installmentNumber"],
    total = row["creditCardMetadata.totalInstallments"];

  if (
    (installment !== null &&
      installment !== undefined &&
      Number(installment) > 0) ||
    (total !== null && total !== undefined && Number(total) > 1)
  ) {
    return { reason: "installment_metadata" };
  }

  const { absoluteAmountMinor } = row;
  if (
    absoluteAmountMinor === null ||
    absoluteAmountMinor === undefined ||
    !digitsPattern.test(absoluteAmountMinor)
  ) {
    return { reason: "missing_or_invalid_amount" };
  }

  if (BigInt(absoluteAmountMinor) === 0n) {
    return { reason: "zero_amount" };
  }

  if (!row.accountId) {
    return { reason: "missing_account" };
  }

  const name = nameFor(row);
  if (!name) {
    return { reason: "missing_payee" };
  }

  if (row.currencyCode === null || row.currencyCode === undefined) {
    return { reason: "missing_or_invalid_amount" };
  }
  return {
    name,
    record: {
      ...row,
      absoluteAmountMinor,
      accountId: row.accountId,
      accountingDate,
      currencyCode: row.currencyCode,
    },
  };
}

function candidate(
  group: RecurrenceGroup,
  pattern: Cadence,
): SubscriptionCandidate {
  const { rows } = group;

  const [first] = rows;

  if (!first) {
    fail(FaultCode.INVALID_RESPONSE);
  }

  const payee = nameFor(first);
  if (!payee) {
    fail(FaultCode.INVALID_RESPONSE);
  }

  const values = rows.map((row) => BigInt(row.absoluteAmountMinor)),
    sum = values.reduce((n, v) => n + v, 0n);

  const minimum = values.reduce((a, b) => (a < b ? a : b)),
    maximum = values.reduce((a, b) => (a > b ? a : b));

  const last = rows.at(-1);

  if (!last) {
    fail(FaultCode.INVALID_RESPONSE);
  }

  const categories = [
    ...new Set(
      rows
        .map((row) => row.category)
        .filter((value) => value !== null && value !== undefined),
    ),
  ].sort();

  const purposeKnown = rows.every(
    (row) => row.classification === Classification.consumption_evidence,
  );

  const expenseCategory = categories.some((name) =>
    ordinaryExpenses.has(normalizeName(name)),
  );

  const classification = recurrenceClassification(
    purposeKnown,
    expenseCategory,
    pattern,
  );

  const reasons = [
    "repeated_payee_in_same_account",
    "calendar_or_interval_pattern_observed",
  ];

  const warnings = [
    "subscription_unconfirmed",
    "same_payee_can_represent_multiple_contracts",
  ];

  if (minimum !== maximum) {
    reasons.push("amounts_vary");
  }

  if (
    pattern.periodicity === Periodicity.insufficient_history ||
    (pattern.observedPattern === Periodicity.annual && rows.length === 2)
  ) {
    warnings.push("limited_occurrences");
  }

  if (pattern.missingCycles) {
    warnings.push("gaps_in_observed_cycles_not_proof_of_cancellation");
  }

  if (pattern.multipleChargesPerMonth) {
    warnings.push("multiple_charges_per_month");
  }

  if (!purposeKnown) {
    warnings.push("economic_purpose_uncertain_not_confirmed_spending");
  }

  if (expenseCategory) {
    warnings.push("category_suggests_ordinary_expense_but_can_be_inconsistent");
  }

  if (categories.length > 1) {
    warnings.push("category_changes");
  }

  if (payee.source === "counterparty") {
    warnings.push("counterparty_is_not_guaranteed_merchant_identity");
  }

  const strength = recurrenceStrength(pattern, rows.length);

  const byMonth: Record<string, string> = {};

  for (const row of rows) {
    const month = row.accountingDate.slice(0, 7);
    byMonth[month] = (
      BigInt(byMonth[month] ?? "0") + BigInt(row.absoluteAmountMinor)
    ).toString();
  }

  const sample = rows.slice(-SUBSCRIPTION_RULES.maxEvidencePerCandidate);

  return {
    accountId: first.accountId,
    amounts: {
      averageMinor: {
        denominator: String(rows.length),
        numerator: sum.toString(),
      },
      byMonth,
      lastChargeMinor: last.absoluteAmountMinor,
      maximumMinor: maximum.toString(),
      minimumMinor: minimum.toString(),
      observedTotalMinor: sum.toString(),
      pattern: minimum === maximum ? "constant" : "variable",
      unit: "currency_minor",
    },
    anchorRecordId: first.id,
    cadence: {
      intervalDays: pattern.intervalDays.slice(-12),
      intervalsTruncated: pattern.intervalDays.length > 12,
      missingCycles: pattern.missingCycles,
    },
    categories: categories.slice(0, 5),
    categoriesTruncated: categories.length > 5,
    classification,
    confirmed: false,
    currency: first.currencyCode,
    evidence: {
      charges: sample.map((row) => ({
        amountMinor: row.absoluteAmountMinor,
        classification: row.classification,
        date: row.accountingDate,
        id: row.id,
      })),
      recordIds: sample.map((row) => row.id),
      referencesTruncated: rows.length > sample.length,
    },
    firstChargeDate: first.accountingDate,
    lastChargeDate: last.accountingDate,
    observedPattern: pattern.observedPattern,
    occurrenceCount: rows.length,
    payee: {
      name: payee.value,
      normalizedName: payee.normalized,
      source: payee.source,
    },
    periodicity: pattern.periodicity,
    reasons,
    recurrenceEvidenceStrength: strength,
    warnings,
  };
}

export function detectSubscriptions(
  rows: FinanceRecord[],
  { from, to, currency, asOfDay, limit = 20, offset = 0 }: RecurrenceOptions,
): RecurrenceResult {
  const exclusions = new Map<string, Exclusion>();

  const exclude = (row: FinanceRecord, reason: string) => {
    const item = exclusions.get(reason) ?? {
      count: 0,
      knownAmountMinor: "0",
      reason,
      recordIds: [],
    };

    item.count += 1;

    if (
      row.absoluteAmountMinor !== null &&
      row.absoluteAmountMinor !== undefined &&
      digitsPattern.test(row.absoluteAmountMinor)
    ) {
      item.knownAmountMinor = (
        BigInt(item.knownAmountMinor ?? "0") + BigInt(row.absoluteAmountMinor)
      ).toString();
    }

    if (item.recordIds.length < SUBSCRIPTION_RULES.maxExclusionIds) {
      item.recordIds.push(row.id);
    }
    exclusions.set(reason, item);
  };

  const groups = collectRecurrenceGroups({ asOfDay, currency, exclude, rows });

  const candidates: SubscriptionCandidate[] = [];

  for (const group of groups.values()) {
    group.rows.sort(
      (a, b) =>
        a.accountingDate.localeCompare(b.accountingDate) ||
        a.id.localeCompare(b.id),
    );
    const pattern = group.rows.length >= 2 ? cadence(group.rows) : null;

    if (pattern) {
      candidates.push(candidate(group, pattern));
    } else {
      for (const row of group.rows) {
        exclude(row, "no_temporal_pattern");
      }
    }
  }

  candidates.sort((a, b) => {
    const x = BigInt(a.amounts.observedTotalMinor),
      y = BigInt(b.amounts.observedTotalMinor);

    if (x > y) {
      return -1;
    }

    if (x < y) {
      return 1;
    }

    return (
      a.accountId.localeCompare(b.accountId) ||
      a.payee.normalizedName.localeCompare(b.payee.normalizedName) ||
      a.anchorRecordId.localeCompare(b.anchorRecordId)
    );
  });

  const byClassification = {
      possible_subscription: "0",
      recurring_expense: "0",
      recurring_payment: "0",
    },
    byMonth: Record<string, string> = {};

  const byClassificationMonth: Record<
    RecurrenceClassification,
    Record<string, string>
  > = {
    possible_subscription: {},
    recurring_expense: {},
    recurring_payment: {},
  };

  for (const item of candidates) {
    byClassification[item.classification] = (
      BigInt(byClassification[item.classification]) +
      BigInt(item.amounts.observedTotalMinor)
    ).toString();

    for (const [month, value] of Object.entries(item.amounts.byMonth)) {
      byMonth[month] = (
        BigInt(byMonth[month] ?? "0") + BigInt(value)
      ).toString();
      const classified = byClassificationMonth[item.classification];
      classified[month] = (
        BigInt(classified[month] ?? "0") + BigInt(value)
      ).toString();
    }
  }

  const nextOffset = offset + limit < candidates.length ? offset + limit : null,
    historyDays = dateIndex(to) - dateIndex(from) + 1;

  return {
    analysis: {
      algorithm: SUBSCRIPTION_RULES.algorithm,
      asOfDay,
      groupCount: groups.size,
      historyAssessment:
        historyDays < 90 ? "short_window" : "multi_month_window",
      historyDays,
      outcome: recurrenceOutcome(candidates.length, historyDays),
      scannedAllFilteredRecords: true,
    },
    candidateCount: candidates.length,
    candidates: candidates.slice(offset, offset + limit),
    exclusions: [...exclusions.values()].map((item) => ({
      ...item,
      referencesTruncated: item.count > item.recordIds.length,
    })),
    pagination: { limit, nextOffset, offset },
    recordCount: rows.length,
    totals: {
      allCandidatesMinor: exactSum(
        candidates.map((c) => ({
          absoluteAmountMinor: c.amounts.observedTotalMinor,
        })),
      ),
      byClassification,
      byClassificationMonth,
      byMonth,
      currentMonthlyEstimateMinor: null,
      kind: "observed_candidate_debits_not_confirmed_subscription_spending",
      refundsNetted: false,
      scope: "all candidates before pagination",
      unit: "currency_minor",
    },
  };
}

function recurrenceClassification(
  purposeKnown: boolean,
  expenseCategory: boolean,
  pattern: Cadence,
) {
  if (!purposeKnown) {
    return RecurrenceClassification.recurring_payment;
  }

  if (
    expenseCategory ||
    pattern.multipleChargesPerMonth ||
    pattern.observedPattern === Periodicity.irregular
  ) {
    return RecurrenceClassification.recurring_expense;
  }

  return RecurrenceClassification.possible_subscription;
}

function recurrenceStrength(pattern: Cadence, occurrences: number) {
  if (
    pattern.periodicity === Periodicity.insufficient_history ||
    pattern.observedPattern === Periodicity.irregular ||
    pattern.missingCycles ||
    (pattern.observedPattern === Periodicity.annual && occurrences === 2)
  ) {
    return RecurrenceStrength.limited;
  }

  return occurrences >= 6
    ? RecurrenceStrength.strong
    : RecurrenceStrength.moderate;
}

function recurrenceOutcome(count: number, historyDays: number) {
  if (count) {
    return "candidates_found";
  }

  if (historyDays < 60) {
    return Periodicity.insufficient_history;
  }

  return "no_candidates_in_snapshot";
}

function collectRecurrenceGroups({
  rows,
  currency,
  asOfDay,
  exclude,
}: Pick<RecurrenceOptions, "currency" | "asOfDay"> & {
  rows: FinanceRecord[];
  exclude: (row: FinanceRecord, reason: string) => void;
}) {
  const groups = new Map<string, RecurrenceGroup>();
  const dates = new Map<FinanceRecord["accountingDate"], string | null>();
  for (const row of rows) {
    const entry = recurrenceEntry(row, asOfDay, dates);
    if ("reason" in entry) {
      exclude(row, entry.reason);
      continue;
    }
    const { record, name } = entry;
    const key = JSON.stringify([
      record.accountId,
      currency,
      name.source,
      name.normalized,
    ]);
    const group = groups.get(key) ?? { name, rows: [] };
    group.rows.push(record);
    groups.set(key, group);
  }
  return groups;
}
