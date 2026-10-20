import { z } from "zod/v4";

import { CollectionStatus, RunStatus } from "../domain";
import type { AccountConnectToken, PortalResponse } from "./portal.types";
export const PortalResponseSchema = z.object({
  accounts: z.array(
    z.object({
      balanceMinor: z.string().nullable(),
      collectionStatus: z.enum(CollectionStatus),
      connectionId: z.string(),
      currency: z.string(),
      error: z.string().nullable(),
      id: z.string(),
      lastAttemptAt: z.string().nullable(),
      lastCompletedFrom: z.string().nullable(),
      lastCompletedTo: z.string().nullable(),
      lastSuccessAt: z.string().nullable(),
      name: z.string(),
      observedAt: z.string(),
      observedFrom: z.string().nullable(),
      observedTo: z.string().nullable(),
      sourceUpdatedAt: z.string().nullable(),
      type: z.enum(["BANK", "CREDIT"]),
    }),
  ),
  configured: z.boolean(),
  connections: z.array(
    z.object({
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
