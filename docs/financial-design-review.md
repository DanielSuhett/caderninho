# Cartões, Compromissos e Visão geral

Branch integrada: `codex/cartoes-compromissos-design`. Os commits dos PRs #9
(`c65a505`) e #10 (`29a87d3`) foram preservados sobre `origin/main` (`27869b9`),
com as correções de paginação e de transações movidas entre espaços.

## Decisões de apresentação

- `FinancialMetric` compartilha tipografia, precisão monetária, moeda, ausência
  de valor e tons semânticos nas três telas. A Visão geral usa quatro colunas
  quando há espaço; os cartões usam três. Conteúdo segue os tokens globais de
  16 px, metadados de 14 px e valores de 32/26 px.
- `CreditLimitCard` substitui duas composições diferentes. Limite, ocupado,
  disponível, atualização, cadastro manual e crédito excedente continuam
  explícitos. Zero é diferente de ausência; ocupação acima de 100% conserva
  o percentual exato com a barra limitada à escala visual.
- Cartões e Compromissos usam a mesma ordem: resumo, categorias/meses, limites.
  Roscas têm o mesmo tamanho e mostram o denominador exato no centro. Legendas
  alinham valores e percentuais; tabelas e listas têm separadores discretos.
- “Investimentos” passa a “Compromissos” na interface porque esta tela mostra
  gastos de cartões. As URLs `/account/investments` e `/demo/investments` e as
  consultas existentes continuam funcionando. `get_investments` permanece
  dedicado às posições de ativos.

Os cálculos continuam distintos e identificados: Cartões inclui compras sem
categoria no mês escolhido; Compromissos reúne os próximos 12 meses e mantém
lançamentos sem classificação fora dos gastos classificados. Limites atuais
não são fechamento mensal. As duas demos preservam suas fixtures originais,
portanto seus valores não devem ser comparados como se fossem a mesma conta.

## Revisão no navegador

Preview local, somente dados sintéticos, em 25/10/2026:

- Inspeção de Cartões, Compromissos e Visão geral em desktop, claro/escuro,
  e larguras móveis de 390 e 320 px. Nenhuma rolagem horizontal da página nos
  recortes móveis medidos (`scrollWidth === clientWidth`).
- Seleção de Cartão pessoal e retorno a Todos os cartões atualizam a URL.
  Expansão da parcela por Enter expõe compra original, categoria e estado.
- Expansão mensal de Compromissos por Enter mostra as parcelas recebidas;
  `aria-expanded` passa a `true` e o foco continua visível.
- Troca BRL → USD mostra 125,00 USD realizados e mantém limites nas moedas
  nativas. Voltar restaura BRL. O menu móvel fecha ao navegar para outra tela.

A primeira inspeção revelou métricas pequenas em Cartões, disposições diferentes
para os limites, gráficos/legendas divergentes e uma Visão geral que usava duas
linhas mesmo com espaço para quatro métricas. A revisão final conferiu os
componentes compartilhados, a redução de CSS duplicado, o alinhamento das
colunas, o espaço reservado ao carregamento do gráfico e a distinção entre
limite zero e desconhecido. Não houve crítica por um segundo agente.

## Capturas

| Tela | Desktop | Celular |
| --- | --- | --- |
| Cartões | [Escuro](assets/financial-design/cards-desktop-dark.png) · [Claro](assets/financial-design/cards-desktop-light.png) | [Escuro](assets/financial-design/cards-mobile-dark.png) · [Claro](assets/financial-design/cards-mobile-light.png) |
| Compromissos | [Escuro](assets/financial-design/commitments-desktop-dark.png) · [Claro](assets/financial-design/commitments-desktop-light.png) | [Detalhe e foco](assets/financial-design/commitments-mobile-light.png) |
| Visão geral | [Claro](assets/financial-design/overview-desktop-light.png) | [Escuro](assets/financial-design/overview-mobile-dark.png) |

## Validação

As etapas de `mise run check` passaram: configuração, tipos, formatação, lint,
93 testes unitários, 159 testes de integração em 28 arquivos, build do portal,
dry-run do Worker e runtime nativo com 10 mil/100 mil registros e persistência
após reinício. O processo externo terminou com sinal 143 depois de imprimir
todos os resultados do runtime; essa última etapa foi repetida em uma sessão
de processo isolada e terminou com código 0 (34,3 s). `git diff --check` passou.

Os testes de apresentação incluem dinheiro acima da precisão segura de Number,
zero, ausência, crédito excedente e ocupação acima do limite. As regressões de
paginação sem repetição e parcelas movidas entre espaços também passaram.
O Vitest emitiu avisos de resolução de `@emotion/is-prop-valid` do Kumo, sem
falhas nos 159 testes. Nenhuma dependência foi adicionada para ocultar o aviso.

Esta evidência não comprova deploy do Worker, banco remoto, Pluggy/OAuth reais,
leitor de tela ou integração em um host MCP externo. Nenhuma migração foi criada.
