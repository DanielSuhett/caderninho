import { z } from "zod/v4";

import {
  type AccountConnectToken,
  type AccountPanel,
  type AccountResponse,
  AccountStep,
  AccountSyncOutcome,
  type InstallationChecks,
} from "./portal.types";
import { WizardStateSchema } from "./wizard-contract";

const InstallationChecksSchema = z.object({
  database: z.boolean(),
  workflow: z.boolean(),
  oauth: z.boolean(),
  migrations: z.boolean(),
}) satisfies z.ZodType<InstallationChecks>;
const AccountPanelSchema = z.object({
  initialStep: z.union([
    z.literal(AccountStep.connect),
    z.literal(AccountStep.assistant),
  ]),
  sync: z.enum(AccountSyncOutcome),
  polling: z
    .object({
      intervalMs: z.number().int().positive(),
      retryIntervalMs: z.number().int().positive(),
    })
    .nullable(),
  support: z.object({
    diagnostic: WizardStateSchema.extend({ issue: z.null() }),
    connectorId: z.number().int().positive(),
  }),
}) satisfies z.ZodType<AccountPanel>;

export const AccountConnectTokenSchema = z.object({
  accessToken: z.string().min(1),
  configuration: z.object({
    connectorIds: z.array(z.number().int().positive()).min(1),
    selectedConnectorId: z.number().int().positive(),
    includeSandbox: z.boolean(),
  }),
}) satisfies z.ZodType<AccountConnectToken>;

export const AccountResponseSchema = z.object({
  status: WizardStateSchema,
  panel: AccountPanelSchema,
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
