import type {
  TransactionCard,
  TransactionMerchant,
  TransactionPayment,
} from "./transaction.entity";

export interface Credentials {
  clientId: string;
  clientSecret: string;
}
export type MoneyInput = string | number | null | undefined;
export interface ProviderBoleto {
  barcode?: string | null | undefined;
  baseAmount?: MoneyInput;
  digitableLine?: string | null | undefined;
  discountAmount?: MoneyInput;
  interestAmount?: MoneyInput;
  penaltyAmount?: MoneyInput;
}
export interface ProviderCard
  extends Omit<TransactionCard, "payeeMCC" | "totalAmountMinor"> {
  payeeMCC?: string | number | null | undefined;
  totalAmount?: MoneyInput;
}
export interface ProviderPayment
  extends Omit<TransactionPayment, "boletoMetadata"> {
  boletoMetadata?: ProviderBoleto | null | undefined;
}
export interface ProviderConnection {
  connector?:
    | {
        id: string | number;
        name?: string | null | undefined;
        imageUrl?: string | null | undefined;
      }
    | undefined;
  id: string;
}
export interface ProviderAccount {
  balance?: MoneyInput;
  creditData?:
    | {
        creditLimit?: MoneyInput;
        brand?: string | null | undefined;
        brandAdditionalInfo?: string | null | undefined;
        availableCreditLimit?: MoneyInput;
        balanceCloseDate?: string | null | undefined;
        balanceDueDate?: string | null | undefined;
      }
    | null
    | undefined;
  currencyCode: string;
  id: string;
  itemId: string;
  name: string;
  number?: string | null | undefined;
  type: "BANK" | "CREDIT";
}
export interface ProviderTransaction {
  accountId: string;
  amount: string | number | null;
  amountInAccountCurrency?: MoneyInput;
  balance?: MoneyInput;
  category?: string | null | undefined;
  categoryId?: string | null | undefined;
  createdAt?: string | null | undefined;
  creditCardMetadata?: ProviderCard | null | undefined;
  currencyCode: string;
  date: string;
  description: string;
  descriptionRaw?: string | null | undefined;
  id: string;
  merchant?: TransactionMerchant | null | undefined;
  operationType?: string | null | undefined;
  operationTypeAdditionalInfo?: string | null | undefined;
  order?: number | null | undefined;
  paymentData?: ProviderPayment | null | undefined;
  providerCode?: string | null | undefined;
  providerId?: string | null | undefined;
  status: "PENDING" | "POSTED";
  type: "DEBIT" | "CREDIT";
  updatedAt?: string | null | undefined;
}
export interface TransactionPage {
  next: string | null;
  records: ProviderTransaction[];
}
