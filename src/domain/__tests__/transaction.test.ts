import assert from "node:assert/strict";
import test from "node:test";

import {
  transactionIdentification,
  transactionIdentificationInput,
} from "../../fixtures/transaction-identification";
import {
  compactTransaction,
  normalizeAccount,
  normalizeTransaction,
  ProviderTransactionSchema,
  TransactionIdentificationSchema,
  transactionMatchesText,
} from "..";

const bank = normalizeAccount(
  {
    balance: "9007199254740993.01",
    currencyCode: "BRL",
    id: "a",
    itemId: "c",
    name: "Synthetic",
    type: "BANK",
  },
  "c",
);
test("account and transaction keep exact money and the provider calendar day", () => {
  assert.equal(bank.balanceMinor, "900719925474099301");
  const tx = normalizeTransaction(
    {
      accountId: "a",
      amount: "-9007199254740993.01",
      currencyCode: "BRL",
      date: "2026-10-01T00:00:00.000Z",
      description: "Synthetic",
      id: "t",
      status: "POSTED",
      type: "DEBIT",
    },
    bank.id,
  );
  assert.equal(tx.amountMinor, "-900719925474099301");
  assert.equal(tx.date, "2026-10-01");
  assert.equal(tx.identification?.date, "2026-10-01T00:00:00.000Z");
});

test("transaction identification keeps typed merchant, participants and exact card/boleto money without unknown payload fields", () => {
  const parsed = ProviderTransactionSchema.parse({
    accountId: "a",
    amount: "-10",
    currencyCode: "BRL",
    date: "2026-10-01",
    description: "Synthetic",
    id: "t",
    type: "DEBIT",
    ...transactionIdentificationInput,
    privatePayload: { secret: "discard" },
  });
  const row = normalizeTransaction(parsed, "a");
  assert.deepEqual(row.identification, transactionIdentification);
  assert.deepEqual(
    TransactionIdentificationSchema.parse(row.identification),
    transactionIdentification,
  );
  assert.equal(transactionMatchesText(row, "00000000000191"), true);
  assert.equal(transactionMatchesText(row, "RECEBEDOR SINTÉTICO"), true);
  assert.equal(transactionMatchesText(row, "institution-synthetic"), true);
  assert.equal(transactionMatchesText(row, "not-present"), false);
});

test("identification preserves explicit null, absence and partial or masked documents", () => {
  const base = {
    accountId: "a",
    amount: "0",
    currencyCode: "BRL",
    date: "2026-10-01",
    description: "",
    id: "t",
    type: "CREDIT",
  };
  assert.equal(
    normalizeTransaction(ProviderTransactionSchema.parse(base), "a")
      .identification,
    null,
  );
  const row = normalizeTransaction(
    ProviderTransactionSchema.parse({
      ...base,
      merchant: null,
      order: 0,
      paymentData: {
        receiver: { documentNumber: { value: "***.000.000-**" } },
      },
    }),
    "a",
  );
  assert.deepEqual(row.identification, {
    merchant: null,
    order: 0,
    paymentData: { receiver: { documentNumber: { value: "***.000.000-**" } } },
  });
});

const pixRecord = {
  accountId: "synthetic-account",
  amountMinor: "-6000",
  category: "Travel",
  currency: "BRL",
  date: "2026-10-01",
  description: "Transferência enviada pelo Pix|AGÊNCIA SINTÉTICA LTDA",
  direction: "DEBIT",
  id: "synthetic-pix",
  identification: {
    amountInAccountCurrency: null,
    balance: null,
    category: "Travel",
    categoryId: "19000000",
    createdAt: "2026-10-01T18:11:47.946Z",
    creditCardMetadata: null,
    date: "2026-10-01T03:00:00.000Z",
    descriptionRaw: "Transferência enviada pelo Pix|AGÊNCIA SINTÉTICA LTDA",
    merchant: null,
    operationType: "PIX",
    operationTypeAdditionalInfo: null,
    order: 0,
    paymentData: {
      authenticationCode: null,
      boletoMetadata: null,
      payer: {
        accountNumber: null,
        branchNumber: null,
        documentNumber: { type: "CPF", value: "000.000.000-00" },
        name: null,
        routingNumber: null,
        routingNumberISPB: null,
      },
      paymentMethod: "PIX",
      reason: null,
      receiver: {
        accountNumber: null,
        branchNumber: null,
        documentNumber: { type: "CNPJ", value: "00.000.000/0001-91" },
        name: "AGÊNCIA SINTÉTICA LTDA",
        routingNumber: null,
        routingNumberISPB: null,
      },
      receiverReferenceId: null,
      referenceNumber: null,
    },
    providerCode: null,
    providerId: null,
    updatedAt: "2026-10-01T18:11:47.946Z",
  },
  status: "POSTED",
} as const;

test("compact transactions keep the counterparty and drop repeated or empty provider fields", () => {
  const { identification: _identification, ...top } = pixRecord;
  const compact = compactTransaction(pixRecord);
  assert.deepEqual(compact, {
    ...top,
    identification: {
      categoryId: "19000000",
      operationType: "PIX",
      paymentData: {
        payer: { documentNumber: { type: "CPF", value: "000.000.000-00" } },
        paymentMethod: "PIX",
        receiver: {
          documentNumber: { type: "CNPJ", value: "00.000.000/0001-91" },
          name: "AGÊNCIA SINTÉTICA LTDA",
        },
      },
    },
  });
  const full = JSON.stringify(pixRecord).length;
  assert.ok(JSON.stringify(compact).length < full * 0.5);
});

test("compact transactions keep card charge fields, merchant and a differing source text", () => {
  const compact = compactTransaction({
    category: "alimentacao",
    description: "Mercado de exemplo",
    id: "synthetic-card",
    identification: transactionIdentification,
  });
  assert.deepEqual(compact.identification, {
    amountInAccountCurrency: "9007199254740993.01",
    category: "Groceries",
    categoryId: "09010000",
    creditCardMetadata: {
      billPostDate: "2026-10-02",
      cardNumber: "1234",
      installmentNumber: 1,
      payeeMCC: "5411",
      totalInstallments: 2,
    },
    descriptionRaw: "COMPRA ORIGINAL EXEMPLO",
    merchant: transactionIdentification.merchant,
    operationType: "PIX",
    operationTypeAdditionalInfo: "Pagamento de compra",
    paymentData: {
      payer: {
        documentNumber: { type: "CPF", value: "***.000.000-**" },
        name: "Pagador sintético",
      },
      paymentMethod: "PIX",
      reason: "Compra sintética",
      receiver: {
        documentNumber: { type: "CNPJ", value: "00.000.000/0001-91" },
        name: "Recebedor sintético",
      },
    },
  });
  assert.equal(
    compactTransaction({
      category: null,
      description: "Pix",
      identification: { descriptionRaw: "Pix", merchant: null, order: 0 },
    }).identification,
    null,
  );
});
