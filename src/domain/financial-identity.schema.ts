import { z } from "zod/v4";

import type { FinancialIdentity } from "./financial-identity.entity";
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
