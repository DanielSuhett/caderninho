# Execução da refatoração Kumo — 24/10/2026

## Resultado e limites

Migração no código real, branch `codex/kumo-refactor`, a partir da main local
`e6e9f09`. O estado anterior foi preservado em `6f1ebad`, sem squash. Nenhum
push, deploy ou migração remota. Na ampliação autorizada foi adicionado ECharts 6.1.0;
o pacote Kumo não foi atualizado.
A versão continua **2.14.0**. A identidade adotada é o Kumo escuro da referência
enviada pelo usuário; DESIGN.md conserva os princípios e contratos financeiros.

A revisão usou as skills kumo-design e Product Design audit/design-qa. Não houve
consulta a uma designer humana ou serviço externo de revisão. As capturas são
do código compilado com APIs sintéticas, em navegador real, não mockups gerados.
[QA](../../design-qa.md) e [índice de capturas](capturas/README.md) delimitam a evidência.

## Inventário completo: decisões por componente

“Usado” não significa importar um símbolo em uma galeria. A descrição distingue
uso operacional, composição integrada e exemplo de referência. Ter um componente
no catálogo não justifica criar uma funcionalidade para encaixá-lo.

| Componente | Disposição | Uso ou condição |
| --- | --- | --- |
| Badge | Usado | Estados financeiros, importação e contagens de seções; dashboard, transações, organização, auditoria. |
| Banner | Usado | Parcialidade e erros persistentes; ação abre a atividade MCP quando há falhas. |
| Checkbox | Usado | Filtros e perfil; adaptador UiCheckbox conserva defaultChecked e valor on da API controlada. |
| ClipboardText | Usado | URL MCP em Conexões, com cópia e rótulo em português. |
| Code | Substituído | Export simples deprecated na 2.14.0. IDs usam InlineCopyText e trechos curtos usam code; não há editor longo que justifique Shiki. |
| Collapsible | Usado | DisclosureItem usa DefaultTrigger e DefaultPanel, seta e animação oficiais, keepMounted para campos. Contas, regras, grupos, histórico, concessões, eventos e perfis. |
| Combobox | Usado | Conta e categoria nos filtros; catálogo restrito, valor serializado é o identificador. |
| DatePicker | Usado | Intervalo civil em Popover; digitação de um limite continua disponível; calendário sob demanda e rótulos pt-BR. |
| DateRangePicker | Substituído | Deprecated; DatePicker mode=range atende o mesmo intervalo. |
| Dialog | Alternativa atendida | Após revisão crítica, o uso direto foi substituído por LayerDialog, que fornece também título, corpo, ações e adaptação móvel. Não manter dois shells de modal. |
| DropdownMenu | Usado | Ações secundárias de regras e grupos. Editar permanece visível ao expandir. |
| Empty | Usado | Primeiro uso e resultado vazio, diferenciados de erro de leitura. |
| Field | Usado | Composição integrada de Input/Select; export explícito também demonstrado na referência. |
| Grid | Usado | Editor de grupo e galeria; formulário responsivo, sem cards decorativos. |
| InlineCopyText | Usado | IDs nas áreas de referência e auditoria; preserva o valor completo. |
| InputGroup | Usado | Busca com ícone oficial; busca de descrição/regra visível fora do diálogo. |
| Label | Usado | Labels integrados dos campos; export explícito demonstrado na referência. Nenhum label externo sem associação ao gatilho Select. |
| LayerCard | Usado | Superfície única por lista ou agrupamento. Painéis expansíveis internos não acrescentam outro LayerCard. |
| LayerDialog | Usado | Filtros, detalhes de transação, regras, grupos e confirmações; slots oficiais de título, corpo e ações, adaptação móvel da biblioteca. |
| Link | Usado | Links de contexto, ajuda, recuperação e reinício de consulta. |
| Loader | Usado | Fase indeterminada de importação e calendário carregado sob demanda. |
| Meter | Usado | Consumo de cotas/CPU da landing e escala diária relativa declarada na auditoria. Nenhum percentual Pluggy. |
| Pagination | Usado | Apenas quando há próximo cursor; reinício por link separado. Nenhum total/página anterior inventados; contagem permanece quando não há próxima página. |
| Popover | Usado | Calendário; não substitui editor extenso. |
| Select | Usado | Pequenos conjuntos de escopo, período, estado, moeda e campos de regra. |
| Sidebar | Usado | Provider/Header/Content/Group/Menu/MenuButton/Footer/Trigger/Close. Footer compacto com quebra segura; referências e saída ficam no Content. |
| Surface | Substituído | Deprecated; LayerCard atende as superfícies existentes. |
| Switch | Usado | Ativação no rascunho de regra; só persiste ao salvar. |
| Table | Usado | Transações e atividade MCP; conteúdo reorganizado em linhas no celular, sem soma da página. |
| Text | Usado | Cabeçalhos do workspace e exemplos; tipografia de documento em @layer base para o restante. |
| Toasty | Usado | Feedback de gravação concluída; erro e parcialidade permanecem em Banner. |
| Toolbar | Usado | Filtros, limpeza e composição de ações; pesquisa principal descoberta. |
| Tooltip | Usado | Atualização por ícone com nome acessível; nada essencial depende de hover. |
| Autocomplete | Condicional | Não há endpoint de sugestões úteis de descrição; a busca livre deve continuar aceitando qualquer texto. |
| Breadcrumbs | Sem ganho atual | Rotas planas da Sidebar e detalhes em diálogo; não inventar hierarquia. |
| ButtonGroup | Avaliado, não adotado | Presets substituem condições e precisam quebrar linhas no celular; botões independentes com texto são claros. Sem split action ou seleção persistente equivalente. |
| Chart | Usado após ampliação | Série mensal de despesas no painel/demo, com agregados completos existentes, moeda explícita, ECharts lazy e tabela exata alternativa. |
| CloudflareLogo | Sem ganho atual | Infraestrutura já identificada em texto; não substituir a marca do produto pela do fornecedor. |
| CommandPalette | Condicional | Sete destinos já descobertos na Sidebar; demanda de busca global/atalhos não estabelecida. Não duplicar navegação apenas pelo catálogo. |
| InputArea | Sem campo atual | Nenhum campo longo/JSON editável neste fluxo; não inventar configuração avançada. |
| MenuBar | Alternativa atendida | Toolbar é a composição adequada para filtros; DropdownMenu atende ações secundárias. |
| Radio | Alternativa atendida | Select conserva as escolhas existentes em formulários compactos. Sem nova escolha de modo que exija opções simultaneamente expostas. |
| SankeyChart | Depende de dados | Sem contrato de fluxos origem/destino; transferências poderiam ser contadas duas vezes. |
| SensitiveInput | Avaliado, não adotado | 2.14.0 traz revelar/copiar e textos internos em inglês sem labels públicos para traduzir. Login continua SSR sem JS; segredo Pluggy nunca retorna do servidor. Input password preserva esse contrato. |
| TableOfContents | Sem ganho atual | Referência tem cinco seções Collapsible curtas; outro menu não melhora navegação. |
| Tabs | Avaliado, não adotado | Categorias e etiquetas podem ser consultadas juntas; Collapsible independente conserva esse uso e evita esconder uma seção atrás da outra. |
| TagInput | Sem edição atual | Painel consulta etiquetas do catálogo; não há campo livre de edição. Uma futura seleção restrita pede Combobox múltiplo. |
| TimeseriesChart | Alternativa atendida | Chart nativo atende a série mensal categórica. Auditoria mantém Meter relativo + Table; não acrescentar um segundo gráfico para a mesma leitura. |
| BubbleMap | Sem aplicação | Não há geolocalização no contrato. |
| ChoroplethMap | Sem aplicação | Não há agregação geográfica no contrato. |
| GlobeMap | Sem aplicação | Não há jornada geográfica no produto. |
| Button | Usado | Variantes oficiais; UiButton somente mapeia danger para destructive, sem reconstrução visual. |
| Input | Usado | Campos visíveis; nomes/limites/autocomplete e tipos semânticos preservados. |

