import { z } from "zod/v4";

import { FilterSchema } from "#contracts/queries.ts";
import { ResourceSchema } from "#domain/enums.ts";
import { FinanceRecordSchema } from "#domain/schemas.ts";

export const MigrationRowSchema = z
  .object({
    sourceKey: z.string().min(1).max(2048),
    readAt: z.iso.datetime(),
    resource: ResourceSchema,
    parentId: z.string(),
    record: FinanceRecordSchema,
  })
  .strict();
const OperationScope = z.object({
  itemIds: z.array(z.string()).min(1).max(100),
  filter: FilterSchema.optional(),
  renormalize: z.boolean().optional(),
});
export const OperationInputSchema = z.discriminatedUnion("kind", [
  OperationScope.extend({ kind: z.literal("sync") }).strict(),
  OperationScope.extend({ kind: z.literal("reconcile") }).strict(),
  OperationScope.extend({ kind: z.literal("reapply") }).strict(),
  OperationScope.extend({
    kind: z.literal("webhook"),
    eventId: z.string().min(1),
  }).strict(),
  OperationScope.extend({
    kind: z.literal("migration"),
    migration: z.array(MigrationRowSchema).max(20),
    migrationPolicy: z
      .enum(["refuse-conflicts", "keep-current", "prefer-bundle"])
      .optional(),
  }).strict(),
]);
export type OperationInput = z.infer<typeof OperationInputSchema>;
export const OperationStatusSchema = z.enum([
  "working",
  "completed",
  "cancelled",
  "failed",
]);
export type OperationStatus = z.infer<typeof OperationStatusSchema>;

export const WebhookSchema = z
  .object({
    eventId: z.string().min(1).max(200),
    event: z.enum([
      "transactions/created",
      "transactions/updated",
      "transactions/deleted",
    ]),
    itemId: z.string().uuid(),
    accountId: z.string().uuid(),
    transactionIds: z.array(z.string().uuid()).max(10000).optional(),
    transactionsCreatedAtFrom: z.iso.datetime().optional(),
  })
  .loose();

export const MigrationRequestSchema = z
  .object({
    itemId: z.string(),
    rows: z.array(MigrationRowSchema).min(1).max(20),
    policy: z
      .enum(["refuse-conflicts", "keep-current", "prefer-bundle"])
      .default("refuse-conflicts"),
    apply: z.boolean().default(false),
  })
  .strict();
export type MigrationRequest = z.infer<typeof MigrationRequestSchema>;
export type WebhookEvent = z.infer<typeof WebhookSchema>;
