import { z } from "zod/v4";

import {
  CategoryColorSchema,
  CategoryIconSchema,
  RunStatus,
  TransactionClassificationSchema,
  TransactionIdentificationSchema,
} from "../domain";
import { CardCommitmentsQuerySchema } from "./card-commitments";
import { PortalCardsQuerySchema } from "./cards";
import { planningDefinitions } from "./planning";
import { ImportedRuleOriginSchema } from "./rule-import";
import { RuleFilterSchema } from "./rules";

// Deliberate read-only allowlist; the portal cannot forward arbitrary MCP mutations.
export const PortalQuerySchema = z
  .object({
    csrf: z.string(),
    query: z.union([
      PortalCardsQuerySchema,
      CardCommitmentsQuerySchema.extend({
        tool: z.literal("get_card_commitments"),
      }),
      planningDefinitions[96].schema.extend({
        tool: z.literal("preview_rule_import"),
      }),
      planningDefinitions[0].schema.extend({ tool: z.literal("get_accounts") }),
      planningDefinitions[2].schema.extend({
        tool: z.literal("get_transactions"),
      }),
      planningDefinitions[3].schema.extend({ tool: z.literal("get_overview") }),
      planningDefinitions[23].schema.extend({
        groupBy: z.literal("month"),
        tool: z.literal("generate_chart"),
      }),
      planningDefinitions[94].schema.extend({
        tool: z.literal("get_portal_transactions"),
      }),
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
        type: z.enum(["personal", "family", "business"]),
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
        kind: z.enum(["income", "expense", "transfer"]),
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
        direction: z.enum(["DEBIT", "CREDIT"]).nullable(),
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
  direction: z.enum(["DEBIT", "CREDIT"]),
  id,
  identification: TransactionIdentificationSchema.nullish(),
  ignored: z.boolean(),
  manual: z.boolean(),
  personId: id,
  personName: z.string(),
  status: z.enum(["POSTED", "PENDING"]),
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
      planningDefinitions[97].schema.extend({
        tool: z.literal("import_rules"),
      }),
      planningDefinitions[52].schema.extend({
        tool: z.literal("create_category"),
      }),
      planningDefinitions[53].schema.extend({
        tool: z.literal("update_category"),
      }),
      planningDefinitions[54].schema.extend({
        tool: z.literal("delete_category"),
      }),
      planningDefinitions[91].schema.extend({
        tool: z.literal("create_category_group"),
      }),
      planningDefinitions[92].schema.extend({
        tool: z.literal("update_category_group"),
      }),
      planningDefinitions[93].schema.extend({
        tool: z.literal("delete_category_group"),
      }),
      planningDefinitions[56].schema.extend({ tool: z.literal("create_rule") }),
      planningDefinitions[57].schema.extend({ tool: z.literal("update_rule") }),
      planningDefinitions[58].schema.extend({ tool: z.literal("delete_rule") }),
      planningDefinitions[84].schema.extend({
        tool: z.literal("create_space"),
      }),
      planningDefinitions[85].schema.extend({
        tool: z.literal("update_space"),
      }),
      planningDefinitions[89].schema.extend({
        tool: z.literal("delete_space"),
      }),
    ]),
    csrf: z.string(),
  })
  .strict();
export type PortalMutation = z.input<typeof PortalMutationSchema>["command"];
