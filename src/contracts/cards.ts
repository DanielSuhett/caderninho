import { z } from "zod/v4";

import { FinancialIdentitySchema } from "../domain";

const id = z.string().min(1).max(160);
const minor = z.string().regex(/^-?\d+$/);
const amount = z.object({
  count: z.number().int().nonnegative(),
  knownMinor: minor,
  totalMinor: minor.nullable(),
  unknownCount: z.number().int().nonnegative(),
});
export const PortalCardsQuerySchema = z
  .object({
    accountId: id.optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("BRL"),
    cursor: z.string().max(4096).optional(),
    month: z
      .string()
      .regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
      .refine((value) => value <= "9998-12"),
    personId: id.optional(),
    spaceId: id.default("personal"),
    tool: z.literal("get_portal_cards"),
  })
  .strict();
export type PortalCardsQuery = z.infer<typeof PortalCardsQuerySchema>;
export const PortalCardInstallmentSchema = z.object({
  accountId: id,
  amountMinor: minor.nullable(),
  cardNumber: z.string().nullable(),
  categoryId: z.string().nullable(),
  date: z.string(),
  description: z.string(),
  id,
  installmentNumber: z.number().int(),
  purchaseDate: z.string().nullable(),
  status: z.enum(["confirmed", "pending", "future"]),
  totalInstallments: z.number().int(),
});
export const PortalCardsSchema = z.object({
  data: z.object({
    accounts: z.array(
      z.object({
        allocatedMinor: minor.nullable(),
        availableCreditMinor: minor.nullable(),
        balanceObservedAt: z.string().nullable(),
        cardNumber: z.string().nullable(),
        closeDate: z.string().nullable(),
        creditLimitMinor: minor.nullable(),
        currency: z.string(),
        dueDate: z.string().nullable(),
        id,
        identity: FinancialIdentitySchema.nullish(),
        name: z.string(),
        personId: id,
        personName: z.string(),
      }),
    ),
    categories: z.array(amount.extend({ categoryId: z.string().nullable() })),
    confirmed: amount,
    currencies: z.array(z.string()),
    currency: z.string(),
    future: amount,
    installments: z.array(PortalCardInstallmentSchema),
    month: z.string(),
    months: z.array(
      z.object({
        confirmed: amount,
        future: amount,
        month: z.string(),
        pending: amount,
      }),
    ),
    nextCursor: z.string().nullable(),
    pending: amount,
    purchases: amount,
    referenceDay: z.string(),
    refunds: amount,
  }),
  partial: z.boolean(),
});
export type PortalCards = z.infer<typeof PortalCardsSchema>["data"];
export type PortalCardInstallment = z.infer<typeof PortalCardInstallmentSchema>;
