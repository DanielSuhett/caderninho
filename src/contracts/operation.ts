import { z } from "zod/v4";

import {
  FinanceRecordSchema,
  MigrationPolicy,
  type MigrationRequest,
  ResourceSchema,
  type WebhookEvent,
  WebhookEventType,
} from "../domain";

export const MigrationRowSchema = z
  .object({
    parentId: z.string(),
    readAt: z.iso.datetime(),
    record: FinanceRecordSchema,
    resource: ResourceSchema,
    sourceKey: z.string().min(1).max(2048),
  })
  .strict();
export const WebhookSchema = z
  .object({
    accountId: z.string().uuid(),
    event: z.enum(WebhookEventType),
    eventId: z.string().min(1).max(200),
    itemId: z.string().uuid(),
    transactionIds: z.array(z.string().uuid()).max(10_000).optional(),
    transactionsCreatedAtFrom: z.iso.datetime().optional(),
  })
  .loose() satisfies z.ZodType<WebhookEvent>;

export const MigrationRequestSchema = z
  .object({
    apply: z.boolean().default(false),
    itemId: z.string(),
    policy: z.enum(MigrationPolicy).default(MigrationPolicy.refuse_conflicts),
    rows: z.array(MigrationRowSchema).min(1).max(20),
  })
  .strict() satisfies z.ZodType<MigrationRequest>;
