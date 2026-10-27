# Interface com Kumo

[DESIGN.md](../DESIGN.md) define os princípios e os temas claro e escuro do Kumo.
A versão instalada é `@cloudflare/kumo` 2.14.0; a API desta versão prevalece
sobre a documentação do site.

## Fundação

`Document` carrega `kumo.css` standalone e declara `data-mode="dark"`.
`DesignHead` carrega o bootstrap externo `/theme.js`, Inter local e `design.css`, com aliases de layout e regras de documento em `@layer base`:
as classes de componentes Kumo mantêm prioridade. Não definir a cor global de
`a`, fontes de controles ou seletores genéricos por `data-kumo-component`.
Inter vem da distribuição oficial rsms.me/inter, com licença SIL OFL em
`src/web/assets/fonts/Inter-LICENSE.txt`, sem serviço de fontes durante o uso.
Source Serif 4 vem da distribuição oficial Adobe (commit
`80d3f8894c09c937bebfa9011247d2e1c79fd6f4`), com licença em
`src/web/assets/fonts/SourceSerif4-LICENSE.md`. A fonte editorial só é carregada
pela landing e pelo espécime da referência visual. Não há serviço externo de
fontes, Hanken ou wordmark especial. O nome é Caderninho.

O tema inicial é escuro; o alternador sol/lua aplica a preferência local em
`data-mode` e salva `caderninho.theme`. O script é assíncrono, permitido pela CSP
sem código inline; não garante ausência de um primeiro frame no tema inicial.
O consentimento OAuth conserva a CSP sem scripts: `Portal` desativa o bootstrap
e o alternador por `themeSwitching={false}`, mantendo o tema escuro estático.
Receitas/entradas e despesas/saídas usam success/danger da biblioteca, com sinal,
moeda e direção preservados. Identidade de categoria usa a cor e o ícone do
catálogo em barras, transações, regras e opções; nomes permanecem neutros.
Falha do armazenamento não impede trocar tema. Eventos storage sincronizam
abas sem remontar formulários; só o gráfico assina o tema com useSyncExternalStore
para receber isDarkMode/ChartPalette. O bootstrap continua independente do React.

Conteúdo e controles têm 16 px; metadados, `--text-xs` e `--text-sm` têm 14 px.
Inter local em `--font-sans` atende à preferência explícita do usuário, que
prevalece sobre a regra 14 px da skill. Métricas usam 32 px desktop/26 px móvel. Títulos usam `Text` ou headings sem alterar
tracking. Peso máximo 600. Componentes conservam foco, raios, sombras e estados.
`--font-display` usa Source Serif 4 somente nos títulos editoriais da landing;
prévia, navegação e controles usam Inter. `--font-mono` usa a monoespaçada do
sistema em código, URLs, chaves e prompts, cerca de 0,9 em no texto. Dinheiro
continua em Inter tabular. Corpo tem entrelinha 1,5; títulos de interface 1,25;
hero 1,1. Não criar fontes alternativas por rota. `DesignTypography` demonstra
papéis, acentos e valores exatos na referência visual.

Espaços do produto seguem 4, 8, 12, 16, 24 e 32 px. CSS próprio organiza conteúdo
e responsividade; não reconstrói Button, Select, Checkbox, Tooltip ou modal.

### Superfícies, contornos e sombras

`src/web/styles/design.css` ajusta os tokens nativos por `data-mode`; todos os
documentos e componentes usam a mesma fundação. No claro: canvas neutro 96%,
elevated 98%, base branco, line 82% e hairline 90% em OKLCH sem croma. No escuro:
canvas 14%, elevated 17%, base 21%, line 36% e hairline 30%. `control`/`tint` usam
100%/94% e 23%/28%, respectivamente. Fundos não são todos brancos ou pretos.
`surface-raised` é alias de elevated, uma camada discreta; popup usa base.

A escala é compartilhada: `shadow-xs` curta para conteúdo, `shadow-sm` para
controles, `shadow-md` e `shadow-lg` para sobreposições, `shadow-dialog` para
modal. A cor de queda vem de `kumo-shadow-drop` (preto 8% no claro, 35% no
escuro). O contorno ring nativo permanece; divisores sticky usam borda sem
elevação. Não adicionar sombras de página, empilhar molduras nem usar sombra
como único sinal de limite.

