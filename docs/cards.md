# Cartões e parcelamentos

`/account/cards` reúne os gastos das contas `CREDIT`, os limites importados e as
parcelas recebidas. A demonstração pública em `/demo/cards` usa os mesmos
componentes, o ledger sintético compartilhado e nenhuma conexão real.

O seletor **Cartão** fica no diálogo **Filtros**, mesmo com uma única conta. Permite alternar entre Todos os cartões e uma conta específica. A seleção
recalcula resumo, categorias, parcelas e limites do recorte; preserva mês,
pessoa, grupo e moeda, e reinicia a paginação. Pessoa, grupo e moeda usam o mesmo diálogo.

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

## Limite definido pelo dono

A caneta em cada cartão abre um Dialog Kumo para definir um limite local. O
valor é salvo no D1, em `planning_accounts`, e sobrevive a reload e novas
importações. O dado bruto do provedor continua intacto. “Usar limite do banco”
remove a preferência local ao salvar; o valor importado volta a prevalecer.

`update_account_settings` aceita `creditLimitMinor` inteiro em unidades menores
ou `null` para restaurar, somente em contas CREDIT. Fechamento e vencimento
continuam editáveis apenas em cartões manuais. O portal expõe somente a edição
do limite, com sessão, CSRF, confirmação, recibo idempotente e `expected_revision`
obrigatória. Revisão antiga exige atualizar; não sobrescreve silenciosamente.
Não há migração nova: a preferência usa o modelo persistente existente.

Com um limite local, a ocupação preserva a diferença exata entre limite e
crédito disponível recebidos do banco. O novo disponível é **estimado** como
limite local menos essa ocupação, inclusive quando negativo. Sem os dois valores
de origem, ocupação e disponível ficam indisponíveis; gastos do mês não os
substituem. A tela identifica o limite local e o disponível estimado. A mesma
política vale em `get_accounts`, `get_overview` e `get_card_commitments`;
`availabilitySource=estimated` distingue a estimativa no MCP. A demo mantém a
preferência só na sessão e a restaura no reload, conforme seu contrato.

## Parcelas recebidas

A seção Parcelamentos mostra o mês selecionado. A tabela “Parcelas por mês”
foi removida da interface; a série mensal do contrato de consulta permanece
disponível para compatibilidade. Cada parcela usa a data
do seu lançamento e os metadados estruturados `installmentNumber`,
`totalInstallments` e `purchaseDate`. O valor total da compra não é somado às
parcelas. Nenhuma descrição é analisada para inventar um parcelamento.

A consulta mensal mantém até 50 parcelas por página, agrupadas em compras na
interface. Cada compra expande a tabela compartilhada `InstallmentTable`, com
avatar de pessoa/banco/bandeira, número, data, valor exato, lançamento e fatura.
A expansão busca o histórico completo recebido daquela compra, por
`get_portal_transactions` com `transactionId`, conta e grupo; não fica limitada
ao mês escolhido. A mesma leitura serve ao modal de uma transação parcelada.
Duplicidade de números de parcela impede agrupar compras ambiguamente. O cursor inclui revisão e
filtros e dia financeiro; mudança de escopo, revisão ou dia exige reiniciar. Datas de compra ausentes
permanecem identificadas, sem inferência.

No celular, as linhas da tabela mantêm padding de 16 px em todos os lados e
12 px entre grupos de informação. Em containers de até 280 px, lançamento e
pagamento ocupam linhas completas; valores e metadados conservam 16/14 px. A
superfície existente da compra é preservada, sem outro LayerCard na expansão.

Uma célula vazia significa que nenhuma parcela foi recebida. Parcelas ausentes
não são projetadas a partir do número total, e confirmação do lançamento não
comprova pagamento da fatura. A coluna Fatura mostra “Paga” somente quando a
fatura vinculada tem evidência de conciliação bancária do modelo existente;
“Marcada paga” preserva a marcação manual. Fatura ausente, incompatível com
conta/moeda ou sem evidência permanece “Pagamento não informado”, inclusive em
lançamentos POSTED. A demo possui evidências sintéticas explícitas em três
parcelas de Ferramentas de desenvolvimento, sem alterar os valores do ledger. A disponibilidade dos dados varia por instituição;
consulte [parcelamentos na Pluggy](https://docs.pluggy.ai/en/docs/products/credit-card-installments).

## Implementação e validação

`get_portal_cards` integra a allowlist de leitura do portal, com sessão, CSRF e
validação Zod. Não cria ferramenta MCP, migração ou chamada nova à
Pluggy. A edição usa a mutação local documentada acima. O serviço usa a projeção efetiva existente, com leitura incremental e
detalhes limitados; valida a revisão depois da consulta.

O gráfico usa Kumo Chart e ECharts PieChart carregados sob demanda. Conteúdo e
controles desta aba usam 16 px, metadados de 14 px, Inter e temas nativos. Testes locais usam apenas
dados sintéticos; não comprovam
disponibilidade de limites em uma instituição real ou deploy.
