export interface TransactionMerchant {
  businessName?: string | null | undefined;
  category?: string | null | undefined;
  cnae?: string | null | undefined;
  cnpj?: string | null | undefined;
  name?: string | null | undefined;
}

export interface TransactionParticipant {
  accountNumber?: string | null | undefined;
  branchNumber?: string | null | undefined;
  documentNumber?:
    | { type?: string | null | undefined; value?: string | null | undefined }
    | null
    | undefined;
  name?: string | null | undefined;
  routingNumber?: string | null | undefined;
  routingNumberISPB?: string | null | undefined;
}

export interface TransactionBoleto {
  barcode?: string | null | undefined;
  baseAmountMinor?: string | null | undefined;
  digitableLine?: string | null | undefined;
  discountAmountMinor?: string | null | undefined;
  interestAmountMinor?: string | null | undefined;
  penaltyAmountMinor?: string | null | undefined;
}

export interface TransactionPayment {
  authenticationCode?: string | null | undefined;
  boletoMetadata?: TransactionBoleto | null | undefined;
  payer?: TransactionParticipant | null | undefined;
  paymentMethod?: string | null | undefined;
  reason?: string | null | undefined;
  receiver?: TransactionParticipant | null | undefined;
  receiverReferenceId?: string | null | undefined;
  referenceNumber?: string | null | undefined;
}

export interface TransactionCard {
  billForecastDate?: string | null | undefined;
  billId?: string | null | undefined;
  billPostDate?: string | null | undefined;
  cardNumber?: string | null | undefined;
  feeType?: string | null | undefined;
  feeTypeAdditionalInfo?: string | null | undefined;
  installmentNumber?: number | null | undefined;
  otherCreditsAdditionalInfo?: string | null | undefined;
  otherCreditsType?: string | null | undefined;
  payeeMCC?: string | null | undefined;
  paymentType?: string | null | undefined;
  purchaseDate?: string | null | undefined;
  totalAmountMinor?: string | null | undefined;
  totalInstallments?: number | null | undefined;
  transactionDateTime?: string | null | undefined;
}

export interface TransactionIdentification {
  amountInAccountCurrency?: string | null | undefined;
  balance?: string | null | undefined;
  category?: string | null | undefined;
  categoryId?: string | null | undefined;
  createdAt?: string | null | undefined;
  creditCardMetadata?: TransactionCard | null | undefined;
  date?: string | null | undefined;
  descriptionRaw?: string | null | undefined;
  merchant?: TransactionMerchant | null | undefined;
  operationType?: string | null | undefined;
  operationTypeAdditionalInfo?: string | null | undefined;
  order?: number | null | undefined;
  paymentData?: TransactionPayment | null | undefined;
  providerCode?: string | null | undefined;
  providerId?: string | null | undefined;
  updatedAt?: string | null | undefined;
}

const documentSearch = /^[\d.\s/-]+$/;

export function transactionMatchesText(
  row: {
    description: string;
    identification?: TransactionIdentification | null | undefined;
  },
  text: string,
) {
  const identity = row.identification;
  const payment = identity?.paymentData;
  const merchant = identity?.merchant;
  const fields = [
    row.description,
    identity?.descriptionRaw,
    identity?.providerId,
    identity?.providerCode,
    identity?.operationType,
    identity?.operationTypeAdditionalInfo,
    merchant?.name,
    merchant?.businessName,
    merchant?.category,
    merchant?.cnae,
    payment?.payer?.name,
    payment?.receiver?.name,
    payment?.reason,
    payment?.referenceNumber,
    payment?.receiverReferenceId,
    payment?.authenticationCode,
  ];
  const documents = [
    merchant?.cnpj,
    payment?.payer?.documentNumber?.value,
    payment?.receiver?.documentNumber?.value,
  ];
  const needle = text.toLocaleLowerCase();
  if (
    [...fields, ...documents].some((value) =>
      value?.toLocaleLowerCase().includes(needle),
    )
  ) {
    return true;
  }
  const digits = text.replace(/\D/g, "");
  return (
    !!digits &&
    documentSearch.test(text) &&
    documents.some((value) => value?.replace(/\D/g, "").includes(digits))
  );
}
