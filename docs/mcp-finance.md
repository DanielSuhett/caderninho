# MCP financeiro: catálogo e decisões

Estado: implementação local para revisão, baseada em `061cefb`.
Referência pesquisada em 22/10/2026. A branch não foi enviada ao Git remoto,
nem aplicada a uma instalação Cloudflare real.

## Escopo verificado

O artigo público do Visor descreve capacidades e alguns nomes de tools, mas não
publica o catálogo completo com schemas. O endpoint MCP respondeu HTTP 401 sem
autenticação. Portanto este trabalho implementa equivalentes das capacidades
publicadas, preservando os nomes explicitamente documentados quando aplicáveis;
não afirma paridade de assinatura com tools privadas ou habilitadas por plano.

A Pluggy fornece contas, transações, faturas, investimentos e empréstimos, com
cobertura dependente da instituição/conexão. Planejamento e edição são locais.
As quatro tools `caderninho_*` continuam disponíveis com seus contratos originais.
As 90 tools adicionais usam a visão efetiva, com sobreposições e dados manuais.

A extensão de [backoffice](backoffice.md) acrescenta `delete_space` e condições
compostas em regras, chegando a 94 tools.

## Pessoas e perfis Pluggy

A extensão de [titularidade](household.md) acrescenta múltiplos perfis e filtros
por `personId`, preservando os contratos existentes. `caderninho_status` fornece os IDs
das pessoas e perfis. Espaço, pessoa e aplicação são conceitos independentes.

## Contrato comum

Consultas aceitam `spaceId`, padrão `personal`. Toda escrita exige `spaceId`
explícito, `confirmed: true` e `idempotency_key` não vazia. Confirme com a pessoa
antes da chamada. A mesma chave e os mesmos argumentos normalizados devolvem o
resultado durável anterior. Reutilização para outra solicitação é recusada.
Nenhuma tool envia PIX, contrata crédito ou altera um registro na instituição.

Dinheiro entra e sai como string inteira de unidades mínimas da moeda.
Débito/crédito são magnitudes com direção separada. Moedas nunca são somadas entre
si. Valores desconhecidos permanecem `null`; subtotais conhecidos têm nomes
próprios. Contas manuais exigem uma moeda suportada explicitamente.

As consultas novas retornam `{data, partial, revision}`. `get_transactions` retorna
até 500 registros, com cursor; qualquer alteração financeira concorrente exige
reiniciar. Escritas por seleção/período são atômicas e recusam mais de 500 registros.
Não há confirmação parcial de uma seleção maior. As escritas em D1 não refazem
coletas Pluggy nem alteram a admissão de uma importação a cada 24 horas.

## Decisões financeiras

- **Origem preservada:** exclusões de transações são tombstones locais. Reimportar
  não desfaz edições. Regras novas afetam novas transações; `apply_rules` reaplica
  explicitamente um período. Excluir regra não desfaz suas classificações.
  Regras ignoram caixa em A–Z; caracteres acentuados são literais. Importação e
  reaplicação seguem a mesma comparação e desempate por ID.
- **Classificação conservadora:** despesas/rendas requerem categoria local com
  tipo explícito. Movimentos ainda não classificados são contabilizados à parte;
  nomes de categorias de terceiros não viram regras implícitas de consumo.
- **Faturas:** marcação manual não altera valores/pagamentos bancários. A
  confirmação bancária usa a relação documentada entre faturas consecutivas,
  pagamentos e encargos na mesma moeda. Cartões manuais projetam faturas pelo
  fechamento/vencimento; `recurrenceId` em um lançamento substitui a ocorrência
  mensal correspondente para evitar duplicá-la na projeção.
- **Parcelamentos:** a Pluggy não fornece uma chave única de agrupamento. Cada
  parcela observada aparece como candidato independente, com `estimated: true`,
  sem afirmar pagamento das parcelas anteriores e sem gerar recorrências
  automáticas a partir de agrupamentos duvidosos. Planos manuais criam uma
  recorrência, não centenas de transações futuras.
