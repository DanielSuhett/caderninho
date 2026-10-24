# Categorias e classificação

## Relação com grupos e espaços

Um espaço financeiro (Pessoal, Família etc.) contém categorias e agrupadores de
categorias. Um agrupador contém várias categorias. Uma categoria pertence a zero
ou um agrupador, sempre no mesmo espaço. O agrupador é organização visual; não
altera valores, natureza financeira, regras ou classificação das transações.

`planning_categories` conserva os IDs e dados existentes, acrescentando `icon`,
`color` e `groupId`. `planning_category_groups` guarda `id` e JSON tipado com
`spaceId`, `name`, `icon` e `color`, conforme as outras tabelas de planejamento.
`0009_fixed_categories.sql` cria os grupos iniciais e as 33 categorias em todos
os espaços existentes. Novos espaços recebem o mesmo catálogo. Os nomes fixos
não podem ser alterados nem excluídos. Ícone, cor, grupo e limite são editáveis.
Categorias personalizadas e referências legadas são preservadas.

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
2. Clef habilitado, com categoria fixa válida e confiança de pelo menos 0,8.
3. Regras determinísticas de conversão do rótulo Pluggy.

O catálogo e as regras estão em `src/domain/category.entity.ts`. O mapeamento
cobre a árvore publicada da Pluggy e variantes antigas conhecidas, incluindo
`Accomodation` e `Tolls and in vehicle payment`. Rótulos amplos recebem a
categoria mais próxima disponível: Services/Other → Compras, Travel → Lazer,
Transportation → Corridas. Não se infere uma categoria específica ausente no
provedor: Casamento e Lavanderia, por exemplo, precisam de evidência do Clef ou
de correção/regra local. Rótulos novos desconhecidos e ausentes ficam sem
categoria até haver evidência; o rótulo original continua preservado.

`transactions.category` e `identification` conservam a origem. O resultado do
Clef fica em `transactions.classification`: categoria estável, modelo, confiança,
versão e hash da evidência. As consultas de planejamento usam a categoria efetiva
com ID do espaço. As consultas financeiras de origem continuam retornando a
categoria Pluggy e também expõem a classificação separada. Desligar o Clef faz
as projeções usarem as regras Pluggy, mesmo que exista decisão Clef armazenada.

Investimentos e transferências ficam fora dos totais de receita/despesa. Entrada
de empréstimo em Financiamento também é movimentação; a parcela de saída continua
como despesa. O fluxo de caixa mantém todos os movimentos bancários.

## Clef no Worker

Os dois arquivos Wrangler declaram o binding `AI` e `CLEF_ENABLED="false"`.
Para habilitar após publicar a versão/migração, configure `CLEF_ENABLED="true"`
nas variáveis do Worker. Não há token de API extra: o binding usa Workers AI da
mesma conta Cloudflare. O modelo escolhido é `@cf/cloudflare/clef-flash`.

Quando habilitado, o Workflow acrescenta a fase `classification` após importar
transações e produtos. Percorre páginas de 25 registros pelo índice de conta/data/ID;
cada publicação confirma decisões e checkpoint no mesmo batch. IDs de steps
existentes são preservados. Evidências iguais na página compartilham uma decisão;
decisões aceitas com hash e versão iguais são reutilizadas nas importações
seguintes. Mudanças na origem invalidam a classificação antiga. Erros, resposta
inválida, quota, `unknown` e baixa confiança usam fallback. Após erro do binding,
o adapter para de chamar IA naquela execução; uma retomada pode tentar novamente.

O prompt usa descrição, descrição original, direção, nome/razão social/CNAE/ramo
do estabelecimento, contraparte, motivo, tipo de operação e MCC. Documentos,
CNPJ, agência/conta, referências, saldo, valor e IDs ficam no histórico privado;
não são enviados como campos do prompt. Textos livres podem conter informação
pessoal recebida da origem. Não existe consulta externa de CNPJ/CNAE pelo modelo.

O limite gratuito é compartilhado com outros usos da conta. O código não altera
plano, billing nem limites da Cloudflare. Em conta paga, habilitar inferência pode
gerar cobrança após a franquia; `CLEF_ENABLED=false` evita chamadas do produto.

Fontes oficiais consultadas em 24/10/2026:
[árvore Pluggy](https://v2.docs.pluggy.ai/en/docs/products/transaction-categorization),
[Clef Flash](https://developers.cloudflare.com/workers-ai/models/clef-flash/),
[Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## Evidência

Testes locais cobrem catálogo e migração, CRUD/vínculos/idempotência/escopo,
respostas do adapter, classificação após importação, cache, fallback, desligamento
e precedência manual. A validação anterior em dados reais é descrita em
`clef-category-validation-2026-10-24.md`; ela antecede este catálogo de 33 nomes e
não mede a acurácia desta versão. Deploy, migração remota e importação real desta
implementação não foram executados.

O teste de custo local semeia 10 mil transações na mesma data e consulta uma
página no final do histórico. A condição composta `(date,id)>(?,?)` mantém até
51 linhas lidas por página de 25 registros, incluindo acessos ao índice/tabela;
o teste compara os mesmos resultados com a forma `OR`, que relê registros
anteriores. O repository usa a condição composta e o índice de conta/data/ID.

### Smoke remoto com o catálogo novo

Em 24/10/2026, três chamadas reais ao Clef Flash da conta Cloudflare usaram
somente dados sintéticos e o mesmo prompt/catálogo do adapter (4.011 tokens de
entrada no total). Não houve deploy ou alteração de D1 remoto.

| Evidência sintética | Escolha do modelo | Confiança retornada | Decisão do produto |
| --- | --- | --- | --- |
| Mercado Exemplo, CNAE 4711302 | Compras | 0,1967 | Rejeita; usa fallback |
| Drogaria Exemplo, CNAE 4771701 | Farmácia | 0,8213 | Aceita Farmácia |
| PIX recebido sem finalidade | unknown | 0,3340 | Usa fallback |

O primeiro caso mostra que o catálogo, sozinho, não garante acerto. O limiar é
uma política inicial conservadora; confiança retornada não mede acurácia real.
