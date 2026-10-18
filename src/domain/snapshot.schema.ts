import { z } from "zod/v4";

import { AvailabilitySchema, ResourceSchema } from "./enums.schema";
import type { ItemInfo } from "./provider.entity";
import type { Snapshot } from "./snapshot.types";

const text = z.string().nullish();
const scalar = z.union([z.string(), z.number(), z.boolean()]).nullish();
const ImportArgsSchema = z
  .object({
    accountId: z.string().optional(),
    from: z.string().optional(),
    investmentId: z.string().optional(),
    refresh: z.boolean().optional(),
    resource: ResourceSchema.optional(),
    resumeToken: z.string().optional(),
    to: z.string().optional(),
  })
  .strict();

const ItemInfoSchema = z.object({
  connector: z.object({
    id: scalar,
    isOpenFinance: z.boolean().nullish(),
    isSandbox: z.boolean().nullish(),
    name: text,
    products: z.array(z.string()).nullish(),
  }),
  consentExpiresAt: text,
  executionStatus: text,
  id: scalar,
  lastUpdatedAt: text,
  products: z.array(z.string()).nullish(),
  resourcesCollectedAt: z.json().nullish(),
  status: text,
  statusDetail: z.record(z.string(), z.json()).nullish(),
}) satisfies z.ZodType<ItemInfo>;

const CoverageSchema = z
  .object({
    apiPaginationComplete: z.boolean(),
    bankHistoryComplete: z.boolean().nullable(),
    reason: z.string().nullable().optional(),
    sourceCollectionVerified: z.boolean().optional(),
  })
  .loose();

const CollectionSchema = z
  .object({
    coverage: CoverageSchema,
    dataKey: z.string().optional(),
    importJobId: z.string().optional(),
    lastAttempt: z.json().optional(),
    readAt: z.string(),
    recordCount: z.number(),
    recordReferenceDates: z.array(z.string()).optional(),
    resource: ResourceSchema,
    scope: ImportArgsSchema.extend({ currency: z.string().optional() }),
    sourceItemUpdatedAt: text,
    sourceReferenceAt: text,
    status: AvailabilitySchema,
  })
  .loose();

export const SnapshotSchema = z
  .object({
    collections: z.record(z.string(), CollectionSchema),
    item: ItemInfoSchema,
    itemId: z.string(),
    owner: z.string(),
    snapshotId: z.string(),
  })
  .loose() satisfies z.ZodType<Snapshot>;