- **Empréstimos/metas:** SAC distribui todos os centavos do principal, cobra juros
  mensais em pontos-base e arredonda juros half-up. Conciliações seguem a ordem;
  desfazer preserva a transação. Metas com ativo vinculado usam o saldo do ativo
  em lugar de somá-lo às contribuições. Valor contratado e saldo devedor da
  Pluggy permanecem distintos.

## Limites explícitos

Espaços organizam dados da instalação; não criam compartilhamento multiusuário
nem mudam uma seleção de espaço no painel. As preferências de notificação são
persistidas, mas não há serviço de envio: a resposta informa
`deliveryConfigured: false`. Fotografias de metas não são parte do modelo.

Gráficos retornam SVG seguro e séries exatas, separados por moeda. A geometria
usa proporções limitadas; os rótulos preservam inteiros completos. Há até 60 grupos
por gráfico. Roscas recusam valores negativos, que devem ser exibidos em barras.
O host MCP pode exigir uma ação adicional para exibir o SVG.

Projeções são estimativas de saldos BANK e compromissos conhecidos. Não presumem
rendimento, transações futuras desconhecidas ou faturas bancárias ainda ausentes.
Recorrências bancárias com lançamento confirmado no mês deixam de ser previstas;
ignorar um lançamento nas análises não o remove do saldo da conta manual.
Recorrências mensais limitam o horizonte a 1.200 meses. Metadados e configurações
são carregados por consulta; o histórico é percorrido em páginas, sem `SUM REAL`.
Essa abordagem favorece a instalação pessoal; desempenho e consumo em produção
não foram medidos nesta branch.

A integração real com Meu Pluggy, permissões por produto, OAuth em ChatGPT/Claude,
provisionamento e deploy continuam como validações externas. Os testes locais
usam apenas dados sintéticos e não constituem prova dessas etapas.

## Validação local

`mise run check` passou em 22/10/2026: tipos, configuração, lint, formatação,
19 testes Node, 59 testes de integração em 11 arquivos e build Wrangler dry-run.
O teste nativo de Workflow/D1 passou com 10 mil e 100 mil transações sintéticas,
replay, falhas parciais e reinício do Worker com preservação do banco. Os cenários
de integração exercitam as ferramentas de planejamento; o transporte MCP autenticado
verifica o catálogo original de 93 tools e escritas com confirmação e repetição idempotente.

## Fontes primárias

