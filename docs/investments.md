# Carteira de investimentos

`/account/investments` apresenta ativos financeiros importados da Pluggy e
posições manuais. `/demo/investments` usa os mesmos componentes e agregação com
dados sintéticos. A landing promove a carteira e aponta para essa demonstração.
Parcelas e limites de crédito ficam em Cartões.

## Consulta compartilhada

Painel e MCP usam `get_investments`. O portal exige sessão, origem e CSRF; o MCP
usa OAuth. Os filtros são grupo, pessoa, moeda, classe, instituição e estado.
Os campos existentes de cada posição permanecem compatíveis; `details`,
`identity` e `totals` acrescentam metadados e agregados.

```json
{
  "name": "get_investments",
  "arguments": {
    "spaceId": "personal",
    "currency": "BRL",
    "type": "FIXED_INCOME"
  }
}
```

## Valores e composição

- `amountMinor`: posição bruta, vinda de `amount`.
- `details.balanceMinor`: posição líquida, vinda de `balance`.
- `details.profitMinor`: resultado informado, vindo de `amountProfit`.
- `details.withdrawalMinor`: disponível para resgate, vindo de `amountWithdrawal`.

Cada moeda tem totais próprios e alocações por classe/instituição. Dinheiro usa
strings inteiras em unidades menores e BigInt; nenhuma soma converte moedas.
Um campo ausente não vira zero: o total correspondente fica nulo, com subtotal
conhecido e quantidade de posições sem valor. Excluídos e totalmente resgatados
ficam na lista, fora dos totais. Não inferimos rentabilidade nem histórico a
partir de uma posição atual. Os gráficos são composição, não evolução temporal.

Detalhes exibem valor aplicado, impostos, código, quantidade decimal, emissor,
datas e taxas recebidas. Não há ordens de compra, venda, aplicação ou resgate.

## Identidade e interação

A instituição explícita do ativo, quando enviada por B3, prevalece. Sem ela, a
marca vem do conector Pluggy. Somente URLs verificadas da CDN Pluggy são usadas;
sem imagem válida, há ícone de banco. Não adivinhamos instituição pelo nome.
Pessoa e instituição usam círculos sobrepostos quando não há pessoa selecionada.
Os filtros ficam em um diálogo Kumo; o botão resume pessoas em um grupo compacto.
Detalhes abrem por clique ou teclado. Textos explicativos ficam nos tooltips dos
rótulos; dados parciais e valores ausentes continuam explícitos.

## Persistência e evidência

Metadados ficam no JSON tipado do modelo de planejamento. A sincronização conserva grupo
e inclusão editados pela pessoa. Posições sem detalhes continuam legíveis e recebem
novos campos quando a origem os retornar em uma sincronização posterior.

Testes sintéticos cobrem importação, contrato MCP/portal, precisão monetária,
moedas, ausência, filtros, exclusões e resgates. Esses testes não comprovam
conexão Pluggy/OAuth real ou execução em um host MCP externo.

Fontes: [Investment](https://docs.pluggy.ai/en/docs/products/investments) e
[List investments](https://docs.pluggy.ai/en/reference/investment/investments-list).