O standalone Kumo 2.14 embute comprimentos nas utilidades de sombra. O bloco
`@layer utilities` em `design.css` as associa aos tokens, mantendo a composição
de ring/foco. Dialog também embute uma sombra inline de 3%: `WorkspaceDialog`
passa `--tw-shadow: var(--shadow-dialog)` pelo `style` suportado, sem redesenhar
o modal. Não adicionar seletores genéricos por `data-kumo-component`.
`DesignPalette` demonstra as cores efetivas, LayerCard e Popover reais. Comparar
as mesmas superfícies nos dois modos, inclusive campos, foco e leitura secundária.
O texto de aviso claro usa OKLCH 48%/0,12/57,5 para ter contraste adequado nos
fundos usados; a cor de preenchimento do alerta continua independente.

## Responsabilidades

| Responsabilidade | Implementação |
| --- | --- |
| Navegação autenticada | `workspace-shell.tsx`: Sidebar.Provider/Header/Content/Group/Menu/MenuButton/Footer/Trigger e useSidebar |
| Navegação pública | `PublicLayout` e landing estática, com seus links e âncoras próprios |
| Superfícies | Títulos externos com `AnalysisSection`; LayerCard em listas irmãs, nunca aninhado |
| Séries mensais | Chart com extremidades alinhadas e `MonthSlider` nativo acessível; `PeriodPicker` Kumo compartilha seleção/Cancelar |
| Parcelas | `InstallmentTable` em Cartões e transações, avatares e evidência de pagamento da fatura vinculada |
| FAQ público | Collapsible Kumo sob demanda, fallback HTML com caret Phosphor |
| Transações | Table, Badge e Dialog; linha abre o botão nativo; categoria e menu oferecem ações diretas |
| Contas, regras e histórico | Collapsible.DefaultTrigger/Panel, divisor simples, detalhes 14/16 px e ações compactas; sem Critérios/Referência técnica |
| Filtros | Toolbar e Dialog, GET e rascunho isolado |
| Campos | Input/Field/Label, Select pequeno, Combobox para conta/categoria, InputGroup na busca |
| Datas | Input date digitável + DatePicker range em Popover, carregado sob demanda e traduzido |
| Edição | Dialog sempre montado; WorkspaceDialog organiza cabeçalho/corpo/ações numa superfície nativa, proteção de rascunho, busy, Escape e retorno de foco |
| Feedback | Banner persistente, Empty, Loader e SkeletonLine; Toasty confirma salvamento concluído |
| Cópia | ClipboardText para URL/chave MCP e prompts, com rótulos em português |
| Paginação | Pagination com total desconhecido; API só fornece cursor para avançar e URL de reinício |
| Medidas | Meter apenas com denominador declarado; escala relativa na atividade não representa cota |
| Explicação de consulta MCP | Flow real 2.14, quatro nós, horizontal/vertical; fallback HTML e carregamento sob demanda na landing |
| Composição de regras | Flow.Node/Parallel no detalhe e rascunho sob Collapsible; escopo → alternativas OU/condições E → categoria, vertical em espaço menor |

`UiButton` só mapeia `tone="danger"` para `destructive`. `UiField` usa o Field
integrado do Input. `UiCheckbox` acrescenta estado inicial de formulário à API
controlada do Checkbox 2.14, preservando o valor nativo `on`.

A Sidebar precisa de uma altura definida no shell. Seu Footer é uma linha
compacta com tema; Trigger/Close ficam no Header ao lado da marca. Referência
visual e saída pertencem ao Menu dentro de Content. Não repetir contagens da
instalação no rodapé.
Rotas ficam em Finanças, Organização e Instalação; a demo conserva os grupos
aplicáveis e Demonstração. Não esconder os links atrás de grupos recolhidos.
A marca móvel é um link para a visão geral do ambiente com seu recorte.
`lastSuccessAt` informa a última importação concluída, sem prometer atualização
individual de limites; a demo identifica a data estática dos exemplos.
Não colocar uma lista vertical inteira no Footer nem sobrescrever sua aparência.
O menu móvel fecha após uma navegação aceita, preservando o bloqueio de rascunho.

