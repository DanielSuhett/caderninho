# QA visual — Kumo e demonstração pública

final result: pass

## Resultado local em 24/10/2026

### Rodada 08 — itens 2 a 5

Transações com superfície uniforme, reflow por container e direção redundante
removida com guardas financeiros. Regras com contagens absolutas, ações antes do
Flow e menos contexto repetido. Auditoria com baseline/2×2, grade sem efeito no
filtro, erro com recuperação sob demanda e bootstrap alinhado.

14 páginas com/sem grade em desktop e celular; estados expandidos e larguras
intermediárias em [polimento](docs/kumo/polimento-08.md) e
[galeria 08](docs/kumo/capturas/rodada-08/README.md). Três edições do nome: 3→0
atualizações estruturais do Flow, sem alegar ganho percentual de latência.
Movimento reduzido simulado; reflow CSS equivalente, sem zoom nativo.
`mise run check` passou: 51 Node, 108 integração/19 arquivos, build/dry-run e
runtime local 10 mil/100 mil. Sem dependências novas, push, deploy ou merge.
[Revisão independente](docs/kumo/revisao-critica-08-polimento.md).

### Histórico da rodada 03

Na rodada 03, revisão com 8/10 qualitativo em cada uma das 14 páginas, após três rodadas
com agente independente no papel de designer crítica. Aprovação limitada às
capturas e interações registradas; não é aprovação humana nem de produção.
[Relatório por página](docs/kumo/revisao-critica-03.md),
[galeria](docs/kumo/capturas/README.md) e
[dados/contraste/bundle](docs/kumo/dados-e-evidencias.md).

### Rodada 07 — composição das regras

Flow real em regra expandida e rascunho sob Collapsible. Escopo obrigatório antes
das alternativas OU/condições E, categoria depois; pausa e prioridade explícitas.
Lista recolhida preservada. Carregamento visível sob demanda e alternativa HTML
quando o módulo opcional falha. Sem dependências novas.

Inspeção sintética de duas alternativas em desktop 1440/celular 391, máximo 4×8 em
desktop 1440/celular 320, pausada, editor com preset e condição incompleta,
continuidade/descarte de rascunho e falha 503 do módulo. O máximo foi corrigido
após crítica: nós pelo topo e valor financeiro quebrado só entre milhares.
Quatro testes novos preservam semântica e precisão de apresentação.
Gate completo passou com 49 testes Node, 108 de integração e runtime local
Workflow/D1 de 10 mil/100 mil registros. Sem push/deploy ou validação do provedor.
[Método e limites](docs/kumo/rule-flow.md) · [capturas](docs/kumo/capturas/README.md).

### Rodada 06 — fluidez React

Aplicados critérios da skill oficial vercel-react-best-practices ao projeto
React/Vite. Entry da landing com dependências caiu de 35.144 para 3.059 bytes
brutos; boot privado de 893.919 para 822.906. Shell da demo cresceu 3.589 bytes
para evitar reloads. Não confundir esses recortes com tamanho do aplicativo todo.

Snapshot idêntico: antes 23 renders/23 leituras; depois 1 render inicial/12
leituras. Tab até Transações antecipou o chunk sem novas consultas. Demo manteve
o mesmo documento ao trocar mês, moeda, navegar, buscar por Enter e usar Voltar.
Foram vistos detalhe de parcelas, configuração lazy e, no Worker local em
391×845, navegação móvel com fechamento de Sidebar, foco no conteúdo e sem
overflow horizontal. Não houve nova nota de designer nem auditoria das 14 páginas.

Gate completo passou: 45 testes Node, 108 de integração, build/dry-run e runtime
10k/100k; check:quick repetido após o último ajuste. Nenhum FPS/INP de campo foi
medido. Sem dependências novas ou deploy.
[Método, tradeoffs e capturas](docs/kumo/performance.md).

### Rodada 05 — movimento e explicação MCP

Implementação de Flow nativo Kumo 2.14 na landing, com sequência finita de quatro
etapas, pausa/continuação/repetição e Sem animação. Explicação HTML disponível
antes do JavaScript e após falha do chunk. Hero/seções e wrapper do painel usam
entradas curtas, sem interpolação financeira ou cascata de linhas.

Vistos: Flow desktop pausado/reproduzindo/completo; móvel 391px; topo em 320px e
geometria de todos os nós; orientação em 1090/1101px; fallback após 503 sintético;
Transações privadas, Dialog de filtros e regra expandida. Progressão, conectores,
pausa e suspensão fora da área foram observados em leituras temporais do DOM.
Foi corrigido um corte de 15px dentro do Flow em 320px, que não aparecia como
overflow do documento. Capturas iniciais rejeitadas estão identificadas.

A designer crítica abriu 12 imagens e atribuiu 8/10 qualitativo à explicação MCP
e às amostras do painel; isso não reaprova todas as páginas nem mede satisfação.
Movimento reduzido do SO e ocultação de aba foram tratados/revisados no código,
sem execução desses caminhos de runtime. Sem animação não substitui emulação da
preferência do SO. Não houve nova revisão por grade de todas as páginas.

`mise run check` final passou após as correções: 44 testes Node, 108 de integração,
build/dry-run e runtime local 10k/100k, além de tipos/formato/lint. Sem mudanças de
dependências, push ou deploy. [Evidência detalhada](docs/kumo/motion.md),
[revisão crítica](docs/kumo/revisao-critica-05-motion.md) e
[capturas](docs/kumo/capturas/README.md).

### Rodada 04 — correção do critério de Transações

