import { z } from "zod/v4";

import {
  LiveBalanceInputSchema,
  PreviewInputSchema,
  RuleCommandSchema,
  SubscriptionInputSchema,
} from "#contracts/finance.ts";
import { type ToolCall, ToolName } from "#contracts/mcp.types.ts";
import { AggregateSchema, QuerySchema } from "#contracts/queries.ts";
import { FilterSchema } from "#domain/filter.ts";
import {
  CorrectionInputSchema,
  RecordReferenceSchema,
} from "#domain/record-correction.schema.ts";

export const LongInput = z
  .object({
    requestKey: z.string().min(1).max(200),
    renormalize: z.boolean().optional(),
    itemIds: z.array(z.string()).min(1).max(100),
    filter: FilterSchema.optional(),
  })
  .strict();
const declarations = [
  {
    name: ToolName.setup_status,
    description:
      "Diagnóstico de configuração sem credenciais, identificadores ou dados bancários. Oriente uma ação por vez. Nunca peça secrets, senhas ou prints de chaves. Não inicia importação.",
    schema: z.object({}).strict(),
  },
  {
    name: ToolName.sync,
    description:
      "Materializar todos os recursos autorizados; primeira carga integral, depois incremento. MCP Task durável.",
    schema: LongInput,
  },
  {
    name: ToolName.reconcile,
    description:
      "Reconciliação explícita de todos os recursos dos Items indicados. MCP Task.",
    schema: LongInput,
  },
  {
    name: ToolName.reapply,
    description:
      "Reaplicar versão ativa de regras ao filtro explícito, preservando overrides. MCP Task.",
    schema: LongInput,
  },
  {
    name: ToolName.status,
    description:
      "Consultar cobertura D1, operações e backlog; sem iniciar importação.",
    schema: z.object({}).strict(),
  },
  {
    name: ToolName.query,
    description:
      "Consultar registros no D1. Campos original.* e effective.* são distintos. Cursor exige mesma revisão.",
    schema: QuerySchema,
  },
  {
    name: ToolName.aggregate,
    description:
      "Totais exatos por moeda do universo SQL. metric aceita count, amount, cashFlow (BANK), consumption_v1 ou unclassifiedDebits para transações e métricas próprias de cada recurso. Métricas flow excluem pendentes/futuros; valores ignorados são excluídos. Sem metric, soma bruta assinada da origem.",
    schema: AggregateSchema,
  },
  {
    name: ToolName.rules,
    description:
      "Importar/validar, criar/editar versão completa, ativar, desativar ou ordenar regras. Importação dry-run por padrão; activate publica versão sem recategorizar o passado.",
    schema: RuleCommandSchema,
  },
  {
    name: ToolName.preview,
    description:
      "Simular regras no mesmo filtro usado por reaplicação. Quantidade total SQL; diferenças da amostra identificada, sem alterar dados.",
    schema: PreviewInputSchema,
  },
  {
    name: ToolName.override,
    description:
      "Corrigir campo local; value=null remove override e volta à herança. Não escreve na Pluggy.",
    schema: CorrectionInputSchema,
  },
  {
    name: ToolName.explain,
    description:
      "Explicar origem, versão, regras aplicadas e overrides da transação.",
    schema: RecordReferenceSchema,
  },
  {
    name: ToolName.get_subscriptions,
    description:
      "Detectar recorrências na base D1 completa do período solicitado. Recusa universo maior que o limite de análise; não inventa totais de amostra.",
    schema: SubscriptionInputSchema,
  },
  {
    name: ToolName.live_balance,
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
      ToolName.sync,
      ToolName.reconcile,
      ToolName.reapply,
      ToolName.rules,
      ToolName.override,
    ].some((name) => name === t.name),
    destructiveHint: false,
    openWorldHint: [
      ToolName.sync,
      ToolName.reconcile,
      ToolName.live_balance,
    ].some((name) => name === t.name),
  },
}));
export const ToolCallSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal(ToolName.setup_status),
    input: declarations[0].schema,
  }),
  z.object({
    name: z.literal(ToolName.sync),
    input: declarations[1].schema,
  }),
  z.object({
    name: z.literal(ToolName.reconcile),
    input: declarations[2].schema,
  }),
  z.object({
    name: z.literal(ToolName.reapply),
    input: declarations[3].schema,
  }),
  z.object({
    name: z.literal(ToolName.status),
    input: declarations[4].schema,
  }),
  z.object({
    name: z.literal(ToolName.query),
    input: declarations[5].schema,
  }),
  z.object({
    name: z.literal(ToolName.aggregate),
    input: declarations[6].schema,
  }),
  z.object({
    name: z.literal(ToolName.rules),
    input: declarations[7].schema,
  }),
  z.object({
    name: z.literal(ToolName.preview),
    input: declarations[8].schema,
  }),
  z.object({
    name: z.literal(ToolName.override),
    input: declarations[9].schema,
  }),
  z.object({
    name: z.literal(ToolName.explain),
    input: declarations[10].schema,
  }),
  z.object({
    name: z.literal(ToolName.get_subscriptions),
    input: declarations[11].schema,
  }),
  z.object({
    name: z.literal(ToolName.live_balance),
    input: declarations[12].schema,
  }),
]) satisfies z.ZodType<ToolCall>;

export const PRODUCT_INSTRUCTIONS =
  "Consulte a base financeira D1 com query e prefira aggregate para totais exatos por moeda. Nunca coordene páginas Pluggy. Verifique cobertura quando ausente/parcial; inicie sync explicitamente. Sync normal carrega toda a base autorizada inicialmente e depois mantém mudanças. Original é o valor da origem; efetivo aplica override, regras e origem nessa ordem. Valide/simule regras antes da ativação solicitada. Alterar regras não recategoriza o passado; reapply tem escopo explícito e preserva overrides. Sync, reconcile e reapply retornam Tasks somente com negociação io.modelcontextprotocol/tasks; acompanhe tasks/get ou subscriptions/listen. Fechar a escuta não cancela processamento. Recorrências são candidatos, não contratos confirmados. Saldo persistido tem referência temporal; live_balance é intenção pontual distinta e não garante tempo real.";