## Contratos de interação

Busca de transações e regras fica visível com InputGroup; GET conserva os filtros
aplicados e reinicia sem cursor. Filtros editados são rascunho. Aplicar faz GET e remove o cursor anterior.
Cancelar/Escape não aplicam; reabrir lê os valores da URL. Limpar remove também
pessoa, grupo e cursor. Links de navegação preservam pessoa/grupo. Não simular
`ChangeEvent` para adaptar Select; usar `onValueChange`.

Calendário representa datas civis da origem. Não converter para UTC usando
`toISOString()`. Campos continuam aceitando um único limite inicial ou final.
DateRangePicker legado está deprecated; usar DatePicker com `mode="range"`.

RuleEditor e GroupEditor mantêm o rascunho enquanto o diálogo está aberto.
Escape/fechar solicita descarte quando há edição. “Continuar editando” conserva
os campos. Busy bloqueia fechamento e navegação; cancelamento não interrompe uma
escrita de resultado incerto. Confirmação destrutiva começa em Cancelar.
Roots permanecem montados ao fechar, permitindo a animação de saída do Kumo.

Movimento: wrapper de página em 140 ms/6 px; hero em 220 ms e seções públicas
em 160 ms, uma vez. Nenhum valor financeiro é interpolado e não há cascata de
linhas. Sidebar/Dialog/Collapsible mantêm transições nativas. O Collapsible
recebe neutralização local de painel/caret em `prefers-reduced-motion: reduce`.
O Flow tem uma sequência finita e pausável; textos não dependem da reprodução.
Não usar `finish()` para cancelar animações infinitas ao mudar a preferência:
`cancel()` devolve os elementos ao estado base. Política de movimento em
[Movimento](#movimento).

Fluidez: páginas privadas lazy ignoram renders do polling com props idênticas;
foco/hover da Sidebar antecipam módulos sem antecipar consultas. Conexões é
carregada sob demanda. Grupos/valores/options do Chart conservam referência até
os dados ou a moeda mudarem. A demo mantém o shell ao navegar por GET.
O helper puro da landing importa shared/result diretamente, sem carregar HTTP.

Gráficos compartilham `svg-chart.tsx`: SVG leve, tooltip HTML com superfície
opaca, texto e borda dos tokens, resposta imediata e contenção no próprio
gráfico. `ChartViewport` reserva altura e monta o gráfico uma vez, a até 160 px da área visível; legenda e
tabela permanecem disponíveis. Não carregar o editor de regras/transações ao
abrir Investimentos na demo. As ilhas MCP, regra, performance e FAQ da landing
têm entradas separadas e conservam o fallback HTML se uma melhoria falhar.

`SyncStatusIndicator` usa Popover nativo por hover/teclado/clique em todos os tamanhos:
relógio neutro, Loader para importação pendente/em execução, relógio verde por até
três minutos desde a conclusão real e aviso para falha/consulta indisponível.
A data da demo é explicitamente fictícia, sem sucesso ou progresso simulados.
O estado fica no shell e não é reiniciado ao navegar. O monitor pausa em aba
oculta e não mantém polling periódico de instalação ociosa; mudanças da origem
invalidam leituras e atualizam os consumidores. Botões de recarga de consultas
foram removidos. Ações reais de sincronização, retry, salvar e confirmar continuam.
Entrada do painel: 140 ms; hero: 220 ms; revelação editorial: 160 ms. Sem animação
de números ou de cor no hover. Movimento reduzido elimina entradas e rotação do
indicador; o estado continua disponível pelo nome acessível e pelo Popover.

O preview de regra consulta; salvar afeta as próximas importações, sem
reclassificar histórico. Grupo Pessoal não pode ser excluído. Acesso MCP sempre
informa consequências e exige confirmação antes de revogar.

O diagrama de regra acompanha os campos existentes; não é um segundo editor nem
uma simulação de execução. Prioridade/pausa ficam fora das condições, e filtros
globais antecedem todas as alternativas. Importação lazy visível e fallback
textual preservam a consulta. Veja [composição de regras](#composição-de-regras).

## Dados financeiros e técnicos

Não usar Number para dinheiro. Preservar `amountMinor`, moeda, direção, zero,
indisponível, ignorados, pendentes e futuras. Saldo de cartão não significa
dinheiro disponível. Parcelas usam datas e metadados estruturados da origem;
“registrada” não comprova pagamento da fatura. Não criar total da página.

Importação mostra fase/conta reais e segue consultável quando parcial. Não há
progresso global com denominador conhecido no contrato Pluggy atual.
A visão geral usa os agregados existentes `get_overview` e `generate_chart`,
com período completo por moeda. Gráficos são SVG próprios e leves
(`account/svg-chart.tsx`), carregados sob demanda; tabela alternativa preserva
valores exatos e continua disponível quando o chunk falha. Tooltip responde a
ponteiro e setas do teclado. Categoria usa
Meter relativo com texto explícito, sem sugerir cota.
[Políticas dos agregados](frontend-workspace.md#agregação-e-apresentação).

Auditoria distingue requisições, ferramentas, falhas, cancelamentos, bytes e
modelos declarados. Bytes não são tokens nem custo de IA. A escala diária de
Meter usa o máximo observado no período, declarado no texto, sem sugerir cota.
Free tier mantém laranja como consumo, período, cota e estimativa identificados.

### Respiro de filtros e registros

`WorkspaceFilters` coloca a composição de pessoas fora do Toolbar, num grupo
flexível com gap de 12 px. Toolbar conserva Filtros/Limpar; os avatares preservam
seus links e contorno atuais. O grupo pode quebrar linha sem alargar os botões.

`InstallmentTable` conserva a tabela semântica e a faixa nativa Kumo. No celular,
cada linha tem padding de 16 px e gap de 12 px × 16 px. Em containers de até
280 px, status e pagamento ocupam linhas completas, alinhados à esquerda.
Não adicionar um card à tabela: a superfície da compra já é um LayerCard.

`InvestorDashboard` usa um LayerCard nativo por posição, com 16 px entre cards.
Cabeçalho externo; trigger e painel conservam insets de 16 px × 20 px, reduzidos
para 16 px no celular. A grade de valores permanece comparável no desktop.

### Composição de avatares

`AccountAvatar` compõe pessoa, instituição e bandeira sem trocar o banco pela
bandeira do cartão. São círculos de 32 px com sobreposição de 10 px; partes
ausentes não deixam espaços vazios. O SVG bancário usa a identidade normalizada
da conta e a URL validada da CDN Pluggy. O conector Meu Pluggy não representa
o banco; **Identificar banco**, em Pessoas, associa uma instituição do catálogo
oficial ao Item inteiro. O editor mostra as contas vinculadas antes de salvar,
permite remover a associação e informa falha/carregamento do catálogo.
A bandeira usa o asset local existente.
`AvatarStack` desenha somente os arcos expostos do perímetro externo: 0,75 px
em repouso, 1,5 px em hover/seleção e 2 px com o token de foco por teclado.
Não há linhas nas interseções, anéis de superfície, salto de camada ou mudança
de tamanho. Cada imagem mantém seu fallback independente.

Cada parte conhecida é um link com nome acessível e Tooltip: pessoa seleciona o
titular, banco reúne todas as contas do mesmo ID de instituição e bandeira reúne
os cartões correspondentes de todos os bancos. Grupo/período/busca permanecem;
conta individual e cursor saem. Os filtros se combinam e têm chips removíveis.
A seleção integra consultas, totais e paginação, não apenas os itens renderizados.
A demo aplica a mesma correspondência de identidade. Select/Combobox usam a versão
estática; a composição interativa fica fora do botão de expansão. A referência
visual oferece o exemplo real em “Avatares e filtros”.

A pessoa aparece conforme o contexto existente: várias pessoas e nenhum filtro
individual. Ao filtrar uma pessoa, banco e bandeira continuam disponíveis.
Contas sem identidade bancária mantêm o ícone genérico, sem deduzir banco pela
descrição da transação ou pelo nome da conta.

Revisão local de 25/10/2026, com dados fictícios e `mise run check` aprovado:

| Superfície / estado | Conferência |
| --- | --- |
| Transações | Alteradas e revisadas no desktop e a 391 CSS px, nos dois temas; foto, SVG e bandeira carregados, sem overflow da página. |
| Filtros | Opções de conta revisadas com banco/bandeira; abertura por teclado e aplicação do filtro de pessoa preservaram a identidade bancária. |
| Cartões / limites | Composição compartilhada revisada no desktop escuro e no celular claro; cartão sem instituição manteve somente pessoa/bandeira. |
| Outros consumidores | Visão geral, investimentos e onboarding reutilizam o componente; sem revisão visual adicional nesta alteração. Usos sem bandeira conservam a mesma composição anterior. |
| Ausência / falha de logo | Conta sem identidade conferida na demo com ícone genérico. Falha de rede da imagem não foi provocada nesta revisão. |

## Referência e validação

Na revisão global de 26/10/2026, `WorkspaceHeading` recebeu um espaço para
filtros no próprio cabeçalho. Busca de transações/regras continua junto da lista;
não aplicar o mesmo arranjo a todas as tarefas. `UiIconButton` compartilha Tooltip,
nome acessível e alvo de 40 px com as ações do onboarding, categorias e regras.
Filtros sem escolhas reais são omitidos, preservando campos GET e remoção dos
recortes ativos. Ausência de valor usa texto de conteúdo de 16 px; valores
monetários mantêm 32/26 px. Consulte a [matriz por página](../design-qa.md) para
capturas, estados, decisões e limites da validação.

`/account/design-system` demonstra os componentes realmente usados, com dados
fictícios. Não mantém uma biblioteca própria de botões, tooltips ou sombras.
Surface e Code simples também estão deprecated na API instalada; não adotá-los
em novas composições. LayerCard e trechos curtos de código atendem aos usos atuais;
realce extenso depende de um caso real e avaliação do carregamento sob demanda.

`mise run check:quick` verifica tipos, imports, formato e lint. `mise run check`
inclui testes, build e runtime local. A revisão visual cobre desktop/celular,
expansões, formulários e estados nos dois temas.
Não interpretar um build, uma captura sintética ou HTTP 200 como OAuth, Pluggy,
produção ou acessibilidade completa validados.

## Estilos e QA

Table do ledger com superfície uniforme e reflow por container; a API
2.14 não oferece prop para desativar zebra, por isso a adaptação é restrita às
linhas desse ledger. Dinheiro só quebra entre milhares; direção não se repete
quando o sinal é inequívoco. Métricas da auditoria compartilham trilhas por
subgrid e baseline, com 2×2 em espaço intermediário. Erro tem retry prioritário
e outras recuperações em Collapsible.

A demo reutiliza OrganizationView, RuleEditor, GroupEditor e a prévia
reais; nenhum segundo layout de Regras/Grupos. O adapter mantém mutações na
memória da aba. Reaplicar é secundário a Nova regra e explica o alcance sobre
todos os meses, ignorados e categorias preservadas. Grupo só ganha um Select
visível quando há mais de uma escolha ou um escopo não pessoal.
[Contrato e limites](frontend-workspace.md#demo-pública).

CSS de documento, páginas públicas e landing em `src/web/styles/`; nenhum estilo
JSX authored inline. O build combina o standalone 2.14 com o CSS oficial de
componentes do pacote, removendo somente o import do binding já presente. Isso
repõe o CSS de DatePicker ausente no standalone, sem reconstruir seu calendário.
Popover do calendário limita a largura à viewport; datas continuam civis/pt-BR.

Ao atualizar o Kumo, revisar as adaptações da Sidebar 2.14: altura `100dvh`,
`role=dialog`/`aria-modal`, conteúdo externo inert, ciclo de Tab e retorno ao
Trigger. O gatilho externo usa `openMobile` em `aria-expanded`, pois o interno
usa o estado desktop.

Pendências de validação: executar movimento reduzido do SO e mudança ao vivo,
ocultação real da aba, zoom nativo de 200% e leitor de tela; conferir contraste
nos estados usados, inclusive marcadores com cores arbitrárias de categoria.
Capturas sintéticas e reflow por viewport não encerram essas verificações.

## Temas e significado financeiro

Movimentos CREDIT/DEBIT usam verde/vermelho pela direção mesmo se o sinal divergir;
transferência continua movimento, sem virar renda/despesa. Saldo, fluxo, zero,
indisponível e ignorado são neutros. Pendentes/futuros têm avisos textuais; cor
não significa liquidação. Categoria não colore texto ou dinheiro: aparência vem
do cadastro atual por ID, sem inferência por nome/posição. Compra com categorias
variadas não herda a primeira parcela; categoria desconhecida tem fallback neutro.

Meter usa indicatorClassName/currentColor e escala relativa ao maior volume;
nomes/valores neutros preservam leitura quando a cor arbitrária tem pouco contraste.
Meters de consumo Free continuam laranja. Despesas mensais usam Attention do
ChartPalette em linha/pontos/preenchimento, com eixos e grade neutros nos dois temas.
Editar aparência não reaplica regras nem muda cálculos. O catálogo atualiza pelo
fluxo de gravação, sem sincronização de categorias entre abas independentes.

## Movimento

| Superfície | Política |
| --- | --- |
| Hero | 220 ms/6 px, atrasos 0/40/80/120 ms; somente sem movimento reduzido. |
| Seções públicas | Revelação única de 160 ms/8 px, opacidade 0,75 → 1; conteúdo visível sem IntersectionObserver. |
| Painel/demo | Wrapper de 140 ms/6 px; rota/query reinicia a entrada privada. Sem shimmer, cascata de linhas ou números interpolados. |
| Sidebar/Dialog/Collapsible | Transições nativas e roots montados; neutralização local sob prefers-reduced-motion. |
| Exemplo MCP | Quatro etapas de 2,4 s, conector de 700 ms; 9,6 s ativos, sequência finita, pausável e repetível. |

Flow.Node com canvas=false preserva rolagem normal. A consulta ilustrada separa
pergunta, acesso, cópia D1 e resposta ao cliente; consentimento e sincronização
não fazem parte da consulta. O cliente prepara a resposta de IA, sem chamada real
no exemplo. Texto/HTML ficam disponíveis sem JS ou chunk opcional.

A melhoria carrega perto da seção e inicia uma vez. Pausar/Continuar/Repetir/Sem
animação controlam a sequência; ocultar aba ou sair da área pausa, e voltar
reinicia a duração da etapa. Não representa progresso de serviço. Fallback/Flow
compartilham breakpoint de 1100 px; em 320 px descontam scrollbar e permitem
crescer a altura; controles ficam em coluna até 360 px. Ao atualizar Kumo, revisar
CSS de data-index sob .mcp-flow. A CLI 2.14 pode omitir Flow do registro; exports,
tipos e implementação de `@cloudflare/kumo/components/flow` são a API usada.
Referência: [Flow oficial](https://kumo-ui.com/components/flow/).

## Composição de regras

Escopo obrigatório → alternativas OU/condições E → categoria. Conta, movimento
e descrição globais são obrigatórios em todas as alternativas; moeda fica no
escopo. Legadas conservam texto; incompletas e referências ausentes têm orientação
explícita. Prioridade/pausa ficam na linha, grupo no contexto, sem novos efeitos.
Campo/comparador/valor têm estrutura própria, sem recortar strings de dinheiro:
metadado em 14 px, Badge info e valor em 16 px/peso 500. Datas são inclusivas;
valores extremos só quebram entre milhares, mantendo casas decimais/moeda juntas.

Com container de 800 px, escopo/categoria têm 200 px e alternativas 260 px,
alinhadas pelo topo; menor espaço usa orientação vertical e OU explícito.
Flow calcula posições/conexões. Importação usa IntersectionObserver;
ResizeObserver muda só a orientação. Falha conserva HTML completo e conteúdo
compartilhado independente do módulo lazy. Fallback mantém gaps de 64 px entre
etapas e 16 px entre alternativas; não há medição de CLS ou execução fictícia.
Memoização depende de condições/categoria/ativação, sem recalcular ao renomear.
