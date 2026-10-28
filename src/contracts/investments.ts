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
const bank = z.object({
  id: z.string(),
  logoUrl: z.string().nullable(),
  name: z.string(),
});
const group = z.object({
  banks: z.array(bank),
  count: z.number().int().nonnegative(),
  currency: z.string(),
  furthestDueDate: z.string().nullable(),
  gross: measure,
  id: z.string(),
  nearestDueDate: z.string().nullable(),
  net: measure,
  rateTypes: z.array(z.string()),
  recordIds: z.array(z.string()),
  subtype: z.string().nullable(),
  type: z.string(),
  withdrawal: measure,
});
const allocation = measure.extend({ id: z.string(), name: z.string() });
export const InvestmentListSchema = z.object({
  data: z.object({
    groups: z.array(group),
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
        withdrawal: measure,
      }),
    ),
  }),
  partial: z.boolean().optional(),
});
export type InvestmentList = z.infer<
  typeof InvestmentListSchema
>["data"]["records"];
export type InvestmentGroup = InvestmentPortfolio["groups"][number];
export type InvestmentPortfolio = z.infer<typeof InvestmentListSchema>["data"];
