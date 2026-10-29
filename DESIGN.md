# Contrato visual do Caderninho

Direção autorizada em 24/10/2026, com referência escura reforçada durante a revisão: substituir a identidade preta/laranja e a
Hanken pelos componentes e tokens padrão do Kumo 2.14.0. O nome do produto
é Caderninho, em texto comum. Não reproduzir o wordmark anterior.

## Fundação

Temas escuro e claro nativos do Kumo (`data-mode="dark"`/`"light"`), com escuro
inicial e preferência local pelo alternador sol/lua. Inter variável local em `--font-sans`, superfícies
`kumo-canvas`, `kumo-base` e `kumo-elevated`. Ação primária azul do Kumo,
seleção neutra, texto e estados semânticos da biblioteca. Os aliases CSS do
produto apontam aos tokens efetivos; não criam uma segunda paleta.

### Contraste e elevação nos dois temas

Revisão de 26/10/2026: o tema claro tem fundo cinza neutro, com superfícies de
conteúdo brancas; o escuro usa fundo carvão e superfícies progressivamente mais
claras. Não usar branco para todos os níveis no claro nem preto para todos no
escuro. A hierarquia depende de superfície, contorno e espaçamento; sombra é
complementar, nunca o único sinal de uma região ou controle.

| Papel Kumo | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| canvas | OKLCH 96% neutro | 14% neutro | Fundo da página |
| elevated | 98% | 17% | Faixas e camadas discretas |
| base | Branco | 21% | LayerCard, Dialog e Popover |
| control / tint | Branco / 94% | 23% / 28% | Campo e interação |
| line / hairline | 82% / 90% | 36% / 30% | Contorno / divisor discreto |

Os valores vivem apenas em `styles/design.css`, nos tokens semânticos do Kumo,
para alcançar produto, demo e páginas públicas. `surface-raised` conserva o papel
de camada discreta de `kumo-elevated`; um popup usa `base` e sombra maior.
Elevação curta (`shadow-xs`) delimita conteúdo; `shadow-sm` atende controles;
`shadow-md`/`shadow-lg` atendem sobreposições; Dialog usa `shadow-dialog`.
Geometria compartilhada, opacidade de queda 8% no claro e 35% no escuro. O ring
nativo continua responsável pelo contorno. Não somar borda e sombra, criar
sombras por página ou remover foco para deixar o layout mais limpo.

O bundle standalone do Kumo fixa comprimentos de sombra; o adaptador das
utilidades em `design.css` as liga à escala. `WorkspaceDialog` troca somente
a sombra inline fixa da versão 2.14, preservando superfície, ring e comportamento
nativos. A referência visual mostra os tokens reais, um LayerCard e um Popover
comparáveis. Revisar leitura secundária, campos, foco, diálogos e logos nos dois
temas; contraste decorativo não substitui contraste de texto ou de controle.
Texto de aviso claro usa laranja escuro (OKLCH 48%/0,12/57,5) para permanecer
legível em canvas, superfície e tint; não reutilizar a cor de preenchimento de
alerta como cor de texto.

Superfícies e hierarquia continuam monocromáticas. Verde identifica entradas,
vermelho identifica saídas, usando success/danger do Kumo em cada tema. Na lista,
a cor segue a direção da origem, nunca uma inferência pelo sinal. Zero,
indisponível e ignorados permanecem neutros. O sinal e o texto continuam
disponíveis. No resumo, receitas são verdes e despesas vermelhas; saldo e fluxo
bancário conservam tratamento neutro. A série de despesas mensais também usa
vermelho: linha, pontos e preenchimento discreto, com a cor semântica Attention
do ChartPalette Kumo; eixos e grade permanecem neutros. Comparadores das regras usam Badge info,
campos ficam discretos e valores têm peso médio, sem semântica de receita/despesa.

A cor e o ícone cadastrados de cada categoria se repetem nos seus usos: barras
do resumo, identificação nas transações/detalhes, resultado das regras e opções
de categoria. São sinais discretos de identidade; nomes e valores permanecem
neutros. Categorias desconhecidas ou compras com categorias variadas não herdam
uma cor de outra categoria. A cor financeira do valor segue a direção da origem,
independente da cor da categoria. Barras usam a cor cadastrada sem transformar
volume observado em cota ou mudar a agregação.

