import type { operations } from "#worker/schema.ts";

export type Operation = typeof operations.$inferSelect;
export type Progress = {
  pages: number;
  received: number;
  new: number;
  changed: number;
  unchanged: number;
  classified: number;
  resources: number;
  errors: number;
  duplicates: number;
};
export type PageCommit = {
  done: boolean;
  cancelled: boolean;
  next?: string | null;
  nextCursor?: string | null;
  resource?: string;
  parent?: string;
  item?: string;
};

export function progressWithDefaults(saved: Partial<Progress>): Progress {
  return {
    pages: 0,
    received: 0,
    new: 0,
    changed: 0,
    unchanged: 0,
    classified: 0,
    resources: 0,
    errors: 0,
    duplicates: 0,
    ...saved,
  };
}
