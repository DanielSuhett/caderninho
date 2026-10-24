# Componentes Kumo no Caderninho — 24/10/2026

Inventário de diagnóstico e referência visual, produzido antes da implementação. A nova exploração visual segue a autorização de abandonar a identidade anterior e adotar a aparência padrão do Kumo.

## Evidência e escopo

- Código atual: branch `codex/onboarding-live-import`, HEAD `4e3e7e4`, com as 26 modificações e 2 testes novos preexistentes preservados.
- Imports diretos do Kumo encontrados apenas em `src/web/ui.tsx`: Button, LinkButton e Input. Não confundir equivalentes próprios/HTML nativo com uso do componente Kumo.
- Pacote instalado: `@cloudflare/kumo` 2.14.0. Conferência via `kumo ls`, `kumo docs`, exports e declarações do pacote; o site atual pode ter API adicional.
- Prints oficiais: páginas de componentes, estados abertos de diálogos/menus/seleção, Sidebar móvel, gráficos e três blocos. Os prints comprovam aparência observada, não acessibilidade completa ou integração no Caderninho.

## Resultado do registro instalado

Condicional: **15**, Direto: **33**, Sem aplicação atual: **3**, Já usado: **2**. O registro tem 53 componentes; exports adicionais e blocos estão abaixo.

## Prioridade para as novas imagens

1. Sidebar padrão Kumo no shell autenticado; tema claro, seleção neutra, cabeçalho e gatilho móvel prontos.
2. LayerCard + Table para contas/transações/auditoria, sem cards aninhados.
3. Toolbar + InputGroup + Select/Combobox + DatePicker para busca/escopo/filtros.
4. Banner + Badge + Loader/SkeletonLine para parcialidade, pendências, falhas e carregamento.
5. Dialog/LayerDialog + DropdownMenu + Tooltip/ClipboardText para detalhes, edição e ações secundárias.

## Direto