## Tipografia por função

Direção revisada em 26/10/2026: Inter é a fonte principal do sistema, sem impor
uma única voz a todas as superfícies. A diferenciação vem da função, não de uma
fonte diferente por página. A referência visual em `/account/design-system` mostra
os mesmos tokens e componentes usados pelo produto.

| Função | Fonte e tratamento | Onde usar |
| --- | --- | --- |
| Interface | Inter local; corpo/controles 16 px, metadados 14 px; títulos 28/20/16 px | Painel, demo, instalação, login, consentimento, formulários, tabelas e diálogos |
| Editorial | Source Serif 4 local, peso 500; hero 40–64 px e seções 30–40 px, entrelinha 1,1–1,25 | Títulos da landing; nunca botões, navegação, gráficos ou prévias do painel |
| Valores | Inter com algarismos tabulares e alinhamento pelo valor; métricas 32 px desktop/26 px celular | Dinheiro, percentuais comparáveis e contagens; moeda subordinada, sempre legível |
| Código | Monoespaçada do sistema em `--font-mono`; cerca de 0,9 em no texto corrido | URLs, chaves, comandos e prompts; não usar para descrições, datas ou dinheiro |

Inter permanece nos títulos funcionais da landing, como o diagrama de conexão,
e nos exemplos do produto: a interface ilustrada precisa ter a mesma tipografia
da interface real. Login e consentimento são tarefas, por isso conservam Inter.
O card social e o favicon existentes conservam Inter; a mudança editorial não
altera os assets publicados automaticamente.

Corpo usa entrelinha 1,5; textos de apoio da landing, 1,6; títulos de interface,
1,25. Limitar prosa a cerca de 65 caracteres por linha e separar rótulo/valor por
4 px. Peso máximo 600, sentence case e tracking original. Não usar fonte fina,
itálico decorativo, caixa alta ou texto menor para obter densidade. Números exatos
não podem ser cortados nem convertidos para abreviações. Zero é diferente de
indisponível; a família tipográfica não comunica sozinha direção ou estado.

