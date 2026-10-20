import { z } from "zod/v4";

import {
  AggregateQuerySchema,
  ConnectionSelectionSchema,
  StatusInputSchema,
  TransactionQuerySchema,
} from "./finance";
export const ToolName = {
  accounts: "caderninho_accounts",
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
    schema: StatusInputSchema,
  },
  {
    description:
      "Importar contas e transações da origem. Retorna execução existente ou admissão/pausa/cooldown por conexão. Não exige coordenar páginas.",
    name: ToolName.sync,
    readOnly: false,
    schema: ConnectionSelectionSchema,
  },
  {
    description:
      "Contas BANK/CREDIT e saldo observado com moeda e referência temporal. Saldo de cartão não é patrimônio disponível.",
    name: ToolName.accounts,
    readOnly: true,
    schema: ConnectionSelectionSchema,
  },
  {
    description:
      "Consultar histórico local por campos conhecidos. Cursor exige mesma revisão; categoria e descrição vêm da origem.",
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
export const tools = definitions.map((d) => ({
  annotations: {
    destructiveHint: false,
    openWorldHint: d.name === ToolName.sync,
    readOnlyHint: d.readOnly,
  },
  description: d.description,
  inputSchema: z.toJSONSchema(d.schema, { io: "input" }),
  name: d.name,
}));
export const PRODUCT_INSTRUCTIONS =
  "Consulte contas e transações locais. Use aggregate para totais exatos, nunca some uma página. Preserve moedas e a semântica BANK/CREDIT, pendentes e transferências. Não chame subtotal incerto de total definitivo. Saldo tem referência temporal. Inicie sync explicitamente e acompanhe por status; nunca coordene páginas Pluggy. O histórico acumula registros e só muda pela importação. Débito não é gasto e crédito não é renda. Não peça secrets ao proprietário.";
