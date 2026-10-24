# Temas, significado financeiro e categorias

24/10/2026. Implementação local com Kumo 2.14.0. A preferência do usuário por
Inter e conteúdo/controles em 16 px prevalece sobre a regra de 14 px da skill;
metadados mantêm 14 px. [Capturas](capturas/rodada-10/README.md).

## Dois temas, uma composição

`data-mode="dark"` e `data-mode="light"` ativam os tokens nativos. Superfícies,
texto, estados, foco e componentes seguem a mesma composição. Não existe uma
segunda paleta do produto. Os aliases financeiros apontam a success/danger;
placeholder aponta a subtle para reforçar sua leitura, inclusive no tema claro.

O botão ghost nativo fica no rodapé da Sidebar no desktop, no cabeçalho móvel
e na navegação pública. `/theme.js` usa delegação de clique e armazena somente
`caderninho.theme`. Falha do armazenamento não impede trocar o tema da página.
Eventos de storage sincronizam abas da mesma origem. Não há troca de key nem
remontagem de formulários. Somente o gráfico assina o tema por
`useSyncExternalStore` e recebe `isDarkMode`/`ChartPalette` do Kumo.

O bootstrap é um arquivo externo assíncrono, independente do bundle React e
compatível com script-src self. A primeira pintura pode mostrar o tema inicial
antes de aplicar uma preferência clara salva. Não se declara garantia de zero
flash. Sem preferência válida, o tema inicial continua escuro.

## Cores com papéis distintos

| Papel | Tratamento |
| --- | --- |
| Entrada/saída na lista e detalhe | Verde/vermelho pela direção CREDIT/DEBIT da origem, mesmo quando o sinal diverge. Sinal original e direção continuam disponíveis. |
| Receitas/despesas classificadas | Verde/vermelho nas métricas; cálculos e critérios existentes permanecem intactos. |
| Saldo, fluxo, zero, indisponível e ignorado | Neutros. Pendentes/futuros conservam seus avisos; a cor não significa liquidação. |
| Categoria | Cor e ícone do cadastro em barras, identificação nas transações/detalhes, resumo/resultado das regras e opções de seleção. Textos e dinheiro não recebem a cor da categoria. |
| Comparador de regra | Badge info nativo; campo em 14 px discreto e valor em 16 px/peso 500. E/OU e escopo continuam legíveis. |

A cor cadastrada não é uma inferência por nome, posição da lista ou tipo de
movimento. Categorias desconhecidas usam fallback neutro. Compra com categorias
variadas não recebe o ícone da primeira parcela como se fosse única.

Meter mantém a escala relativa ao maior volume absoluto observado e os valores
exatos/moeda no texto. A cor cadastrada chega por propriedade de estilo derivada
dos dados; a API `indicatorClassName` aplica currentColor ao preenchimento. Não
reconstrói o componente e não altera os meters laranja de consumo do free tier.
O nome permanece neutro para sua leitura não depender do contraste de uma cor
customizada. Uma cor arbitrária muito próxima do fundo pode tornar o marcador
menos perceptível; o nome e o valor continuam disponíveis.

Transferências na lista usam cor de entrada/saída como movimento, sem virar
receita/despesa classificada. A série mensal de despesas usa vermelho semântico
Attention do ChartPalette Kumo na linha, nos pontos e no preenchimento discreto,
nos dois temas. Eixos e grade continuam neutros; a série representa despesas
do período e não herda a cor de uma categoria individual. Não há conversão
cambial, soma da página atual ou animação dos números.

## Fluxo de dados e preservação

Os consumidores recebem a aparência do catálogo atual por ID. A demo e o painel
compartilham `FinancialDashboard`, `TransactionList`, `CategoryLabel` e o
resultado de composição das regras. O fallback HTML e o Flow usam o mesmo
conteúdo. Editar a aparência não reaplica regras nem modifica valores, direção,
classificação, agregados ou fixtures compartilhadas.

O contrato GET, URLs, nomes dos campos e textos legais não muda. O catálogo
atualiza os consumidores após a gravação pelo fluxo existente; na demo a edição
continua temporária, até recarregar a aba. Não há sincronização em tempo real do
catálogo entre abas independentes.

## Evidência e limites

As capturas documentam código compilado e dados sintéticos locais, com os estados
explicitados no índice. A revisão independente dos primeiros 17 screenshots
atribuiu 8,5/10 a Regras/Transações e 8/10 a Visão geral/editores. Essas notas são
inferências qualitativas dos estados vistos, não testes de satisfação humana.

A revisão complementar abriu 13 capturas da propagação das cores: resumo,
transações, detalhe, regras, seletor e reflow em 320 px. Parecer qualitativo
8,5/10, sem bloqueio concreto observado. Confirmou Mercado roxo nos usos e
verde/vermelho financeiro independente da categoria; não validou contraste de
cores arbitrárias futuras nem ampliou a cobertura para todas as páginas.

As verificações locais não comprovam acessibilidade completa, produção, OAuth,
Pluggy ou comportamento de um host MCP. Nenhuma dependência nova é necessária.
