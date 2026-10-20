import { z } from "zod/v4";

import { RunStatus } from "../domain";
import type { AccountConnectToken, PortalResponse } from "./portal.types";
export const PortalResponseSchema = z.object({
  configured: z.boolean(),
  connections: z.array(
    z.object({
      accounts: z.record(
        z.string(),
        z
          .object({
            balanceMinor: z.string().nullable(),
            balanceObservedAt: z.string().nullable(),
            currency: z.string(),
            name: z.string(),
            type: z.enum(["BANK", "CREDIT"]),
          })
          .strict(),
      ),
      id: z.string(),
      importCheckpoint: z
        .object({
          accountId: z.string().nullable(),
          phase: z.enum(["accounts", "transactions", "finish"]),
        })
        .nullable(),
      importError: z.string().nullable(),
      importStatus: z.enum(RunStatus).nullable(),
      lastSuccessAt: z.string().nullable(),
      nextEligibleAt: z.string().nullable(),
      partial: z.boolean(),
    }),
  ),
  csrf: z.string(),
  origin: z.string(),
}) satisfies z.ZodType<PortalResponse>;
export const AccountConnectTokenSchema = z.object({
  accessToken: z.string(),
  configuration: z.object({
    connectorIds: z.array(z.number()),
    includeSandbox: z.boolean(),
    selectedConnectorId: z.number(),
  }),
}) satisfies z.ZodType<AccountConnectToken>;
export const AccountActionSchema = z.object({ csrf: z.string() }).strict();
export const ItemActionSchema = AccountActionSchema.extend({
  itemId: z.string().min(1).max(128),
});
export const ConnectTokenActionSchema = AccountActionSchema.extend({
  itemId: z.string().min(1).max(128).optional(),
});
