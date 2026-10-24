# Capturas — rodadas críticas 03 a 10

## Temas e cores semânticas — rodada 10

[Temas, comparadores e identidade de categoria](rodada-10/README.md).
[Contrato e limites](../temas-e-contraste.md). Código compilado local sintético;
resumo, ledger, regras, editores e navegação pública amostrados.

## Demo interativa — rodada 09

[Quatro páginas, editores, reaplicação e grupos isolados](rodada-09/README.md).
[Contrato e testes](../demo-interativa.md) ·
[crítica independente](../revisao-critica-09-demo.md). Evidência local sintética;
as outras páginas do produto mantêm a revisão histórica 08.

## Polimento atual — rodada 08

[14 páginas, grades, estados e medições](rodada-08/README.md). Ledger, regras,
alinhamento e recuperação/fluidez foram revisados com capturas atuais.
[Relatório](../polimento-08.md) · [revisão independente](../revisao-critica-08-polimento.md).

## Composição das regras — rodada 07

24/10/2026. Código compilado em fixture privada sintética local 8799.
[Contratos e limites](../rule-flow.md) · [revisão crítica](../revisao-critica-07-rule-flow.md).
Somente Regras foi reavaliada nesta rodada; os registros das demais páginas são históricos.

| Estado | Captura |
| --- | --- |
| Lista e composição com duas alternativas | [recolhida](rodada-07/regras-recolhidas-desktop.png) / [desktop](rodada-07/regras-composicao-desktop.png) |
| Fluxo vertical em 391 px | [início](rodada-07/regras-composicao-mobile.png) / [condições e resultado](rodada-07/regras-composicao-mobile-resultado.png) |
| Editor com preset e regra pausada | [editor](rodada-07/regras-editor-preset-desktop.png) / [pausada](rodada-07/regras-pausada-desktop.png) |
| Máximo de 4×8 condições | [desktop](rodada-07/regras-maximo-desktop.png) / [320 px](rodada-07/regras-maximo-mobile-320.png) / [geometria móvel](rodada-07/geometria-maximo-mobile.json) |
| Módulo opcional indisponível | [composição textual após 503](rodada-07/regras-fallback-503.png) |

O máximo exige rolagem vertical; as imagens não mostram todos os nós. As versões
`regras-maximo-*-inicial.png` são rejeitadas: centralização escondia o escopo e a
categoria no desktop e o número extremo quebrava no meio de um grupo em 320 px.
Na versão corrigida, alinhamento nativo pelo topo e quebra só entre milhares.
Larguras são CSS; screenshots podem ser redimensionados pela API. Sem declaração
de conformidade completa de acessibilidade, produção ou motor financeiro pela fixture.

## Movimento e explicação MCP — rodada 05

24/10/2026. [Política, verificações e limites](../motion.md) ·
[revisão crítica](../revisao-critica-05-motion.md). Landing no Worker local 8801;
painel e falha deliberada do chunk em fixture sintética 8799. Capturas estáticas
documentam os estados; progressão, pausa e offsets foram observados em leituras
temporais separadas do DOM, sem confundir imagens com gravação.

| Estado | Captura aceita |
| --- | --- |
| Flow MCP desktop | [pausado revisado](rodada-05/mcp-desktop-revisado.jpg) / [reproduzindo](rodada-05/mcp-desktop-reproduzindo.jpg) |
| Flow MCP móvel | [superior 391px](rodada-05/mcp-mobile-superior.jpg) / [inferior 391px](rodada-05/mcp-mobile-inferior.jpg) / [topo corrigido 320px](rodada-05/mcp-320-corrigido.jpg) |
| Limite de orientação | [vertical 1090px](rodada-05/mcp-1090.jpg) / [horizontal 1101px](rodada-05/mcp-1100.jpg) |
| Chunk opcional indisponível | [fallback HTML após 503](rodada-05/mcp-fallback-503.jpg) |
| Painel amostrado | [Transações](rodada-05/transacoes-entrada-desktop.jpg) / [Dialog de filtros](rodada-05/filtros-desktop.jpg) / [regra expandida](rodada-05/regra-expandida-desktop.jpg) |

`landing-antes.jpg` é baseline histórica em viewport diferente, sem comparação
pixel a pixel. `mcp-desktop-pausado.jpg` registra a versão inicial rejeitada
(corpo menor, último título quebrado e rótulo Ver tudo). `mcp-320.jpg` registra
o corte rejeitado, substituído por `mcp-320-corrigido.jpg`. A captura corrigida
de 320px não mostra os nós inferiores; os quatro foram conferidos por geometria.