As duas fontes são locais, com suas licenças SIL OFL, sem consulta a serviços de
fontes durante o uso. Source Serif 4 vem da [distribuição oficial da Adobe](https://github.com/adobe-fonts/source-serif/tree/80d3f8894c09c937bebfa9011247d2e1c79fd6f4),
com eixos de peso e tamanho óptico. `font-optical-sizing: auto` respeita esses
eixos; `font-display: swap` mantém texto disponível. A landing antecipa sua fonte
editorial; o painel só a carrega quando a referência visual a demonstra.
Os arquivos publicados são subconjuntos latinos (Latin-1, pontuação, setas e
símbolos usados): Inter com pesos 400–600 e Source Serif 4 no peso 500, ambos
com tamanho óptico. O nome do arquivo leva a versão da fonte; ao mudar glifos ou
eixos, gere um novo nome, pois `/fonts/*.woff2` tem cache imutável.

A preferência explícita por conteúdo de 16 px prevalece sobre a regra de 14 px
da skill kumo-design. Temas usam os mesmos papéis tipográficos. Verificar acentos
em português, valores longos, foco, contraste, reflow em 320 CSS px e zoom de 200%
antes de concluir. Capturas não comprovam conformidade completa de acessibilidade.

Consentimento OAuth é renderizado sem scripts pela CSP existente: usa o tema
escuro estático, sem alternador inoperante. Entrada, painel, demo e páginas
públicas conservam a alternância. Contraste usa tokens semânticos compartilhados
com a biblioteca; links de contexto continuam reconhecíveis. Espaços de layout:
4, 8, 12, 16, 24 e 32 px. Componentes conservam raios, sombras, foco, hover e
estados. Não combinar borda com sombra de elevação nem aplicar overrides
genéricos por `data-kumo-component`.

## Composição

Sidebar real com Provider/Header/Content/Menu/Footer/Trigger. Rotas ficam sob
Finanças, Organização e Instalação, em grupos nativos sempre descobríveis, sem
acrescentar cliques para abrir páginas. A demo mantém Finanças/Organização e um
grupo próprio de demonstração. A marca no cabeçalho móvel leva à visão geral do
ambiente atual e preserva o recorte. A data do cabeçalho é a última importação
concluída; na demo, a data da fixture fica identificada como exemplo. Nunca usar
a hora de renderização como atualização dos dados. A navegação
móvel usa o comportamento modal da biblioteca. A navegação pública permanece
própria, com links para instalação, entrada, código e âncoras existentes.

Títulos de seção ficam fora das superfícies, com a mesma distância antes do
conteúdo em Visão geral, Cartões e Investimentos. `AnalysisSection` reúne título,
moeda e ajuda; o LayerCard envolve só o conteúdo. Títulos de contas e compras
identificam registros dentro de sua superfície. Não misturar os dois níveis.

LayerCard delimita agrupamentos irmãos, nunca outro LayerCard. Table organiza
registros comparáveis; no celular a informação se reorganiza sem rolagem da
página. Collapsible expõe detalhes sob demanda. Filtros e editores usam Dialog,
com Root sempre montado. Rascunhos, descarte, Escape, foco e estado busy
permanecem parte do comportamento. Banner conserva avisos persistentes;
Empty e SkeletonLine representam ausência e carregamento reais.

Uma ação primária por tarefa. Remover molduras e explicações repetidas,
preservando descoberta, contexto e consequências. Não apresentar seções genéricas
“Critérios” ou “Referência técnica”. Metadados de implementação e IDs não entram
na leitura financeira. A identidade do aplicativo autorizado permanece na
Auditoria porque ajuda a decidir qual acesso revogar. Política de um valor fica
na ajuda contextual já existente; falha, parcialidade e pendência ficam visíveis.

Controles correspondem a escolhas reais. Em Transações, uma conta no catálogo
completo dispensa seletor; se todos os registros pertencem a ela, seu nome aparece
uma vez no contexto, sem coluna repetida. Pessoa e grupo de opção única também
dispensam seletores. O contrato GET continua preservado; escopos antigos ou
indisponíveis permanecem identificáveis e removíveis. Busca e Filtros formam uma
barra discreta; opções avançadas ficam no Dialog. Moeda é informação de cada
valor na lista, sem seletor de moeda. Nos agregados da visão geral, a escolha de
moeda continua necessária para impedir somas incompatíveis.

A linha inteira de Transações abre o detalhe pelo trigger nativo, conservando
seleção de texto, teclado e retorno de foco. Sem categoria tem uma aba própria
com Badge warning de pendências no recorte completo. Orientação e prompt
copiável ficam sob “Resolva com sua IA”. Categoria editável e criar regra estão
disponíveis na linha e no detalhe; a regra nasce como rascunho revisável.
Avatares usam contorno de 0,75 px somente no perímetro externo da composição,
sem borda nas interseções. Hover/seleção reforçam os arcos expostos para 1,5 px;
foco por teclado usa 2 px e o token de foco. Os dois temas usam os mesmos papéis.
Não adicionar anéis de separação, elevar o avatar ou mudar sua geometria. Limite local de cartão é
persistente e reversível; disponível recalculado fica identificado como estimativa.

Modais usam Dialog nativo do Kumo com uma única superfície, sem moldura externa
adicional. Cabeçalho, corpo rolável e ações compartilham espaçamento; o rodapé
continua visível em telas baixas. Dados essenciais precedem detalhes técnicos.
Expansões de registros usam Collapsible.Panel sem a linha de citação do
DefaultPanel. Detalhes de contas, investimentos, grupos e sincronizações
compartilham rótulos de 14 px, valores de 16 px, separação de 4 px e grupos de
20/24 px. Contas mostram titular com avatar e ação compacta de transações;
“Conta importada” e “Cartão · não é dinheiro disponível” não se repetem em cada
registro. Saldos de cartão continuam excluídos do saldo bancário agregado. O botão de recolher a navegação fica ao lado de Caderninho no topo;
o rodapé não repete contagens de pessoas/conexões. Não mostrar contagem de itens
da página quando ela não ajuda a navegar; preservar controles reais de cursor.

Ledger usa superfície uniforme, categoria e exceções na mesma faixa. Direção
visível pode ser omitida quando o sinal da origem é inequívoco; continua acessível
e no detalhe. Zero, indisponível e sinal divergente exigem direção visível. Nunca
fabricar sinal de débito. Valores extensos quebram apenas entre milhares.

Regras recolhidas mostram contagens absolutas de alternativas/condições. Ações
vêm antes da composição; contexto, prioridade e políticas não se repetem no Flow.
Erros oferecem uma recuperação principal, com alternativas sob demanda.

Parcelamentos usam a mesma tabela de parcelas recebidas na página de Cartões
e no detalhe de transações. A expansão consulta a compra pelo ID, em seu grupo e
conta, incluindo meses anteriores e futuros recebidos. Mostra avatar, número,
data, valor exato, lançamento e estado da fatura. Não projetar parcelas ausentes
nem confundir lançamento confirmado com pagamento. “Paga” exige conciliação da
fatura vinculada; marcação manual fica distinta; ausência é “não informado”.

Séries mensais permitem mover uma janela por controle deslizante com nome,
valor acessível, teclado e toque. O seletor de mês usa o mesmo comportamento em
todas as páginas mensais, preservando rascunho/Cancelar antes de consultar.
A linha do gráfico alcança as extremidades da escala; a tabela mantém os valores
exatos de toda a série recebida. O FAQ público usa Collapsible Kumo com fallback
HTML funcional, ícone da biblioteca, foco e respostas completas. GitHub usa o
ícone oficial da biblioteca com `currentColor`, junto de Código aberto.

## Minimalismo em toda a experiência

Direção reforçada pelo usuário em 25/10/2026. Aplica-se à jornada completa:
onboarding, páginas públicas, painel, demo, formulários, detalhes, diálogos e
estados intermediários. Compactar Pessoas na POC não significa que as demais
telas foram revisadas. Cada superfície precisa responder à sua tarefa; não
copiar a mesma barra de ícones para contextos diferentes.

1. **Mostrar só o necessário para decidir e agir.** Título identifica a tarefa;
   corpo, metadados e rodapé não repetem a mesma explicação. Remover instruções
   óbvias, resumos duplicados, diretórios repetidos e molduras sem função.
   Simplificar composição e passos antes de reduzir fontes ou espaçamento.
2. **Manter ações compactas e previsíveis.** Ações de gestão ficam próximas do
   título ou do item, com hierarquia discreta. Caneta edita, relógio abre
   histórico e + adiciona; ícones equivalentes conservam significado e posição.
   Não empilhar botões secundários ocupando a largura da página. Uma ação
   primária pode manter verbo visível e largura adequada à tarefa, sobretudo
   em formulários móveis. Ícones não substituem clareza em ações pouco familiares,
   destrutivas ou que envolvem consentimento.
3. **Representar identidade e estado sem frases repetidas.** Preferir logo,
   nome e um estado compacto alinhado à direita. Um dot ou uma label curta pode
   representar conexão normal, com nome acessível e contexto sob demanda.
   Conexão, importação concluída, pendência e falha têm significados distintos;
   não usar verde de sucesso para cobrir uma etapa ainda incompleta. Falha,
   parcialidade, desatualização relevante e recuperação ficam visíveis.
   Não pulsar um estado concluído; movimento indica atividade real.
4. **Expor detalhes quando necessários.** Ajuda, histórico e opções
   avançadas entram por Tooltip, Collapsible ou Dialog adequados. Não esconder
   instruções indispensáveis para concluir um formulário, consequências,
   consentimento ou erro dentro de um tooltip. Pessoa ou conta única dispensa
   seletor; seletores com escolhas reais mostram avatar/nome de forma compacta.
5. **Preservar a continuidade da jornada.** Não pedir novamente dados já
   disponíveis nem reexibir tarefas concluídas como novas. Uma conta Meu Pluggy
   por pessoa admite vários bancos e autorizações próprias; adicionar banco
   reutiliza as credenciais configuradas. A proposta de onboarding agrupa pessoas
   e bancos antes da importação. Alterações visuais preservam rascunhos, voltar,
   retomada, dados já importados e estados parciais, sem inventar sucesso.

### Critérios complementares de revisão

- **Descoberta e acessibilidade:** todo botão de ícone tem nome acessível;
  Tooltip funciona por foco e ponteiro. Controles funcionam por teclado, têm
  foco visível e área de acionamento adequada; na barra compacta da POC, 40 ×
  40 CSS px. Informação crítica não depende só de cor ou hover. Redução de
  movimento é respeitada.
- **Consistência com significado:** reutilizar componentes Kumo, tokens e
  identidades existentes. Mesma ação usa o mesmo nome e ícone, sem duplicar
  controles na mesma tarefa. Bancos usam `connector.imageUrl` verificado, com
  fallback; pessoas usam foto ou iniciais. Não adivinhar logos pelo nome.
- **Responsividade e densidade:** reordenar e quebrar grupos sem rolagem
  horizontal da página ou CTAs secundários gigantes. Testar nomes e valores
  longos, uma e várias pessoas/contas. Preservar a tipografia de 16/14 px e a
  leitura de valores exatos; ícones compactos não justificam texto ilegível.
- **Feedback proporcional:** carregamento, vazio, erro, sucesso e retomada têm
  tratamento próprio e uma próxima ação clara. Progresso representa trabalho
  real; evitar spinners intermináveis, animação decorativa e percentuais
  inventados. Atualização e falha não apagam dados já disponíveis.
- **Simplicidade verificável:** remover conteúdo e passos sem função antes de
  criar componentes ou abstrações. Medir lentidão observada; não usar skeletons
  ou animações para encobrir trabalho redundante. Registrar páginas e estados
  realmente vistos, incluindo os não validados. Uma captura bonita de uma rota
  não comprova a qualidade da experiência inteira.

## Contratos preservados

URLs, âncoras, nomes de campos e textos legais seguem os contratos existentes.
Filtros são GET; editar é rascunho, aplicar reinicia cursor, cancelar não aplica.
Pessoa e grupo permanecem no escopo dos links. Valores financeiros usam unidades
menores exatas, sem conversão implícita, total da página ou dinheiro em Number.
Zero difere de indisponível. Cartão não vira saldo disponível. Parcelas,
pendentes, futuras e ignoradas continuam explícitas.

Meter representa consumo com denominador conhecido. Nas estimativas do free
tier, o preenchimento laranja continua representando consumo, com período,
cota e estimativa identificados. Importação Pluggy mostra fase e contas reais,
sem porcentagem global inventada. A demo pública em `/demo`, `/demo/transactions`, `/demo/investments`,
`/demo/rules` e `/demo/groups` usa somente fixtures sintéticas compartilhadas
com testes; compartilha os componentes reais do aplicativo. Adaptadores da demo
fornecem dados e estado em memória aos mesmos componentes; não recriam telas ou
regras de negócio. A importação usa `RuleImporter` e `prepareRuleImport` também
no produto; somente os vínculos com armazenamento e a persistência diferem.
Edições de regras e
grupos duram até recarregar a aba. O wizard de regra termina em
“Salvar e reclassificar”, ação explícita com escopo e resultado visíveis. Não consulta nem altera
contas, credenciais ou autorizações reais. Charts exigem agregação completa e política
explícita de período, moeda, escopo, transferências, ignorados e parcelas.

Auditoria distingue requisições, ferramentas, erros, bytes e modelos declarados.
Bytes não são tokens nem custo. Login não é consentimento. Dados salvos continuam
consultáveis durante importação e falhas de atualização.

## Movimento e validação

Usar as transições funcionais do Kumo, sem transição de cor, shimmer decorativo
ou animação de valores monetários. Entrada do painel em 140 ms/6 px por navegação;
sem cascata de linhas ou interpolação de números. A landing usa entrada de hero
em 220 ms e revelação única de seções em 160 ms, sem bloquear a leitura.

Fluidez é um requisito compartilhado: a landing entrega o conteúdo em HTML e
melhora cada seção com um módulo independente perto da área visível. O painel e a
demo mantêm o shell e carregam código de rota por intenção (foco/hover), sem
antecipar consultas financeiras. Gráficos montam uma vez ao se aproximar da tela,
com altura reservada e valores exatos na legenda/tabela. Hover tem resposta
imediata; tooltips usam superfície opaca e os tokens de texto/borda do tema.

O relógio de sincronização fica ao lado do tema, no topo móvel e no rodapé da
Sidebar no desktop. Hover, teclado ou clique abrem o mesmo Popover Kumo. Somente
pending/running recebidos exibem Loader; verde dura até três minutos após uma
conclusão real, sem reiniciar ao navegar. Erro/falha continuam distintos. Na demo,
o conteúdo informa a data fictícia. Não exibir botões de recarga de consultas;
preservar sincronização bancária, recuperação de falha e confirmação de escritas.
Mudanças reais da origem invalidam o cache e atualizam a visão montada.

Flow explica uma consulta MCP à cópia sincronizada em quatro etapas de 2,4 s,
com todos os textos sempre legíveis. Reproduz uma vez ao entrar, permite pausar,
continuar, repetir e consultar sem animação. Suspende fora da tela/aba ativa e
mantém a explicação estática se o chunk falhar. Pluggy e autorização inicial são
preparação; verificar acesso e consultar o D1 pertencem à consulta. A resposta de
IA fica no cliente. Movimento reduzido elimina reprodução automática e conectores
animados; o esquema completo permanece disponível. Revisar teclado,
foco e contraste nos estados realmente usados, em desktop e celular.
Captura local/sintética não comprova acessibilidade completa, OAuth, Pluggy,
produção ou comportamento de um host MCP.

Consulte o [guia de componentes](docs/design-system.md) para implementar e validar
esses contratos. Catálogo de marcas bancárias continua auxiliar e não permite
inferir instituição por nome de conta, pessoa ou saldo.

## Conferência de composição

Cartões (`/account/cards` e `/demo/cards`), Investimentos e Visão geral
compartilham `FinancialMetric`, valores de 32/26 px, metadados de 14 px e os
tokens globais de conteúdo de 16 px. Cartões e Visão geral usam `CreditLimitCard`.
Gastos mensais, limites atuais e parcelas recebidas formam seções distintas.
A carteira mostra composição atual por classe e instituição. Consulte os
[cálculos e estados de Cartões](docs/cards.md).

Grade opt-in: `?grid=1` no painel/demo e `#layout-grid` nas páginas públicas.
12 colunas e gutters de 24 px no desktop; 4 colunas e 16 px no celular; baseline 8 px.
A grade confere eixos de conteúdo e margens; o padding interno dos componentes
continua pertencendo ao Kumo. As capturas sem grade são a apresentação do produto.

Não incluir controles que só abrem conteúdo vazio, IDs na leitura financeira
inicial ou ações secundárias dominantes. A validação visual é limitada aos
estados realmente vistos; revisar desktop, celular, teclado, foco e os dois
temas antes de considerar uma alteração concluída.

## Carteira e identidade financeira

Investimentos é a carteira do investidor em `/account/investments` e
`/demo/investments`; parcelas de cartão ficam em Cartões. A aba Compromissos
foi removida. As telas usam FinancialMetric, LayerCard, donuts e legendas
exatas, com semântica e rótulos próprios. Composição de investimentos usa posição
bruta; líquido, resultado informado e resgate não são estimados. Valores sem
cobertura aparecem como indisponíveis. Dados antigos continuam legíveis.

PersonAvatar identifica pessoas; AccountAvatar mostra a instituição em contas,
cartões e investimentos. Em cartões, compõe também a bandeira disponível, sem
substituir o logo do banco. O avatar de pessoa entra na composição quando há
mais de uma pessoa e nenhum filtro de pessoa selecionado. Transações e filtros
reutilizam essa composição. O combo usa círculos
de 32 px sobrepostos em 10 px, no mesmo eixo. Bandeiras vêm de assets locais licenciados. Instituições
usam URLs verificadas da CDN Pluggy. O conector Meu Pluggy autentica a integração,
mas não identifica o banco: a associação escolhida em Pessoas vale para todas as
contas do mesmo Item. Sem associação, a instituição permanece desconhecida. Não
inferir pelo nome da conta ou do ativo. Instituição explícita de B3 prevalece; sem logo verificado, ícone genérico.
Filtros, linhas, saldos e limites reutilizam a mesma identificação.

Nas páginas financeiras do produto e da demo, cada parte é um link com Tooltip:
pessoa filtra o titular; banco filtra todas as contas com o mesmo ID de instituição;
bandeira filtra todos os cartões daquela bandeira, inclusive em outros bancos.
Filtros são combináveis; preservam grupo, período e busca, removem conta individual
e cursor. Clicar novamente na parte selecionada ou remover seu chip desfaz o filtro.
Resumo, gráfico, contagem e paginação usam o mesmo recorte antes de agregar.
Sem identidade conhecida, manter fallback estático sem inventar um filtro.
Avatares em opções de Select/Combobox são decorativos; links da composição ficam
fora de triggers de expansão, para não aninhar controles interativos.

Títulos e métricas não repetem explicações no corpo. Ajuda contextual fica em
Tooltip Kumo acessível por foco, avisos de falha/parcialidade permanecem visíveis.
A demo tem um único marcador no topo; não repete avisos junto de cada filtro.

Filtros mantêm avatares como irmãos do Toolbar, separados por 12 px; o
Toolbar agrupa somente ações relacionadas, sem comprimir a composição de pessoas.
Linhas de parcelas no celular conservam 16 px de padding nos quatro lados e
12 px entre informações. Em containers de até 280 px, lançamento e pagamento
ocupam linhas completas para evitar colunas de texto estreitas.

Posições de investimentos usam LayerCards irmãos separados por 16 px, com o
título da seção fora das superfícies. Cada registro tem padding de 16 px na
vertical e 20 px na horizontal (16 px no celular); a expansão conserva esse
alinhamento. Preserve a grade comparável no desktop e os rótulos no celular.
Não empilhar um card dentro de outro para obter espaçamento.

Os avatares de pessoas ficam ao lado do botão Filtros em um grupo compacto
(até três avatares e +N), com alvos independentes. Filtros de escopo, classe, instituição, cartão e moeda ficam no
diálogo Kumo. Cada tela tem uma ação de atualização, sem ícones duplicados.

PersonAvatar usa a foto da pessoa quando disponível e mantém as iniciais como
alternativa para ausência ou falha de carregamento. PersonDirectory compartilha
a identidade por ID, sem repetir imagens nos registros financeiros. As duas
pessoas da demo usam as fotos fornecidas para ilustrar o produto. A edição em
Conexões oferece prévia, troca, remoção e salvamento explícito.

## Compartilhamento da landing

O hero apresenta “Suas finanças, na sua IA.” ao lado de uma prévia compacta
do painel com lançamentos sintéticos. “Código aberto. De graça.” fica como
contexto; demo é a ação principal, Instalar é secundária e o link MIT é discreto.
No celular, os botões conservam largura de conteúdo. A prévia usa fixtures reais
da demo e mantém valores, sinal e moeda. O texto próximo diferencia software
grátis de serviços externos e da instalação própria.
Custos aparecem antes da comparação técnica, com as condições do Free visíveis.

O card social usa Inter, fundo escuro e um acento azul Kumo. “Código aberto” e
“De graça” são os textos principais. A composição central de 1200 × 630 px mantém
a mensagem principal dentro dos 630 px centrais para tolerar recortes quadrados.
`src/web/assets/social-card.svg` é a fonte editável;
`public/social-card-open-source-v3.png` é a exportação atual. A URL nova evita
reutilizar o cache da arte anterior (`social-card.png`, mantida por compatibilidade).
Ao editar a arte, exporte novamente o PNG com Inter Variable local.
O favicon usa a inicial C em Inter sobre azul Kumo, sem alterar o nome em texto
na navegação: ICO 16/32 px, PNG 96 px e Apple 180 px. A fonte editável é
`src/web/assets/favicon.svg`.

Título, descrição e metadados sociais ficam em `src/web/landing-metadata.tsx`.
O site público entrega canonical, Open Graph, X Card e JSON-LD WebSite no HTML
inicial; a landing das instalações usa `noindex,follow` e não anuncia o domínio
público como sua própria URL. A categoria do produto aparece antes do título do hero. Consulte a [revisão SEO](docs/seo.md) para fontes,
limites da prova e pendências de infraestrutura.
Depois de publicar o site, conferir `https://usecaderninho.com/` no OpenGraph.xyz.

## Regras de área do painel

Regras específicas que antes ficavam em AGENTS.md. Consulte a seção da área que
você vai alterar; não é preciso ler todo o documento para mudanças locais.

- Produto e demo usam as mesmas telas e editores; adaptadores `demo-*` cuidam de
  fixtures, navegação e estado em memória. Regras de negócio compartilhadas ficam
  no domínio. Ao mudar um fluxo, teste os dois adaptadores pelo mesmo contrato,
  preservando a persistência privada do produto.
- Títulos de seção ficam fora das superfícies (`AnalysisSection`). Não reintroduzir
  seções genéricas “Critérios”/“Referência técnica”, explicações óbvias de cartão
  ou contagens técnicas na leitura financeira. Política dos valores fica na ajuda
  contextual; erros e parcialidade continuam visíveis.
- Ícones para ações secundárias familiares, com nome acessível e Tooltip por foco;
  preservar rótulos necessários à decisão. Ajuda sob demanda não oculta erro,
  consentimento ou contexto indispensável. Não obter densidade encolhendo a fonte.
- Identidades usam contorno somente nos arcos externos, sem linhas nas interseções,
  nos dois temas. Hover/seleção reforçam o contorno; foco usa o token de foco. Não
  elevar avatar nem mudar a sobreposição. Avatares ficam fora do Toolbar, com gap
  de 12 px entre identidade e ações. Opções de Select/Combobox usam avatares
  estáticos.
- Pessoa filtra titular, banco reúne contas por ID de instituição e bandeira reúne
  cartões entre bancos. Preservar período/grupo, remover cursor/conta específica e
  oferecer filtros removíveis. Aplicar o recorte antes de agregar/paginar, com
  paridade na demo.
- Links ficam fora de triggers de expansão. Navegação usa grupos nativos. Trigger e
  expansão compartilham os mesmos insets.
- Parcelas: padding de 16 px nas linhas móveis; status/pagamento usam linhas
  completas em containers muito estreitos. Mostram toda a compra recebida na mesma
  tabela, inclusive fora do mês. Pagamento depende da fatura vinculada, com
  marcação manual distinta; confirmado não significa pago.
- Posições de investimentos usam LayerCards irmãos com gap de 16 px e título
  externo, sem cards aninhados.
- Controles mensais compartilham a janela acessível; a marca móvel volta à visão
  geral e a atualização vem da importação concluída, nunca da renderização.
- FAQs usam Kumo e mantêm fallback funcional.
- Importação de regras funciona no produto e na demo, com prévia, categorias
  resolvidas, revisão, idempotência e histórico preservado.
- Temas: claro usa fundo cinza e conteúdo branco; escuro usa carvão e superfícies
  mais claras, pelos papéis de `styles/design.css`. Ajustar tokens Kumo
  compartilhados, nunca branco/preto, bordas ou sombras isolados por página.
  Sombra não pode ser a única separação. Ao mudar tema ou elevação, atualizar a
  referência visual e conferir LayerCard, Dialog, Popover e campos.
- POC continua isolada até instrução explícita para alterar o produto;
  documentação de uma proposta não comprova sua implementação.
