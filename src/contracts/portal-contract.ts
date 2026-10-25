import { z } from "zod/v4";

import { AccountType, ImportPhase, RunStatus } from "../domain";
import { HouseholdCatalogSchema } from "./household";
import type { AccountConnectToken, PortalResponse } from "./portal.types";
export const AccountFailureCodeSchema = z.enum([
  "APPLICATION_CHANGE_REQUIRES_NEW_PROFILE",
  "CREDENTIALS_REQUIRED",
  "NOT_FOUND",
  "PROFILE_DISABLED",
  "PROFILE_EXISTS",
  "PROFILE_OWNER_IMMUTABLE",
  "SOURCE_IDENTITY_MISMATCH",
  "UPSTREAM_AUTH",
  "UPSTREAM_FORBIDDEN",
  "UPSTREAM_RATE_LIMIT",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_UNAVAILABLE",
]);
export type AccountFailureCode = z.infer<typeof AccountFailureCodeSchema>;
export const PortalResponseSchema = z.object({
  ...HouseholdCatalogSchema.shape,
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
            type: z.enum([AccountType.BANK, AccountType.CREDIT]),
          })
          .strict(),
      ),
      hasTransactions: z.boolean().optional(),
      id: z.string(),
      importCheckpoint: z
        .object({
          accountId: z.string().nullable(),
          phase: z.enum([
            ImportPhase.accounts,
            ImportPhase.transactions,
            ImportPhase.investments,
            ImportPhase.loans,
            ImportPhase.bills,
            ImportPhase.classification,
            ImportPhase.finish,
          ]),
        })
        .nullable(),
      importError: z.string().nullable(),
      importStatus: z.enum(RunStatus).nullable(),
      lastSuccessAt: z.string().nullable(),
      nextEligibleAt: z.string().nullable(),
      partial: z.boolean(),
      personId: z.string().optional(),
      personName: z.string().optional(),
      profileId: z.string().optional(),
      profileName: z.string().optional(),
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
  itemId: z.string().min(1).max(160),
  profileId: z.string().min(1).max(128).default("default"),
});
export const ConnectTokenActionSchema = AccountActionSchema.extend({
  itemId: z.string().min(1).max(160).optional(),
  profileId: z.string().min(1).max(128).default("default"),
});

export const SyncActionSchema = AccountActionSchema.extend({
  connectionIds: z.array(z.string().min(1).max(160)).min(1).max(200).optional(),
});