### Exports adicionais e blocos

| Item | Disposição |
| --- | --- |
| SkeletonLine | Usado nos estados de recurso/rota em carregamento, sem barras CSS próprias. |
| RefreshButton | Usado com Tooltip e estado disabled durante atualização. |
| Flow | Sem grafo de dependências ou edição de fluxo; jornada atual não precisa de um diagrama. |
| CodeHighlighted | Disponível em @cloudflare/kumo/code; sem configuração extensa atual que justifique Shiki. |
| PoweredByCloudflare | Atribuição textual suficiente; não acrescentar marca do fornecedor ao produto. |
| Slider | Export estilizado ausente na 2.14.0; não usar primitiva para valores financeiros exatos. |
| PageHeader | Bloco de referência, não instalado. Text/Toolbar e composição local mantêm só as partes necessárias, sem breadcrumbs/tabs fictícios. |
| ResourceListPage | Bloco de referência, não instalado. Listas existentes agora usam LayerCard/Table/Empty/Pagination diretamente. |
| DeleteResource | Bloco de referência, não instalado. LayerDialog.Alert explicita consequências e começa em Cancelar; digitar nome não é necessário para estas ações. |

## Vícios encontrados e removidos

| Antes | Correção no produto | Evidência |
| --- | --- | --- |
| Cor global de links vazava para MenuButton; Footer usado como pilha de navegação | Resets em @layer base; Content para todos os menus, Footer de uma linha | visao-geral-desktop, sidebar-celular |
| Collapsible base com seta, rotação, hover e foco reconstruídos | DefaultTrigger/DefaultPanel, keepMounted; CSS organiza só o resumo do registro | conta-expandida-desktop, grupos-celular |
| Mesmo shell artesanal de modal com header/footer em vários lugares | Slots oficiais de LayerDialog e Actions.Primary; confirmação via Alert | grupo-editor-celular, parcelas-desktop |
| Busca escondida dentro de Filtros | InputGroup visível e GET preserva escopo/filtros, remove cursor | transacoes-desktop/celular |
| Contadores grudados no título e resets zerando o espaço das seções | Badge para contagem; remoção do reset genérico de disclosure | grupos-celular, auditoria-celular |
| Paginação com dois botões inúteis sem próximo cursor | Controle só quando há próxima página; reinício conserva URL conhecida | transacoes-desktop, sincronizacoes-celular |
| Banner MCP mandava procurar atividade escondida | Ação Ver atividade abre o Collapsible correspondente e rola até ele | auditoria-atividade-celular |
| Hanken, wordmark, paleta e sombras próprias mantinham outra identidade | Inter local e tokens semânticos Kumo; assets sem consumidor removidos; galeria refeita | DESIGN.md, design.tsx, design-tokens.ts |

