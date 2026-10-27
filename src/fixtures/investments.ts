import type { InvestmentDetails, InvestorPosition } from "../domain";

const details: InvestmentDetails = {
  annualRate: null,
  balanceMinor: null,
  code: null,
  dueDate: null,
  financialTaxMinor: null,
  fixedAnnualRate: null,
  incomeTaxMinor: null,
  issuer: null,
  lastMonthRate: null,
  lastTwelveMonthsRate: null,
  originalMinor: null,
  profitMinor: null,
  purchaseDate: "2025-10-20",
  quantity: null,
  rate: null,
  rateType: null,
  status: "ACTIVE",
  subtype: null,
  withdrawalMinor: null,
};
const institutions = [
  {
    id: "201",
    logoUrl: "https://cdn.pluggy.ai/assets/connector-icons/201.svg",
    name: "Itaú",
  },
  { id: "demo-broker", logoUrl: null, name: "Corretora Horizonte" },
];
function position(input: {
  id: string;
  name: string;
  type: string;
  amountMinor: string | null;
  personId?: string;
  currency?: string;
  details?: Partial<InvestmentDetails>;
  broker?: boolean;
  included?: boolean;
}): InvestorPosition {
  return {
    amountMinor: input.amountMinor,
    connectionId: "demo-investor",
    currency: input.currency ?? "BRL",
    date: "2026-10-23",
    details: { ...details, ...input.details },
    id: input.id,
    identity: {
      cardBrand: null,
      institution: institutions[input.broker ? 1 : 0] ?? null,
    },
    included: input.included ?? true,
    manual: false,
    name: input.name,
    personId: input.personId ?? "demo-person",
    spaceId: "personal",
    type: input.type,
  };
}
export const demoInvestments: InvestorPosition[] = [
  position({
    amountMinor: "2854000",
    details: {
      balanceMinor: "2800000",
      dueDate: "2027-10-20",
      financialTaxMinor: "0",
      incomeTaxMinor: "54000",
      issuer: "Itaú",
      originalMinor: "2500000",
      profitMinor: "300000",
      rate: "102",
      rateType: "CDI",
      subtype: "CDB",
      withdrawalMinor: "2800000",
    },
    id: "cdb",
    name: "CDB liquidez diária",
    type: "FIXED_INCOME",
  }),
  position({
    amountMinor: "1200000",
    details: {
      balanceMinor: "1180000",
      dueDate: "2028-04-15",
      financialTaxMinor: "0",
      incomeTaxMinor: "20000",
      issuer: "Itaú",
      originalMinor: "1100000",
      profitMinor: "100000",
      rate: "11.8",
      rateType: "PRE",
      subtype: "CDB",
      withdrawalMinor: null,
    },
    id: "cdb-prefixado",
    name: "CDB prefixado 2028",
    type: "FIXED_INCOME",
  }),
  position({
    amountMinor: "800000",
    details: {
      balanceMinor: "790000",
      dueDate: "2029-08-10",
      financialTaxMinor: "0",
      incomeTaxMinor: "10000",
      issuer: "Itaú",
      originalMinor: "740000",
      profitMinor: "60000",
      rate: "6.2",
      rateType: "IPCA",
      subtype: "CDB",
      withdrawalMinor: null,
    },
    id: "cdb-ipca",
    name: "CDB IPCA+ 2029",
    type: "FIXED_INCOME",
  }),
  position({
    amountMinor: "500000",
    broker: true,
    details: {
      balanceMinor: "495000",
      dueDate: "2027-03-01",
      financialTaxMinor: "0",
      incomeTaxMinor: "5000",
      issuer: "Corretora Horizonte",
      originalMinor: "480000",
      profitMinor: "20000",
      rate: "110",
      rateType: "CDI",
      subtype: "CDB",
      withdrawalMinor: "495000",
    },
    id: "cdb-horizonte",
    name: "CDB Horizonte 110% CDI",
    type: "FIXED_INCOME",
  }),
  position({
    amountMinor: "1830000",
    details: {
      balanceMinor: "1800000",
      lastMonthRate: "0.92",
      lastTwelveMonthsRate: "11.4",
      originalMinor: "1650000",
      profitMinor: "150000",
      subtype: "FIXED_INCOME_FUND",
      withdrawalMinor: "1800000",
    },
    id: "fund",
    name: "Fundo de renda fixa",
    personId: "demo-person-2",
    type: "MUTUAL_FUND",
  }),
  position({
    amountMinor: "920000",
    broker: true,
    details: {
      balanceMinor: "920000",
      code: "BOVA11",
      originalMinor: "980000",
      profitMinor: "-60000",
      quantity: "80",
      withdrawalMinor: "920000",
    },
    id: "etf",
    name: "BOVA11",
    type: "ETF",
  }),
  position({
    amountMinor: "456000",
    broker: true,
    details: {
      balanceMinor: "456000",
      code: "ITUB4",
      originalMinor: "400000",
      profitMinor: "56000",
      quantity: "120",
      withdrawalMinor: "456000",
    },
    id: "equity",
    name: "ITUB4",
    personId: "demo-person-2",
    type: "EQUITY",
  }),
  position({
    amountMinor: "125000",
    broker: true,
    currency: "USD",
    id: "usd-etf",
    name: "ETF internacional",
    type: "ETF",
  }),
  position({
    amountMinor: "0",
    details: { balanceMinor: "0", status: "TOTAL_WITHDRAWAL", subtype: "CDB" },
    id: "closed",
    name: "CDB resgatado",
    type: "FIXED_INCOME",
  }),
  position({
    amountMinor: "800000",
    id: "excluded",
    included: false,
    name: "Previdência separada",
    type: "SECURITY",
  }),
];
