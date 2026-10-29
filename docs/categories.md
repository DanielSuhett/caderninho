# Categorias e classificação

## Espaços e custo fixo

Um espaço financeiro (Pessoal, Família etc.) contém categorias. Não há
agrupadores: a única organização é o campo `fixedCost`, que marca as categorias
de despesa que compõem o custo fixo mensal e dimensionam a reserva de
emergência. O campo não altera valores, natureza financeira, regras nem
classificação das transações.

`planning_categories` guarda categorias com `icon`, `color` e `fixedCost`. O
schema inicial cria as 33 categorias fixas visíveis do espaço Pessoal, com
Aluguel, Energia, Gás, Internet, Financiamento, Seguro, Impostos e taxas,
Faculdade, Farmácia, Saúde e Mercado já em custo fixo. Novos espaços recebem o
mesmo catálogo. Os nomes fixos não podem ser alterados nem excluídos. Ícone,
cor, custo fixo e limite são editáveis. Categorias personalizadas conservam
seus próprios IDs e referências. Os ícones usam uma lista fechada do produto;
cores aceitam somente `#RRGGBB`.

A migração `0003_fixed_cost_reserve.sql` remove `groupId` das categorias,
marca o custo fixo padrão nas categorias de sistema e exclui
`planning_category_groups`.

## MCP e portal

`get_categories` retorna os campos de aparência, `fixedCost` e `system`, e
aceita o filtro `fixedCost`. `create_category` e `update_category` aceitam
`icon`, `color` e `fixedCost`.

As mutações usam os contratos existentes: `spaceId`, `confirmed=true` e
`idempotency_key`. O planejamento valida o espaço e publica
categoria/revisão/recibo atomicamente. `/api/account/catalog` inclui os campos
das categorias. A página Categorias liga e desliga o custo fixo por categoria;
a página Reserva soma essas categorias. A demonstração usa os mesmos contratos
e dados sintéticos, sem gravar no banco.

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

Testes locais cobrem catálogo inicial, custo fixo/idempotência/escopo,
mapeamento determinístico da Pluggy e precedência manual.
Deploy, migração remota e importação real exigem validação separada.

O teste de custo local semeia 10 mil transações na mesma data e consulta uma
página no final do histórico. A condição composta `(date,id)>(?,?)` mantém até
51 linhas lidas por página de 25 registros, incluindo acessos ao índice/tabela;
o teste compara os mesmos resultados com a forma `OR`, que relê registros
anteriores. O repository usa a condição composta e o índice de conta/data/ID.
