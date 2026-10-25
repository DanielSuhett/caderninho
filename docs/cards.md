# Cartões e parcelamentos

`/account/cards` reúne os gastos das contas `CREDIT`, os limites importados e as
parcelas recebidas. A demonstração pública em `/demo/cards` usa os mesmos
componentes, o ledger sintético compartilhado e nenhuma conexão real.

O seletor **Cartão** fica sempre visível acima dos valores, mesmo com uma única
conta. Permite alternar entre Todos os cartões e uma conta específica. A seleção
recalcula resumo, categorias, meses, parcelas e limites do recorte; preserva mês,
pessoa, grupo e moeda, e reinicia a paginação. Pessoa e grupo ficam em Filtros.

## Gastos do mês

O recorte usa grupo, pessoa, conta de cartão e moeda. Os totais percorrem todos
os lançamentos do recorte; a paginação dos detalhes não limita a soma. Dinheiro
permanece em unidades menores inteiras, com BigInt no cálculo e strings no HTTP.

Compras confirmadas têm status `POSTED` e data até o dia de referência. Débitos
sem categoria também entram. Créditos descontam como estorno somente quando
classificados como despesa. Categorias de transferência e receita, pagamentos
de fatura identificados pela origem, ignorados e excluídos ficam fora. Não há
conversão entre moedas nem soma do débito bancário de pagamento da fatura.

Pendentes até hoje e lançamentos com data futura ficam separados. Uma parcela
pendente com data futura entra somente na coluna Futura. Valor ausente torna o
total indisponível, preservando a soma conhecida e a quantidade sem valor.

## Limite e categorias

Limite e disponível vêm de `creditData.creditLimit` e `availableCreditLimit`,
quando enviados pelo banco. Alocado é a diferença exata entre ambos. A tela
preserva ausência, zero e crédito excedente. Um limite não positivo não recebe
percentual de ocupação. O medidor limita sua geometria a 100%, preservando no
texto percentuais acima de 100%.

Esses valores são a última informação importada, independentemente do mês
selecionado. A data exibida é a observação da conta; não comprova atualização
individual do limite. Limites de contas diferentes não são somados, pois podem
ser compartilhados. O saldo da conta não substitui o limite utilizado: sua
semântica pode variar entre conectores, conforme a
[documentação de contas da Pluggy](https://docs.pluggy.ai/en/docs/products/accounts).

A rosca particiona as compras confirmadas do mês **antes dos estornos**, com
as cores cadastradas das categorias e legenda exata. Seu denominador é o total
dessas compras, não o limite do cartão. O gasto líquido e os estornos aparecem
no resumo. A legenda continua disponível se o gráfico falhar; valores acima da
escala numérica segura ou compras sem valor impedem o gráfico.

## Parcelas recebidas

A tabela cobre o mês selecionado e os onze seguintes. Cada parcela usa a data
do seu lançamento e os metadados estruturados `installmentNumber`,
`totalInstallments` e `purchaseDate`. O valor total da compra não é somado às
parcelas. Nenhuma descrição é analisada para inventar um parcelamento.

Os detalhes mostram até 50 parcelas por página do mês escolhido, com data da
compra original, cartão, categoria, número e estado. O cursor inclui revisão e
filtros; mudança de escopo ou revisão exige reiniciar. Datas de compra ausentes
permanecem identificadas, sem inferência.

Uma célula vazia significa que nenhuma parcela foi recebida. Parcelas ausentes
não são projetadas a partir do número total, e confirmação do lançamento não
comprova pagamento da fatura. A disponibilidade dos dados varia por instituição;
consulte [parcelamentos na Pluggy](https://docs.pluggy.ai/en/docs/products/credit-card-installments).

## Implementação e validação

`get_portal_cards` integra a allowlist de leitura do portal, com sessão, CSRF e
validação Zod. Não cria ferramenta MCP, mutação, migração ou chamada nova à
Pluggy. O serviço usa a projeção efetiva existente, com leitura incremental e
detalhes limitados; valida a revisão depois da consulta.

O gráfico usa Kumo Chart e ECharts PieChart carregados sob demanda. Conteúdo e
controles desta aba usam 14 px conforme a solicitação, preservando Inter e os
temas nativos. A [revisão de design](cards-design-review.md) registra o loop de
crítica e seus limites. Testes locais usam apenas dados sintéticos; não comprovam
disponibilidade de limites em uma instituição real ou deploy.
