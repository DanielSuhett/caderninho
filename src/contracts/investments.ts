import { z } from "zod/v4";

import { FinancialIdentitySchema, type InvestmentDetails } from "../domain";

const minor = z.string().regex(/^-?\d+$/);
const decimal = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/)
  .nullable();
export const InvestmentDetailsSchema = z.object({
  annualRate: decimal,
  balanceMinor: minor.nullable(),
  code: z.string().nullable(),
  dueDate: z.string().nullable(),
  financialTaxMinor: minor.nullable(),
  fixedAnnualRate: decimal,
  incomeTaxMinor: minor.nullable(),
  issuer: z.string().nullable(),
  lastMonthRate: decimal,
  lastTwelveMonthsRate: decimal,
  originalMinor: minor.nullable(),
  profitMinor: minor.nullable(),
  purchaseDate: z.string().nullable(),
  quantity: decimal,
  rate: decimal,
  rateType: z.string().nullable(),
  status: z.string().nullable(),
  subtype: z.string().nullable(),
  withdrawalMinor: minor.nullable(),
}) satisfies z.ZodType<InvestmentDetails>;
const measure = z.object({
  knownMinor: minor,
  totalMinor: minor.nullable(),
  unknownCount: z.number().int().nonnegative(),
});
const allocation = measure.extend({ id: z.string(), name: z.string() });
export const InvestmentListSchema = z.object({
  data: z.object({
    records: z.array(
      z.object({
        amountMinor: minor.nullable(),
        connectionId: z.string().nullable(),
        currency: z.string(),
        date: z.string().nullable(),
        details: InvestmentDetailsSchema.nullish(),
        id: z.string(),
        identity: FinancialIdentitySchema.nullish(),
        included: z.boolean(),
        manual: z.boolean(),
        name: z.string(),
        personId: z.string().optional(),
        personName: z.string().optional(),
        profileId: z.string().nullable().optional(),
        spaceId: z.string(),
        type: z.string(),
      }),
    ),
    totals: z.array(
      z.object({
        byInstitution: z.array(allocation),
        byType: z.array(allocation),
        count: z.number().int().nonnegative(),
        currency: z.string(),
        gross: measure,
        net: measure,
        original: measure,
        profit: measure,
        withdrawal: measure,
      }),
    ),
  }),
  partial: z.boolean().optional(),
});
export type InvestmentList = z.infer<
  typeof InvestmentListSchema
>["data"]["records"];
export type InvestmentPortfolio = z.infer<typeof InvestmentListSchema>["data"];
