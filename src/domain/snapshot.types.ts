import type { Availability, Resource } from "#domain/enums.ts";
import type { OptionalText } from "#domain/finance.types.ts";
import type { ItemInfo } from "#domain/provider.types.ts";
import type { JsonValue } from "#shared/json.types.ts";

export interface ImportArgs {
  resource?: Resource | undefined;
  from?: string | undefined;
  to?: string | undefined;
  accountId?: string | undefined;
  investmentId?: string | undefined;
  resumeToken?: string | undefined;
  refresh?: boolean | undefined;
}

export interface Collection {
  [field: string]: unknown;
  resource: Resource;
  scope: ImportArgs & { currency?: string | undefined };
  status: Availability;
  readAt: string;
  dataKey?: string | undefined;
  recordCount: number;
  importJobId?: string | undefined;
  coverage: {
    [field: string]: unknown;
    apiPaginationComplete: boolean;
    bankHistoryComplete: boolean | null;
    sourceCollectionVerified?: boolean | undefined;
    reason?: string | null | undefined;
  };
  sourceReferenceAt?: OptionalText;
  sourceItemUpdatedAt?: OptionalText;
  recordReferenceDates?: string[] | undefined;
  lastAttempt?: JsonValue | undefined;
}

export interface Snapshot {
  [field: string]: unknown;
  snapshotId: string;
  owner: string;
  itemId: string;
  item: ItemInfo;
  collections: Record<string, Collection>;
}
