import { createContext, useContext } from "react";
import type { z } from "zod/v4";

import type {
  PortalTransactionListSchema,
  TransactionListSchema,
} from "../../contracts";

export type EditableTransaction =
  | z.infer<typeof TransactionListSchema>["data"]["records"][number]
  | z.infer<typeof PortalTransactionListSchema>["data"]["records"][number];
export const TransactionEditingContext = createContext<
  ((row: EditableTransaction, action: "category" | "rule") => void) | null
>(null);
export function useTransactionEditing() {
  return useContext(TransactionEditingContext);
}
