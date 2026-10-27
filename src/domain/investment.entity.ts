import type { Investment } from "./planning.entity";

export interface InvestmentDetails {
  annualRate: string | null;
  balanceMinor: string | null;
  code: string | null;
  dueDate: string | null;
  financialTaxMinor: string | null;
  fixedAnnualRate: string | null;
  incomeTaxMinor: string | null;
  issuer: string | null;
  lastMonthRate: string | null;
  lastTwelveMonthsRate: string | null;
  originalMinor: string | null;
  profitMinor: string | null;
  purchaseDate: string | null;
  quantity: string | null;
  rate: string | null;
  rateType: string | null;
  status: string | null;
  subtype: string | null;
  withdrawalMinor: string | null;
}
export type InvestorPosition = Investment;
export interface PositionBank {
  id: string;
  logoUrl: string | null;
  name: string;
}
export const UNKNOWN_BANK_ID = "unknown";
const accents = /[\u0300-\u036f]/g;
const issuerSuffix = /\s+S\.?\s?\/?A\.?$/;
const issuerNoise = /[^A-Z0-9 ]+/g;
const spaces = /\s+/g;
// The connection names the bank. When it only names the generic connector,
// the issuer reported on the position is the best evidence left.
export function normalizeIssuer(issuer: string | null | undefined) {
  const cleaned = (issuer ?? "")
    .normalize("NFD")
    .replace(accents, "")
    .toUpperCase()
    .trim()
    .replace(issuerSuffix, "")
    .replace(issuerNoise, " ")
    .replace(spaces, " ")
    .trim();
  return cleaned || null;
}
export function positionBank(row: InvestorPosition): PositionBank {
  const institution = row.identity?.institution;
  if (institution) {
    return {
      id: institution.id,
      logoUrl: institution.logoUrl ?? null,
      name: institution.name,
    };
  }
  const issuer = normalizeIssuer(row.details?.issuer);
  if (issuer) {
    return {
      id: `issuer:${issuer}`,
      logoUrl: null,
      name: row.details?.issuer?.trim() ?? issuer,
    };
  }
  return {
    id: UNKNOWN_BANK_ID,
    logoUrl: null,
    name: "Instituição não informada",
  };
}
export interface InvestmentSelection {
  currency?: string | undefined;
  institutionId?: string | undefined;
  status?: string | undefined;
  type?: string | undefined;
}
function measure(
  rows: InvestorPosition[],
  value: (row: InvestorPosition) => string | null | undefined,
) {
  let known = 0n;
  let unknownCount = 0;
  for (const row of rows) {
    const amount = value(row);
    if (amount === null || amount === undefined) {
      unknownCount += 1;
    } else {
      known += BigInt(amount);
    }
  }
  return {
    knownMinor: known.toString(),
    totalMinor: unknownCount ? null : known.toString(),
    unknownCount,
  };
}
function isActive(row: InvestorPosition) {
  return row.included && row.details?.status !== "TOTAL_WITHDRAWAL";
}
function knownAmount(row: InvestorPosition) {
  return row.amountMinor === null ? 0n : BigInt(row.amountMinor);
}
function descending(left: bigint, right: bigint) {
  if (left === right) {
    return 0;
  }
  return left > right ? -1 : 1;
}
function dueDateOrder(left: InvestorPosition, right: InvestorPosition) {
  const first = left.details?.dueDate;
  const second = right.details?.dueDate;
  if (first === second) {
    return 0;
  }
  if (!first) {
    return 1;
  }
  if (!second) {
    return -1;
  }
  return first < second ? -1 : 1;
}
// Positions of one kind pile up into a single row: the user holds "CDB", not
// each certificate. Only active positions are summed, but redeemed and excluded
// ones stay listed so the drilldown still shows them.
function positionGroups(rows: InvestorPosition[]) {
  const groups = new Map<string, InvestorPosition[]>();
  for (const row of rows) {
    const key = [row.currency, row.type, row.details?.subtype ?? ""].join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([id, members]) => {
      const [first] = members;
      const active = members.filter(isActive);
      const weights = new Map<string, { bank: PositionBank; weight: bigint }>();
      for (const row of members) {
        const bank = positionBank(row);
        const entry = weights.get(bank.id) ?? { bank, weight: 0n };
        entry.weight += isActive(row) ? knownAmount(row) : 0n;
        weights.set(bank.id, entry);
      }
      const due = active
        .map((row) => row.details?.dueDate)
        .filter((date): date is string => !!date)
        .sort();
      return {
        banks: [...weights.values()]
          .sort(
            (left, right) =>
              descending(left.weight, right.weight) ||
              left.bank.name.localeCompare(right.bank.name),
          )
          .map((entry) => entry.bank),
        count: active.length,
        currency: first?.currency ?? "",
        furthestDueDate: due.at(-1) ?? null,
        gross: measure(active, (row) => row.amountMinor),
        id,
        nearestDueDate: due[0] ?? null,
        net: measure(active, (row) => row.details?.balanceMinor),
        profit: measure(active, (row) => row.details?.profitMinor),
        rateTypes: [
          ...new Set(
            active
              .map((row) => row.details?.rateType)
              .filter((rateType): rateType is string => !!rateType),
          ),
        ].sort(),
        recordIds: [...members].sort(dueDateOrder).map((row) => row.id),
        subtype: first?.details?.subtype ?? null,
        type: first?.type ?? "",
        withdrawal: measure(active, (row) => row.details?.withdrawalMinor),
      };
    })
    .sort(
      (left, right) =>
        descending(
          BigInt(left.gross.knownMinor),
          BigInt(right.gross.knownMinor),
        ) || left.id.localeCompare(right.id),
    );
}
export function investmentPortfolio(
  records: InvestorPosition[],
  selection: InvestmentSelection = {},
) {
  const selected = records.filter(
    (row) =>
      (!selection.currency || row.currency === selection.currency) &&
      (!selection.type || row.type === selection.type) &&
      (!selection.institutionId ||
        row.identity?.institution?.id === selection.institutionId) &&
      (!selection.status || row.details?.status === selection.status),
  );
  const active = selected.filter(isActive);
  const currencies = [...new Set(active.map((row) => row.currency))].sort();
  const allocation = (
    rows: InvestorPosition[],
    dimension: "type" | "institution",
  ) => {
    const groups = new Map<
      string,
      { id: string; name: string; rows: InvestorPosition[] }
    >();
    for (const row of rows) {
      const institution = row.identity?.institution;
      const id =
        dimension === "type" ? row.type : (institution?.id ?? UNKNOWN_BANK_ID);
      const name =
        dimension === "type"
          ? row.type
          : (institution?.name ?? "Instituição não informada");
      const group = groups.get(id) ?? { id, name, rows: [] };
      group.rows.push(row);
      groups.set(id, group);
    }
    return [...groups.values()].map((group) => ({
      id: group.id,
      name: group.name,
      ...measure(group.rows, (row) => row.amountMinor),
    }));
  };
  return {
    groups: positionGroups(selected),
    records: selected,
    totals: currencies.map((currency) => {
      const rows = active.filter((row) => row.currency === currency);
      return {
        byInstitution: allocation(rows, "institution"),
        byType: allocation(rows, "type"),
        count: rows.length,
        currency,
        gross: measure(rows, (row) => row.amountMinor),
        net: measure(rows, (row) => row.details?.balanceMinor),
        original: measure(rows, (row) => row.details?.originalMinor),
        profit: measure(rows, (row) => row.details?.profitMinor),
        withdrawal: measure(rows, (row) => row.details?.withdrawalMinor),
      };
    }),
  };
}
