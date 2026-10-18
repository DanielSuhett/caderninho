import { RE2JS } from "re2js";
import { z } from "zod/v4";

import { compareDecimal, day } from "#domain/exact.ts";

const Text = z.string().max(2048);

export const ActionSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_category"), value: Text }).strict(),
  z.object({ op: z.literal("set_description"), value: Text }).strict(),
  z
    .object({
      op: z.literal("set_tag"),
      key: z.string().min(1).max(80),
      value: Text,
    })
    .strict(),
  z.object({ op: z.literal("ignore") }).strict(),
]);

const Comparator = z.enum(["eq", "ne", "gt", "gte", "lt", "lte"]);

const FactSchema = z.string().refine((p) => allowed(p), "Unknown fact");

const Literal = z.union([
  z.string().max(2048),
  z.number().int().safe(),
  z.boolean(),
  z.null(),
]);

const PredicateSchema = z.discriminatedUnion("operator", [
  z
    .object({
      fact: FactSchema,
      operator: z.enum(["equal", "notEqual"]),
      value: Literal,
    })
    .strict(),
  z
    .object({
      fact: FactSchema,
      operator: z.literal("contains"),
      value: z.union([z.string().max(2048), z.array(Literal).max(1000)]),
    })
    .strict(),
  z
    .object({
      fact: FactSchema,
      operator: z.literal("regex"),
      value: z
        .string()
        .max(512)
        .refine((v) => {
          try {
            RE2JS.compile(accents(v), RE2JS.CASE_INSENSITIVE);

            return true;
          } catch {
            return false;
          }
        }, "Invalid RE2 regex"),
    })
    .strict(),
  z
    .object({
      fact: FactSchema,
      operator: z.literal("decimalCompare"),
      value: z
        .object({
          op: Comparator,
          value: z.string().refine((v) => {
            try {
              compareDecimal(v, v);

              return true;
            } catch {
              return false;
            }
          }, "Invalid decimal"),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      fact: FactSchema,
      operator: z.literal("decimalBetween"),
      value: z.tuple([z.string(), z.string()]).refine(([a, b]) => {
        try {
          return compareDecimal(a, b) <= 0;
        } catch {
          return false;
        }
      }, "Invalid decimal bounds"),
    })
    .strict(),
  z
    .object({
      fact: FactSchema,
      operator: z.literal("dateCompare"),
      value: z
        .object({
          op: Comparator,
          value: z.string().refine((v) => {
            try {
              day(v);

              return true;
            } catch {
              return false;
            }
          }, "Invalid date"),
        })
        .strict(),
    })
    .strict(),
]);

export const ConditionSchema = z.union([
  PredicateSchema,
  z
    .object({
      get all() {
        return z.array(ConditionSchema).max(1000);
      },
    })
    .strict(),
  z
    .object({
      get any() {
        return z.array(ConditionSchema).min(1).max(1000);
      },
    })
    .strict(),
  z
    .object({
      get not() {
        return ConditionSchema;
      },
    })
    .strict(),
]);

export type Condition = z.infer<typeof ConditionSchema>;

export const RuleSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: Text,
    priority: z.number().int().safe(),
    is_active: z.boolean().default(true),
    conditions: z.union([
      z.object({ all: z.array(ConditionSchema).max(1000) }).strict(),
      z.object({ any: z.array(ConditionSchema).min(1).max(1000) }).strict(),
      z.object({ not: ConditionSchema }).strict(),
    ]),
    event: z
      .object({
        type: z.enum(["classify", "enrich"]),
        params: z
          .object({ actions: z.array(ActionSchema).min(1).max(32) })
          .strict(),
      })
      .strict(),
  })
  .strict();

export const CatalogSchema = z.object({
  groups: z.array(z.object({ id: Text, name: Text }).strict()).max(1000),
  categories: z
    .array(
      z
        .object({
          id: Text,
          name: Text,
          group_id: Text,
          aliases: z.array(Text).default([]),
        })
        .strict(),
    )
    .max(5000),
});

export const RulesSchema = CatalogSchema.extend({
  version: z.literal(2),
  rules: z.array(RuleSchema).max(2000),
}).strict();

export type Rules = z.infer<typeof RulesSchema>;

export type Rule = z.infer<typeof RuleSchema>;

export const DerivedSchema = z.object({
  category_id: z.string(),
  category: z.string(),
  category_group_id: z.string(),
  category_group: z.string(),
  description: z.string(),
  tags: z.record(z.string(), z.string()),
  ignored: z.boolean(),
  evidence: z.array(z.object({ ruleId: z.string(), action: ActionSchema })),
});

export type Derived = z.infer<typeof DerivedSchema>;

export const TransactionContextSchema = z.object({
  id: Text,
  account_id: Text,
  account_name: Text,
  description: Text,
  counterparty_name: Text,
  direction: Text,
  operation: Text,
  payment_method: Text,
  currency: Text,
  account_type: Text,
  original_category: Text,
  amount: Text,
  amount_abs: Text,
  date: Text,
  installment_number: Text,
  total_installments: Text,
});

export type TransactionContext = z.infer<typeof TransactionContextSchema>;

export const fields = new Set([
  ...Object.keys(TransactionContextSchema.shape).map((k) => `tx.${k}`),
  ...Object.keys(DerivedSchema.shape)
    .filter((k) => k !== "evidence")
    .map((k) => `result.${k}`),
]);

export const allowed = (p: string) =>
  fields.has(p) || /^result\.tags\.[a-zA-Z0-9_-]{1,80}$/.test(p);

export const accents = (s: string) =>
  s.normalize("NFD").replace(/\p{Mn}/gu, "");
