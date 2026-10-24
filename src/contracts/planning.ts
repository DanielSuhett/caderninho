import { z } from "zod/v4";

import { CategoryColorSchema, CategoryIconSchema } from "../domain";
import { RuleFilterSchema, RulePreviewQuerySchema } from "./rules";

const id = z.string().min(1).max(160);
const text = z.string().trim().min(1).max(240);
const amount = z.string().regex(/^(0|[1-9]\d{0,29})$/);
const currency = z.enum([
  "BRL",
  "USD",
  "EUR",
  "GBP",
  "ARS",
  "AUD",
  "BHD",
  "CAD",
  "CHF",
  "CLP",
  "JPY",
  "KWD",
]);
const day = z.iso.date();
const direction = z.enum(["DEBIT", "CREDIT"]);
const scope = { personId: id.optional(), spaceId: id.default("personal") };
const mutation = {
  confirmed: z.literal(true),
  idempotency_key: z.string().trim().min(1).max(160),
  spaceId: id,
};
const listing = { ...scope, include_hidden: z.boolean().default(false) };
const categoryAppearance = {
  color: CategoryColorSchema.optional(),
  groupId: id.nullable().optional(),
  icon: CategoryIconSchema.optional(),
};
const period = { ...scope, from: day, to: day };
const selection = {
  ...scope,
  accountId: id.optional(),
  cardNumber: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  categoryId: id.optional(),
  direction: direction.optional(),
  from: day.optional(),
  include_ignored: z.boolean().default(false),
  status: z.enum(["PENDING", "POSTED"]).optional(),
  tagId: id.optional(),
  text: z.string().max(240).optional(),
  to: day.optional(),
};
const accountFields = {
  closeDay: z.number().int().min(1).max(31).optional(),
  creditLimitMinor: amount.optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  hidden: z.boolean().optional(),
  name: text.optional(),
  personId: id.optional(),
};
const transactionFields = {
  amountMinor: amount.optional(),
  category: id.nullable().optional(),
  date: day.optional(),
  description: text.optional(),
  direction: direction.optional(),
  ignored: z.boolean().optional(),
  status: z.enum(["PENDING", "POSTED"]).optional(),
};
const recurrenceFields = {
  accountId: id,
  active: z.boolean().default(true),
  amountMinor: amount,
  categoryId: id.nullable().default(null),
  currency,
  direction,
  endDate: day.nullable().default(null),
  name: text,
  startDate: day,
};
const loanFields = {
  amountMinor: amount,
  currency,
  firstPaymentDate: day,
  installmentMinor: amount,
  name: text,
  paid: z.number().int().min(0).max(600),
  personId: id.optional(),
  total: z.number().int().min(1).max(600),
};
const investmentFields = {
  amountMinor: amount,
  currency,
  date: day,
  included: z.boolean().default(true),
  name: text,
  personId: id.optional(),
  type: text,
};
const goalFields = {
  currency,
  name: text,
  personId: id.optional(),
  targetDate: day.nullable().default(null),
  targetMinor: amount,
};
const ruleFields = {
  accountId: id.nullable().default(null),
  categoryId: id,
  direction: direction.nullable().default(null),
  enabled: z.boolean().default(true),
  filter: RuleFilterSchema.nullable().default(null),
  name: text,
  priority: z.number().int().min(0).max(1000).default(100),
  text: z.string().trim().max(240).default(""),
};

