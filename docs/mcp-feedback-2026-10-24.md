# Ajustes do feedback MCP de 24/10/2026

Base: `d40be18`, versão 0.4.0. Trabalho local na branch
`codex/feedback-consultas-mcp`.

## Consultas efetivas

Saldos importados não consultam transações quando não existem contas manuais
na seleção. Para saldos manuais, somente suas contas entram na leitura.

As consultas aplicam período e contas no SQL usando os índices existentes.
Origens com sobreposições são lidas por ID separadamente e avaliadas depois das
edições, preservando mudanças de data, conta, espaço, classificação e exclusão.
Não há nova materialização persistida nem migração de banco nesta entrega.
A lista de ocorrências usa ordenação e cursor no banco e interrompe a leitura
quando obtém `limit + 1` correspondências da origem, combinadas com edições e
lançamentos manuais. O agrupamento por compra do painel conserva sua travessia
completa porque precisa reunir parcelas antes de paginar.

Comparar períodos calcula os dois resumos em uma passagem sobre o intervalo
que os abrange. Intervalos explícitos muito distantes ainda podem ler os dados
entre eles. Filtros de categoria, tag e texto continuam sendo aplicados sobre a
projeção em memória; uma seleção pouco seletiva ainda pode examinar muitos
registros dentro do período. As origens editadas e os lançamentos manuais também
continuam em memória: o custo não é independente do volume de edições locais.

Tags, regras, categorias, grupos, espaços e preferências de notificação leem
somente seu catálogo e o contexto mínimo, sem carregar empréstimos, metas,
parcelas ou sobreposições de transações. As demais famílias conservam o snapshot
completo. Cache global e materialização ampla não foram introduzidos.

## Contratos e significado

Resultados MCP de sucesso incluem `structuredContent` com o mesmo objeto
canônico presente no JSON textual. O texto JSON foi preservado para os clientes
existentes, conforme a [especificação MCP de conteúdo estruturado](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#structured-content).
Esta entrega não reduz esse custo de serialização duplicada no transporte.
O catálogo serializado mede 148.567 bytes compactos nesta revisão; 38.482 bytes
são os seis schemas de saída. Esse custo melhora a descrição do contrato, mas
não representa economia de contexto e não foi convertido em estimativa de tokens.

Seis consultas analíticas têm `outputSchema`: `get_overview`,
`get_spending_by_category`, `analyze_categories`, `get_spending_comparison`,
`get_spending_pace` e `generate_chart`. A cobertura dos schemas restantes pode
ser ampliada sem alterar o formato atual. Os testes chamam essas seis consultas
via HTTP MCP com OAuth sintético e validam os dados retornados.

As consultas de planejamento e a lista agrupada expõem `view`, `scope`,
`revision`, `coverage` e `oldestLastSuccessAt`, além dos campos anteriores.
`preview_rule` preserva seu envelope específico. Cobertura considera pessoa,
espaço e conta selecionados, inclusive transações movidas entre espaços e
conexões sem contas que ainda não concluíram sua primeira importação.
`coverage.kind` distingue dados importados, dados somente locais e ausência de
fontes; `partial: false` continua sem prometer atualização recente.

Resumo, série e detalhe aceitam os mesmos filtros de conta, categoria, tag,
moeda, cartão, direção, status, texto e ignorados. Os resumos devolvem a seleção
aplicada. Totais realizados permanecem limitados a POSTED e ao dia de referência;
`eligibility` explicita essa regra mesmo quando a lista inclui pendentes/futuros.
Saldo, investimentos e empréstimos da visão geral são contexto patrimonial,
separado dos totais de transações filtradas.

Agregados de categoria incluem ID, nome e rótulo. `amountMinor` permanece exato;
`scale` e `formattedAmount` permitem apresentação sem conversão para Number.
Moeda desconhecida tem `scale: null`, sem assumir duas casas decimais.
`knownUnclassifiedMinor` soma magnitudes conhecidas dos movimentos sem
classificação, sem chamá-los de despesa. `unclassifiedMinor` é null quando há
valor desconhecido nesse conjunto, com contagem própria.

`generate_chart` aceita `includeSvg: false` para devolver séries sem SVG.
O padrão `true` e os defaults anteriores de `get_transactions` foram preservados
por compatibilidade. As instruções e descrições orientam `date_desc`, `limit: 5`
para últimas compras e o reaproveitamento dos grupos presentes nos resumos.
Os SVGs opcionais usam os rótulos legíveis; a série exata permanece canônica.

`get_spending_comparison` aceita `comparison`:

- `previous_period`: intervalo anterior de duração igual, padrão existente.
- `previous_month`: mesmos dias no mês anterior, limitados ao último dia do mês.
- `explicit`: exige `previousFrom` e `previousTo` válidos.

Todos os retornos informam as datas resolvidas. O inventário em
[mcp-tools.md](mcp-tools.md) é gerado por `npm run docs:mcp`, evitando contagens
manuais divergentes nas páginas principais.

## Evidência local

`tests/integration/planning-feedback.test.ts` verifica 1.000 e 10.000 registros
fora do período, mantendo dez dentro da seleção e uma conta importada:

| Consulta | Passagens de origem | Registros materializados | Orçamento de leitura D1 de transações |
| --- | --- | --- | --- |
| `get_accounts` | 0 | 0 | 0 |
| `get_spending_by_category` | 1 | 10 | até 30 |
| `get_overview` | 1 | 10 | até 30 |
| `get_spending_comparison` | 1 | 10 | até 30 |
| `get_transactions`, date_desc, limit 5 | 1 | 6 | até 30 |

O orçamento é verificado com `D1Result.meta.rows_read` do SQLite/workerd local.
Como Drizzle usa `raw()`, que descarta os metadados, o teste captura os SELECTs
e parâmetros reais e os reexecuta na mesma fixture sem mudanças para medir
as linhas examinadas. Essa medida não inclui as leituras do snapshot. A quantidade materializada é contada no
repositório real. Estes cenários não demonstram latência, p95 ou custo de produção,
nem um orçamento universal para todas as combinações de filtros e contas.

Também são testados paginação com edições/manuais/exclusões, precisão de 30
dígitos, moedas de escalas diferentes, filtros consistentes, nulos desconhecidos,
comparações explícitas e por mês, fontes por pessoa e catálogo reduzido.

Validação final: `mise run check` passou com Node 24.21.0: tipos gerados,
TypeScript estrito, formatação, lint, 72 testes Node, 143 testes de integração,
build do portal/dry-run do Worker e um teste nativo de Workflow/D1 com 10 mil e
100 mil transações, replay, falhas parciais e persistência após reinício.
`git diff --check` e os links locais alterados também passaram. O aviso conhecido
de resolução de `@emotion/is-prop-valid` em Kumo apareceu nos testes; não impediu
a execução nem o build.

## Limites externos

Nesta sessão, a descoberta de ferramentas não disponibilizou ferramentas
financeiras do plugin Caderninho. Isso não identifica a causa da associação do
plugin e não demonstra falha no servidor. Skill instalada e endpoint ativo não
substituem uma chamada autenticada no host real.

Não houve deploy, migração remota, alteração da instalação do plugin nem consulta
a dados privados. Exposição do plugin, renderização de Intelligent UI/MCP Apps e
latência de produção exigem validação posterior no host conectado. Construção de
widgets próprios não é necessária para entregar os dados estruturados desta
mudança.
