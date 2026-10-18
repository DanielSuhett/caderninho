import type {
  Classification,
  Periodicity,
  RecurrenceClassification,
  RecurrenceStrength,
} from "#domain/enums.ts";
import type { FinanceRecord } from "#domain/finance.types.ts";

export interface RecurrenceOptions {
  from: string;
  to: string;
  currency: string;
  limit?: number;
  offset?: number;
  asOfDay: string;
}

export interface EligibleRecurrenceRecord extends FinanceRecord {
  accountingDate: string;
  absoluteAmountMinor: string;
  accountId: string;
  currencyCode: string;
}

export interface Exclusion {
  reason: string;
  count: number;
  recordIds: string[];
  knownAmountMinor?: string;
}

export interface Cadence {
  periodicity: Periodicity;
  observedPattern: Periodicity;
  missingCycles: number;
  multipleChargesPerMonth: boolean;
  intervalDays: number[];
}

export interface Payee {
  source: string;
  value: string;
  normalized: string;
}

export interface RecurrenceGroup {
  name: Payee;
  rows: EligibleRecurrenceRecord[];
}

export interface SubscriptionCandidate {
  anchorRecordId: string;
  accountId: string;
  payee: { name: string; normalizedName: string; source: string };
  observedPattern: Periodicity;
  reasons: string[];
  warnings: string[];
  categories: string[];
  categoriesTruncated: boolean;
  firstChargeDate: string;
  lastChargeDate: string;
  cadence: {
    missingCycles: number;
    intervalDays: number[];
    intervalsTruncated: boolean;
  };
  currency: string;
  classification: RecurrenceClassification;
  confirmed: false;
  periodicity: Periodicity;
  recurrenceEvidenceStrength: RecurrenceStrength;
  occurrenceCount: number;
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
}

export interface RecurrenceResult {
  recordCount: number;
  candidates: SubscriptionCandidate[];
  candidateCount: number;
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
  pagination: { limit: number; offset: number; nextOffset: number | null };
  exclusions: (Exclusion & { referencesTruncated: boolean })[];
}
