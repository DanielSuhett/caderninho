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

Texto de conteúdo e controles em 16 px; metadados em 14 px; títulos em 28/20/16 px, sentence case,
peso máximo 600 e tracking original. Métricas financeiras em 32 px no desktop e 26 px no celular, com moeda subordinada e algarismos tabulares. Dinheiro exato e moeda sempre visíveis.
A preferência explícita do usuário por Inter e conteúdo maior prevalece sobre
a regra de 14 px da skill kumo-design. Contraste reforçado pelos tokens semânticos
compartilhados com a biblioteca; links de contexto neutros e sublinhados.
Espaços de layout: 4, 8, 12, 16, 24 e 32 px. Componentes conservam seus raios,
sombras, foco, hover e estados. Não combinar borda com sombra de elevação.
Não aplicar overrides genéricos por `data-kumo-component`.

## Composição

Sidebar real com Provider/Header/Content/Menu/Footer/Trigger. A navegação
móvel usa o comportamento modal da biblioteca. A navegação pública permanece
própria, com links para instalação, entrada, código e âncoras existentes.

LayerCard delimita agrupamentos irmãos, nunca outro LayerCard. Table organiza
registros comparáveis; no celular a informação se reorganiza sem rolagem da
página. Collapsible expõe detalhes sob demanda. Filtros e editores usam Dialog,
com Root sempre montado. Rascunhos, descarte, Escape, foco e estado busy
permanecem parte do comportamento. Banner conserva avisos persistentes;
Empty e SkeletonLine representam ausência e carregamento reais.

Uma ação primária por tarefa. Remover molduras e explicações repetidas,
preservando descoberta, contexto e consequências. IDs ficam em referência
técnica recolhida. Estados de falha, parcialidade, pendência e exclusão não
ficam escondidos em uma referência técnica.

Controles correspondem a escolhas reais. Em Transações, uma conta no catálogo
completo dispensa seletor; se todos os registros pertencem a ela, seu nome aparece
uma vez no contexto, sem coluna repetida. Pessoa e grupo de opção única também
dispensam seletores. O contrato GET continua preservado; escopos antigos ou
indisponíveis permanecem identificáveis e removíveis. Busca e Filtros formam uma
barra discreta; opções avançadas ficam no Dialog. Moeda é informação de cada
valor na lista, sem seletor de moeda. Nos agregados da visão geral, a escolha de
moeda continua necessária para impedir somas incompatíveis.

Ledger usa superfície uniforme, categoria e exceções na mesma faixa. Direção
visível pode ser omitida quando o sinal da origem é inequívoco; continua acessível
e no detalhe. Zero, indisponível e sinal divergente exigem direção visível. Nunca
fabricar sinal de débito. Valores extensos quebram apenas entre milhares.

Regras recolhidas mostram contagens absolutas de alternativas/condições. Ações
vêm antes da composição; contexto, prioridade e políticas não se repetem no Flow.
Erros oferecem uma recuperação principal, com alternativas sob demanda.

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
com testes; compartilha os componentes reais do aplicativo. Edições de regras e
grupos duram até recarregar a aba. Salvar uma regra não reclassifica o histórico;
reaplicar exige uma ação explícita, com escopo e resultado visíveis. Não consulta nem altera
contas, credenciais ou autorizações reais. Charts exigem agregação completa e política
explícita de período, moeda, escopo, transferências, ignorados e parcelas.

Auditoria distingue requisições, ferramentas, erros, bytes e modelos declarados.
Bytes não são tokens nem custo. Login não é consentimento. Dados salvos continuam
consultáveis durante importação e falhas de atualização.

## Movimento e validação

Usar as transições funcionais do Kumo, sem transição de cor, shimmer decorativo
ou animação de valores monetários. Entrada do painel em 180 ms/6 px por navegação;
sem cascata de linhas ou interpolação de números. A landing usa entrada de hero
em 400 ms e revelação única de seções em 280 ms, sem bloquear a leitura.

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

PersonAvatar identifica pessoas; AccountAvatar mostra bandeira em cartões e
instituição em contas/investimentos, com avatar de pessoa sobreposto quando há
mais de uma pessoa e nenhum filtro de pessoa selecionado. O combo usa círculos
de 32 px sobrepostos em 10 px, no mesmo eixo. Bandeiras vêm de assets locais licenciados. Instituições
usam exclusivamente `connector.imageUrl` da CDN Pluggy, sem inferir pelo nome do
ativo. Instituição explícita de B3 prevalece; sem logo verificado, ícone genérico.
Filtros, linhas, saldos e limites reutilizam a mesma identificação.

Títulos e métricas não repetem explicações no corpo. Ajuda contextual fica em
Tooltip Kumo acessível por foco, avisos de falha/parcialidade permanecem visíveis.
A demo tem um único marcador no topo; não repete avisos junto de cada filtro.

Os avatares de pessoas integram o botão Filtros em um grupo compacto (até três
avatares e +N). Filtros de escopo, classe, instituição, cartão e moeda ficam no
diálogo Kumo. Cada tela tem uma ação de atualização, sem ícones duplicados.

PersonAvatar usa a foto da pessoa quando disponível e mantém as iniciais como
alternativa para ausência ou falha de carregamento. PersonDirectory compartilha
a identidade por ID, sem repetir imagens nos registros financeiros. As duas
pessoas da demo usam as fotos fornecidas para ilustrar o produto. A edição em
Conexões oferece prévia, troca, remoção e salvamento explícito.

## Compartilhamento da landing

O hero destaca “Código aberto. De graça.”, com a categoria “Suas finanças no
ChatGPT e Claude”, demo como primeira ação e link para o repositório MIT. O texto
próximo diferencia software grátis de serviços externos e da instalação própria.
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
