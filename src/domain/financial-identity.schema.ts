import { z } from "zod/v4";

import { PERSONAL_CONNECTOR_ID } from "./connection.entity";
import {
  type FinancialIdentity,
  type Institution,
  institutionLogoUrl,
} from "./financial-identity.entity";
export const InstitutionSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(160)
      .refine((id) => id !== String(PERSONAL_CONNECTOR_ID)),
    logoUrl: z
      .string()
      .max(2048)
      .nullable()
      .refine((url) => url === null || institutionLogoUrl(url) !== null),
    name: z.string().trim().min(1).max(160),
  })
  .strict() satisfies z.ZodType<Institution>;
export const FinancialIdentitySchema = z.object({
  cardBrand: z.string().nullable(),
  institution: z
    .object({
      id: z.string(),
      logoUrl: z.string().nullable(),
      name: z.string(),
    })
    .nullable(),
}) satisfies z.ZodType<FinancialIdentity>;
