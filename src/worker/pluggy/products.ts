import { z } from "zod/v4";

import {
  accountingDay,
  normalizeMoney,
  ProductKind,
  type ProductPage,
} from "../../domain";
import type { PersonalPluggyClient } from "./client.adapter";
import { sdkResult } from "./source";

const money = z.union([z.string(), z.number()]).nullish();
const investment = z.object({
  amount: money,
  currencyCode: z.string(),
  date: z.string().nullish(),
  id: z.string().min(1),
  itemId: z.string().min(1),
  name: z.string(),
  type: z.string(),
});
const loan = z.object({
  contractAmount: money,
  currencyCode: z.string(),
  firstInstallmentDueDate: z.string().nullish(),
  id: z.string().min(1),
  installments: z
    .object({
      paidInstallments: z.coerce.number().int().nonnegative().nullish(),
      totalNumberOfInstallments: z.coerce
        .number()
        .int()
        .nonnegative()
        .nullish(),
    })
    .nullish(),
  itemId: z.string().min(1),
  payments: z.object({ contractOutstandingBalance: money }).nullish(),
  productName: z.string(),
});
const bill = z.object({
  accountId: z.string().optional(),
  dueDate: z.string(),
  financeCharges: z
    .array(
      z.object({ amount: money, currencyCode: z.string(), type: z.string() }),
    )
    .max(1000)
    .default([]),
  id: z.string().min(1),
  minimumPaymentAmount: money,
  payments: z
    .array(
      z.object({
        amount: money,
        currencyCode: z.string(),
        paymentDate: z.string(),
      }),
    )
    .max(1000)
    .default([]),
  totalAmount: money,
  totalAmountCurrencyCode: z.string(),
});
function pageSchema<T extends z.ZodType>(record: T) {
  return z.object({
    page: z.coerce.number().int().positive(),
    results: z.array(record).max(500),
    total: z.coerce.number().int().nonnegative(),
    totalPages: z.coerce.number().int().nonnegative(),
  });
}
function nextPage(
  page: { page: number; total: number; totalPages: number; results: unknown[] },
  requested: number,
) {
  if (
    page.page !== requested ||
    page.total < page.results.length ||
    (page.total > 0 && !page.results.length) ||
    (page.page < page.totalPages && !page.results.length) ||
    page.totalPages > 10_000
  ) {
    throw new Error("INVALID_PAGINATION");
  }
  return page.page < page.totalPages ? page.page + 1 : null;
}
export async function productPage(
  client: PersonalPluggyClient,
  input: { kind: ProductKind; id: string; page: number; observedAt: string },
): Promise<ProductPage> {
  switch (input.kind) {
    case ProductKind.investments: {
      const page = pageSchema(investment).parse(
        await sdkResult(() =>
          client.fetchInvestments(input.id, undefined, {
            page: input.page,
            pageSize: 100,
          }),
        ),
      );
      return {
        kind: input.kind,
        next: nextPage(page, input.page),
        records: page.results.map((row) => {
          if (row.itemId !== input.id) {
            throw new Error("SOURCE_IDENTITY_MISMATCH");
          }
          return {
            amountMinor: normalizeMoney(row.amount, row.currencyCode),
            connectionId: input.id,
            currency: row.currencyCode,
            date: accountingDay(row.date),
            id: row.id,
            included: true,
            manual: false,
            name: row.name,
            spaceId: "personal",
            type: row.type,
          };
        }),
      };
    }
    case ProductKind.loans: {
      const page = pageSchema(loan).parse(
        await sdkResult(() =>
          client.fetchLoans(input.id, { page: input.page, pageSize: 100 }),
        ),
      );
      return {
        kind: input.kind,
        next: nextPage(page, input.page),
        records: page.results.map((row) => {
          if (row.itemId !== input.id) {
            throw new Error("SOURCE_IDENTITY_MISMATCH");
          }
          return {
            amountMinor: normalizeMoney(
              row.payments?.contractOutstandingBalance,
              row.currencyCode,
            ),
            connectionId: input.id,
            contractAmountMinor: normalizeMoney(
              row.contractAmount,
              row.currencyCode,
            ),
            currency: row.currencyCode,
            firstPaymentDate: accountingDay(row.firstInstallmentDueDate),
            hidden: false,
            id: row.id,
            installmentMinor: null,
            manual: false,
            name: row.productName,
            observedAt: input.observedAt,
            paid: row.installments?.paidInstallments ?? null,
            spaceId: "personal",
            total: row.installments?.totalNumberOfInstallments ?? null,
          };
        }),
      };
    }
    case ProductKind.bills: {
      const page = pageSchema(bill).parse(
        await sdkResult(() =>
          client.fetchCreditCardBills(input.id, {
            page: input.page,
            pageSize: 100,
          }),
        ),
      );
      return {
        kind: input.kind,
        next: nextPage(page, input.page),
        records: page.results.map((row) => {
          if (row.accountId && row.accountId !== input.id) {
            throw new Error("SOURCE_IDENTITY_MISMATCH");
          }
          return {
            accountId: input.id,
            amountMinor: normalizeMoney(
              row.totalAmount,
              row.totalAmountCurrencyCode,
            ),
            charges: row.financeCharges.map((c) => ({
              amountMinor: normalizeMoney(c.amount, c.currencyCode),
              currency: c.currencyCode,
              type: c.type,
            })),
            currency: row.totalAmountCurrencyCode,
            dueDate: accountingDay(row.dueDate) ?? "",
            id: row.id,
            minimumMinor: normalizeMoney(
              row.minimumPaymentAmount,
              row.totalAmountCurrencyCode,
            ),
            observedAt: input.observedAt,
            payments: row.payments.map((p) => ({
              amountMinor: normalizeMoney(p.amount, p.currencyCode),
              currency: p.currencyCode,
              date: accountingDay(p.paymentDate) ?? "",
            })),
          };
        }),
      };
    }
    default:
      throw new Error("INVALID_PRODUCT");
  }
}
