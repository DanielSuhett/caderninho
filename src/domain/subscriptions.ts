import {
  FaultCode,
  Classification,
  TransactionType,
  TransactionStatus,
  Periodicity,
  RecurrenceClassification,
  RecurrenceStrength,
} from "#domain/enums.ts";
// Pure, versioned heuristics over normalized snapshot records. No API, LLM or writes.
import { day } from "#domain/exact.ts";
import { fail } from "#domain/fault.ts";
import type {
  RecurrenceResult,
  SubscriptionCandidate,
} from "#domain/outputs.ts";
import {
  EligibleRecurrenceRecordSchema,
  type FinanceRecord,
  type EligibleRecurrenceRecord,
  type RecurrenceGroup,
  type RecurrenceOptions,
  type Cadence,
  type Exclusion,
} from "#domain/schemas.ts";

export const SUBSCRIPTION_RULES = {
  algorithm: "recurrence_candidates_v1" as const,
  grouping:
    "accountId + currency + name source + NFKC/whitespace/case-normalized payee; no fuzzy matching or cross-account deduplication",
  patterns: [
    Periodicity.weekly,
    Periodicity.monthly,
    Periodicity.quarterly,
    Periodicity.annual,
    Periodicity.irregular,
    Periodicity.insufficient_history,
  ],
  minimumOccurrences: 3,
  annualMinimumOccurrences: 2,
  tolerances: {
    weeklyDays: 2,
    monthlyDays: 5,
    quarterlyDays: 7,
    annualDays: 10,
  },
  maxEvidencePerCandidate: 12,
  maxExclusionIds: 25,
  confirmation:
    "Candidates only; cadence strength is not probability of a subscription.",
};

const normalizeName = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

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

const dateIndex = (date: string) => Date.parse(date + "T00:00:00Z") / 86400000;

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

function cadence(rows: EligibleRecurrenceRecord[]): Cadence | null {
  const tolerances = SUBSCRIPTION_RULES.tolerances;

  const dates = rows.map((row) => row.accountingDate),
    months = new Set(dates.map((date) => date.slice(0, 7)));

  const pairs = dates.slice(1).map((date, i) => {
    const previous = dates[i];

    if (!previous) fail(FaultCode.INVALID_RESPONSE);

    return {
      days: dateIndex(date) - dateIndex(previous),
      months: monthIndex(date) - monthIndex(previous),
      dayDistance: distanceInMonth(previous, date),
    };
  });

  // A zero-day interval can be multiple plans or duplicated charges; never merge it into one contract.
  const multipleInMonth = months.size < dates.length;

  let pattern: Periodicity | null = null,
    missingCycles = 0;

  if (
    !multipleInMonth &&
    pairs.every(
      (p) => p.months === 12 && p.dayDistance <= tolerances.annualDays,
    )
  )
    pattern = Periodicity.annual;
  else if (
    !multipleInMonth &&
    pairs.every(
      (p) => p.months === 3 && p.dayDistance <= tolerances.quarterlyDays,
    )
  )
    pattern = Periodicity.quarterly;
  else if (
    !multipleInMonth &&
    pairs.some((p) => p.months === 1) &&
    pairs.every(
      (p) =>
        p.months >= 1 &&
        p.months <= 3 &&
        p.dayDistance <= tolerances.monthlyDays,
    )
  ) {
    pattern = Periodicity.monthly;
    missingCycles = pairs.reduce((n, p) => n + p.months - 1, 0);
  } else if (pairs.every((p) => Math.abs(p.days - 7) <= tolerances.weeklyDays))
    pattern = Periodicity.weekly;
  else if (rows.length >= 3 && months.size >= 3)
    pattern = Periodicity.irregular;

  if (!pattern) return null;

  const enough =
    rows.length >=
    (pattern === Periodicity.annual
      ? SUBSCRIPTION_RULES.annualMinimumOccurrences
      : SUBSCRIPTION_RULES.minimumOccurrences);

  return {
    periodicity: enough ? pattern : Periodicity.insufficient_history,
    observedPattern: pattern,
    missingCycles,
    multipleChargesPerMonth: multipleInMonth && pattern !== Periodicity.weekly,
    intervalDays: pairs.map((p) => p.days),
  };
}

function nameFor(row: FinanceRecord) {
  for (const source of ["merchant.name", "counterparty"]) {
    const value = row[source];

    if (typeof value === "string" && value.trim())
      return { source, value, normalized: normalizeName(value) };
  }

  return null; // Descriptions and numeric/name suffixes are never stripped to invent a payee.
}