A avaliação anterior não encerrou o critério de calma solicitado pelo usuário.
Esta rodada revê somente Transações privadas e demo: escolhas proporcionais ao
catálogo completo, conta única sem seletor/coluna repetida, busca compacta com
InputGroup/Button nativos, ausência de seletor de moeda e notas sob demanda.
Moeda continua em cada valor; agregados da visão geral continuam separados por
moeda. Não se atribui nova aprovação às outras páginas.

Vistos: catálogo único, várias contas/Select aberto, conta fora do catálogo,
filtro antigo indisponível e recuperação com Limpar, Dialog sem opções únicas,
demo com BRL/USD identificados, busca aplicada e quebra em 320px. Desktop
1440×900, móvel 391×845 e 320×845; grade 12/4 colunas recapturada em Transações.
Busca por botão e Enter preservou GET; hidden accountId foi preservado ao aplicar.
Fixture privada não aplica SQL real; essas exceções comprovam apresentação e
navegação. Demo também consultada no Worker local 8801 sem sessão, com três
resultados para mercado. [Revisão04](docs/kumo/revisao-critica-04-transacoes.md).

A revisão independente atribuiu 8/10 qualitativo às duas superfícies de
Transações nos estados vistos, sem P1/P2 visual identificado. Isso não valida
satisfação humana nem amplia a cobertura para as demais páginas.

Leitura qualitativa: menor competição entre controles e dados; lista de densidade
moderada e variação baixa, com cor reservada a estados. No móvel 391 a primeira
linha da demo passou de cerca de y345 a y265, sem reduzir fonte ou retirar estados.
Posição observada não é medição de usabilidade. Movimento não foi reavaliado por
imagens estáticas. `mise run check` foi repetido e passou no código desta rodada:
44 testes Node, 108 de integração, build/dry-run e runtime 10k/100k. Permanece o
aviso conhecido do Kumo sobre `@emotion/is-prop-valid` no runner de testes.

## Cinco superfícies verificadas

| Superfície | Evidência atual |
| --- | --- |
| Tipografia | Inter local; conteúdo e controles 16 px, metadados 14 px, títulos 28/20px, métricas 32/26 px e moeda subordinada. Peso máximo 600 e tracking original. |
| Espaço e alinhamento |14 páginas desktop/móvel com grade 12/4 colunas, gutter 24/16 px e baseline 8 px. Eixos de headings, toolbars, linhas, valores e chevrons inspecionados. Sem overflow horizontal nas larguras testadas. |
| Cor e contraste | Neutros reforçados; quatro pares amostrados entre 9,16:1 e 18,73:1. Cor reservada a ação/estado; laranja de consumo público restaurado, com denominador/estimativa e 103% no texto. |
| Imagens e ícones | Phosphor real e componentes Kumo compilados. Galeria de screenshots atuais, sem mockup apresentado como implementação. Capturas transitórias/sem CSS foram rejeitadas. |
| Copy e conteúdo | Parcialidade, moeda, período, classificação, consequência e recuperação visíveis. IDs recolhidos; transações móveis compactas; categorias e referência descobertas. Textos legais preservados. |

## Estados e interações

Desktop 1541×863; móvel emulado 391×845. Cobertura detalhada na galeria e revisão 03.
Overview: parcial, política aberta, categorias, série/tabela, recentes, contas,
primeiro banco, falha da série e falha do chunk gráfico com alternativa exata.
Transações: lista, vazio, erro, carregamento, busca, filtros, calendário pt-BR,
intervalo civil 1–24 out, detalhe e parcelas pendentes/futuras. Regras/grupos:
expandido, editor, rascunho, descarte/continuidade, exclusão e catálogo. Operação:
importação ativa/falha, histórico expandido, perfis/pessoas, URL MCP, grants,
atividade/requisições, modelos/bytes e confirmação de revogação cancelada.
Público: hero, instalação, desempenho/método, CPU/cotas/premissas, FAQ, acesso
normal/erro/recuperação, consentimento e 404. Demo: período/moeda, busca GET e detalhe.

Sidebar móvel: foco inicial, cicloTab, Escape, retorno ao gatilho e bloqueio de
navegação durante edição exercitados na migração. Roots de LayerDialog continuam
montados. A rodada de polimento confirmou visualmente diálogos/ações completos,
rascunho preservado e retorno de foco nos fluxos exercitados. Não extrapolar isso
para conformidade total de acessibilidade ou todos os dispositivos.

## Verificação técnica

`mise run check` final passou em 24/10/2026: tipos, formato, lint,44 testes Node,
108 testes de integração em 19 arquivos, build/dry-run e runtime local Workflow/D1.
Runtime cobriu 10 mil/100 mil registros, cliente desconectado, falha parcial,
replay, recomeço e persistência após reiniciar. Agregados completos foram testados
com mais de uma página, moedas separadas e dinheiro acima do inteiro seguro JS.
A leitura por portal validou o envelope real do serviço e a rejeição por CSRF.

O runner Vitest/workerd ainda emite avisos da dependência opcional
`@emotion/is-prop-valid` no pacote Kumo; todos os testes passaram. Não foi ocultado
o diagnóstico nem instalada dependência só para silenciar o log.

## Inferências e limites

Variação visual baixa entre páginas e moderada entre papéis da informação;
densidade moderada nas listas e maior quando detalhes técnicos estão abertos.
Transações móvel usa nome/valor e conta/data em duas bandas. Dashboard é mais
longo por comportar análises. Movimento parece baixo no uso observado e o gráfico
não anima; screenshots estáticos não medem movimento. São inferências qualitativas.

Preview privado é sintético. Demo é ledger fictício isolado, também aberto no
Worker local sem sessão. Sem push/deploy, OAuth/Pluggy reais, operações financeiras,
revogação real ou validação em host MCP. A evidência de 404 visual usa o componente
local; o build gera 404.html para o site, sem alegar comportamento publicado.
