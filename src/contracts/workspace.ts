import { z } from "zod/v4";

import { RunStatus } from "../domain";
import { planningDefinitions } from "./planning";
import { RuleFilterSchema } from "./rules";

// Deliberate read-only allowlist; the portal cannot forward arbitrary MCP mutations.
export const PortalQuerySchema = z
  .object({
    csrf: z.string(),
    query: z.union([
      planningDefinitions[0].schema.extend({ tool: z.literal("get_accounts") }),
      planningDefinitions[2].schema.extend({
        tool: z.literal("get_transactions"),
      }),
    ]),
  })
  .strict();
export type PortalQuery = z.input<typeof PortalQuerySchema>["query"];
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
        hidden: z.boolean(),
        kind: z.enum(["income", "expense", "transfer"]),
        limitMinor: minor,
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
export const TransactionListSchema = z.object({
  data: z.object({
    cursor: z.string().nullable(),
    records: z.array(
      z.object({
        accountId: id,
        amountMinor: minor,
        category: z.string().nullable(),
        currency: z.string(),
        date: z.string(),
        description: z.string(),
        direction: z.enum(["DEBIT", "CREDIT"]),
        id,
        ignored: z.boolean(),
        manual: z.boolean(),
        personId: id,
        personName: z.string(),
        status: z.enum(["POSTED", "PENDING"]),
      }),
    ),
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
  rules: RuleListSchema.shape.data.shape.records,
  spaces: SpaceListSchema.shape.data.shape.records,
  tags: TagListSchema.shape.data.shape.records,
});
export type WorkspaceCatalog = z.infer<typeof WorkspaceCatalogSchema>;

export const PortalMutationSchema = z
  .object({
    command: z.discriminatedUnion("tool", [
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
