import type { Resource } from "#domain/enums.ts";

export const CorrectionField = {
  category: "category",
  description: "description",
  ignored: "ignored",
  tag: "tag",
} as const;
export type CorrectionField =
  (typeof CorrectionField)[keyof typeof CorrectionField];

export interface RecordReference {
  itemId: string;
  resource: Resource;
  parentId: string;
  id: string;
}

export interface CorrectionInput extends RecordReference {
  field: CorrectionField;
  key?: string | undefined;
  value: string | null;
}

export type RecordChange =
  | { field: typeof CorrectionField.tag; key: string; value: string | null }
  | {
      field: Exclude<CorrectionField, typeof CorrectionField.tag>;
      value: string | null;
    };
