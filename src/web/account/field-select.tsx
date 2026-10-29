import type { ReactNode } from "react";

import { deferred } from "./deferred";

export interface FieldSelectProps {
  className?: string;
  defaultValue: string;
  items: Array<{ label: ReactNode; value: string }>;
  label: string;
  name: string;
}

// Filter forms live in dialogs that load on demand; their selects download
// with them (or earlier, while idle) instead of with every page.
export const FieldSelect = deferred<FieldSelectProps>(
  async () => (await import("./field-select-panel")).FieldSelectPanel,
);
