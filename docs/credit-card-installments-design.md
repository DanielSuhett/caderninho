# Compras parceladas na lista de transações

Revisão e implementação local em 23/10/2026. Base: captura fornecida pelo usuário,
crítica de design e leitura do fluxo de Transações. A captura contém dados
financeiros privados e não foi adicionada ao repositório. A mudança afeta a
consulta e a apresentação do portal, sem alterar a importação, os registros
persistidos, os valores financeiros ou a consulta MCP pública.

## Diagnóstico

1. A lista ordena registros por `date_desc`, sem limite superior padrão. Na
   captura, parcelas pendentes datadas de 2027 ocupam o topo e escondem compras
   recentes. “Mais recentes primeiro” descreve a data de cada parcela, não a
   primeira data da compra.
2. Cada parcela aparece como lançamento independente. O usuário precisa comparar
   descrições, valores e datas para reconhecer uma compra parcelada.
3. O importador guarda `purchaseDate`, `installmentNumber`, `totalInstallments`,
   `cardNumber` e `billId`, mas o contrato da lista do portal não os expõe. A
   consulta pagina por transação: agrupar apenas os 50 registros recebidos no
   navegador partiria uma compra entre páginas.
4. `PENDING` é estado recebido da origem. Uma data futura é uma condição de
   calendário. Ambos podem ocorrer na mesma parcela e precisam de rótulos
   separados. Em cartão, `POSTED` também não prova que a fatura foi paga.

## Comportamento implementado

- Mostrar **uma linha por compra parcelada**, posicionada na data da compra
  (`purchaseDate`). Na ausência dela, usar a primeira data observada e rotular
  “primeira parcela conhecida”. Não inventar a data de uma parcela ausente.
- Na linha, mostrar descrição, cartão/titular, data âncora, “12 parcelas” e o
  **valor da parcela conhecida** com esse rótulo. Se os valores variarem, não
  prometer um valor fixo nem multiplicar uma parcela para apresentar um total.
- A expansão mostra as parcelas recebidas em ordem `1/12`, `2/12` etc., cada
  uma com data, valor exato, `Pendente na origem` ou `Registrada na origem`, e
  `Futura` quando a data excede o dia de referência. Lacunas aparecem como
  “parcela ainda não recebida”, sem gerar transações fictícias. O detalhe mostra
  o identificador da parcela usada como referência na linha.
- A lista principal mostra por padrão compras com data âncora até hoje. Uma
  ação clara, **“Ver lançamentos futuros”**, abre o recorte futuro; parcelas
  futuras de uma compra passada permanecem acessíveis na expansão da compra.
  Uma compra sem data passada conhecida fica no recorte futuro.
- Compras no cartão e pagamentos da fatura continuam conceitos separados.
  Agrupar é uma apresentação da compra; não muda a classificação financeira,
  o fluxo de caixa por data de parcela, a situação da fatura ou os resultados
  das ferramentas MCP existentes.

### Hierarquia visual

| Superfície | Linha fechada | Detalhes |
| --- | --- | --- |
| Desktop | Compra e cartão à esquerda; data âncora e “12 parcelas” no centro; valor rotulado à direita. | Lista cronológica com número, data, valor e os dois estados independentes. |
| Celular | Descrição e valor primeiro; cartão e “12 parcelas” abaixo; data e estados por último. | Uma coluna, sem tabela larga nem rolagem horizontal. |

Manter o `<details>/<summary>` existente como um único alvo de teclado. O nome
acessível deve anunciar compra, quantidade de parcelas e valor rotulado. Estado
não depende apenas de cor; foco visível e alvo de toque preservados. O texto
“50 nesta página” passa a contar **compras e lançamentos avulsos**, não parcelas.

## Regra para formar grupos

O servidor forma e pagina grupos antes de entregar a lista do portal. Ele usa
conta/cartão, moeda, comerciante, valor exato, total de parcelas, número da
parcela e data original ou mês inferido da sequência como indícios. `billId`
não identifica a compra:
cada parcela pode estar em outra fatura. Só agrupar quando a correspondência for
inequívoca pelos dados disponíveis; colisões com o mesmo número de parcela e
metadados insuficientes ficam como lançamentos individuais com seu indicador
`2/12`. Sem `purchaseDate`, o agrupamento pelo mês inferido é uma associação
probabilística; o portal informa “primeira parcela conhecida”. Mudanças na
origem podem desfazer esse agrupamento na próxima consulta.

Filtros de data atuam sobre a data âncora da linha. Um filtro de estado seleciona
grupos que tenham ao menos uma parcela nesse estado, sem esconder as demais na
expansão. O cursor deve contar grupos completos e preservar filtros. A consulta
MCP `get_transactions` continua retornando transações individuais.

## Critérios de aceitação

1. `[1/3, 2/3, 3/3]` em meses distintos ocupa uma linha na data da compra; a
   expansão conserva três datas, valores e estados próprios.
2. Na data atual, uma parcela de 2027 não ocupa o topo da lista padrão; pode ser
   encontrada na compra ou em “Ver lançamentos futuros”.
3. Um grupo não se divide entre páginas; busca e filtros preservam o conjunto
   de parcelas do grupo exibido.
4. Duas compras semelhantes no mesmo dia não são unidas sem evidência
   suficiente; parcelas ausentes não são contabilizadas como pagas ou confirmadas.
5. Desktop, celular e teclado distinguem “futura” de “pendente” e identificam
   se o valor mostrado é de uma parcela ou da compra. O contrato de acessibilidade
   precisa de verificação em leitor de tela real.

## Validação e limites

Os testes de integração usam transações sintéticas e verificam agrupamento antes
da paginação, recorte futuro, estado pendente, compra ambígua e primeira data
observada. A galeria local foi inspecionada em desktop e 390 px: o detalhe abre,
mantém os estados separados e não cria rolagem horizontal. Isso não comprova a
identidade das compras da captura, o estado real da fatura, dados de produção nem
uso com leitor de tela. A documentação da Pluggy afirma que o Open Finance
não fornece um identificador único para agrupar parcelas e que instituições
publicam parcelas em momentos diferentes:
[parcelamentos](https://docs.pluggy.ai/en/docs/products/credit-card-installments),
[ciclo da fatura](https://docs.pluggy.ai/en/docs/products/credit-card-statement-cycle).
