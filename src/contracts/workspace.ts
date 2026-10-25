import { z } from "zod/v4";

import {
  CategoryColorSchema,
  CategoryIconSchema,
  CategoryKind,
  RunStatus,
  SpaceType,
  SpendingGroupBy,
  TransactionClassificationSchema,
  TransactionDirection,
  TransactionIdentificationSchema,
  TransactionStatus,
} from "../domain";
import {
  FinancialOverviewResponseSchema,
  MonthlySpendingResponseSchema,
} from "./dashboard";
import { planningTools } from "./planning";
import {
  ImportedRuleOriginSchema,
  RuleImportResultSchema,
} from "./rule-import";
import { RuleFilterSchema } from "./rules";

export const PortalTransactionQuerySchema =
  planningTools.get_transaction_purchases.schema.extend({
    tool: z.literal("get_portal_transactions"),
  });

// Deliberate read-only allowlist; the portal cannot forward arbitrary MCP mutations.
export const PortalQuerySchema = z
  .object({
    csrf: z.string(),
    query: z.union([
      planningTools.preview_rule_import.command,
      planningTools.get_accounts.command,
      planningTools.get_transactions.command,
      planningTools.get_overview.command,
      planningTools.generate_chart.command.extend({
        groupBy: z.literal(SpendingGroupBy.month),
      }),
      PortalTransactionQuerySchema,
    ]),
  })
  .strict();
export type PortalQuery = z.input<typeof PortalQuerySchema>["query"];
export type PortalTransactionQuery = Extract<
  z.infer<typeof PortalQuerySchema>["query"],
  { tool: "get_portal_transactions" }
>;
const id = z.string().min(1).max(160);
const minor = z
  .string()
  .regex(/^-?\d+$/)
  .nullable();
const named = z.object({ id, name: z.string() });
const SpaceListSchema = z.object({
  data: z.object({
    records: z.array(
      named.extend({
        budgetEnabled: z.boolean(),
        currency: z.string(),
        monthlyBudgetMinor: minor,
        monthStartDay: z.number(),
        type: z.enum([
          SpaceType.personal,
          SpaceType.family,
          SpaceType.business,
        ]),
      }),
    ),
  }),
});
const CategoryListSchema = z.object({
  data: z.object({
    records: z.array(
      named.extend({
        color: CategoryColorSchema.default("#64748b"),
        groupId: id.nullable().default(null),
        hidden: z.boolean(),
        icon: CategoryIconSchema.default("shopping"),
        kind: z.enum([
          CategoryKind.income,
          CategoryKind.expense,
          CategoryKind.transfer,
        ]),
        limitMinor: minor,
        system: z.boolean().default(false),
      }),
    ),
  }),
});
const TagListSchema = z.object({
  data: z.object({ records: z.array(named) }),
});
const RuleListSchema = z.object({
  data: z.object({
    records: z.array(
      named.extend({
        accountId: id.nullable(),
        categoryId: id,
        direction: z
          .enum([TransactionDirection.DEBIT, TransactionDirection.CREDIT])
          .nullable(),
        enabled: z.boolean(),
        filter: RuleFilterSchema.nullable().optional(),
        pack: ImportedRuleOriginSchema.optional(),
        priority: z.number(),
        text: z.string(),
      }),
    ),
  }),
});
export const AccountListSchema = z.object({
  data: z.object({
    records: z.array(named.extend({ personId: id, personName: z.string() })),
  }),
});
const TransactionRecordSchema = z.object({
  accountId: id,
  amountMinor: minor,
  category: z.string().nullable(),
  classification: TransactionClassificationSchema.nullish(),
  currency: z.string(),
  date: z.string(),
  description: z.string(),
  direction: z.enum([TransactionDirection.DEBIT, TransactionDirection.CREDIT]),
  id,
  identification: TransactionIdentificationSchema.nullish(),
  ignored: z.boolean(),
  manual: z.boolean(),
  personId: id,
  personName: z.string(),
  status: z.enum([TransactionStatus.POSTED, TransactionStatus.PENDING]),
});
export const TransactionListSchema = z.object({
  data: z.object({
    cursor: z.string().nullable(),
    records: z.array(TransactionRecordSchema),
  }),
  partial: z.boolean(),
});
const PortalInstallmentSchema = TransactionRecordSchema.extend({
  cardNumber: z.string().nullable(),
  installmentNumber: z.number().int().nullable(),
  purchaseDate: z.string().nullable(),
  totalInstallments: z.number().int().nullable(),
});
export const PortalTransactionListSchema = z.object({
  data: z.object({
    cursor: z.string().nullable(),
    records: z.array(
      PortalInstallmentSchema.extend({
        anchorDate: z.string(),
        anchorKind: z.enum(["transaction", "purchase", "first_seen"]),
        installments: z.array(PortalInstallmentSchema),
      }),
    ),
    referenceDay: z.string(),
  }),
  partial: z.boolean(),
});
const portalQueryResponses = {
  generate_chart: MonthlySpendingResponseSchema,
  get_accounts: AccountListSchema,
  get_overview: FinancialOverviewResponseSchema,
  get_portal_transactions: PortalTransactionListSchema,
  get_transactions: TransactionListSchema,
  preview_rule_import: z.object({ data: RuleImportResultSchema }),
} satisfies Record<PortalQuery["tool"], z.ZodType>;
export type PortalQueryResults = {
  [Tool in keyof typeof portalQueryResponses]: z.output<
    (typeof portalQueryResponses)[Tool]
  >;
};
const queryValidators: {
  [Tool in keyof PortalQueryResults]: z.ZodType<PortalQueryResults[Tool]>;
} = portalQueryResponses;
export function parsePortalQueryResult<Tool extends keyof PortalQueryResults>(
  tool: Tool,
  value: unknown,
): PortalQueryResults[Tool] {
  return queryValidators[tool].parse(value);
}

