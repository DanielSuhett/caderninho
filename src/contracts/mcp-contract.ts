import { z } from "zod/v4";

import {
  CorrectionInputSchema,
  FilterSchema,
  RecordReferenceSchema,
} from "../domain";
import {
  LiveBalanceInputSchema,
  PreviewInputSchema,
  RuleCommandSchema,
  SubscriptionInputSchema,
} from "./finance";
import { type ToolCall, ToolName } from "./mcp.types";
import { AggregateSchema, QuerySchema } from "./queries";

export const LongInput = z
  .object({
    filter: FilterSchema.optional(),
    itemIds: z.array(z.string()).min(1).max(100),
    renormalize: z.boolean().optional(),
    requestKey: z.string().min(1).max(200),
  })
  .strict();
export const ReapplicationInputSchema = LongInput.extend({
  batches: z.boolean().optional(),
  continuation: z
    .object({ batch: z.number().int().nonnegative(), operationId: z.string() })
    .strict()
    .optional(),
});
const declarations = [
  {
    description:
      "Diagnóstico de configuração sem credenciais, identificadores ou dados bancários. Oriente uma ação por vez. Nunca peça secrets, senhas ou prints de chaves. Não inicia importação.",
    name: ToolName.setup_status,
    schema: z.object({}).strict(),
  },
  {
    description:
      "Importar Items elegíveis, uma admissão por Item a cada 24 horas; informa cooldown, pausa e operação existente. Primeira carga integral, depois incremento. MCP Task durável.",
    name: ToolName.sync,
    schema: LongInput,
  },
  {
    description:
      "Reconciliação dentro da mesma janela de 24 horas por Item; durante cooldown registra intenção para o próximo ciclo. MCP Task quando admitida.",
    name: ToolName.reconcile,
    schema: LongInput,
  },
  {
    description:
      "Reaplicar regras locais sincronamente, até 5 registros, preservando overrides. Para seleções maiores use batches:true e envie a continuation devolvida com a mesma requestKey e seleção. Cada chamada confirma só um lote. Sem Workflow; Task terminal se negociada. Mudanças externas exigem nova execução.",
    name: ToolName.reapply,
    schema: ReapplicationInputSchema,
  },
  {
    description:
      "Consultar cobertura D1, operações e backlog; sem iniciar importação.",
    name: ToolName.status,
    schema: z.object({}).strict(),
  },
  {
    description:
      "Consultar registros no D1. Campos original.* e effective.* são distintos. Cursor exige mesma revisão.",
    name: ToolName.query,
    schema: QuerySchema,
  },
  {
    description:
      "Totais exatos por moeda do universo SQL. metric aceita count, amount, cashFlow (BANK), consumption_v1 ou unclassifiedDebits para transações e métricas próprias de cada recurso. Métricas flow excluem pendentes/futuros; valores ignorados são excluídos. Sem metric, soma bruta assinada da origem.",
    name: ToolName.aggregate,
    schema: AggregateSchema,
  },
  {
    description:
      "Importar/validar, criar/editar versão completa, ativar, desativar ou ordenar regras. Importação dry-run por padrão; activate publica versão sem recategorizar o passado.",
    name: ToolName.rules,
    schema: RuleCommandSchema,
  },
  {
    description:
      "Simular regras no mesmo filtro usado por reaplicação. Quantidade total SQL; diferenças da amostra identificada, sem alterar dados.",
    name: ToolName.preview,
    schema: PreviewInputSchema,
  },
  {
    description:
      "Corrigir campo local; value=null remove override e volta à herança. Não escreve na Pluggy.",
    name: ToolName.override,
    schema: CorrectionInputSchema,
  },
  {
    description:
      "Explicar origem, versão, regras aplicadas e overrides da transação.",
    name: ToolName.explain,
    schema: RecordReferenceSchema,
  },
  {
    description:
      "Detectar recorrências na base D1 completa do período solicitado. Recusa universo maior que o limite de análise; não inventa totais de amostra.",
    name: ToolName.get_subscriptions,
    schema: SubscriptionInputSchema,
  },
  {
    description:
      "Leitura pontual da conta na Pluggy, sem sync ou PATCH. Informa horário da leitura e referência da origem; não garante saldo bancário em tempo real.",
    name: ToolName.live_balance,
    schema: LiveBalanceInputSchema,
  },
] as const;
export const tools = declarations.map((t) => ({
  annotations: {
    destructiveHint: false,
    openWorldHint: [
      ToolName.sync,
      ToolName.reconcile,
      ToolName.live_balance,
    ].some((name) => name === t.name),
    readOnlyHint: ![
      ToolName.sync,
      ToolName.reconcile,
      ToolName.reapply,
      ToolName.rules,
      ToolName.override,
    ].some((name) => name === t.name),
  },
  description: t.description,
  inputSchema: z.toJSONSchema(t.schema),
  name: t.name,
}));
export const ToolCallSchema = z.discriminatedUnion("name", [
  z.object({
    input: declarations[0].schema,
    name: z.literal(ToolName.setup_status),
  }),
  z.object({
    input: declarations[1].schema,
    name: z.literal(ToolName.sync),
  }),
  z.object({
    input: declarations[2].schema,
    name: z.literal(ToolName.reconcile),
  }),
  z.object({
    input: declarations[3].schema,
    name: z.literal(ToolName.reapply),
  }),
  z.object({
    input: declarations[4].schema,
    name: z.literal(ToolName.status),
  }),
  z.object({
    input: declarations[5].schema,
    name: z.literal(ToolName.query),
  }),
  z.object({
    input: declarations[6].schema,
    name: z.literal(ToolName.aggregate),
  }),
  z.object({
    input: declarations[7].schema,
    name: z.literal(ToolName.rules),
  }),
  z.object({
    input: declarations[8].schema,
    name: z.literal(ToolName.preview),
  }),
  z.object({
    input: declarations[9].schema,
    name: z.literal(ToolName.override),
  }),
  z.object({
    input: declarations[10].schema,
    name: z.literal(ToolName.explain),
  }),
  z.object({
    input: declarations[11].schema,
    name: z.literal(ToolName.get_subscriptions),
  }),
  z.object({
    input: declarations[12].schema,
    name: z.literal(ToolName.live_balance),
  }),
]) satisfies z.ZodType<ToolCall>;

export const PRODUCT_INSTRUCTIONS =
  "Consulte a base financeira D1 com query e prefira aggregate para totais exatos por moeda. Nunca coordene páginas Pluggy. Verifique cobertura quando ausente/parcial; inicie sync explicitamente. Sync normal carrega todos os recursos dos Items selecionados inicialmente e depois mantém mudanças. Original é o valor da origem; efetivo aplica override, regras e origem nessa ordem. Valide/simule regras antes da ativação solicitada. Alterar regras não recategoriza o passado; reapply recebe uma seleção explícita e preserva overrides. Sync e reconcile respeitam 24 horas por Item e retornam Tasks com negociação io.modelcontextprotocol/tasks, ou estado de cooldown/pausa sem nova tarefa. Reapply é síncrono até 5 transações; seleções maiores exigem batches:true e continuação explícita com mesma chave e seleção. Com Tasks negociadas, cada lote confirmado tem Task terminal. Acompanhe ingestão por tasks/get ou subscriptions/listen; fechar a escuta não cancela processamento. Recorrências são candidatos, não contratos confirmados. Saldo persistido tem referência temporal; live_balance é intenção pontual distinta e não garante tempo real.";
