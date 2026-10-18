import { z } from "zod/v4";

import { AccountSyncOutcome, AdmissionStatus } from "../domain";
import {
  type AccountConnectToken,
  type AccountPanel,
  type AccountResponse,
  AccountStep,
  type InstallationChecks,
} from "./portal.types";
import { WizardStateSchema } from "./wizard-contract";

const InstallationChecksSchema = z.object({
  database: z.boolean(),
  migrations: z.boolean(),
  oauth: z.boolean(),
  workflow: z.boolean(),
}) satisfies z.ZodType<InstallationChecks>;
const AccountPanelSchema = z.object({
  initialStep: z.union([
    z.literal(AccountStep.connect),
    z.literal(AccountStep.assistant),
  ]),
  polling: z
    .object({
      intervalMs: z.number().int().positive(),
      retryIntervalMs: z.number().int().positive(),
    })
    .nullable(),
  support: z.object({
    connectorId: z.number().int().positive(),
    diagnostic: WizardStateSchema.extend({ issue: z.null() }),
  }),
  sync: z.enum(AccountSyncOutcome),
}) satisfies z.ZodType<AccountPanel>;

export const AccountConnectTokenSchema = z.object({
  accessToken: z.string().min(1),
  configuration: z.object({
    connectorIds: z.array(z.number().int().positive()).min(1),
    includeSandbox: z.boolean(),
    selectedConnectorId: z.number().int().positive(),
  }),
}) satisfies z.ZodType<AccountConnectToken>;

export const AccountResponseSchema = z.object({
  checkedAt: z.string(),
  checks: InstallationChecksSchema,
  csrf: z.string(),
  freshness: z
    .object({
      items: z.array(
        z.object({
          id: z.string(),
          lastAdmissionAt: z.string().nullable(),
          lastImportAt: z.string().nullable(),
          nextEligibleAt: z.string().nullable(),
          operationId: z.string().nullable(),
          status: z.enum(AdmissionStatus).optional(),
        }),
      ),
      nextAutomaticAt: z.string(),
    })
    .optional(),
  items: z.array(z.object({ id: z.string() })),
  latest: z
    .object({ phase: z.string(), status: z.string(), updated_at: z.string() })
    .nullable(),
  localApplications: z
    .array(
      z.object({
        batch: z.number().int().nonnegative(),
        operationId: z.string(),
        totalProcessed: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  origin: z.string(),
  panel: AccountPanelSchema,
  status: WizardStateSchema,
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