Larguras/alturas acima são CSS. A captura é redimensionada pela API: por exemplo,
1440×900 CSS → 1425×891 pixels e 320×845 → 305×804. Sem nova revisão por grade das
14 páginas. Movimento reduzido do SO não foi emulado; Sem animação é controle
manual e não substitui essa verificação. Sem teste de produção/OAuth/host MCP.

## Atualização de Transações — rodada 04

24/10/2026. Complemento após a correção de critério do usuário: controles só
quando representam escolhas reais. [Revisão crítica](../revisao-critica-04-transacoes.md).
As capturas 03 de Transações/demo de Transações abaixo são históricas e foram
substituídas por esta rodada; as outras páginas não foram reavaliadas nesta rodada.

| Estado | Captura |
| --- | --- |
| Uma conta, nome uma vez e sem coluna repetida | [desktop final](rodada-04/conta-unica-final-desktop.jpg) / [celular final](rodada-04/conta-unica-final-mobile.jpg) |
| Filtros sem Conta/Grupo/Pessoa de opção única | [Dialog](rodada-04/conta-unica-filtros-mobile.jpg) |
| Conta desconhecida ou filtro antigo | [conta ausente do catálogo](rodada-04/conta-desconhecida-desktop.jpg) / [filtro indisponível e Limpar](rodada-04/filtro-indisponivel-mobile.jpg) |
| Demo, busca e Filtros compactos | [desktop final](rodada-04/demo-desktop-final.jpg) / [celular final](rodada-04/demo-mobile-final.jpg) / [busca aplicada](rodada-04/demo-busca-compacta-mobile.jpg) / [320px](rodada-04/demo-busca-320.jpg) |
| Várias contas, Select e recuperação de parcialidade | [lista e link sublinhado](rodada-04/varias-contas-mobile.jpg) / [Select aberto](rodada-04/varias-contas-select-mobile.jpg) |
| Alinhamentos de Transações | [grade desktop](rodada-04/grade-transacoes-desktop.jpg) / [grade celular](rodada-04/grade-transacoes-mobile.jpg) |

Fixture privada local em 8799; dados sintéticos. A exceção deliberada de conta
fora do catálogo comprova apresentação, não aplicação de filtros por SQL. GET
preservou accountId oculto e Limpar removeu os IDs indisponíveis. Sem rolagem
horizontal nas larguras inspecionadas. Demo final também aberta no Worker local
8801 sem sessão; busca por Enter retornou três registros, preservando mês e
texto no GET. O primeiro conjunto `*-native.jpg` da demo
e `demo-busca-mobile.jpg` registra a etapa anterior à busca compacta.

## Rodada 03 — demais páginas e histórico

24/10/2026. Screenshots do código compilado, com dados sintéticos.
Desktop 1541×863; celular emulado 391×845. Não são imagens geradas por IA.
[Revisão por página](../revisao-critica-03.md), [QA](../../../design-qa.md) e
[galeria com todas as imagens](../galeria.md).

## Páginas atuais

