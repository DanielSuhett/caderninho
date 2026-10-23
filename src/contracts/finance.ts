import { z } from "zod/v4";

import type {
  AggregateQuery,
  TransactionFilter,
  TransactionQuery,
} from "../domain";
import { Metric } from "../domain";

const identifier = z.string().min(1).max(128);
const day = z.iso.date();
const amount = z.string().regex(/^-?(0|[1-9]\d{0,29})$/);
const TransactionFilterSchema = z
  .object({
    accountIds: z
      .array(identifier)
      .min(1)
      .max(100)
      .optional()
      .describe(
        "IDs de contas obtidos em status. IDs desconhecidos retornam NOT_FOUND.",
      ),
    category: z
      .string()
      .max(2048)
      .optional()
      .describe(
        "Categoria exata da origem, sensível a maiúsculas e minúsculas.",
      ),
    connectionIds: z
      .array(identifier)
      .min(1)
      .max(10)
      .optional()
      .describe(
        "IDs de conexões obtidos em status. IDs desconhecidos retornam NOT_FOUND.",
      ),
    currency: z
      .string()
      .min(1)
      .max(12)
      .optional()
      .describe(
        "Moeda exata, por exemplo BRL. Obrigatória para limites monetários.",
      ),
    description: z
      .string()
      .max(2048)
      .optional()
      .describe(
        "Trecho literal da descrição; ignora caixa, inclusive acentos portugueses. Não remove acentos nem aceita curingas.",
      ),
    direction: z.enum(["DEBIT", "CREDIT"]).optional(),
    from: day
      .optional()
      .describe("Dia financeiro inicial inclusivo, AAAA-MM-DD."),
    maxAmountMinor: amount
      .optional()
      .describe(
        "Limite máximo inclusivo do valor ASSINADO, em unidades menores da moeda, como string inteira. BRL -10000 = -R$100,00. Não é magnitude.",
      ),
    minAmountMinor: amount
      .optional()
      .describe(
        "Limite mínimo inclusivo do valor ASSINADO, em unidades menores da moeda, como string inteira. BRL 10000 = R$100,00. Não é magnitude.",
      ),
    status: z.enum(["PENDING", "POSTED"]).optional(),
    to: day.optional().describe("Dia financeiro final inclusivo, AAAA-MM-DD."),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.minAmountMinor !== undefined ||
        value.maxAmountMinor !== undefined) &&
      !value.currency
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Monetary filters require currency",
        path: ["currency"],
      });
    }
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid date range",
        path: ["to"],
      });
    }
    if (
      value.minAmountMinor !== undefined &&
      value.maxAmountMinor !== undefined &&
      BigInt(value.minAmountMinor) > BigInt(value.maxAmountMinor)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid amount range",
        path: ["maxAmountMinor"],
      });
    }
  }) satisfies z.ZodType<TransactionFilter>;
export const TransactionQuerySchema = z
  .object({
    cursor: z
      .object({
        accountId: identifier,
        date: day,
        id: identifier,
        scope: z.string().length(64),
        state: z.string().length(64),
      })
      .strict()
      .optional(),
    filter: TransactionFilterSchema.optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50)
      .describe(
        "Máximo por página. Prefira 5–20 para exemplos; use aggregate para totais.",
      ),
  })
  .strict() satisfies z.ZodType<TransactionQuery>;
export const AggregateQuerySchema = z
  .object({
    filter: TransactionFilterSchema.optional(),
    groupBy: z.enum(["account", "category", "month"]).optional(),
    metric: z
      .enum(Metric)
      .default("count")
      .describe(
        "count conta registros, inclusive pendentes e futuros. debits/credits somam magnitudes POSTED maduras; cash_flow aplica a direção somente em BANK.",
      ),
  })
  .strict() satisfies z.ZodType<AggregateQuery>;
export const ConnectionSelectionSchema = z
  .object({ connectionIds: z.array(identifier).min(1).max(10).optional() })
  .strict();
