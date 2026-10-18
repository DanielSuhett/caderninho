import { z } from "zod/v4";

import { WizardStateSchema } from "#contracts/wizard-contract.ts";

export const InstallationChecksSchema = z.object({
  database: z.boolean(),
  workflow: z.boolean(),
  oauth: z.boolean(),
  migrations: z.boolean(),
});
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
});
export type AccountResponse = z.infer<typeof AccountResponseSchema>;
export type InstallationChecks = z.infer<typeof InstallationChecksSchema>;
export const AccountActionSchema = z
  .object({ csrf: z.string().min(1) })
  .strict();
export const ItemActionSchema = AccountActionSchema.extend({
  itemId: z.uuid(),
});
export const ConnectTokenActionSchema = AccountActionSchema.extend({
  itemId: z.uuid().optional(),
});
