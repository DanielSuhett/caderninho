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
export interface InvestmentSelection {
  currency?: string | undefined;
  institutionId?: string | undefined;
  status?: string | undefined;
  type?: string | undefined;
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
  const active = selected.filter(
    (row) => row.included && row.details?.status !== "TOTAL_WITHDRAWAL",
  );
  const currencies = [...new Set(active.map((row) => row.currency))].sort();
  const measure = (
    rows: InvestorPosition[],
    value: (row: InvestorPosition) => string | null | undefined,
  ) => {
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
  };
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
        dimension === "type" ? row.type : (institution?.id ?? "unknown");
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