function exclusionReason(row: FinanceRecord, asOfDay: string) {
  if (row.type !== TransactionType.DEBIT) return "credit_or_refund_not_netted";

  if (row.status !== TransactionStatus.POSTED) return "not_posted";

  try {
    day(row.accountingDate);
  } catch {
    return "missing_or_invalid_date";
  }

  if (row.accountingDate && row.accountingDate > asOfDay) return "future";

  if (row.classification && excludedClassifications.has(row.classification))
    return row.classification;

  // Providers may omit totalInstallments. installmentNumber alone is already a warning.
  const installment = row["creditCardMetadata.installmentNumber"],
    total = row["creditCardMetadata.totalInstallments"];

  if (
    (installment != null && Number(installment) > 0) ||
    (total != null && Number(total) > 1)
  )
    return "installment_metadata";

  if (
    typeof row.absoluteAmountMinor !== "string" ||
    !/^\d+$/.test(row.absoluteAmountMinor)
  )
    return "missing_or_invalid_amount";

  if (BigInt(row.absoluteAmountMinor) === 0n) return "zero_amount";

  if (!row.accountId) return "missing_account";

  if (!nameFor(row)) return "missing_payee";

  return null;
}

function candidate(
  group: RecurrenceGroup,
  pattern: Cadence,
): SubscriptionCandidate {
  const rows = [...group.rows].sort(
    (a, b) =>
      a.accountingDate.localeCompare(b.accountingDate) ||
      a.id.localeCompare(b.id),
  );

  const first = rows[0];

  if (!first) fail(FaultCode.INVALID_RESPONSE);

  const payee = nameFor(first);

  if (!payee) fail(FaultCode.INVALID_RESPONSE);

  const values = rows.map((row) => BigInt(row.absoluteAmountMinor)),
    sum = values.reduce((n, v) => n + v, 0n);

  const minimum = values.reduce((a, b) => (a < b ? a : b)),
    maximum = values.reduce((a, b) => (a > b ? a : b));

  const last = rows.at(-1);

  if (!last) fail(FaultCode.INVALID_RESPONSE);

  const categories = [
    ...new Set(
      rows
        .map((row) => row.category)
        .filter((value) => typeof value === "string"),
    ),
  ].sort();

  const purposeKnown = rows.every(
    (row) => row.classification === Classification.consumption_evidence,
  );

  const expenseCategory = categories.some((name) =>
    ordinaryExpenses.has(normalizeName(name)),
  );

  const classification = !purposeKnown
    ? RecurrenceClassification.recurring_payment
    : expenseCategory ||
        pattern.multipleChargesPerMonth ||
        pattern.observedPattern === Periodicity.irregular
      ? RecurrenceClassification.recurring_expense
      : RecurrenceClassification.possible_subscription;

  const reasons = [
    "repeated_payee_in_same_account",
    "calendar_or_interval_pattern_observed",
  ];

  const warnings = [
    "subscription_unconfirmed",
    "same_payee_can_represent_multiple_contracts",
  ];

  if (minimum !== maximum) reasons.push("amounts_vary");

  if (
    pattern.periodicity === Periodicity.insufficient_history ||
    (pattern.observedPattern === Periodicity.annual && rows.length === 2)
  )
    warnings.push("limited_occurrences");

  if (pattern.missingCycles)
    warnings.push("gaps_in_observed_cycles_not_proof_of_cancellation");

  if (pattern.multipleChargesPerMonth)
    warnings.push("multiple_charges_per_month");

  if (!purposeKnown)
    warnings.push("economic_purpose_uncertain_not_confirmed_spending");

  if (expenseCategory)
    warnings.push("category_suggests_ordinary_expense_but_can_be_inconsistent");

  if (categories.length > 1) warnings.push("category_changes");

  if (payee.source === "counterparty")
    warnings.push("counterparty_is_not_guaranteed_merchant_identity");

  const strength =
    pattern.periodicity === Periodicity.insufficient_history ||
    pattern.observedPattern === Periodicity.irregular ||
    pattern.missingCycles ||
    (pattern.observedPattern === Periodicity.annual && rows.length === 2)
      ? RecurrenceStrength.limited
      : rows.length >= 6
        ? RecurrenceStrength.strong
        : RecurrenceStrength.moderate;

  const byMonth: Record<string, string> = {};

  for (const row of rows) {
    const month = row.accountingDate.slice(0, 7);
    byMonth[month] = (
      BigInt(byMonth[month] ?? "0") + BigInt(row.absoluteAmountMinor)
    ).toString();
  }

  const sample = rows.slice(-SUBSCRIPTION_RULES.maxEvidencePerCandidate);

  return {
    anchorRecordId: first.id,
    accountId: first.accountId,
    currency: first.currencyCode,
    payee: {
      name: payee.value,
      normalizedName: payee.normalized,
      source: payee.source,
    },
    classification,
    confirmed: false,
    periodicity: pattern.periodicity,
    observedPattern: pattern.observedPattern,
    recurrenceEvidenceStrength: strength,
    reasons,
    warnings,
    categories: categories.slice(0, 5),
    categoriesTruncated: categories.length > 5,
    occurrenceCount: rows.length,
    firstChargeDate: first.accountingDate,
    lastChargeDate: last.accountingDate,
    amounts: {
      unit: "currency_minor",
      observedTotalMinor: sum.toString(),
      lastChargeMinor: last.absoluteAmountMinor,
      minimumMinor: minimum.toString(),
      maximumMinor: maximum.toString(),
      averageMinor: {
        numerator: sum.toString(),
        denominator: String(rows.length),
      },
      pattern: minimum === maximum ? "constant" : "variable",
      byMonth,
    },
    cadence: {
      missingCycles: pattern.missingCycles,
      intervalDays: pattern.intervalDays.slice(-12),
      intervalsTruncated: pattern.intervalDays.length > 12,
    },
    evidence: {
      recordIds: sample.map((row) => row.id),
      referencesTruncated: rows.length > sample.length,
      charges: sample.map((row) => ({
        id: row.id,
        date: row.accountingDate,
        amountMinor: row.absoluteAmountMinor,
        classification: row.classification,
      })),
    },
  };
}

