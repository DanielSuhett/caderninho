import type { JsonValue } from "@/shared/json.types";

import type { Availability, Resource } from "./enums";
import type { OptionalText } from "./finance.entity";
import type { ItemInfo } from "./provider.entity";

export interface ImportArgs {
  accountId?: string | undefined;
  from?: string | undefined;
  investmentId?: string | undefined;
  refresh?: boolean | undefined;
  resource?: Resource | undefined;
  resumeToken?: string | undefined;
  to?: string | undefined;
}

export interface Collection {
  coverage: {
    [field: string]: unknown;
    apiPaginationComplete: boolean;
    bankHistoryComplete: boolean | null;
    sourceCollectionVerified?: boolean | undefined;
    reason?: string | null | undefined;
  };
  dataKey?: string | undefined;
  importJobId?: string | undefined;
  lastAttempt?: JsonValue | undefined;
  readAt: string;
  recordCount: number;
  recordReferenceDates?: string[] | undefined;
  resource: Resource;
  scope: ImportArgs & { currency?: string | undefined };
  sourceItemUpdatedAt?: OptionalText;
  sourceReferenceAt?: OptionalText;
  status: Availability;
  [field: string]: unknown;
}

export interface Snapshot {
  collections: Record<string, Collection>;
  item: ItemInfo;
  itemId: string;
  owner: string;
  snapshotId: string;
  [field: string]: unknown;
}
