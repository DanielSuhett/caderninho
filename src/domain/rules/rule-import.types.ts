import type { JsonValue } from "@/shared/json.types";

export interface SecuroCondition {
  op: string;
  field?: string | undefined;
  value?: JsonValue | undefined;
  conditions?: SecuroCondition[] | undefined;
}

export interface SecuroRule {
  id?: string | undefined;
  name: string;
  conditions_op: "and" | "or";
  conditions: SecuroCondition[];
  actions: {
    op: string;
    value?: string | undefined;
    key?: string | undefined;
  }[];
  priority: number;
  is_active: boolean;
}

export interface SecuroPackage {
  format: "securo-categorization-rules";
  version: 1;
  rules: SecuroRule[];
}
