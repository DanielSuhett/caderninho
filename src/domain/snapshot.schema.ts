import { z } from "zod/v4";

import { AvailabilitySchema, ResourceSchema } from "#domain/enums.schema.ts";
import type { ItemInfo } from "#domain/provider.types.ts";
import type { Snapshot } from "#domain/snapshot.types.ts";

const text = z.string().nullish();
const scalar = z.union([z.string(), z.number(), z.boolean()]).nullish();
const ImportArgsSchema = z
  .object({
    resource: ResourceSchema.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    accountId: z.string().optional(),
    investmentId: z.string().optional(),
    resumeToken: z.string().optional(),
    refresh: z.boolean().optional(),
  })
  .strict();

const ItemInfoSchema = z.object({
  id: scalar,
  status: text,
  executionStatus: text,
  products: z.array(z.string()).nullish(),
  resourcesCollectedAt: z.json().nullish(),
  consentExpiresAt: text,
  lastUpdatedAt: text,
  statusDetail: z.record(z.string(), z.json()).nullish(),
  connector: z.object({
    id: scalar,
    name: text,
    isOpenFinance: z.boolean().nullish(),
    isSandbox: z.boolean().nullish(),
    products: z.array(z.string()).nullish(),
  }),
}) satisfies z.ZodType<ItemInfo>;

const CoverageSchema = z
  .object({
    apiPaginationComplete: z.boolean(),
    bankHistoryComplete: z.boolean().nullable(),
    sourceCollectionVerified: z.boolean().optional(),
    reason: z.string().nullable().optional(),
  })
  .loose();

const CollectionSchema = z
  .object({
    resource: ResourceSchema,
    scope: ImportArgsSchema.extend({ currency: z.string().optional() }),
    status: AvailabilitySchema,
    readAt: z.string(),
    dataKey: z.string().optional(),
    recordCount: z.number(),
    importJobId: z.string().optional(),
    coverage: CoverageSchema,
    sourceReferenceAt: text,
    sourceItemUpdatedAt: text,
    recordReferenceDates: z.array(z.string()).optional(),
    lastAttempt: z.json().optional(),
  })
  .loose();

export const SnapshotSchema = z
  .object({
    snapshotId: z.string(),
    owner: z.string(),
    itemId: z.string(),
    item: ItemInfoSchema,
    collections: z.record(z.string(), CollectionSchema),
  })
  .loose() satisfies z.ZodType<Snapshot>;