| Página e rota | Desktop | Celular | Grade desktop / celular |
| --- | --- | --- | --- |
| Visão geral · `/account` | [imagem](rodada-03/final-visao-geral-desktop.jpg) | [imagem](rodada-03/final-visao-geral-mobile.jpg) | [12 colunas](rodada-03/grade-visao-geral-desktop.jpg) / [4 colunas](rodada-03/grade-visao-geral-mobile.jpg) |
| Transações · `/account/transactions` | [imagem](rodada-03/final-transacoes-desktop.jpg) | [imagem](rodada-03/final-transacoes-mobile.jpg) | [12 colunas](rodada-03/grade-transacoes-desktop.jpg) / [4 colunas](rodada-03/grade-transacoes-mobile.jpg) |
| Regras · `/account/rules` | [imagem](rodada-03/final-regras-desktop.jpg) | [imagem](rodada-03/final-regras-mobile.jpg) | [12 colunas](rodada-03/grade-regras-desktop.jpg) / [4 colunas](rodada-03/grade-regras-mobile.jpg) |
| Grupos · `/account/groups` | [imagem](rodada-03/final-grupos-desktop.jpg) | [imagem](rodada-03/final-grupos-mobile.jpg) | [12 colunas](rodada-03/grade-grupos-desktop.jpg) / [4 colunas](rodada-03/grade-grupos-mobile.jpg) |
| Sincronizações · `/account/sync` | [imagem](rodada-03/final-sincronizacoes-desktop.jpg) | [imagem](rodada-03/final-sincronizacoes-mobile.jpg) | [12 colunas](rodada-03/grade-sincronizacoes-desktop.jpg) / [4 colunas](rodada-03/grade-sincronizacoes-mobile.jpg) |
| Conexões · `/account/connections` | [imagem](rodada-03/final-conexoes-desktop.jpg) | [imagem](rodada-03/final-conexoes-mobile.jpg) | [12 colunas](rodada-03/grade-conexoes-desktop.jpg) / [4 colunas](rodada-03/grade-conexoes-mobile.jpg) |
| Auditoria MCP · `/account/audit` | [imagem](rodada-03/final-auditoria-desktop.jpg) | [imagem](rodada-03/final-auditoria-mobile.jpg) | [12 colunas](rodada-03/grade-auditoria-desktop.jpg) / [4 colunas](rodada-03/grade-auditoria-mobile.jpg) |
| Referência visual · `/account/design-system` | [imagem](rodada-03/final-referencia-desktop.jpg) | [imagem](rodada-03/final-referencia-mobile.jpg) | [12 colunas](rodada-03/grade-referencia-desktop.jpg) / [4 colunas](rodada-03/grade-referencia-mobile.jpg) |
| Landing · `/` | [imagem](rodada-03/final-landing-desktop.jpg) | [imagem](rodada-03/final-landing-mobile.jpg) | [12 colunas](rodada-03/grade-landing-desktop.jpg) / [4 colunas](rodada-03/grade-landing-mobile.jpg) |
| Acesso · `/account/login` | [imagem](rodada-03/final-acesso-desktop.jpg) | [imagem](rodada-03/final-acesso-mobile.jpg) | [12 colunas](rodada-03/grade-acesso-desktop.jpg) / [4 colunas](rodada-03/grade-acesso-mobile.jpg) |
| Consentimento · `/authorize` | [imagem](rodada-03/final-consentimento-desktop-confirmado.jpg) | [imagem](rodada-03/final-consentimento-mobile.jpg) | [12 colunas](rodada-03/grade-consentimento-desktop.jpg) / [4 colunas](rodada-03/grade-consentimento-mobile.jpg) |
| 404 · `/pagina-inexistente` | [imagem](rodada-03/final-404-desktop.jpg) | [imagem](rodada-03/final-404-mobile.jpg) | [12 colunas](rodada-03/grade-404-desktop.jpg) / [4 colunas](rodada-03/grade-404-mobile.jpg) |
| Demo pública · `/demo?month=2026-10` | [imagem](rodada-03/final-demo-desktop.jpg) | [imagem](rodada-03/final-demo-mobile.jpg) | [12 colunas](rodada-03/grade-demo-desktop.jpg) / [4 colunas](rodada-03/grade-demo-mobile.jpg) |
| Demo de Transações · `/demo/transactions?month=2026-10` | [imagem](rodada-03/final-demo-transacoes-desktop-confirmado.jpg) | [imagem](rodada-03/final-demo-transacoes-mobile.jpg) | [12 colunas](rodada-03/grade-demo-transacoes-desktop.jpg) / [4 colunas](rodada-03/grade-demo-transacoes-mobile.jpg) |

## Estados abertos e recuperação

As páginas privadas usam APIs fictícias em 8799. A demo/landing final também
foram abertas no Worker local 8801 sem sessão. Estado privado parcial deliberado;
essas capturas não representam a versão publicada nem dados pessoais.

