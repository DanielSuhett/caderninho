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
      lastAdmittedAt: z.string().nullable(),
      lastSuccessAt: z.string().nullable(),
      name: z.string(),
      nextImportAt: z.string().nullable(),
      observedAt: z.string(),
      status: z.string(),
    }),
  ),
  csrf: z.string(),
  enabled: z.boolean(),
  origin: z.string(),
  runs: z.array(
    z.object({
      connectionId: z.string(),
      createdAt: z.string(),
      error: z.string().nullable(),
      id: z.string(),
      records: z.number(),
      status: z.enum(RunStatus),
      updatedAt: z.string(),
    }),
  ),
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
