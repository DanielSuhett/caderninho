import { TransactionDirection } from "./finance.entity";
import { monthDate } from "./planning.entity";

// Same conservative identity in portal listings, card purchases and the demo.
// Duplicate installment numbers remain ambiguous; descriptions are not parsed.
export function installmentGroupKey(row: {
  accountId: string;
  amountMinor: string | null;
  cardNumber: string | null;
  currency: string;
  date: string;
  description: string;
  direction: string;
  installmentNumber: number | null;
  purchaseDate: string | null;
  totalInstallments: number | null;
}) {
  if (
    row.installmentNumber === null ||
    row.totalInstallments === null ||
    row.direction !== TransactionDirection.DEBIT ||
    row.totalInstallments < 2 ||
    row.installmentNumber < 1 ||
    row.installmentNumber > row.totalInstallments
  ) {
    return null;
  }
  const firstMonth = row.purchaseDate
    ? ""
    : monthDate(row.date, 1 - row.installmentNumber).slice(0, 7);
  return JSON.stringify([
    row.accountId,
    row.cardNumber,
    row.currency,
    row.description.trim().toLocaleLowerCase(),
    row.amountMinor,
    row.totalInstallments,
    row.purchaseDate ? `purchase:${row.purchaseDate}` : `month:${firstMonth}`,
  ]);
}