| Componente | Onde ajudaria / condição | Print oficial |
| --- | --- | --- |
| Badge | Status pendente/futuro/ignorado, parcialidade, tipo de conta e estado da sincronização; manter rótulo textual e significado. | [documentação visual](https://kumo-ui.com/components/badge/) |
| Banner | Histórico parcial, falha de leitura, erro de importação e recuperação; uma ação contextual no próprio aviso. | [documentação visual](https://kumo-ui.com/components/banner/) |
| Checkbox | Filtros de ignoradas/futuras, enabled e campos booleanos dos formulários; substituir controles nativos apenas conservando os contratos. | [documentação visual](https://kumo-ui.com/components/checkbox/) |
| ClipboardText | URL /mcp e trechos de configuração de assistente hoje copiados por controles próprios. | [documentação visual](https://kumo-ui.com/components/clipboard-text/) |
| Code | Configuração MCP e argumentos técnicos, sem adicionar realce pesado quando texto simples basta. | [documentação visual](https://kumo-ui.com/components/code-highlighted/) |
| Collapsible | Detalhes de contas, compras parceladas, regras e eventos MCP; manter conteúdo necessário à decisão visível. | [documentação visual](https://kumo-ui.com/components/collapsible/) |
| Combobox | Escolher conta, categoria, pessoa ou grupo quando a lista cresce; seleção restrita às opções existentes. | [documentação visual](https://kumo-ui.com/components/combobox/) |
| DatePicker | Datas nos filtros de transações/sincronizações; conservar digitação, locale pt-BR e formato transmitido ao backend. | [documentação visual](https://kumo-ui.com/components/date-picker/) |
| DateRangePicker | Início/fim do período em transações e auditoria; calibrar o calendário duplo para celular e preservar fuso/limites. Referência visual é a família DatePicker. | [documentação visual](https://kumo-ui.com/components/date-picker/) |
| Dialog | Confirmações curtas e detalhamento focal; conservar Escape, foco, retorno ao gatilho, busy e rascunhos. | [documentação visual](https://kumo-ui.com/components/dialog/) |
| DropdownMenu | Ações secundárias de conta, regra, grupo ou concessão MCP; ação de maior importância continua descoberta. | [documentação visual](https://kumo-ui.com/components/dropdown/) |
| Empty | Primeiro uso, nenhum resultado e nenhum histórico; mensagem e ação devem diferenciar falta de dados de filtro sem resultado. | [documentação visual](https://kumo-ui.com/components/empty/) |
| Field | Rótulo, descrição, erro e associação acessível dos formulários. CLI 2.14.0 confirmada; print da família Label/Input. | [documentação visual](https://kumo-ui.com/components/label/) |
| Grid | Organização responsiva de formulários e conjuntos de dados; não usar para inventar um grid de cards decorativos. | [documentação visual](https://kumo-ui.com/components/grid/) |
| InlineCopyText | IDs de conta/transação/conexão/evento nas áreas de detalhe e auditoria, com cópia compacta. | [documentação visual](https://kumo-ui.com/components/inline-copy-text/) |
| InputGroup | Busca com ícone, texto de unidade e botão de filtro; composição pronta para substituir contêineres locais. | [documentação visual](https://kumo-ui.com/components/input-group/) |
| Label | Campos compostos, opcionalidade e dica contextual; preferir Field integrado quando o controle já fornece o rótulo. | [documentação visual](https://kumo-ui.com/components/label/) |
| LayerCard | Contas e listas com cabeçalho Secondary e conteúdo Primary; um agrupamento por conjunto, sem LayerCard aninhado. | [documentação visual](https://kumo-ui.com/components/layer-card/) |
| LayerDialog | Editor de regras, grupos, perfil e filtros longos com título/ações padronizados; preservar rascunho e área rolável. | [documentação visual](https://kumo-ui.com/components/layer-dialog/) |
| Link | Links contextuais de importação, ajuda, documentação e recuperação; distinto de LinkButton já usado. | [documentação visual](https://kumo-ui.com/components/link/) |
| Loader | Importação em andamento e atualização pontual; indicador indeterminado com fase textual, sem porcentagem inventada. | [documentação visual](https://kumo-ui.com/components/loader/) |
| Meter | Cotas Free e medidas com denominador conhecido; preenchimento representa consumo. Não aplicar à importação Pluggy atual. | [documentação visual](https://kumo-ui.com/components/meter/) |
| Pagination | Próxima/anterior nas listas com cursor. A 2.14.0 suporta total desconhecido com hasNextPage; não inventar total nem salto por página. | [documentação visual](https://kumo-ui.com/components/pagination/) |
| Popover | Filtros rápidos e ajuda contextual curta no desktop; formulários extensos continuam em Dialog/LayerDialog. | [documentação visual](https://kumo-ui.com/components/popover/) |
| Select | Escopo pessoa/grupo, direção, status, perfil e selects pequenos hoje nativos. | [documentação visual](https://kumo-ui.com/components/select/) |
| Sidebar | Navegação autenticada inteira: Header, Content, Group, MenuButton, Footer, Trigger e comportamento móvel pronto. | [documentação visual](https://kumo-ui.com/components/sidebar/) |
| Surface | Superfície simples em formulários ou conteúdo sem a composição em camadas do LayerCard. CLI confirmada; print do Grid usa Surface. | [documentação visual](https://kumo-ui.com/components/grid/) |
| Switch | Ativação de regras/perfis, mantendo salvar/aplicar e estados busy; não transformar uma edição em ação imediata silenciosamente. | [documentação visual](https://kumo-ui.com/components/switch/) |
| Table | Auditoria MCP, contas e transações no desktop; valores exatos alinhados e alternativa de linhas para celular. | [documentação visual](https://kumo-ui.com/components/table/) |
| Text | Hierarquia tipográfica padrão Kumo em títulos, corpo, metadados e números; conservar moeda e algarismos tabulares. | [documentação visual](https://kumo-ui.com/components/text/) |
| Toasty | Confirmação breve de copiar/salvar. Erros persistentes e parcialidade permanecem em Banner, sem desaparecer em toast. | [documentação visual](https://kumo-ui.com/components/toast/) |
| Toolbar | Busca e filtros de transações, regras e auditoria numa composição pronta; manter escopo e filtros ativos descobertos. | [documentação visual](https://kumo-ui.com/components/toolbar/) |
| Tooltip | Rótulos de botões por ícone e explicações breves hoje próprias; não esconder informação essencial nem depender só de hover. | [documentação visual](https://kumo-ui.com/components/tooltip/) |

## Condicional

| Componente | Onde ajudaria / condição | Print oficial |
| --- | --- | --- |
| Autocomplete | Busca livre de descrições e regras com sugestões; requer sugestões úteis, preservando texto fora da lista. | [documentação visual](https://kumo-ui.com/components/autocomplete/) |
| Breadcrumbs | Cabeçalho de detalhe de conta/regra ou escopo real; não criar uma hierarquia fictícia nas páginas planas. | [documentação visual](https://kumo-ui.com/components/breadcrumbs/) |
| ButtonGroup | Ação principal com alternativas realmente relacionadas; não agrupar ações destrutivas ou filtros independentes. | [documentação visual](https://kumo-ui.com/components/button-group/) |
| Chart | Barras por categoria e outras visualizações; exige agregado do período completo por moeda, tabela alternativa e ECharts. | [documentação visual](https://kumo-ui.com/charts/timeseries/) |
| CloudflareLogo | Identificar Cloudflare na instalação/provedor, sem transformar a marca do fornecedor na marca do produto. | [documentação visual](https://kumo-ui.com/components/cloudflare-logo/) |
| CommandPalette | Navegação rápida para o público técnico; só se o ganho superar um segundo mecanismo de navegação. Ações financeiras não devem executar sem contexto. | [documentação visual](https://kumo-ui.com/components/command-palette/) |
| InputArea | Texto longo/JSON de configuração ou regra avançada se existir um fluxo autorizado; não inventar campo apenas para usar o componente. | [documentação visual](https://kumo-ui.com/components/input-area/) |
| MenuBar | Grupo de ações por ícone com teclado; Toolbar é a primeira escolha para filtros. CLI confirmada, sem página separada no menu observado. | [documentação visual](https://kumo-ui.com/components/toolbar/) |
| Radio | Poucas escolhas exclusivas, como direção ou modo; não usar Switch para escolhas mutuamente exclusivas. | [documentação visual](https://kumo-ui.com/components/radio/) |
| SankeyChart | Fluxo de recursos entre origens/destinos/categorias apenas após um contrato real de fluxos; risco de dupla contagem e baixa legibilidade móvel. | [documentação visual](https://kumo-ui.com/charts/sankey/) |
| SensitiveInput | Campos de segredo em configuração/login. A API 2.14.0 foi consultada; avaliar o comportamento de revelar/copiar antes de aplicar a senha. | [documentação visual](https://kumo-ui.com/components/sensitive-input/) |
| TableOfContents | Referência visual e documentação longa; não adicionar outro menu em telas operacionais curtas. | [documentação visual](https://kumo-ui.com/components/table-of-contents/) |
| Tabs | Subvisões da mesma tarefa, como contas/cartões ou categorias/tags; não duplicar a Sidebar nem esconder erros em tabs. | [documentação visual](https://kumo-ui.com/components/tabs/) |
| TagInput | Edição de tags livres quando esse fluxo chegar ao painel; se houver catálogo obrigatório, usar Combobox múltiplo. | [documentação visual](https://kumo-ui.com/components/tag-input/) |
| TimeseriesChart | Chamadas/erros MCP por dia ou gastos por dia; requer período, unidade, UTC/fuso explícito e agregado completo. | [documentação visual](https://kumo-ui.com/charts/timeseries/) |

## Sem aplicação atual

| Componente | Onde ajudaria / condição | Print oficial |
| --- | --- | --- |
| BubbleMap | Os contratos atuais não fornecem geolocalização de gastos ou distribuição espacial que justifique o mapa. | [documentação visual](https://kumo-ui.com/charts/maps/) |
| ChoroplethMap | Não há agregação geográfica confiável nos contratos atuais. | [documentação visual](https://kumo-ui.com/charts/maps/) |
| GlobeMap | Não há caso de uso geográfico no painel financeiro atual. | [documentação visual](https://kumo-ui.com/charts/maps/) |

## Já usado

| Componente | Onde ajudaria / condição | Print oficial |
| --- | --- | --- |
| Button | UiButton e UiLink usam Button/LinkButton. Oportunidade é adotar variantes padrão sem a cadeia de overrides. | [documentação visual](https://kumo-ui.com/components/button/) |
| Input | UiField usa Input, mas muitos formulários ainda usam input nativo. Há espaço para ampliar a adoção sem criar novos campos. | [documentação visual](https://kumo-ui.com/components/input/) |

## Exports adicionais, diferenças do catálogo e blocos

| Item | Situação na 2.14.0 e aplicação | Evidência visual |
| --- | --- | --- |
| SkeletonLine | Disponível no export raiz e bundle Loader, apesar de não constar no `kumo ls`. Candidato direto para substituir skeleton local. | [documentação visual](https://kumo-ui.com/components/skeleton-line/) |
| Flow | Disponível no export raiz/granular, fora do registro CLI. Diagrama pode explicar regras complexas, mas não há motivo atual para trocar uma jornada simples por grafo. | [documentação visual](https://kumo-ui.com/components/flow/) |
| CodeHighlighted | Disponível em `@cloudflare/kumo/code`; usar para configuração MCP extensa se o ganho justificar Shiki/lazy load. Code simples também existe. | [documentação visual](https://kumo-ui.com/components/code-highlighted/) |
| RefreshButton | Subcomponente exportado junto de Button. Pode substituir o botão de atualização próprio, preservando busy e nome acessível. | [família Button](https://kumo-ui.com/components/button/) |
| PoweredByCloudflare | Export disponível; candidato apenas a atribuição/informação de infraestrutura pública, sem sugerir que a Cloudflare fornece o produto. | [família de marca](https://kumo-ui.com/components/cloudflare-logo/) |
| Slider | O site mostra um componente estilizado; o pacote 2.14.0 não o exporta na raiz nem em `components/slider`, só a primitiva. Sem recomendação para valores monetários exatos. | [documentação visual](https://kumo-ui.com/components/slider/) |
| PageHeader | Bloco pronto com breadcrumbs/tabs/ações. Pode padronizar cabeçalhos, usando só as partes necessárias; não foi instalado. | [documentação visual](https://kumo-ui.com/blocks/page-header/) |
| ResourceListPage | Bloco do registro, documentado como Resource List; ponto de partida para listas, sem adicionar conteúdo lateral decorativo. Não foi instalado. | [documentação visual](https://kumo-ui.com/blocks/resource-list/) |
| DeleteResource | Bloco com confirmação por nome; reservar para exclusão com consequência que mereça esse atrito. Não foi instalado. | [documentação visual](https://kumo-ui.com/blocks/delete-resource/) |

Field, Surface, MenuBar e DateRangePicker foram confirmados pela CLI/declarations; os prints ligados a eles mostram a família visual relacionada, não uma página autônoma ausente no menu observado.

## Contratos que continuam necessários

- Dinheiro: amountMinor exato, moeda explícita, sem conversão implícita. Agregados financeiros precisam do período inteiro, escopo e regra de transferências/ignoradas/pendentes/parcelas; não somar a página visível.
- Importação: fase e conta atual são conhecidas; total global não é exposto. Loader é adequado; porcentagem/Meter para Pluggy não é sustentada.
- MCP: separar requisições, ferramentas, falhas, cancelamentos, bytes e modelos declarados. Não converter bytes em tokens/custo.
- Cotas: preenchimento é consumo de uma referência declarada, com período e estimativa explícitos.
- Diálogos: preservar rascunho, validação, busy, Escape, foco e retorno ao gatilho, independente da troca de aparência.

## Código cruzado

- [Imports e adaptadores Kumo](/home/suhett/Work/caderninho/src/web/ui.tsx:1).
- [Sidebar e navegação próprias](/home/suhett/Work/caderninho/src/web/account/workspace-view.tsx:122).
- [Drawer próprio](/home/suhett/Work/caderninho/src/web/account/workspace-drawer.tsx:13) e [editor com rascunho](/home/suhett/Work/caderninho/src/web/account/backoffice-dialog.tsx:43).
- [Filtros de transações](/home/suhett/Work/caderninho/src/web/account/transactions-view.tsx:95), [tabelas MCP](/home/suhett/Work/caderninho/src/web/account/audit-view.tsx:365), [erro de recurso](/home/suhett/Work/caderninho/src/web/account/workspace-resource.tsx:86).
- [Tokens atuais](/home/suhett/Work/caderninho/src/web/design-tokens.ts:1), [documentação Kumo oficial](https://kumo-ui.com/), [Sidebar](https://kumo-ui.com/components/sidebar/), [Table](https://kumo-ui.com/components/table/).

## Proveniência visual

A auditoria de 24/10/2026 capturou 65 prints oficiais em
`kumo-projections-2026-10-24/`, no workspace da conversa. As URLs acima
substituem os caminhos absolutos desses arquivos nesta cópia versionada.
A classificação registra candidatos; não exige usar todos os componentes.
O plano da execução está em [plano.md](plano.md).
