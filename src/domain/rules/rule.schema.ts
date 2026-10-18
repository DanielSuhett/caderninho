import { RE2JS } from "re2js";
import { z } from "zod/v4";

import { compareDecimal, day } from "../exact";
import {
  accents,
  allowed,
  Comparator,
  type Condition,
  compileValidatedRules,
  type Rule,
  RuleAction,
  RuleOperator,
  RulePhase,
  type Rules,
} from "./rule.entity";

const Text = z.string().max(2048);

export const ActionSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal(RuleAction.set_category), value: Text }).strict(),
  z.object({ op: z.literal(RuleAction.set_description), value: Text }).strict(),
  z
    .object({
      op: z.literal(RuleAction.set_tag),
      key: z.string().min(1).max(80),
      value: Text,
    })
    .strict(),
  z.object({ op: z.literal(RuleAction.ignore) }).strict(),
]);

const ComparatorSchema = z.enum(Comparator);

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
      operator: z.enum([RuleOperator.equal, RuleOperator.notEqual]),
      value: Literal,
    })
    .strict(),
  z
    .object({
      fact: FactSchema,
      operator: z.literal(RuleOperator.contains),
      value: z.union([z.string().max(2048), z.array(Literal).max(1000)]),
    })
    .strict(),
  z
    .object({
      fact: FactSchema,
      operator: z.literal(RuleOperator.regex),
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
      operator: z.literal(RuleOperator.decimalCompare),
      value: z
        .object({
          op: ComparatorSchema,
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
      operator: z.literal(RuleOperator.decimalBetween),
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
      operator: z.literal(RuleOperator.dateCompare),
      value: z
        .object({
          op: ComparatorSchema,
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

const ConditionSchema: z.ZodType<Condition> = z.union([
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
        type: z.enum(RulePhase),
        params: z
          .object({ actions: z.array(ActionSchema).min(1).max(32) })
          .strict(),
      })
      .strict(),
  })
  .strict() satisfies z.ZodType<Rule>;

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
}).strict() satisfies z.ZodType<Rules>;

export function compileRules(input: unknown) {
  return compileValidatedRules(RulesSchema.parse(input));
}
