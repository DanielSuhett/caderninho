import type { JsonValue } from "@/shared/json.types";

export interface SecuroCondition {
  conditions?: SecuroCondition[] | undefined;
  field?: string | undefined;
  op: string;
  value?: JsonValue | undefined;
}

export interface SecuroRule {
  actions: {
    op: string;
    value?: string | undefined;
    key?: string | undefined;
  }[];
  conditions: SecuroCondition[];
  conditions_op: "and" | "or";
  id?: string | undefined;
  is_active: boolean;
  name: string;
  priority: number;
}

export interface SecuroPackage {
  format: "securo-categorization-rules";
  rules: SecuroRule[];
  version: 1;
}
