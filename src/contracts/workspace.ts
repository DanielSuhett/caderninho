import { z } from "zod/v4";

import {
  AccountType,
  CategoryColorSchema,
  CategoryIconSchema,
  CategoryKind,
  FinancialIdentitySchema,
  ReserveHealth,
  RunStatus,
  SpaceType,
  SpendingGroupBy,
  TransactionDirection,
  TransactionIdentificationSchema,
  TransactionStatus,
} from "../domain";
import { CardCommitmentsResponseSchema } from "./card-commitments";
import { PortalCardsQuerySchema, PortalCardsSchema } from "./cards";
import {
  FinancialOverviewResponseSchema,
  MonthlySpendingResponseSchema,
} from "./dashboard";
import { identityFilterFields } from "./identity-filter";
import { InvestmentListSchema } from "./investments";
import { planningTools } from "./planning";
import {
  ImportedRuleOriginSchema,
  RuleImportResultSchema,
} from "./rule-import";
import { RuleFilterSchema } from "./rules";

export const PortalTransactionQuerySchema =
  planningTools.get_transaction_purchases.schema.extend({
    ...identityFilterFields,
    cardId: z.string().min(1).max(160).optional(),
    cardsOnly: z.boolean().optional(),
    tool: z.literal("get_portal_transactions"),
    transactionId: z.string().min(1).max(160).optional(),
  });

// Deliberate read-only allowlist; the portal cannot forward arbitrary MCP mutations.
export const PortalQuerySchema = z
  .object({
    csrf: z.string(),
    query: z.union([
      PortalCardsQuerySchema,
      planningTools.get_investments.command.extend(identityFilterFields),
      planningTools.get_card_commitments.command,
      planningTools.preview_rule_import.command,
      planningTools.get_accounts.command,
      planningTools.get_emergency_reserve.command,
      planningTools.get_transactions.command,
      planningTools.get_overview.command.extend(identityFilterFields),
      planningTools.generate_chart.command.extend({
        ...identityFilterFields,
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
        fixedCost: z.boolean().default(false),
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
    records: z.array(
      named.extend({
        identity: FinancialIdentitySchema.nullish(),
        personId: id,
        personName: z.string(),
        type: z.enum([AccountType.BANK, AccountType.CREDIT]).optional(),
      }),
    ),
  }),
});
const TransactionRecordSchema = z.object({
  accountId: id,
  amountMinor: minor,
  category: z.string().nullable(),
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
  billPayment: z.enum(["bank", "manual"]).nullable().optional(),
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
    revision: z.number().int().nonnegative().optional(),
    uncategorizedCount: z.number().int().nonnegative().optional(),
  }),
  partial: z.boolean(),
});
export const EmergencyReserveSchema = z.object({
  data: z.object({
    averageMinor: z.string(),
    categories: z.array(
      named.extend({
        averageMinor: z.string(),
        color: CategoryColorSchema.optional(),
        icon: CategoryIconSchema.optional(),
        lowestMinor: minor,
        reductionMinor: z.string(),
      }),
    ),
    coveredMonths: z.number().nullable(),
    currency: z.string(),
    health: z.enum(ReserveHealth).nullable(),
    monthly: z.array(z.object({ amountMinor: z.string(), month: z.string() })),
    months: z.number().int(),
    personId: id,
    reductionMinor: z.string(),
    remainingMinor: minor,
    savedMinor: minor,
    sources: z.array(
      named.extend({
        balanceMinor: minor,
        identity: FinancialIdentitySchema.nullish(),
        kind: z.enum(["account", "investment"]),
        linked: z.boolean(),
      }),
    ),
    surplusMinor: minor,
    targetMinor: z.string(),
  }),
});
export type ReserveReport = z.infer<typeof EmergencyReserveSchema>["data"];
const portalQueryResponses = {
  generate_chart: MonthlySpendingResponseSchema,
  get_accounts: AccountListSchema,
  get_card_commitments: CardCommitmentsResponseSchema,
  get_emergency_reserve: EmergencyReserveSchema,
  get_investments: InvestmentListSchema,
  get_overview: FinancialOverviewResponseSchema,
  get_portal_cards: PortalCardsSchema,
  get_portal_transactions: PortalTransactionListSchema,
  get_transactions: TransactionListSchema,
  preview_rule_import: z.object({ data: RuleImportResultSchema }),
} satisfies Record<PortalQuery["tool"], z.ZodType>;
export type PortalQueryResults = {
  [Tool in keyof typeof portalQueryResponses]: z.output<
    (typeof portalQueryResponses)[Tool]
  >;
};
export const SyncHistorySelectionSchema = z
  .object({
    connectionId: id.optional(),
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
  rules: RuleListSchema.shape.data.shape.records,
  spaces: SpaceListSchema.shape.data.shape.records,
  tags: TagListSchema.shape.data.shape.records,
});
export type WorkspaceCatalog = z.infer<typeof WorkspaceCatalogSchema>;

export const PortalMutationSchema = z
  .object({
    command: z.discriminatedUnion("tool", [
      planningTools.batch_edit_transactions.command
        .pick({
          category: true,
          confirmed: true,
          expected_revision: true,
          idempotency_key: true,
          ids: true,
          spaceId: true,
          tool: true,
        })
        .required({ category: true, expected_revision: true }),
      planningTools.update_account_settings.command
        .pick({
          confirmed: true,
          creditLimitMinor: true,
          expected_revision: true,
          id: true,
          idempotency_key: true,
          spaceId: true,
          tool: true,
        })
        .required({ creditLimitMinor: true, expected_revision: true }),
      planningTools.update_card.command
        .pick({
          confirmed: true,
          creditLimitMinor: true,
          expected_revision: true,
          hidden: true,
          id: true,
          idempotency_key: true,
          name: true,
          personId: true,
          spaceId: true,
          tool: true,
        })
        .required({ expected_revision: true }),
      planningTools.import_rules.command,
      planningTools.apply_rules.command
        .required({ expected_revision: true })
        .extend({ preserveManual: z.literal(true) }),
      planningTools.create_category.command,
      planningTools.update_category.command,
      planningTools.delete_category.command,
      planningTools.create_rule.command,
      planningTools.update_rule.command,
      planningTools.delete_rule.command,
      planningTools.create_space.command,
      planningTools.update_space.command,
      planningTools.delete_space.command,
      planningTools.set_emergency_reserve.command,
    ]),
    csrf: z.string(),
  })
  .strict();
export type PortalMutation = z.input<typeof PortalMutationSchema>["command"];
