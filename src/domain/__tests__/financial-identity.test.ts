import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cardBrandKey,
  connectorInstitution,
  detectInstitution,
  financialIdentity,
  matchesFinancialIdentity,
} from "../financial-identity.entity";

test("identity filters use exact institutions and canonical card brands without guessing missing metadata", () => {
  const identity = {
    cardBrand: "American Express",
    institution: { id: "bank-a", logoUrl: null, name: "Banco" },
  };
  assert.equal(cardBrandKey("amex"), "AMERICANEXPRESS");
  assert.equal(cardBrandKey("Diners Club"), "DINERS");
  assert.equal(matchesFinancialIdentity(identity, { cardBrand: "AMEX" }), true);
  assert.equal(
    matchesFinancialIdentity(identity, {
      cardBrand: "american_express",
      institutionId: "bank-a",
    }),
    true,
  );
  assert.equal(
    matchesFinancialIdentity(identity, {
      cardBrand: "AMEX",
      institutionId: "bank-b",
    }),
    false,
  );
  assert.equal(matchesFinancialIdentity(undefined, {}), true);
  assert.equal(
    matchesFinancialIdentity(undefined, { cardBrand: "VISA" }),
    false,
  );
  assert.equal(
    matchesFinancialIdentity(undefined, { institutionId: "bank-a" }),
    false,
  );
  assert.equal(
    matchesFinancialIdentity(
      { cardBrand: null, institution: null },
      { cardBrand: "--" },
    ),
    false,
  );
});

test("proxy credentials never masquerade as a bank; a connection association preserves card metadata", () => {
  const proxy = {
    id: 200,
    imageUrl: "https://cdn.pluggy.ai/assets/connector-icons/200.svg",
    name: "Meu Pluggy",
  };
  assert.equal(connectorInstitution(proxy), null);
  const bank = connectorInstitution({
    id: 201,
    imageUrl: "https://cdn.pluggy.ai/assets/connector-icons/201.svg",
    name: "Banco sintético",
  });
  assert.ok(bank);
  const legacy = {
    cardBrand: "Mastercard",
    institution: { id: "200", logoUrl: proxy.imageUrl, name: "Meu Pluggy" },
  };
  assert.deepEqual(financialIdentity({ identity: legacy }), {
    cardBrand: "Mastercard",
    institution: null,
  });
  assert.deepEqual(financialIdentity({ identity: legacy, institution: bank }), {
    cardBrand: "Mastercard",
    institution: bank,
  });
  assert.equal(
    connectorInstitution({
      id: 202,
      imageUrl: "https://other.example/bank.svg",
    })?.logoUrl,
    null,
  );
});

const logo = (name: string) =>
  `https://cdn.pluggy.ai/assets/connector-icons/${name}.svg`;
const catalog = [
  { id: "1", logoUrl: logo("btg"), name: "BTG Pactual" },
  { id: "2", logoUrl: logo("btg"), name: "BTG Pactual Empresas" },
  { id: "3", logoUrl: logo("nubank"), name: "Nubank" },
  { id: "4", logoUrl: logo("itau"), name: "Itaú" },
  { id: "5", logoUrl: logo("itau"), name: "Itaú Empresas" },
  { id: "6", logoUrl: logo("inter"), name: "Banco Inter" },
  { id: "7", logoUrl: logo("bb"), name: "Banco do Brasil" },
  { id: "8", logoUrl: logo("santander"), name: "Banco Santander" },
  { id: "9", logoUrl: logo("black"), name: "Black Bank" },
];

test("bank detection reads provider names against the connector catalog", () => {
  assert.deepEqual(
    detectInstitution({
      catalog,
      evidence: ["BTG Banking", "BTG Investimentos", "Cartão BTG BLACK"],
    }),
    catalog[0],
  );
  assert.deepEqual(
    detectInstitution({ catalog, evidence: ["Conta Itaú Personnalité"] }),
    catalog[3],
  );
  assert.deepEqual(
    detectInstitution({ catalog, evidence: ["BANCO BTG PACTUAL S.A."] }),
    catalog[0],
  );
});

test("bank detection stays unknown without distinctive or consistent evidence", () => {
  assert.equal(
    detectInstitution({ catalog, evidence: ["Conta Corrente", "Banco"] }),
    null,
  );
  assert.equal(
    detectInstitution({ catalog, evidence: ["Nubank", "Itaú"] }),
    null,
  );
  assert.equal(detectInstitution({ catalog: [], evidence: ["BTG"] }), null);
});
