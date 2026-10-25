import assert from "node:assert/strict";
import { test } from "node:test";

import { demoInvestments } from "../../fixtures/investments";
import {
  institutionLogoUrl,
  investmentPortfolio,
  normalizeAccount,
  ProviderAccountSchema,
} from "..";

test("portfolio separates currencies, reported profit and excluded or redeemed positions", () => {
  const result = investmentPortfolio(demoInvestments);
  const brl = result.totals.find((row) => row.currency === "BRL");
  assert.equal(result.records.length, 7);
  assert.equal(brl?.count, 4);
  assert.equal(brl?.gross.totalMinor, "6060000");
  assert.equal(brl?.net.totalMinor, "5976000");
  assert.equal(brl?.profit.totalMinor, "446000");
  assert.equal(brl?.byType.length, 4);
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
  assert.equal(result.totals[0]?.profit.totalMinor, "-60000");
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
