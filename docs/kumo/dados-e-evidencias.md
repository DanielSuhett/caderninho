# Dados, dependências e evidência da interface

24/10/2026. Implementação local em `codex/kumo-refactor`.

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
operacionais, mas só leem esse conjunto fictício. Busca/mês/moeda/conta usam GET;
a busca consulta todo o ledger sintético. A demo não importa a API privada do
painel, não usa sessão nem executa edição, conexão ou autorização.

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

| Chunk | Build bruto | Gzip estimado pelo Vite |
| --- | ---: | ---: |
| monthly-spending-chart |190,50 kB |66,29 kB |
| Axis compartilhado |382,61 kB |129,69 kB |
| core |8,95 kB |3,88 kB |

São partes do carregamento do gráfico, além dos chunks compartilhados já usados
pela UI. Não tratar 190,50 kB como custo total. Estes números são relatório de
build, não medição de rede, Core Web Vitals ou desempenho em aparelho físico.
A landing é SSR sem JavaScript obrigatório e não carrega o gráfico.

## Tipografia, contraste e grade

DOM observado: Inter, conteúdo/controles 16 px, metadados 14 px, h1 de 28 px;
métricas 32 px desktop/26 px móvel. `document.fonts.status` estava `loaded`.
Foreground padrão #f4f4f5, metadados #b3b3b8. Kumo neutro escuro com canvas
OKLCH L 0,1/C 0, superfície L 0,17/C 0 e campo L 0,205/C 0.

| Par amostrado | Razão WCAG calculada |
| --- | ---: |
| Texto principal / canvas |18,73:1 |
| Texto principal / superfície |17,40:1 |
| Metadado / superfície |9,16:1 |
| Texto / campo |16,30:1 |

A designer recomputou esses quatro pares a partir dos valores fornecidos. Não é
uma auditoria completa de contraste/estados ou de acessibilidade. Laranja #f97316
é a exceção semântica das barras públicas: consumo da cota; o texto mantém período,
denominador e estimativa, incluindo 103% de CPU com barra saturada em 100%.

As 14 páginas foram capturadas com e sem grade em desktop 1541×863 e emulação móvel
391×845. A emulação solicitou 390×844; a extensão reportou um pixel adicional.
Grade de 12/4 colunas, gutter 24/16 px, baseline 8 px. Não houve overflow horizontal do
documento nas 28 verificações com grade. Isso não prova todos os breakpoints.

## Limite da evidência

As páginas privadas usam fixture visual em 8799 com dados sintéticos. A demo e a
landing também foram abertas no Worker local 8801, sem sessão/credenciais reais;
a busca GET da demo retornou 3 registros de mercado. Os testes de D1/Workflow são
locais e separados das capturas. Confirmações destrutivas foram abertas e
canceladas; não houve revogação real, OAuth de provedor, Pluggy real ou host MCP.

A revisão de um agente no papel de designer crítica é qualitativa, com 8/10 por
página nos estados listados. Não é aprovação de uma designer humana, pesquisa com
usuários, validação de produção ou garantia de acessibilidade completa. O produto
publicado permanece sem alteração, pois não houve push/deploy. A branch local
contém a implementação revista; main foi usada só como base do trabalho.
