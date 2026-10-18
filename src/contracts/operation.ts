import { z } from "zod/v4";

import { ResourceSchema } from "@/domain/enums.schema";
import { FinanceRecordSchema } from "@/domain/finance.schema";

import {
  MigrationPolicy,
  type MigrationRequest,
  type WebhookEvent,
  WebhookEventType,
} from "./operation.types";

export const MigrationRowSchema = z
  .object({
    sourceKey: z.string().min(1).max(2048),
    readAt: z.iso.datetime(),
    resource: ResourceSchema,
    parentId: z.string(),
    record: FinanceRecordSchema,
  })
  .strict();
export const WebhookSchema = z
  .object({
    eventId: z.string().min(1).max(200),
    event: z.enum(WebhookEventType),
    itemId: z.string().uuid(),
    accountId: z.string().uuid(),
    transactionIds: z.array(z.string().uuid()).max(10000).optional(),
    transactionsCreatedAtFrom: z.iso.datetime().optional(),
  })
  .loose() satisfies z.ZodType<WebhookEvent>;

export const MigrationRequestSchema = z
  .object({
    itemId: z.string(),
    rows: z.array(MigrationRowSchema).min(1).max(20),
    policy: z.enum(MigrationPolicy).default(MigrationPolicy.refuse_conflicts),
    apply: z.boolean().default(false),
  })
  .strict() satisfies z.ZodType<MigrationRequest>;