## Baseline preservada

| Área | Contrato mantido |
| --- | --- |
| Rotas públicas | /, /account/login, /authorize, 404; canonical https://usecaderninho.com/ e URL Deploy to Cloudflare. |
| Rotas privadas | /account, /account/transactions, /account/rules, /account/groups, /account/sync, /account/connections, /account/audit, /account/design-system. Sidebar e links conservam pessoa/grupo quando aplicável. |
| Landing | Âncoras de navegação/instalação/metodologia/FAQ existentes, GitHub e Deploy Button; sem introduzir ações privadas no site público. Teste public-navigation verifica a distinção site/instância. |
| Acesso | POST /account/login; csrf, returnTo, password, limites 16–256, current-password; configuração/recuperação sem JS. |
| Consentimento | POST na rota atual; handle, decision=approve/deny; cliente/destino e texto integral sobre acesso, envio de resultados, confirmações e revogação. Entrar não aprova automaticamente. |
| Filtros | space, person, text/q, from, to, direction, accountId, categoryId, status, future=on, ignored=on, days e filtros de histórico. Cursor é removido ao aplicar; cancelamento conserva URL. |
| Escritas | CSRF/origem, confirmação, idempotência e comportamento diante de resultado incerto; não acrescentar retries silenciosos. |
| Marca | Nome Caderninho e destinos existentes. Hanken/wordmark/laranja de ação foram substituídos por autorização explícita; não alegar preservação dessa identidade antiga. |

### Dados necessários e significado

Dinheiro permanece em amountMinor com moeda e direção explícitas. Zero difere de
ausente; cartão não é dinheiro disponível; ignoradas/pendentes/futuras e parcelas
continuam consultáveis. O estado da origem não prova pagamento da fatura.
Não há soma da página ou conversão cambial. O gráfico operacional usa agregados completos reais;
a demo identifica seu ledger como fictício.

