# Dados e carregamento da interface

## Agregação financeira

| Leitura | Origem e significado |
| --- | --- |
| Resumo e categorias | `get_overview` existente em `src/worker/planning/queries.service.ts`; percorre o período completo. O portal valida a resposta com `FinancialOverviewResponseSchema`. |
| Série mensal | `generate_chart` existente, restrito a `groupBy=month` na allowlist do portal. Usa seis meses e `MonthlySpendingResponseSchema`; não agrega os registros visíveis da tabela. |
| Saldo bancário | Soma exata das últimas observações das contas BANK visíveis na moeda escolhida. Se alguma estiver sem valor, mostra Indisponível. Não representa fechamento do mês. Cartões aparecem separados. |
| Recentes | Até seis registros do período, separados do cálculo dos totais. No painel o escopo declara todas as moedas; a demo restringe à moeda escolhida. |
| Categoria e moeda | Receitas/despesas usam classificação explícita. Não há conversão cambial nem filtro de conta nos agregados, pois o contrato atual não fornece esse recorte. A conta pode filtrar a lista de transações. |

A política fica disponível em “Como este resumo é calculado”: somente POSTED até
`referenceDay`; ignorados, pendentes e futuros fora dos agregados. Transferências
e pagamentos de fatura não entram em receitas/despesas. Fluxo bancário representa
entradas menos saídas de contas BANK, inclusive seus movimentos de transferência.
Estornos reduzem despesas da categoria. Parcelas entram na data de cada registro
recebido, sem antecipar o valor integral da compra. O estado da origem não comprova
pagamento da fatura.

`amountMinor` permanece string inteira e os cálculos usam BigInt. Valores ausentes
não viram zero: totais ficam indisponíveis; grupos conhecidos são identificados.
Moedas permanecem separadas em todos os agregados e tabelas. Meter de categoria
compara volume absoluto, com sinal preservado no número e denominador declarado;
não representa cota. Gráfico converte somente inteiros dentro de MAX_SAFE_INTEGER
para plotagem. Acima disso, a tabela conserva os valores exatos; não se arredonda
silenciosamente dinheiro para caber no gráfico.

Falha da série não derruba os demais agregados. Falha do chunk gráfico mostra uma
tabela imediatamente. Quando não há grupos, não aparece um controle prometendo
valores exatos ausentes. Nenhum saldo diário, projeção, taxa de economia, custo de
IA ou percentual de importação foi inventado.

## Demo e segurança

`src/web/demo-data.ts` fornece um ledger determinístico de maio a outubro de 2026,
com BRL/USD, bancos/cartão, estorno, transferências, sem classificação, pendência,
futuro e ignorado. `/demo` e `/demo/transactions` compartilham os componentes
operacionais, mas só leem esse conjunto fictício. Mês/moeda usam GET na visão
geral; busca/mês/conta usam GET em Transações, com moeda em cada valor e sem
conversão ou soma entre moedas. A lista não oferece seletor de moeda;
a busca consulta todo o ledger sintético. A demo não importa a API privada do
painel nem usa sessão. Edições de regras e grupos ficam na memória da aba,
como descrito no [contrato da demo](demo-interativa.md); não conecta bancos
nem autoriza assistentes.

A API financeira privada continua exigindo sessão, origem, JSON e CSRF. A allowlist
foi ampliada somente com as duas leituras existentes acima, não com mutações.
Os testes exercitam a resposta efetiva do serviço/D1 e o bloqueio por CSRF.
O CSP do site permite `form-action 'self'` para os filtros GET da demo; demais
origens/scripts/fonts continuam restritos. Não houve alteração de dados remotos.

## Fonte, estilos e carregamento

Inter variável local, obtida da distribuição oficial `rsms.me/inter`, com licença
SIL OFL em `src/web/assets/fonts/Inter-LICENSE.txt`; WOFF2 de 352.240 bytes. Não há
requisição a um serviço de fontes durante o uso. Preferência do usuário por Inter
16 px prevalece sobre a regra 14 px da skill; metadados continuam 14 px.

Kumo permanece 2.14.0. ECharts 6.1.0 foi adicionado na ampliação autorizada do
escopo. `Chart` nativo carrega com LineChart, Grid, Tooltip, Aria e CanvasRenderer
sob demanda. Valores exatos e alternativa textual são independentes do canvas.
O build combina o standalone e o CSS oficial de componentes da mesma versão,
removendo apenas o import do binding já incluído; o standalone sozinho omitia
os estilos de DatePicker. Nenhuma reconstrução CSS do calendário foi criada.
