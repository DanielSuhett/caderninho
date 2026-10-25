import { z } from "zod/v4";

import {
  AccountType,
  CategoryColorSchema,
  CategoryIconSchema,
  CategoryKind,
  ChartType,
  NotificationChannel,
  SpaceType,
  SpendingGroupBy,
  TransactionDirection,
  TransactionOrder,
  TransactionStatus,
} from "../domain";
import { RuleImportFields } from "./rule-import";
import { RuleFieldsSchema, RulePreviewQuerySchema } from "./rules";

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
const direction = z.enum([
  TransactionDirection.DEBIT,
  TransactionDirection.CREDIT,
]);
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
  currency: currency.optional(),
  direction: direction.optional(),
  from: day.optional(),
  include_ignored: z.boolean().default(false),
  status: z
    .enum([TransactionStatus.PENDING, TransactionStatus.POSTED])
    .optional(),
  tagId: id.optional(),
  text: z.string().max(240).optional(),
  to: day.optional(),
};
const analysisPeriod = { ...selection, from: day, to: day };
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
  status: z
    .enum([TransactionStatus.PENDING, TransactionStatus.POSTED])
    .optional(),
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
const ruleFields = RuleFieldsSchema.shape;

export const planningTools = {
  add_goal_contribution: {
    description:
      "Registrar contribuição; transação existente não é contada novamente.",
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
  analyze_categories: {
    description: "Analisar despesas categorizadas e itens sem categoria.",
    readOnly: true,
    schema: z.object({ ...analysisPeriod }).strict(),
  },
  apply_rules: {
    description:
      "Aplicar regras sincronicamente a até 500 transações; operação atômica.",
    readOnly: false,
    schema: z
      .object({ ...mutation, accountId: id.optional(), from: day, to: day })
      .strict(),
  },
  attach_transaction_tags: {
    description: "Alterar tags das transações selecionadas.",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ids: z.array(id).min(1).max(500),
        tagIds: z.array(id).min(1).max(50),
      })
      .strict(),
  },
  batch_delete_transactions: {
    description:
      "Excluir apresentação local preservando origem; confirmação e repetição idempotente.",
    readOnly: false,
    schema: z
      .object({ ...mutation, ids: z.array(id).min(1).max(500) })
      .strict(),
  },
  batch_edit_transactions: {
    description: "Editar atomicamente até 500 transações selecionadas.",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ids: z.array(id).min(1).max(500),
        ...transactionFields,
      })
      .strict(),
  },
  complete_goal: {
    description: "Concluir meta manualmente.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  complete_installment: {
    description: "Alterar conclusão manual sem inventar pagamentos.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  create_category: {
    description: "Criar categoria personalizada.",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ...categoryAppearance,
        kind: z.enum([
          CategoryKind.income,
          CategoryKind.expense,
          CategoryKind.transfer,
        ]),
        name: text,
      })
      .strict(),
  },
  create_category_group: {
    description: "Criar agrupador de categorias com nome, ícone e cor.",
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
  create_goal: {
    description: "Criar meta financeira.",
    readOnly: false,
    schema: z.object({ ...mutation, ...goalFields }).strict(),
  },
  create_manual_account: {
    description: "Criar conta ou cartão manual.",
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
        type: z.enum([AccountType.BANK, AccountType.CREDIT]),
      })
      .strict(),
  },
  create_manual_installment: {
    description:
      "Criar plano e recorrência de parcelas sem gerar transações futuras.",
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
  create_manual_investment: {
    description: "Criar investimento manual.",
    readOnly: false,
    schema: z.object({ ...mutation, ...investmentFields }).strict(),
  },
  create_manual_loan: {
    description: "Cadastrar dívida manual sem efetuar contratação bancária.",
    readOnly: false,
    schema: z.object({ ...mutation, ...loanFields }).strict(),
  },
  create_manual_loan_schedule: {
    description:
      "Criar cronograma SAC exato; juros mensais em pontos-base e arredondamento half-up.",
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
  create_recurrence: {
    description: "Criar conta fixa ou receita mensal projetada.",
    readOnly: false,
    schema: z.object({ ...mutation, ...recurrenceFields }).strict(),
  },
  create_rule: {
    description: "Criar regra textual determinística de categorização.",
    readOnly: false,
    schema: z.object({ ...mutation, ...ruleFields }).strict(),
  },
  create_space: {
    description:
      "Criar espaço local da mesma pessoa; não cria usuários nem permissões.",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        color: text.default("blue"),
        currency,
        icon: text.default("wallet"),
        monthStartDay: z.number().int().min(1).max(28).default(1),
        name: text,
        type: z
          .enum([SpaceType.personal, SpaceType.business, SpaceType.family])
          .default(SpaceType.personal),
      })
      .strict(),
  },
  create_tag: {
    description: "Criar tag.",
    readOnly: false,
    schema: z.object({ ...mutation, color: text, name: text }).strict(),
  },
  create_transaction: {
    description: "Lançar receita ou despesa em conta manual.",
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
        status: z
          .enum([TransactionStatus.PENDING, TransactionStatus.POSTED])
          .default(TransactionStatus.POSTED),
      })
      .strict(),
  },
  deactivate_recurrence: {
    description: "Desativar projeções futuras.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_card: {
    description:
      "Excluir apresentação de cartão adicional, preservando histórico.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_category: {
    description:
      "Excluir categoria personalizada e reatribuir referências à categoria de sistema do mesmo tipo.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_category_group: {
    description:
      "Remover agrupador; suas categorias e transações são preservadas e ficam sem grupo.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_goal: {
    description: "Excluir meta e contribuições locais; preservar transações.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_manual_account: {
    description:
      "Excluir conta manual vazia; recusa referências financeiras ativas.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_manual_investment: {
    description: "Excluir investimento manual e remover vínculo de metas.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_manual_loan: {
    description: "Excluir dívida manual sem parcelas pendentes vinculadas.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_rule: {
    description: "Excluir regra sem reverter classificações já aplicadas.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_space: {
    description:
      "Excluir um espaço vazio; preserva o grupo pessoal e impede referências órfãs.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_tag: {
    description: "Excluir tag e suas associações.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_transaction: {
    description:
      "Excluir apresentação local preservando origem; confirmação e repetição idempotente.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  delete_transactions_by_period: {
    description:
      "Excluir apresentação local preservando origem; confirmação e repetição idempotente.",
    readOnly: false,
    schema: z
      .object({ ...mutation, accountId: id.optional(), from: day, to: day })
      .strict(),
  },
  edit_transaction: {
    description: "Editar projeção local sem sobrescrever registro bancário.",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...transactionFields }).strict(),
  },
  edit_transactions_by_period: {
    description:
      "Editar seleção integral do período; recusa seleções acima de 500.",
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
  generate_chart: {
    description:
      "Séries exatas por moeda, com nomes e apresentação monetária. Use includeSvg=false para compor sua própria visualização; SVG estático é opcional.",
    readOnly: true,
    schema: z
      .object({
        ...analysisPeriod,
        groupBy: z
          .enum([SpendingGroupBy.category, SpendingGroupBy.month])
          .default(SpendingGroupBy.category),
        includeSvg: z.boolean().default(true),
        type: z.enum([ChartType.bar, ChartType.line, ChartType.doughnut]),
      })
      .strict(),
  },
  get_accounts: {
    description:
      "Contas e saldos com referência temporal; inclui contas manuais e preferências locais.",
    readOnly: true,
    schema: z.object({ ...listing }).strict(),
  },
  get_bills: {
    description:
      "Faturas importadas, pagamentos bancários e marcação manual separada.",
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
  get_budget: {
    description:
      "Orçamento configurado e consumo do ciclo vigente por moeda e categoria; informa valores sem classificação.",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  get_cards: {
    description:
      "Cartões principais e adicionais identificados na origem; ids estáveis e suporte a include_hidden.",
    readOnly: true,
    schema: z.object({ ...listing }).strict(),
  },
  get_categories: {
    description:
      "Listar registros locais e importados, incluindo ocultos quando solicitado.",
    readOnly: true,
    schema: z
      .object({ ...listing, groupId: id.nullable().optional() })
      .strict(),
  },
  get_category_groups: {
    description:
      "Listar agrupadores de categorias de um espaço; não são espaços financeiros.",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  get_goal_plan: {
    description:
      "Quanto guardar por mês, arredondado para cima em unidades mínimas; sem presumir rendimento.",
    readOnly: true,
    schema: z
      .object({ ...scope, id, months: z.number().int().min(1).max(1200) })
      .strict(),
  },
  get_goals: {
    description:
      "Metas locais com valor, prazo e vínculo patrimonial; use get_goal_plan para calcular aportes.",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  get_installments: {
    description:
      "Planos manuais e candidatos derivados de metadados; agrupamento da origem é estimativa, não prova de pagamento.",
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
  get_investments: {
    description:
      "Posições locais e importadas disponíveis. Variação de saldo não comprova rentabilidade.",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  get_loan_schedule: {
    description:
      "Cronograma SAC local e estado de conciliação de cada parcela.",
    readOnly: true,
    schema: z.object({ ...scope, id }).strict(),
  },
  get_loans: {
    description:
      "Listar registros locais e importados, incluindo ocultos quando solicitado.",
    readOnly: true,
    schema: z.object({ ...listing }).strict(),
  },
  get_notification_preferences: {
    description:
      "Preferências locais de avisos. deliveryConfigured=false informa que o envio não está configurado.",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  get_overview: {
    description:
      "Saldos, entradas e saídas por moeda, sem tratar transferências e pagamentos de cartão como consumo.",
    readOnly: true,
    schema: z.object({ ...analysisPeriod }).strict(),
  },
  get_projection: {
    description:
      "Projeção de saldo BANK com recorrências e vencimentos; informa premissas e desconhecidos.",
    readOnly: true,
    schema: z.object({ ...period }).strict(),
  },
  get_recurrences: {
    description:
      "Compromissos recorrentes cadastrados. Não detecta automaticamente assinaturas no histórico.",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  get_rules: {
    description:
      "Regras locais ordenadas por prioridade. Salvar não reaplica o histórico; use preview_rule antes de aplicar.",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  get_spaces: {
    description:
      "Espaços locais e suas configurações de moeda, ciclo e orçamento.",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  get_spending_by_category: {
    description:
      "Despesas classificadas por categoria; exclui transferências e itens ignorados.",
    readOnly: true,
    schema: z.object({ ...analysisPeriod }).strict(),
  },
  get_spending_comparison: {
    description:
      "Comparar gastos com período anterior de igual duração, mesmos dias do mês anterior ou intervalo explícito. Já inclui grupos e totais dos dois períodos.",
    readOnly: true,
    schema: z
      .object({
        ...analysisPeriod,
        comparison: z
          .enum(["previous_period", "previous_month", "explicit"])
          .default("previous_period"),
        previousFrom: day.optional(),
        previousTo: day.optional(),
      })
      .strict(),
  },
  get_spending_pace: {
    description:
      "Ritmo observado de despesas e projeção linear explicitamente estimada.",
    readOnly: true,
    schema: z.object({ ...analysisPeriod }).strict(),
  },
  get_subscriptions: {
    description:
      "Identificar candidatos a assinaturas e cobranças recorrentes no histórico efetivo, com frequência, valores exatos e evidências. Exclui pendentes, futuros, transferências classificadas e parcelas identificadas. Padrão: últimos 12 meses e 3 ocorrências. Não confirma contratos nem cria recorrências; partial/truncated indicam análise incompleta.",
    readOnly: true,
    schema: z
      .object({
        ...scope,
        accountId: id.optional(),
        currency: currency.optional(),
        from: day.optional(),
        limit: z.number().int().min(1).max(100).default(50),
        minOccurrences: z.number().int().min(2).max(12).default(3),
        to: day.optional(),
      })
      .strict(),
  },
  get_tags: {
    description:
      "Etiquetas locais do espaço, com IDs e nomes para filtrar e organizar transações.",
    readOnly: true,
    schema: z.object({ ...scope }).strict(),
  },
  get_transaction_purchases: {
    description:
      "Compras e transações com parcelas de cartão agrupadas antes da paginação, como na lista do painel. Mantém valores de cada parcela, moeda, pendência, datas e identificação. Datas filtram a compra ou primeira parcela conhecida; nunca some a página para calcular totais.",
    readOnly: true,
    schema: z
      .object({
        ...selection,
        cursor: z.string().max(4096).optional(),
        future: z.boolean().default(false),
        limit: z.number().int().min(1).max(500).default(100),
        order: z
          .literal(TransactionOrder.date_desc)
          .default(TransactionOrder.date_desc),
      })
      .omit({ cardNumber: true, tagId: true })
      .strict(),
  },
  get_transactions: {
    description:
      "Histórico efetivo com edições locais e paginação consistente. Para últimas compras envie order=date_desc e limit=5; não some páginas para calcular totais.",
    readOnly: true,
    schema: z
      .object({
        ...selection,
        cursor: z.string().max(4096).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        order: z
          .enum([TransactionOrder.id, TransactionOrder.date_desc])
          .default(TransactionOrder.id),
      })
      .strict(),
  },
  get_upcoming_payments: {
    description:
      "Vencimentos de faturas, recorrências e parcelas de empréstimos sem executar pagamentos.",
    readOnly: true,
    schema: z.object({ ...period }).strict(),
  },
  import_rules: {
    description:
      "Importar JSON de regras compostas atomicamente no espaço confirmado. Preserva regras pessoais e duplicatas; exige a revisão da prévia. Não reaplica histórico.",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ...RuleImportFields,
        revision: z.number().int().nonnegative(),
      })
      .strict(),
  },
  link_goal_asset: {
    description:
      "Vincular exatamente uma conta ou investimento da mesma moeda à meta.",
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
  mark_bill_paid: {
    description:
      "Alterar apenas confirmação manual da fatura; nunca enviar pagamento ao banco.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  move_account: {
    description:
      "Mover conta ou todas as contas da conexão entre espaços pessoais.",
    readOnly: false,
    schema: z.object({ ...mutation, id, targetSpaceId: id }).strict(),
  },
  move_connection: {
    description:
      "Mover conta ou todas as contas da conexão entre espaços pessoais.",
    readOnly: false,
    schema: z
      .object({ ...mutation, connectionId: id, targetSpaceId: id })
      .strict(),
  },
  move_transactions: {
    description:
      "Mover projeções de transações para outro espaço da mesma instalação.",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ids: z.array(id).min(1).max(500),
        targetSpaceId: id,
      })
      .strict(),
  },
  preview_rule: {
    description:
      "Simular uma regra sem salvar nem reclassificar. Usa o mesmo escopo obrigatório, alternativas OU, condições E e dinheiro exato do painel. Informa contagem, amostras e limites de cobertura; truncated ou partial impedem tratar a contagem como definitiva.",
    readOnly: true,
    schema: RulePreviewQuerySchema,
  },
  preview_rule_import: {
    description:
      "Conferir importação de JSON de regras compostas, categorias e duplicatas, sem gravar. Retorna revisão para confirmação.",
    readOnly: true,
    schema: z.object({ ...RuleImportFields, spaceId: id }).strict(),
  },
  reconcile_scheduled_payment: {
    description:
      "Conciliar próxima parcela com transação compatível ou criar lançamento manual; nunca inicia pagamento bancário.",
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
  remove_category_limit: {
    description: "Remover limite com orçamento ativado.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  remove_goal_contribution: {
    description: "Remover contribuição preservando transação.",
    readOnly: false,
    schema: z.object({ ...mutation, contributionId: id, id }).strict(),
  },
  remove_transaction_tags: {
    description: "Alterar tags das transações selecionadas.",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        ids: z.array(id).min(1).max(500),
        tagIds: z.array(id).min(1).max(50),
      })
      .strict(),
  },
  reopen_installment: {
    description: "Alterar conclusão manual sem inventar pagamentos.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  replace_manual_loan_schedule: {
    description:
      "Criar cronograma SAC exato; juros mensais em pontos-base e arredondamento half-up.",
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
  set_budget: {
    description: "Ativar orçamento e definir total mensal por espaço.",
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
  set_category_limit: {
    description: "Definir limite com orçamento ativado.",
    readOnly: false,
    schema: z.object({ ...mutation, amountMinor: amount, id }).strict(),
  },
  set_investment_inclusion: {
    description: "Definir participação no patrimônio.",
    readOnly: false,
    schema: z.object({ ...mutation, id, included: z.boolean() }).strict(),
  },
  set_loan_visibility: {
    description: "Ocultar ou restaurar empréstimo.",
    readOnly: false,
    schema: z.object({ ...mutation, hidden: z.boolean(), id }).strict(),
  },
  set_notification_preference: {
    description:
      "Guardar preferência de canal; não configura nem comprova entrega de notificações.",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        channel: z.enum([NotificationChannel.email, NotificationChannel.push]),
        enabled: z.boolean(),
        event: text,
      })
      .strict(),
  },
  set_primary_card: {
    description: "Definir cartão principal.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  undo_scheduled_payment: {
    description: "Desfazer última conciliação mantendo transação e histórico.",
    readOnly: false,
    schema: z.object({ ...mutation, id, paymentId: id }).strict(),
  },
  unlink_goal_asset: {
    description: "Remover vínculo de patrimônio.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  unlink_goal_transaction: {
    description:
      "Desvincular transação e contribuição associada sem excluir histórico.",
    readOnly: false,
    schema: z.object({ ...mutation, id, transactionId: id }).strict(),
  },
  unmark_bill_paid: {
    description:
      "Alterar apenas confirmação manual da fatura; nunca enviar pagamento ao banco.",
    readOnly: false,
    schema: z.object({ ...mutation, id }).strict(),
  },
  update_account_settings: {
    description:
      "Editar apresentação; limite e ciclo somente para cartões manuais.",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...accountFields }).strict(),
  },
  update_card: {
    description: "Renomear ou ocultar cartão adicional.",
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
  update_category: {
    description:
      "Configurar ícone, cor e grupo de qualquer categoria. Nomes de categorias fixas são protegidos.",
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
  update_category_group: {
    description: "Editar nome, ícone ou cor de um agrupador de categorias.",
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
  update_goal: {
    description: "Atualizar meta financeira.",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...goalFields }).strict(),
  },
  update_installment: {
    description: "Renomear plano e parcelas vinculadas ou alterar categoria.",
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
  update_manual_investment: {
    description: "Editar investimento manual.",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...investmentFields }).strict(),
  },
  update_manual_loan: {
    description: "Atualizar dívida manual sem alterar parcelas conciliadas.",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...loanFields }).strict(),
  },
  update_recurrence: {
    description:
      "Substituir configuração da recorrência, inclusive data final.",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...recurrenceFields }).strict(),
  },
  update_rule: {
    description:
      "Atualizar regra pessoal; pessoais precedem pacotes, depois menor prioridade vence.",
    readOnly: false,
    schema: z.object({ ...mutation, id, ...ruleFields }).strict(),
  },
  update_space: {
    description: "Editar espaço e início do ciclo financeiro.",
    readOnly: false,
    schema: z
      .object({
        ...mutation,
        color: text.optional(),
        icon: text.optional(),
        id,
        monthStartDay: z.number().int().min(1).max(28).optional(),
        name: text.optional(),
        type: z
          .enum([SpaceType.personal, SpaceType.business, SpaceType.family])
          .optional(),
      })
      .strict(),
  },
  update_tag: {
    description: "Editar tag.",
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
} as const;
export const planningDefinitions = Object.entries(planningTools).map(
  ([name, definition]) => ({ ...definition, name }),
);
export const PlanningCommandSchema = z.discriminatedUnion("tool", [
  planningTools.get_transaction_purchases.schema.extend({
    tool: z.literal("get_transaction_purchases"),
  }),
  planningTools.preview_rule.schema.safeExtend({
    tool: z.literal("preview_rule"),
  }),
  planningTools.get_category_groups.schema.extend({
    tool: z.literal("get_category_groups"),
  }),
  planningTools.create_category_group.schema.extend({
    tool: z.literal("create_category_group"),
  }),
  planningTools.update_category_group.schema.extend({
    tool: z.literal("update_category_group"),
  }),
  planningTools.delete_category_group.schema.extend({
    tool: z.literal("delete_category_group"),
  }),
  planningTools.get_accounts.schema.extend({ tool: z.literal("get_accounts") }),
  planningTools.get_cards.schema.extend({ tool: z.literal("get_cards") }),
  planningTools.get_transactions.schema.extend({
    tool: z.literal("get_transactions"),
  }),
  planningTools.get_overview.schema.extend({ tool: z.literal("get_overview") }),
  planningTools.get_spending_by_category.schema.extend({
    tool: z.literal("get_spending_by_category"),
  }),
  planningTools.get_spending_comparison.schema.extend({
    tool: z.literal("get_spending_comparison"),
  }),
  planningTools.get_spending_pace.schema.extend({
    tool: z.literal("get_spending_pace"),
  }),
  planningTools.get_projection.schema.extend({
    tool: z.literal("get_projection"),
  }),
  planningTools.get_bills.schema.extend({ tool: z.literal("get_bills") }),
  planningTools.get_upcoming_payments.schema.extend({
    tool: z.literal("get_upcoming_payments"),
  }),
  planningTools.get_installments.schema.extend({
    tool: z.literal("get_installments"),
  }),
  planningTools.get_categories.schema.extend({
    tool: z.literal("get_categories"),
  }),
  planningTools.get_loans.schema.extend({ tool: z.literal("get_loans") }),
  planningTools.get_tags.schema.extend({ tool: z.literal("get_tags") }),
  planningTools.get_rules.schema.extend({ tool: z.literal("get_rules") }),
  planningTools.get_recurrences.schema.extend({
    tool: z.literal("get_recurrences"),
  }),
  planningTools.get_goals.schema.extend({ tool: z.literal("get_goals") }),
  planningTools.get_investments.schema.extend({
    tool: z.literal("get_investments"),
  }),
  planningTools.get_budget.schema.extend({ tool: z.literal("get_budget") }),
  planningTools.get_spaces.schema.extend({ tool: z.literal("get_spaces") }),
  planningTools.get_notification_preferences.schema.extend({
    tool: z.literal("get_notification_preferences"),
  }),
  planningTools.get_goal_plan.schema.extend({
    tool: z.literal("get_goal_plan"),
  }),
  planningTools.get_loan_schedule.schema.extend({
    tool: z.literal("get_loan_schedule"),
  }),
  planningTools.generate_chart.schema.extend({
    tool: z.literal("generate_chart"),
  }),
  planningTools.create_manual_account.schema.extend({
    tool: z.literal("create_manual_account"),
  }),
  planningTools.update_account_settings.schema.extend({
    tool: z.literal("update_account_settings"),
  }),
  planningTools.delete_manual_account.schema.extend({
    tool: z.literal("delete_manual_account"),
  }),
  planningTools.update_card.schema.extend({ tool: z.literal("update_card") }),
  planningTools.delete_card.schema.extend({ tool: z.literal("delete_card") }),
  planningTools.set_primary_card.schema.extend({
    tool: z.literal("set_primary_card"),
  }),
  planningTools.mark_bill_paid.schema.extend({
    tool: z.literal("mark_bill_paid"),
  }),
  planningTools.unmark_bill_paid.schema.extend({
    tool: z.literal("unmark_bill_paid"),
  }),
  planningTools.create_transaction.schema.extend({
    tool: z.literal("create_transaction"),
  }),
  planningTools.edit_transaction.schema.extend({
    tool: z.literal("edit_transaction"),
  }),
  planningTools.batch_edit_transactions.schema.extend({
    tool: z.literal("batch_edit_transactions"),
  }),
  planningTools.edit_transactions_by_period.schema.extend({
    tool: z.literal("edit_transactions_by_period"),
  }),
  planningTools.delete_transaction.schema.extend({
    tool: z.literal("delete_transaction"),
  }),
  planningTools.batch_delete_transactions.schema.extend({
    tool: z.literal("batch_delete_transactions"),
  }),
  planningTools.delete_transactions_by_period.schema.extend({
    tool: z.literal("delete_transactions_by_period"),
  }),
  planningTools.attach_transaction_tags.schema.extend({
    tool: z.literal("attach_transaction_tags"),
  }),
  planningTools.remove_transaction_tags.schema.extend({
    tool: z.literal("remove_transaction_tags"),
  }),
  planningTools.move_transactions.schema.extend({
    tool: z.literal("move_transactions"),
  }),
  planningTools.create_manual_installment.schema.extend({
    tool: z.literal("create_manual_installment"),
  }),
  planningTools.update_installment.schema.extend({
    tool: z.literal("update_installment"),
  }),
  planningTools.complete_installment.schema.extend({
    tool: z.literal("complete_installment"),
  }),
  planningTools.reopen_installment.schema.extend({
    tool: z.literal("reopen_installment"),
  }),
  planningTools.create_recurrence.schema.extend({
    tool: z.literal("create_recurrence"),
  }),
  planningTools.update_recurrence.schema.extend({
    tool: z.literal("update_recurrence"),
  }),
  planningTools.deactivate_recurrence.schema.extend({
    tool: z.literal("deactivate_recurrence"),
  }),
  planningTools.set_budget.schema.extend({ tool: z.literal("set_budget") }),
  planningTools.set_category_limit.schema.extend({
    tool: z.literal("set_category_limit"),
  }),
  planningTools.remove_category_limit.schema.extend({
    tool: z.literal("remove_category_limit"),
  }),
  planningTools.create_category.schema.extend({
    tool: z.literal("create_category"),
  }),
  planningTools.update_category.schema.extend({
    tool: z.literal("update_category"),
  }),
  planningTools.delete_category.schema.extend({
    tool: z.literal("delete_category"),
  }),
  planningTools.analyze_categories.schema.extend({
    tool: z.literal("analyze_categories"),
  }),
  planningTools.create_rule.schema.extend({ tool: z.literal("create_rule") }),
  planningTools.update_rule.schema.extend({ tool: z.literal("update_rule") }),
  planningTools.delete_rule.schema.extend({ tool: z.literal("delete_rule") }),
  planningTools.apply_rules.schema.extend({ tool: z.literal("apply_rules") }),
  planningTools.create_goal.schema.extend({ tool: z.literal("create_goal") }),
  planningTools.update_goal.schema.extend({ tool: z.literal("update_goal") }),
  planningTools.add_goal_contribution.schema.extend({
    tool: z.literal("add_goal_contribution"),
  }),
  planningTools.remove_goal_contribution.schema.extend({
    tool: z.literal("remove_goal_contribution"),
  }),
  planningTools.complete_goal.schema.extend({
    tool: z.literal("complete_goal"),
  }),
  planningTools.link_goal_asset.schema.extend({
    tool: z.literal("link_goal_asset"),
  }),
  planningTools.unlink_goal_asset.schema.extend({
    tool: z.literal("unlink_goal_asset"),
  }),
  planningTools.delete_goal.schema.extend({ tool: z.literal("delete_goal") }),
  planningTools.unlink_goal_transaction.schema.extend({
    tool: z.literal("unlink_goal_transaction"),
  }),
  planningTools.create_manual_investment.schema.extend({
    tool: z.literal("create_manual_investment"),
  }),
  planningTools.update_manual_investment.schema.extend({
    tool: z.literal("update_manual_investment"),
  }),
  planningTools.set_investment_inclusion.schema.extend({
    tool: z.literal("set_investment_inclusion"),
  }),
  planningTools.delete_manual_investment.schema.extend({
    tool: z.literal("delete_manual_investment"),
  }),
  planningTools.create_manual_loan.schema.extend({
    tool: z.literal("create_manual_loan"),
  }),
  planningTools.update_manual_loan.schema.extend({
    tool: z.literal("update_manual_loan"),
  }),
  planningTools.set_loan_visibility.schema.extend({
    tool: z.literal("set_loan_visibility"),
  }),
  planningTools.delete_manual_loan.schema.extend({
    tool: z.literal("delete_manual_loan"),
  }),
  planningTools.create_manual_loan_schedule.schema.extend({
    tool: z.literal("create_manual_loan_schedule"),
  }),
  planningTools.replace_manual_loan_schedule.schema.extend({
    tool: z.literal("replace_manual_loan_schedule"),
  }),
  planningTools.reconcile_scheduled_payment.schema.extend({
    tool: z.literal("reconcile_scheduled_payment"),
  }),
  planningTools.undo_scheduled_payment.schema.extend({
    tool: z.literal("undo_scheduled_payment"),
  }),
  planningTools.create_tag.schema.extend({ tool: z.literal("create_tag") }),
  planningTools.update_tag.schema.extend({ tool: z.literal("update_tag") }),
  planningTools.delete_tag.schema.extend({ tool: z.literal("delete_tag") }),
  planningTools.create_space.schema.extend({ tool: z.literal("create_space") }),
  planningTools.update_space.schema.extend({ tool: z.literal("update_space") }),
  planningTools.move_account.schema.extend({ tool: z.literal("move_account") }),
  planningTools.move_connection.schema.extend({
    tool: z.literal("move_connection"),
  }),
  planningTools.set_notification_preference.schema.extend({
    tool: z.literal("set_notification_preference"),
  }),
  planningTools.delete_space.schema.extend({ tool: z.literal("delete_space") }),
  planningTools.preview_rule_import.schema.extend({
    tool: z.literal("preview_rule_import"),
  }),
  planningTools.import_rules.schema.extend({ tool: z.literal("import_rules") }),
  planningTools.get_subscriptions.schema.extend({
    tool: z.literal("get_subscriptions"),
  }),
]);
export type PlanningCommand = z.infer<typeof PlanningCommandSchema>;
type ReadTool = {
  [Name in keyof typeof planningTools]: (typeof planningTools)[Name]["readOnly"] extends true
    ? Name
    : never;
}[keyof typeof planningTools];
export type PlanningQuery = Extract<PlanningCommand, { tool: ReadTool }>;
export type PlanningMutation =
  | Exclude<PlanningCommand, PlanningQuery>
  | Extract<PlanningCommand, { tool: "preview_rule_import" }>;
export function isPlanningQuery(
  command: PlanningCommand,
): command is PlanningQuery {
  return planningTools[command.tool].readOnly;
}

export const PlanningCursorSchema = z.tuple([
  z.number().int().nonnegative(),
  z.string(),
  z.string(),
]);
