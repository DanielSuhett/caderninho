import assert from "node:assert/strict";
import { test } from "node:test";

import { demoInvestments } from "../../fixtures/investments";
import {
  type InvestorPosition,
  institutionLogoUrl,
  investmentPortfolio,
  normalizeAccount,
  normalizeIssuer,
  ProviderAccountSchema,
} from "..";

test("portfolio separates currencies and excluded or redeemed positions", () => {
  const result = investmentPortfolio(demoInvestments);
  const brl = result.totals.find((row) => row.currency === "BRL");
  assert.equal(result.records.length, 10);
  assert.equal(brl?.count, 7);
  assert.equal(brl?.gross.totalMinor, "8560000");
  assert.equal(brl?.net.totalMinor, "8441000");
  assert.equal(brl?.byType.length, 4);
  const cdb = result.groups.find(
    (group) => group.subtype === "CDB" && group.currency === "BRL",
  );
  assert.equal(cdb?.count, 4);
  assert.equal(cdb?.recordIds.length, 5);
  assert.equal(cdb?.gross.totalMinor, "5354000");
  assert.deepEqual(
    cdb?.banks.map((bank) => bank.name),
    ["Nubank", "Itaú", "Corretora Horizonte"],
  );
  assert.equal(
    result.totals.find((row) => row.currency === "USD")?.net.totalMinor,
    null,
  );
  assert.equal(
    result.totals.find((row) => row.currency === "USD")?.gross.totalMinor,
    "125000",
  );
});
test("portfolio filters precede aggregates and absence never becomes zero or inferred return", () => {
  const result = investmentPortfolio(demoInvestments, {
    currency: "BRL",
    institutionId: "demo-broker",
    type: "ETF",
  });
  assert.equal(result.records.length, 1);
  const [row] = demoInvestments;
  assert.ok(row);
  const partial = investmentPortfolio([
    { ...row, amountMinor: null },
    { ...row, amountMinor: "900719925474099301", id: "large" },
  ]);
  assert.equal(partial.totals[0]?.gross.totalMinor, null);
  assert.equal(partial.totals[0]?.gross.knownMinor, "900719925474099301");
  assert.equal(partial.totals[0]?.gross.unknownCount, 1);
  assert.equal(
    investmentPortfolio(demoInvestments, { institutionId: "missing" }).totals
      .length,
    0,
  );
});
test("account brands and trusted institution images come from structured provider fields", () => {
  const source = ProviderAccountSchema.parse({
    creditData: {
      brand: "OTHER",
      brandAdditionalInfo: "ELO",
      creditLimit: "0",
    },
    currencyCode: "BRL",
    id: "a",
    itemId: "c",
    name: "Visa is only a nickname",
    type: "CREDIT",
  });
  const account = normalizeAccount(source, "c", {
    id: 201,
    imageUrl: "https://cdn.pluggy.ai/assets/connector-icons/201.svg",
    name: "Itaú",
  });
  assert.equal(account.identity?.cardBrand, "ELO");
  assert.equal(account.details?.creditLimitMinor, "0");
  assert.ok(account.identity?.institution?.logoUrl);
  assert.equal(institutionLogoUrl("https://example.com/logo.svg"), null);
  assert.equal(
    institutionLogoUrl(
      "https://cdn.pluggy.ai/assets/connector-icons/sandbox.svg",
    ),
    null,
  );
  assert.equal(
    institutionLogoUrl(
      "https://cdn.pluggy.ai/assets/connector-icons/201.svg?user=secret",
    ),
    null,
  );
  assert.equal(
    normalizeAccount({ ...source, creditData: null }, "c").identity?.cardBrand,
    null,
  );
});
function syntheticCdb(
  id: string,
  overrides: {
    amountMinor?: string | null;
    currency?: string;
    dueDate?: string;
    institution?: { id: string; logoUrl: string | null; name: string } | null;
    issuer?: string | null;
    personId?: string;
    rateType?: string;
    status?: string;
    subtype?: string;
  } = {},
): InvestorPosition {
  return {
    amountMinor:
      overrides.amountMinor === undefined ? "100000" : overrides.amountMinor,
    connectionId: "synthetic",
    currency: overrides.currency ?? "BRL",
    date: "2026-10-23",
    details: {
      annualRate: null,
      balanceMinor: "90000",
      code: null,
      dueDate: overrides.dueDate ?? "2027-01-10",
      financialTaxMinor: null,
      fixedAnnualRate: null,
      incomeTaxMinor: null,
      issuer: overrides.issuer ?? null,
      lastMonthRate: null,
      lastTwelveMonthsRate: null,
      originalMinor: null,
      purchaseDate: null,
      quantity: null,
      rate: null,
      rateType: overrides.rateType ?? "CDI",
      status: overrides.status ?? "ACTIVE",
      subtype: overrides.subtype ?? "CDB",
      withdrawalMinor: null,
    },
    id,
    identity: {
      cardBrand: null,
      institution:
        overrides.institution === undefined
          ? { id: "bank-a", logoUrl: null, name: "Banco Alfa" }
          : overrides.institution,
    },
    included: true,
    manual: false,
    name: "CDB sintético",
    ...(overrides.personId && { personId: overrides.personId }),
    spaceId: "personal",
    type: "FIXED_INCOME",
  };
}
test("certificates of one bank pile up into a single sorted group", () => {
  const result = investmentPortfolio([
    syntheticCdb("late", { dueDate: "2028-03-01" }),
    syntheticCdb("soon", { amountMinor: "250000", dueDate: "2026-12-01" }),
    syntheticCdb("mid", { dueDate: "2027-06-01", rateType: "PRE" }),
  ]);
  assert.equal(result.groups.length, 1);
  const [group] = result.groups;
  assert.equal(group?.subtype, "CDB");
  assert.equal(group?.count, 3);
  assert.equal(group?.gross.totalMinor, "450000");
  assert.equal(group?.net.totalMinor, "270000");
  assert.equal(group?.nearestDueDate, "2026-12-01");
  assert.equal(group?.furthestDueDate, "2028-03-01");
  assert.deepEqual(group?.rateTypes, ["CDI", "PRE"]);
  assert.deepEqual(group?.recordIds, ["soon", "mid", "late"]);
  assert.deepEqual(
    group?.banks.map((bank) => bank.name),
    ["Banco Alfa"],
  );
});
test("groups list every bank once, largest value first, and split other kinds and currencies", () => {
  const beta = { id: "bank-b", logoUrl: null, name: "Banco Beta" };
  const result = investmentPortfolio([
    syntheticCdb("a1", { amountMinor: "100000" }),
    syntheticCdb("b1", { amountMinor: "900000", institution: beta }),
    syntheticCdb("a2", { amountMinor: "100000" }),
    syntheticCdb("lci", { subtype: "LCI" }),
    syntheticCdb("usd", { currency: "USD" }),
  ]);
  assert.equal(result.groups.length, 3);
  const cdb = result.groups.find(
    (group) => group.subtype === "CDB" && group.currency === "BRL",
  );
  assert.deepEqual(
    cdb?.banks.map((bank) => bank.id),
    ["bank-b", "bank-a"],
  );
  assert.equal(cdb?.count, 3);
  assert.equal(cdb?.gross.totalMinor, "1100000");
  assert.equal(result.groups[0]?.id, cdb?.id);
});
test("redeemed and excluded positions are listed in the group but never summed", () => {
  const result = investmentPortfolio([
    syntheticCdb("open"),
    syntheticCdb("closed", { amountMinor: "0", status: "TOTAL_WITHDRAWAL" }),
    { ...syntheticCdb("hidden", { amountMinor: "700000" }), included: false },
  ]);
  const [group] = result.groups;
  assert.equal(group?.count, 1);
  assert.equal(group?.gross.totalMinor, "100000");
  assert.equal(group?.recordIds.length, 3);
  assert.equal(result.totals[0]?.gross.totalMinor, "100000");
});
test("a position without value keeps the known sum and counts as unknown", () => {
  const result = investmentPortfolio([
    syntheticCdb("known", { amountMinor: "300000" }),
    syntheticCdb("unknown", { amountMinor: null }),
  ]);
  const [group] = result.groups;
  assert.equal(group?.gross.totalMinor, null);
  assert.equal(group?.gross.knownMinor, "300000");
  assert.equal(group?.gross.unknownCount, 1);
  assert.equal(group?.count, 2);
});
test("the issuer names the bank only when the connection does not", () => {
  const result = investmentPortfolio([
    syntheticCdb("one", { institution: null, issuer: "BANCO GAMA S.A." }),
    syntheticCdb("two", { institution: null, issuer: "Banco Gama S/A" }),
    syntheticCdb("three", { institution: null }),
    syntheticCdb("four", {
      issuer: "Banco Delta S.A.",
    }),
  ]);
  const [group] = result.groups;
  assert.deepEqual(
    group?.banks.map((bank) => bank.name).sort(),
    ["Banco Alfa", "BANCO GAMA S.A.", "Instituição não informada"].sort(),
  );
  assert.equal(normalizeIssuer("Banco Gama S/A"), "BANCO GAMA");
  assert.equal(normalizeIssuer("  "), null);
});
test("filters and allocation totals are unchanged by grouping", () => {
  const result = investmentPortfolio(
    [
      syntheticCdb("a"),
      syntheticCdb("b"),
      syntheticCdb("c", { subtype: "LCI" }),
    ],
    { institutionId: "bank-a", type: "FIXED_INCOME" },
  );
  assert.equal(result.totals[0]?.byType.length, 1);
  assert.equal(result.totals[0]?.byInstitution.length, 1);
  assert.equal(result.totals[0]?.gross.totalMinor, "300000");
  assert.equal(result.groups.length, 2);
  assert.equal(
    investmentPortfolio([syntheticCdb("a")], { institutionId: "none" }).groups
      .length,
    0,
  );
});
test("certificates of different people never share a group", () => {
  const result = investmentPortfolio([
    syntheticCdb("ana-1", { personId: "ana" }),
    syntheticCdb("ana-2", { personId: "ana" }),
    syntheticCdb("beto-1", { personId: "beto" }),
  ]);
  assert.equal(result.groups.length, 2);
  assert.deepEqual(result.groups.map((group) => group.count).sort(), [1, 2]);
});
test("sweep balances under R$ 10 are not investments", () => {
  const result = investmentPortfolio([
    syntheticCdb("dust", { amountMinor: "999" }),
    syntheticCdb("real", { amountMinor: "1000" }),
  ]);
  assert.deepEqual(
    result.records.map((row) => row.id),
    ["real"],
  );
});