- [MCP do Visor](https://help.visorfinance.app/pt-BR/articles/1755006-como-conectar-ao-servidor-mcp-do-visor)
- [Recorrências do Visor](https://help.visorfinance.app/pt-BR/articles/3769191-como-usar-contas-fixas-e-recorrencias)
- [Metas do Visor](https://help.visorfinance.app/pt-BR/articles/6142022-como-usar-metas-para-guardar-dinheiro)
- [Regras do Visor](https://help.visorfinance.app/pt-BR/articles/9580010-como-corrigir-transacoes-categorizadas-errado-usando-regras)
- [Transações Pluggy](https://docs.pluggy.ai/en/docs/products/transactions)
- [Faturas Pluggy](https://docs.pluggy.ai/en/docs/products/credit-card-bills)
- [Parcelamentos Pluggy](https://docs.pluggy.ai/en/docs/products/credit-card-installments)
- [Investimentos Pluggy](https://docs.pluggy.ai/en/docs/products/investments)
- [Empréstimos Pluggy](https://docs.pluggy.ai/en/docs/products/loans)

## Ferramentas novas

O schema retornado por `tools/list` é o contrato executável. Campos desconhecidos
são recusados; datas inválidas, valores não canônicos e referências de outro
espaço não chegam ao commit.

### Consultas

| Tool | Comportamento |
| --- | --- |
| `get_accounts` | Contas e saldos com referência temporal; inclui contas manuais e preferências locais. |
| `get_cards` | Cartões principais e adicionais identificados na origem; ids estáveis e suporte a include_hidden. |
| `get_transactions` | Histórico efetivo com edições locais, filtros e paginação consistente. Não some páginas para calcular totais. |
| `get_overview` | Saldos, entradas e saídas por moeda, sem tratar transferências e pagamentos de cartão como consumo. |
| `get_spending_by_category` | Despesas classificadas por categoria; exclui transferências e itens ignorados. |
| `get_spending_comparison` | Comparação com período anterior de igual duração. |
| `get_spending_pace` | Ritmo observado de despesas e projeção linear explicitamente estimada. |
| `get_projection` | Projeção de saldo BANK com recorrências e vencimentos; informa premissas e desconhecidos. |
| `get_bills` | Faturas importadas, pagamentos bancários e marcação manual separada. |
| `get_upcoming_payments` | Vencimentos de faturas, recorrências e parcelas de empréstimos sem executar pagamentos. |
| `get_installments` | Planos manuais e candidatos derivados de metadados; agrupamento da origem é estimativa, não prova de pagamento. |
| `get_categories` | Listar registros locais e importados, incluindo ocultos quando solicitado. |
| `get_loans` | Listar registros locais e importados, incluindo ocultos quando solicitado. |
| `get_tags` | Consultar dados locais de planejamento e registros importados disponíveis. |
| `get_rules` | Consultar dados locais de planejamento e registros importados disponíveis. |
| `get_recurrences` | Consultar dados locais de planejamento e registros importados disponíveis. |
| `get_goals` | Consultar dados locais de planejamento e registros importados disponíveis. |
| `get_investments` | Consultar dados locais de planejamento e registros importados disponíveis. |
| `get_budget` | Consultar dados locais de planejamento e registros importados disponíveis. |
| `get_spaces` | Consultar dados locais de planejamento e registros importados disponíveis. |
| `get_notification_preferences` | Consultar dados locais de planejamento e registros importados disponíveis. |
| `get_goal_plan` | Quanto guardar por mês, arredondado para cima em unidades mínimas; sem presumir rendimento. |
| `get_loan_schedule` | Cronograma SAC local e estado de conciliação de cada parcela. |
| `generate_chart` | Séries exatas por moeda para gráficos de barras, linhas ou rosca; valores inteiros em strings. |
| `analyze_categories` | Analisar despesas categorizadas e itens sem categoria. |

### Escritas confirmadas

| Tool | Comportamento |
| --- | --- |
| `create_manual_account` | Criar conta ou cartão manual. |
| `update_account_settings` | Editar apresentação; limite e ciclo somente para cartões manuais. |
| `delete_manual_account` | Excluir conta manual vazia; recusa referências financeiras ativas. |
| `update_card` | Renomear ou ocultar cartão adicional. |
| `delete_card` | Excluir apresentação de cartão adicional, preservando histórico. |
| `set_primary_card` | Definir cartão principal. |
| `mark_bill_paid` | Alterar apenas confirmação manual da fatura; nunca enviar pagamento ao banco. |
| `unmark_bill_paid` | Alterar apenas confirmação manual da fatura; nunca enviar pagamento ao banco. |
| `create_transaction` | Lançar receita ou despesa em conta manual. |
| `edit_transaction` | Editar projeção local sem sobrescrever registro bancário. |
| `batch_edit_transactions` | Editar atomicamente até 500 transações selecionadas. |
| `edit_transactions_by_period` | Editar seleção integral do período; recusa seleções acima de 500. |
| `delete_transaction` | Excluir apresentação local preservando origem; confirmação e repetição idempotente. |
| `batch_delete_transactions` | Excluir apresentação local preservando origem; confirmação e repetição idempotente. |
| `delete_transactions_by_period` | Excluir apresentação local preservando origem; confirmação e repetição idempotente. |
| `attach_transaction_tags` | Alterar tags das transações selecionadas. |
| `remove_transaction_tags` | Alterar tags das transações selecionadas. |
| `move_transactions` | Mover projeções de transações para outro espaço da mesma instalação. |
| `create_manual_installment` | Criar plano e recorrência de parcelas sem gerar transações futuras. |
| `update_installment` | Renomear plano e parcelas vinculadas ou alterar categoria. |
| `complete_installment` | Alterar conclusão manual sem inventar pagamentos. |
| `reopen_installment` | Alterar conclusão manual sem inventar pagamentos. |
| `create_recurrence` | Criar conta fixa ou receita mensal projetada. |
| `update_recurrence` | Substituir configuração da recorrência, inclusive data final. |
| `deactivate_recurrence` | Desativar projeções futuras. |
| `set_budget` | Ativar orçamento e definir total mensal por espaço. |
| `set_category_limit` | Definir limite com orçamento ativado. |
| `remove_category_limit` | Remover limite com orçamento ativado. |
| `create_category` | Criar categoria personalizada. |
| `update_category` | Renomear, ocultar ou restaurar categoria personalizada. |
| `delete_category` | Excluir categoria personalizada e reatribuir referências à categoria de sistema do mesmo tipo. |
| `create_rule` | Criar regra textual determinística de categorização. |
| `update_rule` | Atualizar regra; prioridade menor vence. |
| `delete_rule` | Excluir regra sem reverter classificações já aplicadas. |
| `apply_rules` | Aplicar regras sincronicamente a até 500 transações; operação atômica. |
| `create_goal` | Criar meta financeira. |
| `update_goal` | Atualizar meta financeira. |
| `add_goal_contribution` | Registrar contribuição; transação existente não é contada novamente. |
| `remove_goal_contribution` | Remover contribuição preservando transação. |
| `complete_goal` | Concluir meta manualmente. |
| `link_goal_asset` | Vincular exatamente uma conta ou investimento da mesma moeda à meta. |
| `unlink_goal_asset` | Remover vínculo de patrimônio. |
| `delete_goal` | Excluir meta e contribuições locais; preservar transações. |
| `unlink_goal_transaction` | Desvincular transação e contribuição associada sem excluir histórico. |
| `create_manual_investment` | Criar investimento manual. |
| `update_manual_investment` | Editar investimento manual. |
| `set_investment_inclusion` | Definir participação no patrimônio. |
| `delete_manual_investment` | Excluir investimento manual e remover vínculo de metas. |
| `create_manual_loan` | Cadastrar dívida manual sem efetuar contratação bancária. |
| `update_manual_loan` | Atualizar dívida manual sem alterar parcelas conciliadas. |
| `set_loan_visibility` | Ocultar ou restaurar empréstimo. |
| `delete_manual_loan` | Excluir dívida manual sem parcelas pendentes vinculadas. |
| `create_manual_loan_schedule` | Criar cronograma SAC exato; juros mensais em pontos-base e arredondamento half-up. |
| `replace_manual_loan_schedule` | Criar cronograma SAC exato; juros mensais em pontos-base e arredondamento half-up. |
| `reconcile_scheduled_payment` | Conciliar próxima parcela com transação compatível ou criar lançamento manual; nunca inicia pagamento bancário. |
| `undo_scheduled_payment` | Desfazer última conciliação mantendo transação e histórico. |
| `create_tag` | Criar tag. |
| `update_tag` | Editar tag. |
| `delete_tag` | Excluir tag e suas associações. |
| `create_space` | Criar espaço local da mesma pessoa; não cria usuários nem permissões. |
| `update_space` | Editar espaço e início do ciclo financeiro. |
| `move_account` | Mover conta ou todas as contas da conexão entre espaços pessoais. |
| `move_connection` | Mover conta ou todas as contas da conexão entre espaços pessoais. |
| `set_notification_preference` | Guardar preferência de canal; não configura nem comprova entrega de notificações. |