export const planningDefinitions = [
  {
    description:
      "Contas e saldos com referência temporal; inclui contas manuais e preferências locais.",
    name: "get_accounts",
    readOnly: true,
    schema: z.object({ ...listing }).strict(),
  },
  {
    description:
      "Cartões principais e adicionais identificados na origem; ids estáveis e suporte a include_hidden.",
    name: "get_cards",
    readOnly: true,
    schema: z.object({ ...listing }).strict(),
  },
  {
    description:
      "Histórico efetivo com edições locais, filtros e paginação consistente. Não some páginas para calcular totais.",
    name: "get_transactions",
    readOnly: true,
    schema: z
      .object({
        ...selection,
        cursor: z.string().max(4096).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        order: z.enum(["id", "date_desc"]).default("id"),
      })
      .strict(),
  },
  {
    description:
      "Saldos, entradas e saídas por moeda, sem tratar transferências e pagamentos de cartão como consumo.",
    name: "get_overview",
    readOnly: true,
    schema: z.object({ ...period }).strict(),
  },
  {
    description:
      "Despesas classificadas por categoria; exclui transferências e itens ignorados.",
    name: "get_spending_by_category",
    readOnly: true,
    schema: z.object({ ...period }).strict(),
  },
  {
    description: "Comparação com período anterior de igual duração.",
    name: "get_spending_comparison",
    readOnly: true,
    schema: z.object({ ...period }).strict(),
  },
  {
    description:
      "Ritmo observado de despesas e projeção linear explicitamente estimada.",
    name: "get_spending_pace",
    readOnly: true,
    schema: z.object({ ...period }).strict(),
  },
  {
    description:
      "Projeção de saldo BANK com recorrências e vencimentos; informa premissas e desconhecidos.",
    name: "get_projection",
    readOnly: true,
    schema: z.object({ ...period }).strict(),
  },
  {
    description:
      "Faturas importadas, pagamentos bancários e marcação manual separada.",
    name: "get_bills",
    readOnly: true,
    schema: z
      .object({
        ...scope,
        accountId: id.optional(),
        from: day.optional(),
        to: day.optional(),
      })
      .strict(),
  },
  {
    description:
      "Vencimentos de faturas, recorrências e parcelas de empréstimos sem executar pagamentos.",
    name: "get_upcoming_payments",
    readOnly: true,
    schema: z.object({ ...period }).strict(),
  },
  {
    description:
      "Planos manuais e candidatos derivados de metadados; agrupamento da origem é estimativa, não prova de pagamento.",
    name: "get_installments",
    readOnly: true,
    schema: z
      .object({
        ...scope,
        cardNumber: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
        include_completed: z.boolean().default(false),
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
      })
      .strict(),
  },
  {
    description:
      "Listar registros locais e importados, incluindo ocultos quando solicitado.",
    name: "get_categories",
    readOnly: true,
    schema: z
      .object({ ...listing, groupId: id.nullable().optional() })
      .strict(),
  },
  {
    description:
      "Listar registros locais e importados, incluindo ocultos quando solicitado.",
    name: "get_loans",
    readOnly: true,
    schema: z.object({ ...listing }).strict(),
  },
  {
    description:
      "Consultar dados locais de planejamento e registros importados disponíveis.",
    name: "get_tags",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  {
    description:
      "Consultar dados locais de planejamento e registros importados disponíveis.",
    name: "get_rules",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  {
    description:
      "Consultar dados locais de planejamento e registros importados disponíveis.",
    name: "get_recurrences",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  {
    description:
      "Consultar dados locais de planejamento e registros importados disponíveis.",
    name: "get_goals",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  {
    description:
      "Consultar dados locais de planejamento e registros importados disponíveis.",
    name: "get_investments",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  {
    description:
      "Consultar dados locais de planejamento e registros importados disponíveis.",
    name: "get_budget",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  {
    description:
      "Consultar dados locais de planejamento e registros importados disponíveis.",
    name: "get_spaces",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  {
    description:
      "Consultar dados locais de planejamento e registros importados disponíveis.",
    name: "get_notification_preferences",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  {
    description:
      "Quanto guardar por mês, arredondado para cima em unidades mínimas; sem presumir rendimento.",
    name: "get_goal_plan",
    readOnly: true,
    schema: z
      .object({ ...scope, id, months: z.number().int().min(1).max(1200) })
      .strict(),
  },
  {
    description:
      "Cronograma SAC local e estado de conciliação de cada parcela.",
    name: "get_loan_schedule",
    readOnly: true,
    schema: z.object({ ...scope, id }).strict(),
  },
  {
    description:
      "Séries exatas por moeda para gráficos de barras, linhas ou rosca; valores inteiros em strings.",
    name: "generate_chart",
    readOnly: true,
    schema: z
      .object({
        ...period,
        groupBy: z.enum(["category", "month"]).default("category"),
        type: z.enum(["bar", "line", "doughnut"]),
      })
      .strict(),
  },
  {
    description: "Criar conta ou cartão manual.",
    name: "create_manual_account",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        closeDay: z.number().int().min(1).max(31).optional(),
        creditLimitMinor: amount.optional(),
        currency,
        dueDay: z.number().int().min(1).max(31).optional(),
        name: text,
        openingBalanceMinor: amount.default("0"),
        personId: id.optional(),
        type: z.enum(["BANK", "CREDIT"]),
      })
      .strict(),
  },
  {
    description:
      "Editar apresentação; limite e ciclo somente para cartões manuais.",
    name: "update_account_settings",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...accountFields }).strict(),
  },
  {
    description:
      "Excluir conta manual vazia; recusa referências financeiras ativas.",
    name: "delete_manual_account",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description: "Renomear ou ocultar cartão adicional.",
    name: "update_card",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        hidden: z.boolean().optional(),
        id,
        name: text.optional(),
      })
      .strict(),
  },
  {
    description:
      "Excluir apresentação de cartão adicional, preservando histórico.",
    name: "delete_card",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description: "Definir cartão principal.",
    name: "set_primary_card",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description:
      "Alterar apenas confirmação manual da fatura; nunca enviar pagamento ao banco.",
    name: "mark_bill_paid",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description:
      "Alterar apenas confirmação manual da fatura; nunca enviar pagamento ao banco.",
    name: "unmark_bill_paid",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description: "Lançar receita ou despesa em conta manual.",
    name: "create_transaction",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        accountId: id,
        amountMinor: amount,
        category: id.nullable().default(null),
        date: day,
        description: text,
        direction,
        recurrenceId: id.optional(),
        status: z.enum(["PENDING", "POSTED"]).default("POSTED"),
      })
      .strict(),
  },
  {
    description: "Editar projeção local sem sobrescrever registro bancário.",
    name: "edit_transaction",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...transactionFields }).strict(),
  },
  {
    description: "Editar atomicamente até 500 transações selecionadas.",
    name: "batch_edit_transactions",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ids: z.array(id).min(1).max(500),
        ...transactionFields,
      })
      .strict(),
  },
  {
    description:
      "Editar seleção integral do período; recusa seleções acima de 500.",
    name: "edit_transactions_by_period",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        accountId: id.optional(),
        from: day,
        to: day,
        ...transactionFields,
      })
      .strict(),
  },
  {
    description:
      "Excluir apresentação local preservando origem; confirmação e repetição idempotente.",
    name: "delete_transaction",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description:
      "Excluir apresentação local preservando origem; confirmação e repetição idempotente.",
    name: "batch_delete_transactions",
    readOnly: false,
    schema: z
      .object({ ...mutation, ids: z.array(id).min(1).max(500) })
      .strict(),
  },
  {
    description:
      "Excluir apresentação local preservando origem; confirmação e repetição idempotente.",
    name: "delete_transactions_by_period",
    readOnly: false,
    schema: z
      .object({ ...mutation, accountId: id.optional(), from: day, to: day })
      .strict(),
  },
  {
    description: "Alterar tags das transações selecionadas.",
    name: "attach_transaction_tags",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ids: z.array(id).min(1).max(500),
        tagIds: z.array(id).min(1).max(50),
      })
      .strict(),
  },
  {
    description: "Alterar tags das transações selecionadas.",
    name: "remove_transaction_tags",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ids: z.array(id).min(1).max(500),
        tagIds: z.array(id).min(1).max(50),
      })
      .strict(),
  },
  {
    description:
      "Mover projeções de transações para outro espaço da mesma instalação.",
    name: "move_transactions",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ids: z.array(id).min(1).max(500),
        targetSpaceId: id,
      })
      .strict(),
  },
  {
    description:
      "Criar plano e recorrência de parcelas sem gerar transações futuras.",
    name: "create_manual_installment",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        accountId: id,
        amountMinor: amount,
        categoryId: id.nullable().default(null),
        current: z.number().int().min(1).max(600),
        name: text,
        startDate: day,
        total: z.number().int().min(1).max(600),
      })
      .strict(),
  },
  {
    description: "Renomear plano e parcelas vinculadas ou alterar categoria.",
    name: "update_installment",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        categoryId: id.nullable().optional(),
        id,
        name: text.optional(),
      })
      .strict(),
  },
  {
    description: "Alterar conclusão manual sem inventar pagamentos.",
    name: "complete_installment",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description: "Alterar conclusão manual sem inventar pagamentos.",
    name: "reopen_installment",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description: "Criar conta fixa ou receita mensal projetada.",
    name: "create_recurrence",
    readOnly: false,
    schema: z.object({ ...mutation, ...recurrenceFields }).strict(),
  },
  {
    description:
      "Substituir configuração da recorrência, inclusive data final.",
    name: "update_recurrence",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...recurrenceFields }).strict(),
  },
  {
    description: "Desativar projeções futuras.",
    name: "deactivate_recurrence",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description: "Ativar orçamento e definir total mensal por espaço.",
    name: "set_budget",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        currency,
        enabled: z.boolean(),
        monthlyBudgetMinor: amount.nullable(),
      })
      .strict(),
  },
  {
    description: "Definir limite com orçamento ativado.",
    name: "set_category_limit",
    readOnly: false,
    schema: z.object({ ...mutation, amountMinor: amount, id }).strict(),
  },
  {
    description: "Remover limite com orçamento ativado.",
    name: "remove_category_limit",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description: "Criar categoria personalizada.",
    name: "create_category",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ...categoryAppearance,
        kind: z.enum(["income", "expense", "transfer"]),
        name: text,
      })
      .strict(),
  },
  {
    description:
      "Configurar ícone, cor e grupo de qualquer categoria. Nomes de categorias fixas são protegidos.",
    name: "update_category",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ...categoryAppearance,
        hidden: z.boolean().optional(),
        id,
        name: text.optional(),
      })
      .strict(),
  },
  {
    description:
      "Excluir categoria personalizada e reatribuir referências à categoria de sistema do mesmo tipo.",
    name: "delete_category",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description: "Analisar despesas categorizadas e itens sem categoria.",
    name: "analyze_categories",
    readOnly: true,
    schema: z.object({ ...period }).strict(),
  },
  {
    description: "Criar regra textual determinística de categorização.",
    name: "create_rule",
    readOnly: false,
    schema: z.object({ ...mutation, ...ruleFields }).strict(),
  },
  {
    description: "Atualizar regra; prioridade menor vence.",
    name: "update_rule",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...ruleFields }).strict(),
  },
  {
    description: "Excluir regra sem reverter classificações já aplicadas.",
    name: "delete_rule",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description:
      "Aplicar regras sincronicamente a até 500 transações; operação atômica.",
    name: "apply_rules",
    readOnly: false,
    schema: z
      .object({ ...mutation, accountId: id.optional(), from: day, to: day })
      .strict(),
  },
  {
    description: "Criar meta financeira.",
    name: "create_goal",
    readOnly: false,
    schema: z.object({ ...mutation, ...goalFields }).strict(),
  },
  {
    description: "Atualizar meta financeira.",
    name: "update_goal",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...goalFields }).strict(),
  },
  {
    description:
      "Registrar contribuição; transação existente não é contada novamente.",
    name: "add_goal_contribution",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        amountMinor: amount,
        date: day,
        id,
        transactionId: id.optional(),
      })
      .strict(),
  },
  {
    description: "Remover contribuição preservando transação.",
    name: "remove_goal_contribution",
    readOnly: false,
    schema: z.object({ ...mutation, contributionId: id, id }).strict(),
  },
  {
    description: "Concluir meta manualmente.",
    name: "complete_goal",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description:
      "Vincular exatamente uma conta ou investimento da mesma moeda à meta.",
    name: "link_goal_asset",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        accountId: id.optional(),
        id,
        investmentId: id.optional(),
      })
      .strict(),
  },
  {
    description: "Remover vínculo de patrimônio.",
    name: "unlink_goal_asset",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description: "Excluir meta e contribuições locais; preservar transações.",
    name: "delete_goal",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description:
      "Desvincular transação e contribuição associada sem excluir histórico.",
    name: "unlink_goal_transaction",
    readOnly: false,
    schema: z.object({ ...mutation, id, transactionId: id }).strict(),
  },
  {
    description: "Criar investimento manual.",
    name: "create_manual_investment",
    readOnly: false,
    schema: z.object({ ...mutation, ...investmentFields }).strict(),
  },
  {
    description: "Editar investimento manual.",
    name: "update_manual_investment",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...investmentFields }).strict(),
  },
  {
    description: "Definir participação no patrimônio.",
    name: "set_investment_inclusion",
    readOnly: false,
    schema: z.object({ ...mutation, id, included: z.boolean() }).strict(),
  },
  {
    description: "Excluir investimento manual e remover vínculo de metas.",
    name: "delete_manual_investment",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description: "Cadastrar dívida manual sem efetuar contratação bancária.",
    name: "create_manual_loan",
    readOnly: false,
    schema: z.object({ ...mutation, ...loanFields }).strict(),
  },
  {
    description: "Atualizar dívida manual sem alterar parcelas conciliadas.",
    name: "update_manual_loan",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...loanFields }).strict(),
  },
  {
    description: "Ocultar ou restaurar empréstimo.",
    name: "set_loan_visibility",
    readOnly: false,
    schema: z.object({ ...mutation, hidden: z.boolean(), id }).strict(),
  },
  {
    description: "Excluir dívida manual sem parcelas pendentes vinculadas.",
    name: "delete_manual_loan",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description:
      "Criar cronograma SAC exato; juros mensais em pontos-base e arredondamento half-up.",
    name: "create_manual_loan_schedule",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        count: z.number().int().min(1).max(600),
        id,
        monthlyRateBps: z.number().int().min(0).max(10_000),
        principalMinor: amount,
        startDate: day,
      })
      .strict(),
  },
  {
    description:
      "Criar cronograma SAC exato; juros mensais em pontos-base e arredondamento half-up.",
    name: "replace_manual_loan_schedule",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        count: z.number().int().min(1).max(600),
        id,
        monthlyRateBps: z.number().int().min(0).max(10_000),
        principalMinor: amount,
        startDate: day,
      })
      .strict(),
  },
  {
    description:
      "Conciliar próxima parcela com transação compatível ou criar lançamento manual; nunca inicia pagamento bancário.",
    name: "reconcile_scheduled_payment",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        accountId: id,
        id,
        paymentId: id,
        transactionId: id.optional(),
      })
      .strict(),
  },
  {
    description: "Desfazer última conciliação mantendo transação e histórico.",
    name: "undo_scheduled_payment",
    readOnly: false,
    schema: z.object({ ...mutation, id, paymentId: id }).strict(),
  },
  {
    description: "Criar tag.",
    name: "create_tag",
    readOnly: false,
    schema: z.object({ ...mutation, color: text, name: text }).strict(),
  },
  {
    description: "Editar tag.",
    name: "update_tag",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        color: text.optional(),
        id,
        name: text.optional(),
      })
      .strict(),
  },
  {
    description: "Excluir tag e suas associações.",
    name: "delete_tag",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description:
      "Criar espaço local da mesma pessoa; não cria usuários nem permissões.",
    name: "create_space",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        color: text.default("blue"),
        currency,
        icon: text.default("wallet"),
        monthStartDay: z.number().int().min(1).max(28).default(1),
        name: text,
        type: z.enum(["personal", "business", "family"]).default("personal"),
      })
      .strict(),
  },
  {
    description: "Editar espaço e início do ciclo financeiro.",
    name: "update_space",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        color: text.optional(),
        icon: text.optional(),
        id,
        monthStartDay: z.number().int().min(1).max(28).optional(),
        name: text.optional(),
        type: z.enum(["personal", "business", "family"]).optional(),
      })
      .strict(),
  },
  {
    description:
      "Mover conta ou todas as contas da conexão entre espaços pessoais.",
    name: "move_account",
    readOnly: false,
    schema: z.object({ ...mutation, id, targetSpaceId: id }).strict(),
  },
  {
    description:
      "Mover conta ou todas as contas da conexão entre espaços pessoais.",
    name: "move_connection",
    readOnly: false,
    schema: z
      .object({ ...mutation, connectionId: id, targetSpaceId: id })
      .strict(),
  },
  {
    description:
      "Guardar preferência de canal; não configura nem comprova entrega de notificações.",
    name: "set_notification_preference",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        channel: z.enum(["email", "push"]),
        enabled: z.boolean(),
        event: text,
      })
      .strict(),
  },
  {
    description:
      "Excluir um espaço vazio; preserva o grupo pessoal e impede referências órfãs.",
    name: "delete_space",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description:
      "Listar agrupadores de categorias de um espaço; não são espaços financeiros.",
    name: "get_category_groups",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  {
    description: "Criar agrupador de categorias com nome, ícone e cor.",
    name: "create_category_group",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        color: CategoryColorSchema,
        icon: CategoryIconSchema,
        name: text,
      })
      .strict(),
  },
  {
    description: "Editar nome, ícone ou cor de um agrupador de categorias.",
    name: "update_category_group",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        color: CategoryColorSchema.optional(),
        icon: CategoryIconSchema.optional(),
        id,
        name: text.optional(),
      })
      .strict(),
  },
  {
    description:
      "Remover agrupador; suas categorias e transações são preservadas e ficam sem grupo.",
    name: "delete_category_group",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  {
    description:
      "Compras e transações com parcelas de cartão agrupadas antes da paginação, como na lista do painel. Mantém valores de cada parcela, moeda, pendência, datas e identificação. Datas filtram a compra ou primeira parcela conhecida; nunca some a página para calcular totais.",
    name: "get_transaction_purchases",
    readOnly: true,
    schema: z
      .object({
        ...selection,
        cursor: z.string().max(4096).optional(),
        future: z.boolean().default(false),
        limit: z.number().int().min(1).max(500).default(100),
        order: z.literal("date_desc").default("date_desc"),
      })
      .omit({ cardNumber: true, tagId: true })
      .strict(),
  },
  {
    description:
      "Simular uma regra sem salvar nem reclassificar. Usa o mesmo escopo obrigatório, alternativas OU, condições E e dinheiro exato do painel. Informa contagem, amostras e limites de cobertura; truncated ou partial impedem tratar a contagem como definitiva.",
    name: "preview_rule",
    readOnly: true,
    schema: RulePreviewQuerySchema,
  },
] as const;
export const PlanningCommandSchema = z.discriminatedUnion("tool", [
  planningDefinitions[94].schema.extend({
    tool: z.literal("get_transaction_purchases"),
  }),
  planningDefinitions[95].schema.safeExtend({
    tool: z.literal("preview_rule"),
  }),
  planningDefinitions[90].schema.extend({
    tool: z.literal("get_category_groups"),
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
  planningDefinitions[0].schema.extend({ tool: z.literal("get_accounts") }),
  planningDefinitions[1].schema.extend({ tool: z.literal("get_cards") }),
  planningDefinitions[2].schema.extend({ tool: z.literal("get_transactions") }),
  planningDefinitions[3].schema.extend({ tool: z.literal("get_overview") }),
  planningDefinitions[4].schema.extend({
    tool: z.literal("get_spending_by_category"),
  }),
  planningDefinitions[5].schema.extend({
    tool: z.literal("get_spending_comparison"),
  }),
  planningDefinitions[6].schema.extend({
    tool: z.literal("get_spending_pace"),
  }),
  planningDefinitions[7].schema.extend({ tool: z.literal("get_projection") }),
  planningDefinitions[8].schema.extend({ tool: z.literal("get_bills") }),
  planningDefinitions[9].schema.extend({
    tool: z.literal("get_upcoming_payments"),
  }),
  planningDefinitions[10].schema.extend({
    tool: z.literal("get_installments"),
  }),
  planningDefinitions[11].schema.extend({ tool: z.literal("get_categories") }),
  planningDefinitions[12].schema.extend({ tool: z.literal("get_loans") }),
  planningDefinitions[13].schema.extend({ tool: z.literal("get_tags") }),
  planningDefinitions[14].schema.extend({ tool: z.literal("get_rules") }),
  planningDefinitions[15].schema.extend({ tool: z.literal("get_recurrences") }),
  planningDefinitions[16].schema.extend({ tool: z.literal("get_goals") }),
  planningDefinitions[17].schema.extend({ tool: z.literal("get_investments") }),
  planningDefinitions[18].schema.extend({ tool: z.literal("get_budget") }),
  planningDefinitions[19].schema.extend({ tool: z.literal("get_spaces") }),
  planningDefinitions[20].schema.extend({
    tool: z.literal("get_notification_preferences"),
  }),
  planningDefinitions[21].schema.extend({ tool: z.literal("get_goal_plan") }),
  planningDefinitions[22].schema.extend({
    tool: z.literal("get_loan_schedule"),
  }),
  planningDefinitions[23].schema.extend({ tool: z.literal("generate_chart") }),
  planningDefinitions[24].schema.extend({
    tool: z.literal("create_manual_account"),
  }),
  planningDefinitions[25].schema.extend({
    tool: z.literal("update_account_settings"),
  }),
  planningDefinitions[26].schema.extend({
    tool: z.literal("delete_manual_account"),
  }),
  planningDefinitions[27].schema.extend({ tool: z.literal("update_card") }),
  planningDefinitions[28].schema.extend({ tool: z.literal("delete_card") }),
  planningDefinitions[29].schema.extend({
    tool: z.literal("set_primary_card"),
  }),
  planningDefinitions[30].schema.extend({ tool: z.literal("mark_bill_paid") }),
  planningDefinitions[31].schema.extend({
    tool: z.literal("unmark_bill_paid"),
  }),
  planningDefinitions[32].schema.extend({
    tool: z.literal("create_transaction"),
  }),
  planningDefinitions[33].schema.extend({
    tool: z.literal("edit_transaction"),
  }),
  planningDefinitions[34].schema.extend({
    tool: z.literal("batch_edit_transactions"),
  }),
  planningDefinitions[35].schema.extend({
    tool: z.literal("edit_transactions_by_period"),
  }),
  planningDefinitions[36].schema.extend({
    tool: z.literal("delete_transaction"),
  }),
  planningDefinitions[37].schema.extend({
    tool: z.literal("batch_delete_transactions"),
  }),
  planningDefinitions[38].schema.extend({
    tool: z.literal("delete_transactions_by_period"),
  }),
  planningDefinitions[39].schema.extend({
    tool: z.literal("attach_transaction_tags"),
  }),
  planningDefinitions[40].schema.extend({
    tool: z.literal("remove_transaction_tags"),
  }),
  planningDefinitions[41].schema.extend({
    tool: z.literal("move_transactions"),
  }),
  planningDefinitions[42].schema.extend({
    tool: z.literal("create_manual_installment"),
  }),
  planningDefinitions[43].schema.extend({
    tool: z.literal("update_installment"),
  }),
  planningDefinitions[44].schema.extend({
    tool: z.literal("complete_installment"),
  }),
  planningDefinitions[45].schema.extend({
    tool: z.literal("reopen_installment"),
  }),
  planningDefinitions[46].schema.extend({
    tool: z.literal("create_recurrence"),
  }),
  planningDefinitions[47].schema.extend({
    tool: z.literal("update_recurrence"),
  }),
  planningDefinitions[48].schema.extend({
    tool: z.literal("deactivate_recurrence"),
  }),
  planningDefinitions[49].schema.extend({ tool: z.literal("set_budget") }),
  planningDefinitions[50].schema.extend({
    tool: z.literal("set_category_limit"),
  }),
  planningDefinitions[51].schema.extend({
    tool: z.literal("remove_category_limit"),
  }),
  planningDefinitions[52].schema.extend({ tool: z.literal("create_category") }),
  planningDefinitions[53].schema.extend({ tool: z.literal("update_category") }),
  planningDefinitions[54].schema.extend({ tool: z.literal("delete_category") }),
  planningDefinitions[55].schema.extend({
    tool: z.literal("analyze_categories"),
  }),
  planningDefinitions[56].schema.extend({ tool: z.literal("create_rule") }),
  planningDefinitions[57].schema.extend({ tool: z.literal("update_rule") }),
  planningDefinitions[58].schema.extend({ tool: z.literal("delete_rule") }),
  planningDefinitions[59].schema.extend({ tool: z.literal("apply_rules") }),
  planningDefinitions[60].schema.extend({ tool: z.literal("create_goal") }),
  planningDefinitions[61].schema.extend({ tool: z.literal("update_goal") }),
  planningDefinitions[62].schema.extend({
    tool: z.literal("add_goal_contribution"),
  }),
  planningDefinitions[63].schema.extend({
    tool: z.literal("remove_goal_contribution"),
  }),
  planningDefinitions[64].schema.extend({ tool: z.literal("complete_goal") }),
  planningDefinitions[65].schema.extend({ tool: z.literal("link_goal_asset") }),
  planningDefinitions[66].schema.extend({
    tool: z.literal("unlink_goal_asset"),
  }),
  planningDefinitions[67].schema.extend({ tool: z.literal("delete_goal") }),
  planningDefinitions[68].schema.extend({
    tool: z.literal("unlink_goal_transaction"),
  }),
  planningDefinitions[69].schema.extend({
    tool: z.literal("create_manual_investment"),
  }),
  planningDefinitions[70].schema.extend({
    tool: z.literal("update_manual_investment"),
  }),
  planningDefinitions[71].schema.extend({
    tool: z.literal("set_investment_inclusion"),
  }),
  planningDefinitions[72].schema.extend({
    tool: z.literal("delete_manual_investment"),
  }),
  planningDefinitions[73].schema.extend({
    tool: z.literal("create_manual_loan"),
  }),
  planningDefinitions[74].schema.extend({
    tool: z.literal("update_manual_loan"),
  }),
  planningDefinitions[75].schema.extend({
    tool: z.literal("set_loan_visibility"),
  }),
  planningDefinitions[76].schema.extend({
    tool: z.literal("delete_manual_loan"),
  }),
  planningDefinitions[77].schema.extend({
    tool: z.literal("create_manual_loan_schedule"),
  }),
  planningDefinitions[78].schema.extend({
    tool: z.literal("replace_manual_loan_schedule"),
  }),
  planningDefinitions[79].schema.extend({
    tool: z.literal("reconcile_scheduled_payment"),
  }),
  planningDefinitions[80].schema.extend({
    tool: z.literal("undo_scheduled_payment"),
  }),
  planningDefinitions[81].schema.extend({ tool: z.literal("create_tag") }),
  planningDefinitions[82].schema.extend({ tool: z.literal("update_tag") }),
  planningDefinitions[83].schema.extend({ tool: z.literal("delete_tag") }),
  planningDefinitions[84].schema.extend({ tool: z.literal("create_space") }),
  planningDefinitions[85].schema.extend({ tool: z.literal("update_space") }),
  planningDefinitions[86].schema.extend({ tool: z.literal("move_account") }),
  planningDefinitions[87].schema.extend({ tool: z.literal("move_connection") }),
  planningDefinitions[88].schema.extend({
    tool: z.literal("set_notification_preference"),
  }),
  planningDefinitions[89].schema.extend({ tool: z.literal("delete_space") }),
]);
export type PlanningCommand = z.infer<typeof PlanningCommandSchema>;

export const PlanningCursorSchema = z.tuple([
  z.number().int().nonnegative(),
  z.string(),
  z.string(),
]);