export function detectSubscriptions(
  rows: FinanceRecord[],
  { from, to, currency, asOfDay, limit = 20, offset = 0 }: RecurrenceOptions,
): RecurrenceResult {
  const groups = new Map<string, RecurrenceGroup>(),
    exclusions = new Map<string, Exclusion>();

  const exclude = (row: FinanceRecord, reason: string) => {
    const item = exclusions.get(reason) ?? {
      reason,
      count: 0,
      knownAmountMinor: "0",
      recordIds: [],
    };

    item.count++;

    if (
      typeof row.absoluteAmountMinor === "string" &&
      /^\d+$/.test(row.absoluteAmountMinor)
    )
      item.knownAmountMinor = (
        BigInt(item.knownAmountMinor ?? "0") + BigInt(row.absoluteAmountMinor)
      ).toString();

    if (item.recordIds.length < SUBSCRIPTION_RULES.maxExclusionIds)
      item.recordIds.push(row.id);
    exclusions.set(reason, item);
  };

  for (const row of rows) {
    const reason = exclusionReason(row, asOfDay);

    if (reason) {
      exclude(row, reason);
      continue;
    }

    const name = nameFor(row);

    if (!name) {
      exclude(row, "missing_payee");
      continue;
    }

    const checked = EligibleRecurrenceRecordSchema.safeParse(row);

    if (!checked.success) {
      exclude(row, "missing_or_invalid_amount");
      continue;
    }

    const key = JSON.stringify([
      row.accountId,
      currency,
      name.source,
      name.normalized,
    ]);

    const group = groups.get(key) ?? { name, rows: [] };
    group.rows.push(checked.data);
    groups.set(key, group);
  }

  const candidates: SubscriptionCandidate[] = [];

  for (const group of groups.values()) {
    group.rows.sort(
      (a, b) =>
        a.accountingDate.localeCompare(b.accountingDate) ||
        a.id.localeCompare(b.id),
    );
    const pattern = group.rows.length >= 2 ? cadence(group.rows) : null;

    if (pattern) candidates.push(candidate(group, pattern));
    else for (const row of group.rows) exclude(row, "no_temporal_pattern");
  }

  candidates.sort((a, b) => {
    const x = BigInt(a.amounts.observedTotalMinor),
      y = BigInt(b.amounts.observedTotalMinor);

    return x > y
      ? -1
      : x < y
        ? 1
        : a.accountId.localeCompare(b.accountId) ||
          a.payee.normalizedName.localeCompare(b.payee.normalizedName) ||
          a.anchorRecordId.localeCompare(b.anchorRecordId);
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
    recordCount: rows.length,
    candidateCount: candidates.length,
    candidates: candidates.slice(offset, offset + limit),
    pagination: { limit, offset, nextOffset },
    analysis: {
      algorithm: SUBSCRIPTION_RULES.algorithm,
      asOfDay,
      historyDays,
      historyAssessment:
        historyDays < 90 ? "short_window" : "multi_month_window",
      outcome: candidates.length
        ? "candidates_found"
        : historyDays < 60
          ? Periodicity.insufficient_history
          : "no_candidates_in_snapshot",
      scannedAllFilteredRecords: true,
      groupCount: groups.size,
    },
    totals: {
      unit: "currency_minor",
      kind: "observed_candidate_debits_not_confirmed_subscription_spending",
      allCandidatesMinor: exactSum(
        candidates.map((c) => ({
          absoluteAmountMinor: c.amounts.observedTotalMinor,
        })),
      ),
      byClassification,
      byMonth,
      byClassificationMonth,
      scope: "all candidates before pagination",
      refundsNetted: false,
      currentMonthlyEstimateMinor: null,
    },
    exclusions: [...exclusions.values()].map((item) => ({
      ...item,
      referencesTruncated: item.count > item.recordIds.length,
    })),
  };
}
