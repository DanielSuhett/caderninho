# Inventário MCP

Gerado por `npm run docs:mcp` a partir do registro de ferramentas.

102 ferramentas: 32 consultas/prévias, 69 escritas locais e 1 operação de sincronização.

| Ferramenta | Operação | Schema de saída | Descrição |
| --- | --- | --- | --- |
| `caderninho_status` | consulta/prévia | — | Estado da instalação, contas e importações. Informa parcialidade e referência temporal; nunca inicia coleta. |
| `caderninho_sync` | sincronização | — | Importar contas e transações da origem. Retorna execução existente ou admissão/cooldown por conexão. Não exige coordenar páginas. |
| `caderninho_transactions` | consulta/prévia | — | Consultar histórico local por campos conhecidos. Cursor exige mesmo estado da seleção; categoria e descrição vêm da origem. |
| `caderninho_aggregate` | consulta/prévia | — | Totais exatos por moeda sobre todo o universo filtrado. Débito não equivale a gasto. Informe parcialidade, desconhecidos e referência temporal. |
| `add_goal_contribution` | escrita local | — | Registrar contribuição; transação existente não é contada novamente. |
| `analyze_categories` | consulta/prévia | sim | Analisar despesas categorizadas e itens sem categoria. |
| `apply_rules` | escrita local | — | Aplicar regras sincronicamente a até 500 transações; operação atômica. |
| `attach_transaction_tags` | escrita local | — | Alterar tags das transações selecionadas. |
| `batch_delete_transactions` | escrita local | — | Excluir apresentação local preservando origem; confirmação e repetição idempotente. |
| `batch_edit_transactions` | escrita local | — | Editar atomicamente até 500 transações selecionadas. |
| `complete_goal` | escrita local | — | Concluir meta manualmente. |
| `complete_installment` | escrita local | — | Alterar conclusão manual sem inventar pagamentos. |
| `create_category` | escrita local | — | Criar categoria personalizada. |
| `create_category_group` | escrita local | — | Criar agrupador de categorias com nome, ícone e cor. |
| `create_goal` | escrita local | — | Criar meta financeira. |
| `create_manual_account` | escrita local | — | Criar conta ou cartão manual. |
| `create_manual_installment` | escrita local | — | Criar plano e recorrência de parcelas sem gerar transações futuras. |
| `create_manual_investment` | escrita local | — | Criar investimento manual. |
| `create_manual_loan` | escrita local | — | Cadastrar dívida manual sem efetuar contratação bancária. |
| `create_manual_loan_schedule` | escrita local | — | Criar cronograma SAC exato; juros mensais em pontos-base e arredondamento half-up. |
| `create_recurrence` | escrita local | — | Criar conta fixa ou receita mensal projetada. |
| `create_rule` | escrita local | — | Criar regra textual determinística de categorização. |
| `create_space` | escrita local | — | Criar espaço local da mesma pessoa; não cria usuários nem permissões. |
| `create_tag` | escrita local | — | Criar tag. |
| `create_transaction` | escrita local | — | Lançar receita ou despesa em conta manual. |
| `deactivate_recurrence` | escrita local | — | Desativar projeções futuras. |
| `delete_card` | escrita local | — | Excluir apresentação de cartão adicional, preservando histórico. |
| `delete_category` | escrita local | — | Excluir categoria personalizada e reatribuir referências à categoria de sistema do mesmo tipo. |
| `delete_category_group` | escrita local | — | Remover agrupador; suas categorias e transações são preservadas e ficam sem grupo. |
| `delete_goal` | escrita local | — | Excluir meta e contribuições locais; preservar transações. |
| `delete_manual_account` | escrita local | — | Excluir conta manual vazia; recusa referências financeiras ativas. |
| `delete_manual_investment` | escrita local | — | Excluir investimento manual e remover vínculo de metas. |
| `delete_manual_loan` | escrita local | — | Excluir dívida manual sem parcelas pendentes vinculadas. |
| `delete_rule` | escrita local | — | Excluir regra sem reverter classificações já aplicadas. |
| `delete_space` | escrita local | — | Excluir um espaço vazio; preserva o grupo pessoal e impede referências órfãs. |
| `delete_tag` | escrita local | — | Excluir tag e suas associações. |
| `delete_transaction` | escrita local | — | Excluir apresentação local preservando origem; confirmação e repetição idempotente. |
| `delete_transactions_by_period` | escrita local | — | Excluir apresentação local preservando origem; confirmação e repetição idempotente. |
| `edit_transaction` | escrita local | — | Editar projeção local sem sobrescrever registro bancário. |
| `edit_transactions_by_period` | escrita local | — | Editar seleção integral do período; recusa seleções acima de 500. |
| `generate_chart` | consulta/prévia | sim | Séries exatas por moeda, com nomes e apresentação monetária. Use includeSvg=false para compor sua própria visualização; SVG estático é opcional. |
| `get_accounts` | consulta/prévia | — | Contas e saldos com referência temporal; inclui contas manuais e preferências locais. |
| `get_bills` | consulta/prévia | — | Faturas importadas, pagamentos bancários e marcação manual separada. |
| `get_budget` | consulta/prévia | — | Orçamento configurado e consumo do ciclo vigente por moeda e categoria; informa valores sem classificação. |
| `get_cards` | consulta/prévia | — | Cartões principais e adicionais identificados na origem; ids estáveis e suporte a include_hidden. |
| `get_categories` | consulta/prévia | — | Listar registros locais e importados, incluindo ocultos quando solicitado. |
| `get_category_groups` | consulta/prévia | — | Listar agrupadores de categorias de um espaço; não são espaços financeiros. |
| `get_goal_plan` | consulta/prévia | — | Quanto guardar por mês, arredondado para cima em unidades mínimas; sem presumir rendimento. |
| `get_goals` | consulta/prévia | — | Metas locais com valor, prazo e vínculo patrimonial; use get_goal_plan para calcular aportes. |
| `get_installments` | consulta/prévia | — | Planos manuais e candidatos derivados de metadados; agrupamento da origem é estimativa, não prova de pagamento. |
| `get_investments` | consulta/prévia | — | Posições locais e importadas disponíveis. Variação de saldo não comprova rentabilidade. |
| `get_loan_schedule` | consulta/prévia | — | Cronograma SAC local e estado de conciliação de cada parcela. |
| `get_loans` | consulta/prévia | — | Listar registros locais e importados, incluindo ocultos quando solicitado. |
| `get_notification_preferences` | consulta/prévia | — | Preferências locais de avisos. deliveryConfigured=false informa que o envio não está configurado. |
| `get_overview` | consulta/prévia | sim | Saldos, entradas e saídas por moeda, sem tratar transferências e pagamentos de cartão como consumo. |
| `get_projection` | consulta/prévia | — | Projeção de saldo BANK com recorrências e vencimentos; informa premissas e desconhecidos. |
| `get_recurrences` | consulta/prévia | — | Compromissos recorrentes cadastrados. Não detecta automaticamente assinaturas no histórico. |
| `get_rules` | consulta/prévia | — | Regras locais ordenadas por prioridade. Salvar não reaplica o histórico; use preview_rule antes de aplicar. |
| `get_spaces` | consulta/prévia | — | Espaços locais e suas configurações de moeda, ciclo e orçamento. |
| `get_spending_by_category` | consulta/prévia | sim | Despesas classificadas por categoria; exclui transferências e itens ignorados. |
| `get_spending_comparison` | consulta/prévia | sim | Comparar gastos com período anterior de igual duração, mesmos dias do mês anterior ou intervalo explícito. Já inclui grupos e totais dos dois períodos. |
| `get_spending_pace` | consulta/prévia | sim | Ritmo observado de despesas e projeção linear explicitamente estimada. |
| `get_tags` | consulta/prévia | — | Etiquetas locais do espaço, com IDs e nomes para filtrar e organizar transações. |
| `get_transaction_purchases` | consulta/prévia | — | Compras e transações com parcelas de cartão agrupadas antes da paginação, como na lista do painel. Mantém valores de cada parcela, moeda, pendência, datas e identificação. Datas filtram a compra ou primeira parcela conhecida; nunca some a página para calcular totais. |
| `get_transactions` | consulta/prévia | — | Histórico efetivo com edições locais e paginação consistente. Para últimas compras envie order=date_desc e limit=5; não some páginas para calcular totais. |
| `get_upcoming_payments` | consulta/prévia | — | Vencimentos de faturas, recorrências e parcelas de empréstimos sem executar pagamentos. |
| `import_rules` | escrita local | — | Importar JSON de regras compostas atomicamente no espaço confirmado. Preserva regras pessoais e duplicatas; exige a revisão da prévia. Não reaplica histórico. |
| `link_goal_asset` | escrita local | — | Vincular exatamente uma conta ou investimento da mesma moeda à meta. |
| `mark_bill_paid` | escrita local | — | Alterar apenas confirmação manual da fatura; nunca enviar pagamento ao banco. |
| `move_account` | escrita local | — | Mover conta ou todas as contas da conexão entre espaços pessoais. |
| `move_connection` | escrita local | — | Mover conta ou todas as contas da conexão entre espaços pessoais. |
| `move_transactions` | escrita local | — | Mover projeções de transações para outro espaço da mesma instalação. |
| `preview_rule` | consulta/prévia | — | Simular uma regra sem salvar nem reclassificar. Usa o mesmo escopo obrigatório, alternativas OU, condições E e dinheiro exato do painel. Informa contagem, amostras e limites de cobertura; truncated ou partial impedem tratar a contagem como definitiva. |
| `preview_rule_import` | consulta/prévia | — | Conferir importação de JSON de regras compostas, categorias e duplicatas, sem gravar. Retorna revisão para confirmação. |
| `reconcile_scheduled_payment` | escrita local | — | Conciliar próxima parcela com transação compatível ou criar lançamento manual; nunca inicia pagamento bancário. |
| `remove_category_limit` | escrita local | — | Remover limite com orçamento ativado. |
| `remove_goal_contribution` | escrita local | — | Remover contribuição preservando transação. |
| `remove_transaction_tags` | escrita local | — | Alterar tags das transações selecionadas. |
| `reopen_installment` | escrita local | — | Alterar conclusão manual sem inventar pagamentos. |
| `replace_manual_loan_schedule` | escrita local | — | Criar cronograma SAC exato; juros mensais em pontos-base e arredondamento half-up. |
| `set_budget` | escrita local | — | Ativar orçamento e definir total mensal por espaço. |
| `set_category_limit` | escrita local | — | Definir limite com orçamento ativado. |
| `set_investment_inclusion` | escrita local | — | Definir participação no patrimônio. |
| `set_loan_visibility` | escrita local | — | Ocultar ou restaurar empréstimo. |
| `set_notification_preference` | escrita local | — | Guardar preferência de canal; não configura nem comprova entrega de notificações. |
| `set_primary_card` | escrita local | — | Definir cartão principal. |
| `undo_scheduled_payment` | escrita local | — | Desfazer última conciliação mantendo transação e histórico. |
| `unlink_goal_asset` | escrita local | — | Remover vínculo de patrimônio. |
| `unlink_goal_transaction` | escrita local | — | Desvincular transação e contribuição associada sem excluir histórico. |
| `unmark_bill_paid` | escrita local | — | Alterar apenas confirmação manual da fatura; nunca enviar pagamento ao banco. |
| `update_account_settings` | escrita local | — | Editar apresentação; limite e ciclo somente para cartões manuais. |
| `update_card` | escrita local | — | Renomear ou ocultar cartão adicional. |
| `update_category` | escrita local | — | Configurar ícone, cor e grupo de qualquer categoria. Nomes de categorias fixas são protegidos. |
| `update_category_group` | escrita local | — | Editar nome, ícone ou cor de um agrupador de categorias. |
| `update_goal` | escrita local | — | Atualizar meta financeira. |
| `update_installment` | escrita local | — | Renomear plano e parcelas vinculadas ou alterar categoria. |
| `update_manual_investment` | escrita local | — | Editar investimento manual. |
| `update_manual_loan` | escrita local | — | Atualizar dívida manual sem alterar parcelas conciliadas. |
| `update_recurrence` | escrita local | — | Substituir configuração da recorrência, inclusive data final. |
| `update_rule` | escrita local | — | Atualizar regra pessoal; pessoais precedem pacotes, depois menor prioridade vence. |
| `update_space` | escrita local | — | Editar espaço e início do ciclo financeiro. |
| `update_tag` | escrita local | — | Editar tag. |