export const SyncHistorySelectionSchema = z
  .object({
    cursor: z.string().max(4096).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    personId: id.optional(),
    status: z.enum(RunStatus).optional(),
  })
  .strict();
export const SyncHistoryCursorSchema = z.object({
  admittedAt: z.iso.datetime(),
  id,
});
export type SyncHistorySelection = z.infer<typeof SyncHistorySelectionSchema>;
export const SyncHistoryResultSchema = z.object({
  cursor: z.string().nullable(),
  records: z.array(
    z.object({
      admittedAt: z.string(),
      connectionId: id,
      error: z.string().nullable(),
      finishedAt: z.string().nullable(),
      id,
      legacy: z.boolean(),
      personId: id,
      personName: z.string(),
      phase: z.string().nullable(),
      profileId: id,
      profileName: z.string(),
      sequence: z.number(),
      status: z.enum(RunStatus),
    }),
  ),
});
export type SyncHistoryResult = z.infer<typeof SyncHistoryResultSchema>;

export const CatalogSelectionSchema = z
  .object({ spaceId: id.default("personal") })
  .strict();
export const WorkspaceCatalogSchema = z.object({
  categories: CategoryListSchema.shape.data.shape.records,
  categoryGroups: z
    .array(
      named.extend({ color: CategoryColorSchema, icon: CategoryIconSchema }),
    )
    .default([]),
  rules: RuleListSchema.shape.data.shape.records,
  spaces: SpaceListSchema.shape.data.shape.records,
  tags: TagListSchema.shape.data.shape.records,
});
export type WorkspaceCatalog = z.infer<typeof WorkspaceCatalogSchema>;

export const PortalMutationSchema = z
  .object({
    command: z.discriminatedUnion("tool", [
      planningTools.import_rules.command,
      planningTools.create_category.command,
      planningTools.update_category.command,
      planningTools.delete_category.command,
      planningTools.create_category_group.command,
      planningTools.update_category_group.command,
      planningTools.delete_category_group.command,
      planningTools.create_rule.command,
      planningTools.update_rule.command,
      planningTools.delete_rule.command,
      planningTools.create_space.command,
      planningTools.update_space.command,
      planningTools.delete_space.command,
    ]),
    csrf: z.string(),
  })
  .strict();
export type PortalMutation = z.input<typeof PortalMutationSchema>["command"];
