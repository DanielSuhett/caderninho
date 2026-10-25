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
Não há Hanken nem wordmark especial. O nome é Caderninho.

O tema inicial é escuro; o alternador sol/lua aplica a preferência local em
`data-mode` e salva `caderninho.theme`. O script é assíncrono, permitido pela CSP
sem código inline; não garante ausência de um primeiro frame no tema inicial.
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
Espaços do produto seguem 4, 8, 12, 16, 24 e 32 px. CSS próprio organiza conteúdo
e responsividade; não reconstrói Button, Select, Checkbox, Tooltip ou modal.

## Responsabilidades

| Responsabilidade | Implementação |
| --- | --- |
| Navegação autenticada | `workspace-shell.tsx`: Sidebar.Provider/Header/Content/Group/Menu/MenuButton/Footer/Trigger e useSidebar |
| Navegação pública | `PublicLayout` e landing estática, com seus links e âncoras próprios |
| Superfícies | LayerCard em listas irmãs; nunca LayerCard aninhado |
| Transações | Table, Badge e LayerDialog; descrição abre detalhes por botão com nome contextual |
| Contas, regras e histórico | Collapsible.DefaultTrigger/DefaultPanel com resumo financeiro; ações ficam no painel |
| Filtros | Toolbar e LayerDialog, GET e rascunho isolado |
| Campos | Input/Field/Label, Select pequeno, Combobox para conta/categoria, InputGroup na busca |
| Datas | Input date digitável + DatePicker range em Popover, carregado sob demanda e traduzido |
| Edição | LayerDialog sempre montado, proteção de rascunho, busy, Escape e retorno de foco |
| Feedback | Banner persistente, Empty, Loader e SkeletonLine; Toasty confirma salvamento concluído |
| Cópia | ClipboardText para URL MCP e InlineCopyText para IDs, com rótulos em português |
| Paginação | Pagination com total desconhecido; API só fornece cursor para avançar e URL de reinício |
| Medidas | Meter apenas com denominador declarado; escala relativa na atividade não representa cota |
| Explicação de consulta MCP | Flow real 2.14, quatro nós, horizontal/vertical; fallback HTML e carregamento sob demanda na landing |
| Composição de regras | Flow.Node/Parallel no detalhe e rascunho sob Collapsible; escopo → alternativas OU/condições E → categoria, vertical em espaço menor |

`UiButton` só mapeia `tone="danger"` para `destructive`. `UiField` usa o Field
integrado do Input. `UiCheckbox` acrescenta estado inicial de formulário à API
controlada do Checkbox 2.14, preservando o valor nativo `on`.

A Sidebar precisa de uma altura definida no shell. Seu Footer é uma linha
compacta; referência visual e saída pertencem ao Menu dentro de Content.
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

Movimento: wrapper de página em 180 ms/6 px; hero em 400 ms e seções públicas
em 280 ms, uma vez. Nenhum valor financeiro é interpolado e não há cascata de
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
com período completo por moeda. Chart nativo Kumo com ECharts 6.1 carrega sob demanda;
tabela alternativa preserva valores exatos e continua disponível quando o chunk
falha. O namespace de echarts/core é importado dinamicamente com LineChart, Grid,
Tooltip, Aria e CanvasRenderer; evite namespace import estático. Categoria usa
Meter relativo com texto explícito, sem sugerir cota.
[Políticas dos agregados](frontend-workspace.md#agregação-e-apresentação).

Auditoria distingue requisições, ferramentas, falhas, cancelamentos, bytes e
modelos declarados. Bytes não são tokens nem custo de IA. A escala diária de
Meter usa o máximo observado no período, declarado no texto, sem sugerir cota.
Free tier mantém laranja como consumo, período, cota e estimativa identificados.

## Referência e validação

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
| Hero | 400 ms/6 px, atrasos 0/40/80/120 ms; somente sem movimento reduzido. |
| Seções públicas | Revelação única de 280 ms/8 px, opacidade 0,75 → 1; conteúdo visível sem IntersectionObserver. |
| Painel/demo | Wrapper de 180 ms/6 px; rota/query reinicia a entrada privada. Sem shimmer, cascata de linhas ou números interpolados. |
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
