import { z } from "zod/v4";

const id = z.string().min(1).max(160);
const minor = z.string().regex(/^-?\d+$/);
const count = z.number().int().nonnegative();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const queryMonth = month.refine(
  (value) => {
    const year = Number(value.slice(0, 4));
    return year >= 1900 && year <= 9998;
  },
  { message: "Selecione um mês entre os anos 1900 e 9998" },
);

export const CardCommitmentsQuerySchema = z
  .object({
    accountId: id.optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    month: queryMonth.optional(),
    months: z.number().int().min(1).max(12).default(12),
    personId: id.optional(),
    spaceId: id.default("personal"),
  })
  .strict();

const totals = z.object({
  currency: z.string(),
  futureMinor: minor.nullable(),
  knownFutureMinor: minor,
  knownObservedCommitmentsMinor: minor,
  knownPendingMinor: minor,
  knownSpentMinor: minor,
  knownUnclassifiedMinor: minor,
  observedCommitmentsMinor: minor.nullable(),
  pendingMinor: minor.nullable(),
  spentMinor: minor.nullable(),
  unclassifiedCount: count,
  unclassifiedUnknownAmountCount: count,
  unknownAmountCount: count,
});

export const CardCommitmentsSchema = z.object({
  accounts: z.array(
    z.object({
      allocatedCreditMinor: minor.nullable(),
      availabilitySource: z.enum(["provider", "unavailable"]),
      availableCreditMinor: minor.nullable(),
      balanceObservedAt: z.string().nullable(),
      creditLimitMinor: minor.nullable(),
      currency: z.string(),
      hidden: z.boolean(),
      id: z.string(),
      limitSource: z.enum(["provider", "manual", "unavailable"]),
      manual: z.boolean(),
      name: z.string(),
      personId: z.string(),
      personName: z.string(),
    }),
  ),
  assumptions: z.array(z.string()),
  categories: z.array(
    z.object({
      amountMinor: minor.nullable(),
      color: z.string(),
      currency: z.string(),
      id: z.string().nullable(),
      knownAmountMinor: minor,
      name: z.string(),
      unknownAmountCount: count,
    }),
  ),
  categoryBasis: z.literal("observed_commitments"),
  from: z.iso.date(),
  installments: z.array(
    z.object({
      accountId: z.string(),
      accountName: z.string(),
      amountMinor: minor.nullable(),
      cardNumber: z.string().nullable(),
      categoryId: z.string().nullable(),
      categoryName: z.string(),
      currency: z.string(),
      date: z.iso.date(),
      description: z.string(),
      direction: z.enum(["DEBIT", "CREDIT"]),
      id: z.string(),
      installmentNumber: z.number().int().positive(),
      phase: z.enum(["spent", "pending", "future"]),
      purchaseDate: z.iso.date().nullable(),
      status: z.enum(["POSTED", "PENDING"]),
      totalInstallments: z.number().int().positive(),
    }),
  ),
  month,
  months: z.array(totals.extend({ month })),
  referenceDay: z.iso.date(),
  to: z.iso.date(),
  totals: z.array(totals),
});

export const CardCommitmentsResponseSchema = z.object({
  coverage: z.object({
    connectionIds: z.array(z.string()),
    kind: z.enum(["imported", "local_only", "empty"]),
    oldestLastSuccessAt: z.string().nullable(),
    partial: z.boolean(),
  }),
  data: CardCommitmentsSchema,
  oldestLastSuccessAt: z.string().nullable(),
  partial: z.boolean(),
  revision: count,
  scope: z.object({ personId: z.string().optional(), spaceId: z.string() }),
  view: z.literal("effective"),
});

export type CardCommitmentsQuery = z.infer<typeof CardCommitmentsQuerySchema>;
export type CardCommitments = z.infer<typeof CardCommitmentsSchema>;
export type CardCommitmentsResponse = z.infer<
  typeof CardCommitmentsResponseSchema
>;
