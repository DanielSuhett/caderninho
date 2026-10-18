import { z } from "zod/v4";

import type {
  AccountResponse,
  InstallationChecks,
} from "#contracts/portal.types.ts";
import { WizardStateSchema } from "#contracts/wizard-contract.ts";

const InstallationChecksSchema = z.object({
  database: z.boolean(),
  workflow: z.boolean(),
  oauth: z.boolean(),
  migrations: z.boolean(),
}) satisfies z.ZodType<InstallationChecks>;
export const AccountResponseSchema = z.object({
  status: WizardStateSchema,
  checks: InstallationChecksSchema,
  items: z.array(z.object({ id: z.string() })),
  latest: z
    .object({ status: z.string(), phase: z.string(), updated_at: z.string() })
    .nullable(),
  csrf: z.string(),
  origin: z.string(),
  checkedAt: z.string(),
}) satisfies z.ZodType<AccountResponse>;
export const AccountActionSchema = z
  .object({ csrf: z.string().min(1) })
  .strict();
export const ItemActionSchema = AccountActionSchema.extend({
  itemId: z.uuid(),
});
export const ConnectTokenActionSchema = AccountActionSchema.extend({
  itemId: z.uuid().optional(),
});
