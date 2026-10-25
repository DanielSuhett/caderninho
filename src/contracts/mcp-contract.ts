import { z } from "zod/v4";

import {
  AggregateQuerySchema,
  ConnectionSelectionSchema,
  TransactionQuerySchema,
} from "./finance";
import { planningDefinitions } from "./planning";
import { planningOutputSchemas } from "./planning-results";
export const ToolName = {
  aggregate: "caderninho_aggregate",
  status: "caderninho_status",
  sync: "caderninho_sync",
  transactions: "caderninho_transactions",
} as const;
const definitions = [
  {
    description:
      "Estado da instalação, contas e importações. Informa parcialidade e referência temporal; nunca inicia coleta.",
    name: ToolName.status,
    readOnly: true,
    schema: ConnectionSelectionSchema,
  },
  {
    description:
      "Importar contas e transações da origem. Retorna execução existente ou admissão/cooldown por conexão. Não exige coordenar páginas.",
    name: ToolName.sync,
    readOnly: false,
    schema: ConnectionSelectionSchema,
  },
  {
    description:
      "Consultar histórico local por campos conhecidos. Cursor exige mesmo estado da seleção; categoria e descrição vêm da origem.",
    name: ToolName.transactions,
    readOnly: true,
    schema: TransactionQuerySchema,
  },
  {
    description:
      "Totais exatos por moeda sobre todo o universo filtrado. Débito não equivale a gasto. Informe parcialidade, desconhecidos e referência temporal.",
    name: ToolName.aggregate,
    readOnly: true,
    schema: AggregateQuerySchema,
  },
];
export const tools = [...definitions, ...planningDefinitions].map((d) => {
  const output = planningOutputSchemas.get(d.name);
  return {
    annotations: {
      destructiveHint: !d.readOnly && d.name !== ToolName.sync,
      openWorldHint: d.name === ToolName.sync,
      readOnlyHint: d.readOnly,
    },
    description: d.description,
    inputSchema: z.toJSONSchema(d.schema, { io: "input" }),
    name: d.name,
    ...(output && { outputSchema: z.toJSONSchema(output, { io: "output" }) }),
  };
});
export const PRODUCT_INSTRUCTIONS =
  "Consulte contas e transações locais. Use aggregate para totais exatos, nunca some uma página. Preserve moedas e a semântica BANK/CREDIT, pendentes e transferências. Não chame subtotal incerto de total definitivo. Saldo tem referência temporal. Inicie sync explicitamente e acompanhe por status; nunca coordene páginas Pluggy. As quatro ferramentas caderninho_* preservam a visão da origem. As demais consultam a visão efetiva com edições locais. Para escritas, confirme o espaço e a ação com o proprietário e envie confirmed=true e idempotency_key único; repita a chave somente para a mesma solicitação. Edições são locais no Caderninho; não alteram dados na instituição financeira. Débito não é gasto e crédito não é renda. Não peça secrets ao proprietário. Use preview_rule para simular condições antes de salvar; salvar uma regra não reaplica o histórico, apply_rules exige ação explícita com período. get_transaction_purchases reproduz a lista agrupada do painel: cada valor é de uma parcela, não o total da compra. Para ocorrências individuais use get_transactions. Administração de pessoas, perfis Pluggy e autorizações fica no painel privado." +
  " Para perguntas sobre hoje ou movimentação recente, considere oldestLastSuccessAt: o sucesso completo mais antigo das conexões selecionadas, ou null quando alguma nunca concluiu. Consulte status para detalhes por conexão. referenceDay é o dia usado para elegibilidade, não a data da última coleta. partial:false não garante dados atuais nem todo o histórico do banco. Uma seleção vazia não prova movimento zero depois da última importação. Valores amountMinor/totalMinor são strings em unidades menores de cada moeda; limites monetários filtram valores assinados, não magnitudes. A ordem entre transações do mesmo dia desempata por conta e ID, sem prometer horário. Não infira titularidade pelo nome da conta. Para últimas compras, envie get_transactions com order=date_desc e limit=5. Reaproveite os grupos de get_overview/get_spending_comparison sem repetir consultas de categorias ou gráfico sobre a mesma seleção. Use os mesmos filtros em resumo, gráfico e detalhe. Prefira generate_chart com includeSvg=false para compor visualizações. get_recurrences lista compromissos cadastrados; assinaturas exigem análise de frequência e evidências do histórico. Em RESTART_REQUIRED, descarte o cursor e reinicie a seleção; não combine revisões diferentes.";