O contrato dos gráficos atuais registra período completo, escopo e moeda, com
políticas de transferências/ignoradas/pendentes/parcelas em [dados-e-evidencias.md](dados-e-evidencias.md). A auditoria tem dias UTC
mas não mede custo de IA: requisições, ferramentas, falhas, cancelamentos, bytes e
modelos declarados ficam distintos. Meter diário é relativo ao máximo observado,
explicitamente descrito, sem sugerir limite contratado.

Na landing, laranja significa consumo. Cotas/período/metodologia e estimativas
continuam explícitos. CPU acima da referência satura visualmente a barra, mas
mantém valor e percentual reais no texto. Pluggy mostra fase real com Loader;
sem denominador global conhecido não há porcentagem de importação.

## Adaptações necessárias na versão instalada

Sidebar 2.14.0 mantém posicionamento/overlay/collapse próprios. O shell fornece
altura 100dvh e área principal rolável. No móvel, composição por props acrescenta
role dialog/aria-modal, inert no conteúdo externo e ciclo de Tab; Escape e retorno
ao gatilho foram exercitados. O Trigger externo usa openMobile no aria-expanded
porque o interno da versão usa open de desktop. Não sobrescrever position sticky.

Checkbox é controlado: UiCheckbox acrescenta estado inicial mantendo o valor on.
Conteúdo e controles usam 16 px, metadados usam 14 px; Inter local e escala maior
são preferências explícitas que prevalecem sobre 14 px da skill. DefaultTrigger
e controles mantêm comportamento nativo, sem mudar tracking. Campos têm label integrado, especialmente Select.
DatePicker range substitui o DateRangePicker deprecated. Surface e Code simples
não devem aparecer em novas composições.

Detalhes públicos permanecem HTML details/summary: landing, recuperação e
metodologias funcionam com SSR sem JavaScript. O painel React usa Collapsible.
SensitiveInput foi avaliado com sua API instalada, sem instalar outra versão.

## Leitura qualitativa e prioridades

Estas são **inferências visuais**, não medições: variação baixa no aplicativo
(superfícies e controles consistentes); movimento baixo, restrito a feedback,
expansões, modal/menu e carregamento; densidade moderada nas listas e maior nas
áreas técnicas expandidas. A landing conserva hierarquia editorial e maior respiro;
o aplicativo prioriza leitura e operação. Não comparar ambos por uma mesma régua
de composição de marketing.

As três oportunidades realizadas de maior impacto são: biblioteca assumir de fato
navegação/expansões/diálogos; busca e recuperação ficarem descobertas; remover o
CSS de identidade/controle que concorria com os componentes. Não preencher o
espaço deixado por uma amostra pequena com cards/gráficos sem tarefa ou dados.

## Validação

Resultado final, comandos e limite de evidência estão em design-qa.md. Build e
runtime são locais; não comprovam provedor, OAuth real, produção ou host MCP.
Kumo permanece 2.14.0; package/lock incluem ECharts 6.1.0. Capturas históricas
rejeitadas ficam identificadas como tais; a galeria final só aponta evidência aceita.

## Polimento após as rodadas críticas

Inter local, tipos semânticos, tokens de contraste compartilhados, toolbars e
resumos alinhados, Transações móvel compacta e Sidebar compartilhada com a demo.
IDs financeiros foram movidos para RecordReference; descarte de rascunho separa
mensagem e ações, sem corte móvel. Formulários de pessoas não sobrepõem controles.
CSS authored inline foi removido. O build incorpora o CSS oficial que faltava
no DatePicker standalone 2.14; a largura do Popover respeita a viewport.

Três oportunidades concretizadas: controles/estados pertencem ao Kumo; resumo
financeiro completo e descoberto substitui leitura de saldo isolado; demo pública
permite experimentar mês/moeda/busca antes da instalação.

Revisão crítica 03:8/10 qualitativo por página nos estados listados, após três
rodadas com correções intermediárias rejeitadas. Gráfico mantém tabela exata
quando o chunk falha; falha isolada da série não derruba o resto do resumo.
[Galeria](capturas/README.md) e [QA](../../design-qa.md) são a evidência atual.
