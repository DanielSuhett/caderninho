# Contrato visual do Caderninho

Direção autorizada em 24/10/2026, com referência escura reforçada durante a revisão: substituir a identidade preta/laranja e a
Hanken pelos componentes e tokens padrão do Kumo 2.14.0. O nome do produto
é Caderninho, em texto comum. Não reproduzir o wordmark anterior.

## Fundação

Tema escuro padrão do Kumo (`data-mode="dark"`), Inter variável local em `--font-sans`, superfícies
`kumo-canvas`, `kumo-base` e `kumo-elevated`. Ação primária azul do Kumo,
seleção neutra, texto e estados semânticos da biblioteca. Os aliases CSS do
produto apontam aos tokens efetivos; não criam uma segunda paleta.

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
sem porcentagem global inventada. A demo pública em `/demo` e `/demo/transactions` usa somente um conjunto fictício
local; compartilha os componentes reais do aplicativo. Não consulta nem altera
contas, credenciais ou autorizações reais. Charts exigem agregação completa e política
explícita de período, moeda, escopo, transferências, ignorados e parcelas.

Auditoria distingue requisições, ferramentas, erros, bytes e modelos declarados.
Bytes não são tokens nem custo. Login não é consentimento. Dados salvos continuam
consultáveis durante importação e falhas de atualização.

## Movimento e validação

Usar as transições funcionais do Kumo, sem transição de cor, shimmer decorativo
ou animação de valores monetários. Respeitar movimento reduzido. Revisar teclado,
foco e contraste nos estados realmente usados, em desktop e celular.
Captura local/sintética não comprova acessibilidade completa, OAuth, Pluggy,
produção ou comportamento de um host MCP.

Plano e evidências: [migração](docs/kumo/plano.md), [inventário](docs/kumo/inventario.md)
e `design-qa.md`. Catálogo de marcas bancárias continua auxiliar e não permite
inferir instituição por nome de conta, pessoa ou saldo.

## Conferência de composição

Grade opt-in: `?grid=1` no painel/demo e `#layout-grid` nas páginas públicas.
12 colunas e gutters de 24 px no desktop; 4 colunas e 16 px no celular; baseline 8 px.
A grade confere eixos de conteúdo e margens; o padding interno dos componentes
continua pertencendo ao Kumo. As capturas sem grade são a apresentação do produto.

Não incluir controles que só abrem conteúdo vazio, IDs na leitura financeira
inicial ou ações secundárias dominantes. A aprovação visual é limitada aos
estados realmente vistos e registrada por página na revisão crítica.
