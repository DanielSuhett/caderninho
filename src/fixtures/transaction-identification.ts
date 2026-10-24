import type { ProviderTransaction, TransactionIdentification } from "../domain";

export const transactionIdentificationInput = {
  amountInAccountCurrency: "9007199254740993.01",
  balance: "9007199254740993.02",
  category: "Groceries",
  categoryId: "09010000",
  createdAt: "2026-10-01T15:30:00Z",
  creditCardMetadata: {
    billForecastDate: "2026-11",
    billId: "synthetic-bill",
    billPostDate: "2026-10-02",
    cardNumber: "**** **** **** 1234",
    feeType: "OTHER",
    feeTypeAdditionalInfo: "Tarifa sintética",
    installmentNumber: 1,
    otherCreditsAdditionalInfo: "Crédito sintético",
    otherCreditsType: "OTHER",
    payeeMCC: 5411,
    paymentType: "INSTALLMENT",
    purchaseDate: "2026-10-01T00:00:00Z",
    totalAmount: "9007199254740993.01",
    totalInstallments: 2,
    transactionDateTime: "2026-10-01T12:30:00-03:00",
  },
  descriptionRaw: "COMPRA ORIGINAL EXEMPLO",
  merchant: {
    businessName: "Mercado sintético LTDA",
    category: "Supermercado",
    cnae: "4711302",
    cnpj: "00.000.000/0001-91",
    name: "Mercado de exemplo",
  },
  operationType: "PIX",
  operationTypeAdditionalInfo: "Pagamento de compra",
  order: 0,
  paymentData: {
    authenticationCode: "synthetic-authentication",
    boletoMetadata: {
      barcode: "00000000000000000000000000000000000000000000",
      baseAmount: "9007199254740993.01",
      digitableLine: "00000.00000 00000.000000 00000.000000 0 00000000000000",
      discountAmount: "0",
      interestAmount: "0.01",
      penaltyAmount: "1.23",
    },
    payer: {
      accountNumber: "1234-5",
      branchNumber: "0001",
      documentNumber: { type: "CPF", value: "***.000.000-**" },
      name: "Pagador sintético",
      routingNumber: "000",
      routingNumberISPB: "00000000",
    },
    paymentMethod: "PIX",
    reason: "Compra sintética",
    receiver: {
      accountNumber: "5678-9",
      branchNumber: "0002",
      documentNumber: { type: "CNPJ", value: "00.000.000/0001-91" },
      name: "Recebedor sintético",
      routingNumber: "001",
      routingNumberISPB: "00000001",
    },
    receiverReferenceId: "synthetic-receiver-reference",
    referenceNumber: "synthetic-end-to-end",
  },
  providerCode: "NSU-synthetic",
  providerId: "institution-synthetic",
  updatedAt: "2026-10-02T16:00:00Z",
} satisfies Partial<ProviderTransaction>;

const { totalAmount: _totalAmount, ...card } =
  transactionIdentificationInput.creditCardMetadata;

export const transactionIdentification = {
  ...transactionIdentificationInput,
  creditCardMetadata: {
    ...card,
    cardNumber: "1234",
    payeeMCC: "5411",
    totalAmountMinor: "900719925474099301",
  },
  paymentData: {
    ...transactionIdentificationInput.paymentData,
    boletoMetadata: {
      barcode:
        transactionIdentificationInput.paymentData.boletoMetadata.barcode,
      baseAmountMinor: "900719925474099301",
      digitableLine:
        transactionIdentificationInput.paymentData.boletoMetadata.digitableLine,
      discountAmountMinor: "0",
      interestAmountMinor: "1",
      penaltyAmountMinor: "123",
    },
  },
} satisfies TransactionIdentification;
