import { z } from "zod/v4";

import {
  AggregateQuerySchema,
  ConnectionSelectionSchema,
  TransactionQuerySchema,
} from "./finance";
import { planningDefinitions } from "./planning";
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
export const tools = [...definitions, ...planningDefinitions].map((d) => ({
  annotations: {
    destructiveHint: !d.readOnly && d.name !== ToolName.sync,
    openWorldHint: d.name === ToolName.sync,
    readOnlyHint: d.readOnly,
  },
  description: d.description,
  inputSchema: z.toJSONSchema(d.schema, { io: "input" }),
  name: d.name,
}));
export const PRODUCT_INSTRUCTIONS =
  "Consulte contas e transações locais. Use aggregate para totais exatos, nunca some uma página. Preserve moedas e a semântica BANK/CREDIT, pendentes e transferências. Não chame subtotal incerto de total definitivo. Saldo tem referência temporal. Inicie sync explicitamente e acompanhe por status; nunca coordene páginas Pluggy. As quatro ferramentas caderninho_* preservam a visão da origem. As demais consultam a visão efetiva com edições locais. Para escritas, confirme o espaço e a ação com o proprietário e envie confirmed=true e idempotency_key único; repita a chave somente para a mesma solicitação. Edições nunca alteram dados no banco. Débito não é gasto e crédito não é renda. Não peça secrets ao proprietário.";
