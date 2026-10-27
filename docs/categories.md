# Categorias e classificação

## Relação com grupos e espaços

Um espaço financeiro (Pessoal, Família etc.) contém categorias e agrupadores de
categorias. Um agrupador contém várias categorias. Uma categoria pertence a zero
ou um agrupador, sempre no mesmo espaço. O agrupador é organização visual; não
altera valores, natureza financeira, regras ou classificação das transações.

`planning_categories` guarda categorias com `icon`, `color` e `groupId`.
`planning_category_groups` guarda `id` e JSON tipado com
`spaceId`, `name`, `icon` e `color`, conforme as outras tabelas de planejamento.
O schema inicial cria os agrupadores e as 33 categorias fixas visíveis do espaço
Pessoal. Novos espaços recebem o mesmo catálogo. Os nomes fixos
não podem ser alterados nem excluídos. Ícone, cor, grupo e limite são editáveis.
Categorias personalizadas conservam seus próprios IDs e referências.

Remover um agrupador deixa suas categorias com `groupId=null`. Não remove
categorias nem altera transações. Os ícones usam uma lista fechada do produto;
cores aceitam somente `#RRGGBB`.

## MCP e portal

As ferramentas novas são `get_category_groups`, `create_category_group`,
`update_category_group` e `delete_category_group`. `get_categories` retorna os
campos de aparência, vínculo e `system`. `create_category` e `update_category`
aceitam `icon`, `color` e `groupId`; `groupId=null` remove o vínculo.

As mutações usam os contratos existentes: `spaceId`, `confirmed=true` e
`idempotency_key`. O planejamento valida referências entre espaços e publica
categoria/grupo/revisão/recibo atomicamente. `/api/account/catalog` inclui
`categoryGroups` e os campos das categorias. O painel Grupos mostra os
agrupadores e permite editar categorias e criar/editar/remover agrupadores.
A demonstração usa os mesmos contratos e dados sintéticos, sem gravar no banco.

## Prioridade e fallback

1. Edição ou regra local já aplicada.
2. Regras determinísticas de conversão do rótulo Pluggy.

O catálogo e as regras estão em `src/domain/category.entity.ts`. O mapeamento
cobre a árvore publicada da Pluggy e variantes antigas conhecidas, incluindo
`Accomodation` e `Tolls and in vehicle payment`. Rótulos amplos recebem a
categoria mais próxima disponível: Services/Other → Compras, Travel → Lazer,
Transportation → Corridas. Não se infere uma categoria específica ausente no
provedor: Casamento e Lavanderia, por exemplo, precisam de correção ou regra local. Rótulos novos desconhecidos e ausentes ficam sem
categoria até haver evidência; o rótulo original continua preservado.

`transactions.category` e `identification` conservam a origem. As consultas de
planejamento usam a categoria efetiva com ID do espaço. As consultas financeiras
de origem continuam retornando a categoria Pluggy.

Investimentos e transferências ficam fora dos totais de receita/despesa. Entrada
de empréstimo em Financiamento também é movimentação; a parcela de saída continua
como despesa. O fluxo de caixa mantém todos os movimentos bancários.

Fonte oficial da árvore de categorias:
[árvore Pluggy](https://v2.docs.pluggy.ai/en/docs/products/transaction-categorization), consultada em 24/10/2026.

## Evidência

Testes locais cobrem catálogo inicial, CRUD/vínculos/idempotência/escopo,
mapeamento determinístico da Pluggy e precedência manual.
Deploy, migração remota e importação real exigem validação separada.

O teste de custo local semeia 10 mil transações na mesma data e consulta uma
página no final do histórico. A condição composta `(date,id)>(?,?)` mantém até
51 linhas lidas por página de 25 registros, incluindo acessos ao índice/tabela;
o teste compara os mesmos resultados com a forma `OR`, que relê registros
anteriores. O repository usa a condição composta e o índice de conta/data/ID.
