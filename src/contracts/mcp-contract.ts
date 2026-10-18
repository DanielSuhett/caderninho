import { z } from "zod/v4";

import {
  LiveBalanceInputSchema,
  PreviewInputSchema,
  RuleCommandSchema,
  SubscriptionInputSchema,
} from "#contracts/finance.ts";
import {
  AggregateSchema,
  FilterSchema,
  QuerySchema,
} from "#contracts/queries.ts";
import {
  CorrectionInputSchema,
  RecordReferenceSchema,
} from "#domain/record-correction.ts";

export const LongInput = z
  .object({
    requestKey: z.string().min(1).max(200),
    renormalize: z.boolean().optional(),
    itemIds: z.array(z.string()).min(1).max(100),
    filter: FilterSchema.optional(),
  })
  .strict();
export const declarations = [
  {
    name: "caderninho_setup_status",
    description:
      "Diagnóstico de configuração sem credenciais, identificadores ou dados bancários. Oriente uma ação por vez. Nunca peça secrets, senhas ou prints de chaves. Não inicia importação.",
    schema: z.object({}).strict(),
  },
  {
    name: "caderninho_sync",
    description:
      "Materializar todos os recursos autorizados; primeira carga integral, depois incremento. MCP Task durável.",
    schema: LongInput,
  },
  {
    name: "caderninho_reconcile",
    description:
      "Reconciliação explícita de todos os recursos dos Items indicados. MCP Task.",
    schema: LongInput,
  },
  {
    name: "caderninho_reapply",
    description:
      "Reaplicar versão ativa de regras ao filtro explícito, preservando overrides. MCP Task.",
    schema: LongInput,
  },
  {
    name: "caderninho_status",
    description:
      "Consultar cobertura D1, operações e backlog; sem iniciar importação.",
    schema: z.object({}).strict(),
  },
  {
    name: "caderninho_query",
    description:
      "Consultar registros no D1. Campos original.* e effective.* são distintos. Cursor exige mesma revisão.",
    schema: QuerySchema,
  },
  {
    name: "caderninho_aggregate",
    description:
      "Totais exatos por moeda do universo SQL. metric aceita count, amount, cashFlow (BANK), consumption_v1 ou unclassifiedDebits para transações e métricas próprias de cada recurso. Métricas flow excluem pendentes/futuros; valores ignorados são excluídos. Sem metric, soma bruta assinada da origem.",
    schema: AggregateSchema,
  },
  {
    name: "caderninho_rules",
    description:
      "Importar/validar, criar/editar versão completa, ativar, desativar ou ordenar regras. Importação dry-run por padrão; activate publica versão sem recategorizar o passado.",
    schema: RuleCommandSchema,
  },
  {
    name: "caderninho_preview",
    description:
      "Simular regras no mesmo filtro usado por reaplicação. Quantidade total SQL; diferenças da amostra identificada, sem alterar dados.",
    schema: PreviewInputSchema,
  },
  {
    name: "caderninho_override",
    description:
      "Corrigir campo local; value=null remove override e volta à herança. Não escreve na Pluggy.",
    schema: CorrectionInputSchema,
  },
  {
    name: "caderninho_explain",
    description:
      "Explicar origem, versão, regras aplicadas e overrides da transação.",
    schema: RecordReferenceSchema,
  },
  {
    name: "caderninho_get_subscriptions",
    description:
      "Detectar recorrências na base D1 completa do período solicitado. Recusa universo maior que o limite de análise; não inventa totais de amostra.",
    schema: SubscriptionInputSchema,
  },
  {
    name: "caderninho_live_balance",
    description:
      "Leitura pontual da conta na Pluggy, sem sync ou PATCH. Informa horário da leitura e referência da origem; não garante saldo bancário em tempo real.",
    schema: LiveBalanceInputSchema,
  },
] as const;
export const tools = declarations.map((t) => ({
  name: t.name,
  description: t.description,
  inputSchema: z.toJSONSchema(t.schema),
  annotations: {
    readOnlyHint: ![
      "caderninho_sync",
      "caderninho_reconcile",
      "caderninho_reapply",
      "caderninho_rules",
      "caderninho_override",
    ].includes(t.name),
    destructiveHint: false,
    openWorldHint: [
      "caderninho_sync",
      "caderninho_reconcile",
      "caderninho_live_balance",
    ].includes(t.name),
  },
}));
export function validateTool(name: string, input: unknown) {
  const d = declarations.find((x) => x.name === name);
  if (!d) {
    throw new Error("UNKNOWN_TOOL");
  }
  return d.schema.parse(input);
}

export const ToolCallSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("caderninho_setup_status"),
    input: declarations[0].schema,
  }),
  z.object({
    name: z.literal("caderninho_sync"),
    input: declarations[1].schema,
  }),
  z.object({
    name: z.literal("caderninho_reconcile"),
    input: declarations[2].schema,
  }),
  z.object({
    name: z.literal("caderninho_reapply"),
    input: declarations[3].schema,
  }),
  z.object({
    name: z.literal("caderninho_status"),
    input: declarations[4].schema,
  }),
  z.object({
    name: z.literal("caderninho_query"),
    input: declarations[5].schema,
  }),
  z.object({
    name: z.literal("caderninho_aggregate"),
    input: declarations[6].schema,
  }),
  z.object({
    name: z.literal("caderninho_rules"),
    input: declarations[7].schema,
  }),
  z.object({
    name: z.literal("caderninho_preview"),
    input: declarations[8].schema,
  }),
  z.object({
    name: z.literal("caderninho_override"),
    input: declarations[9].schema,
  }),
  z.object({
    name: z.literal("caderninho_explain"),
    input: declarations[10].schema,
  }),
  z.object({
    name: z.literal("caderninho_get_subscriptions"),
    input: declarations[11].schema,
  }),
  z.object({
    name: z.literal("caderninho_live_balance"),
    input: declarations[12].schema,
  }),
]);
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const PRODUCT_INSTRUCTIONS =
  "Consulte a base financeira D1 com query e prefira aggregate para totais exatos por moeda. Nunca coordene páginas Pluggy. Verifique cobertura quando ausente/parcial; inicie sync explicitamente. Sync normal carrega toda a base autorizada inicialmente e depois mantém mudanças. Original é o valor da origem; efetivo aplica override, regras e origem nessa ordem. Valide/simule regras antes da ativação solicitada. Alterar regras não recategoriza o passado; reapply tem escopo explícito e preserva overrides. Sync, reconcile e reapply retornam Tasks somente com negociação io.modelcontextprotocol/tasks; acompanhe tasks/get ou subscriptions/listen. Fechar a escuta não cancela processamento. Recorrências são candidatos, não contratos confirmados. Saldo persistido tem referência temporal; live_balance é intenção pontual distinta e não garante tempo real.";