| Área | Estados e capturas aceitos |
| --- | --- |
| Visão geral | [Cálculo](rodada-03/visao-geral-calculo-mobile.jpg), [conta](rodada-03/visao-geral-contas-mobile.jpg), [primeiro banco](rodada-03/visao-geral-primeiro-banco-mobile.jpg), [falha da série](rodada-03/visao-geral-serie-erro-mobile-final.jpg), [fallback exato](rodada-03/visao-geral-grafico-fallback-mobile.jpg) |
| Transações | [Filtros](rodada-03/transacoes-filtros-mobile.jpg), [calendário corrigido](rodada-03/transacoes-calendario-mobile-final.jpg), [intervalo](rodada-03/transacoes-calendario-selecao-mobile.jpg), [parcelas](rodada-03/transacoes-parcelas-mobile.jpg), [erro](rodada-03/transacoes-erro-mobile.jpg), [vazio](rodada-03/transacoes-vazio-mobile.jpg), [carregamento](rodada-03/transacoes-carregamento-mobile.jpg) |
| Regras/grupos | [Regra expandida](rodada-03/regra-expandida-mobile.jpg), [editor](rodada-03/regra-editor-mobile.jpg), [rascunho corrigido](rodada-03/regra-rascunho-mobile-corrigido.jpg), [exclusão](rodada-03/regra-exclusao-mobile.jpg), [editor de grupo](rodada-03/grupo-editor-mobile.jpg), [etiquetas](rodada-03/grupos-etiquetas-mobile.jpg) |
| Operação | [Histórico](rodada-03/sincronizacao-expandida-mobile.jpg), [gerenciar](rodada-03/conexoes-gerenciar-mobile-corrigido.jpg), [pessoas](rodada-03/conexoes-pessoas-mobile-completo.jpg), [MCP](rodada-03/conexoes-mcp-mobile-corrigido.jpg), [falha](rodada-03/conexoes-falha-detalhe-mobile.jpg) |
| Auditoria | [Métricas](rodada-03/auditoria-metricas-mobile.jpg), [modelos/clientes](rodada-03/auditoria-inferior-mobile-corrigida.jpg), [requisições](rodada-03/auditoria-requisicoes-mobile.jpg), [confirmação](rodada-03/auditoria-confirmacao-mobile-estavel.jpg) |
| Referência/acesso | [Controles](rodada-03/referencia-controles-mobile-final.jpg), [feedback](rodada-03/referencia-feedback-mobile.jpg), [erro e recuperação](rodada-03/acesso-erro-recuperacao-mobile.jpg) |
| Demo | [Busca aplicada](rodada-03/demo-busca-mobile.jpg), [detalhe](rodada-03/demo-detalhe-mobile-final.jpg), [referência sob demanda](rodada-03/demo-detalhe-referencia-mobile-final.jpg), [gráfico](rodada-03/demo-grafico-mobile.jpg), [valores exatos](rodada-03/demo-valores-exatos-mobile.jpg), [conta](rodada-03/demo-conta-expandida-mobile.jpg) |
| Landing | [Desempenho](rodada-03/landing-desempenho-mobile-final.jpg), [método](rodada-03/landing-metodo-mobile-final.jpg), [CPU](rodada-03/landing-cpu-mobile-final.jpg), [método CPU](rodada-03/landing-cpu-metodo-mobile-final.jpg), [cotas](rodada-03/landing-cotas-mobile-final.jpg), [FAQ](rodada-03/landing-faq-mobile-final.jpg); [CPU desktop](rodada-03/landing-cpu-desktop-final.jpg), [premissas desktop](rodada-03/landing-cotas-desktop-final.jpg) |

## Histórico e imagens rejeitadas

Rodadas 1/2 são histórico, não prova do acabamento atual. O relatório 03 identifica
as rejeições: demo inicial em skeleton; confirmação durante animação; calendário
sem CSS ou Popover excedente; formulário de pessoas sobreposto; rascunho cortado;
IDs expostos; headers transitórios e capturas públicas com recorte incorreto.

Os seis arquivos iniciais `landing-*-mobile.jpg` abaixo da dobra e os arquivos
`landing-{cpu,cpu-metodo,cotas,faq}-desktop-estavel.jpg` não demonstram as seções:
o primeiro conjunto usou clip.y=0 com o documento rolado; o segundo coincidiu com
manifest de assets do preview sendo reconstruído. Os `*-final.jpg` correspondentes
foram abertos e aceitos. Os arquivos antigos ficam só como histórico de revisão.

Calendário: `transacoes-calendario-mobile.jpg` é o defeito original;
`transacoes-calendario-mobile-corrigido.jpg` ainda excedia a viewport; somente
`transacoes-calendario-mobile-final.jpg` e `*-selecao-mobile.jpg` são aceitos.

A 404 usa o componente local. O build também gera `dist/site/404.html`; não houve
prova de comportamento publicado. Capturas estáticas não comprovam movimento,
acessibilidade completa, Pluggy/OAuth reais ou operações em produção.
