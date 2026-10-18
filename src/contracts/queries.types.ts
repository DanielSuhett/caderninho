import type { Resource } from "#domain/enums.ts";
import type { Filter } from "#domain/filter.types.ts";
import type { RecordReference } from "#domain/record-correction.types.ts";

export type Identity = RecordReference;

export interface Cursor {
  revision: number;
  offset: number;
  scope: string;
}

export interface Query {
  resource: Resource;
  filter?: Filter | undefined;
  limit: number;
  cursor?: Cursor | undefined;
}

export interface Aggregate {
  resource: Resource;
  filter?: Filter | undefined;
  metric?: string | undefined;
}
