# Revisão da experiência do produto

Revisão local em 25–26/10/2026, a partir de `cc2e5a4`, no checkout
`/home/suhett/Work/caderninho`. Preview: `http://localhost:8916/`.
A POC da porta 8914 foi preservada. Nenhum deploy ou migração remota faz parte
desta revisão. Contas, lançamentos e eventos usados na conferência são sintéticos.

## Evidência e leitura da cobertura

As dez páginas internas e as seis da demo foram abertas nos temas claro e escuro,
em largura normal e estreita. As larguras efetivamente lidas no navegador foram
1280 e 391 CSS px; algumas capturas adicionais têm 402 CSS px. Não confundir
redimensionar a janela com verificar a largura efetiva.

Capturas, árvores acessíveis e dimensões estão em
`.wrangler/design-review-20261025/`. `qa-captures.json` identifica URL, tema,
largura e posição de rolagem de cada captura; `gallery.html` reúne a seleção
aceita. Essa pasta é local e ignorada pelo Git. A amostra em `docs/qa/` contém
somente a demo, sem acesso privado ou dados reais:

- [Visão geral, desktop escuro](docs/qa/2026-10-26-overview-dark.jpg)
- [Transações sem categoria, desktop claro](docs/qa/2026-10-26-transactions-light.jpg)
- [Editor de limite, celular escuro](docs/qa/2026-10-26-cards-mobile-dark.jpg)
- [Landing, desktop claro](docs/qa/2026-10-26-landing-light.jpg)
- [Cartões, desktop claro](docs/qa/2026-10-26-cards-light.jpg)

As tabelas distinguem revisão visual, comportamento local e trechos externos.
Uma captura do primeiro viewport não comprova todos os estados de uma página.
Consentimento é a exceção de tema: sua CSP bloqueia scripts e mantém o tema
escuro estático. O controle inoperante foi removido; nenhum cabeçalho de
segurança foi relaxado.
Os caminhos e estados auxiliares conferidos estão no final deste documento.

## Visão geral — `/account`

| Problema | Decisão | Alteração | Evidência | Pendência |
| --- | --- | --- | --- | --- |
| Filtros em faixa isolada; vazios com moldura dentro de outra superfície; ausência de valor cortada no celular. | Agrupar consulta no cabeçalho e distinguir texto de ausência de número financeiro. | Filtros junto de mês/atualização; critérios compactos; Empty sem moldura interna; “Indisponível” em texto de conteúdo de 16 px. Valores monetários mantêm 32/26 px. | `account-overview-{light,dark}-{1280,391}`; resumo parcial e sem lançamentos. | Dados reais do provedor não consultados. |

## Transações — `/account/transactions`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Busca repetida dentro dos filtros e ausência de atualização manual. | Manter busca e filtros próximos; oferecer uma atualização. | Busca avançada virou campo oculto que conserva o GET; botão de atualizar com nome acessível; vazio aponta para Pessoas. | `account-transactions-*`; `demo-transactions-*`; filtros, detalhe, busca, cancelamento e recuperação de consulta inválida. | Cursor/volume e dinheiro exato são conferidos pela suíte; sem paginação de dados bancários reais. |

## Cartões — `/account/cards`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Controles separados do título; resumo móvel muito alto; filtro sem escolhas quando não há cartão. | Manter identidade e critérios, compactando composição. | Filtros no cabeçalho; mês com nome acessível sem legenda repetida; métricas móveis em duas colunas de rótulo/valor; filtro ausente se não oferece escolhas. “Todos os cartões” continua disponível mesmo com um cartão. | `account-cards-*` vazio; `demo-cards-*` preenchido; limites e parcelamentos compartilhados. | Limites e parcelas de bancos reais não consultados. |

## Investimentos — `/account/investments`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Faixa de filtros isolada; escolhas únicas/sem posições; métricas móveis em blocos extensos. | Seletores representam escolhas reais. | Cabeçalho compartilhado; classe/instituição/moeda únicas preservadas em campos ocultos; filtro sem escolhas removido; rótulo e valor reorganizados no celular. | `account-investments-*` vazio/parcial; `demo-investments-*` com carteira e composição. | Cobertura real de bruto/líquido/resgate continua dependente do provedor. |

## Regras — `/account/rules`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Importar, editar e mais ações competiam com a criação. | Uma ação principal; gestão compacta e contextual. | Importar e editar usam ícones com Tooltip; menu de mais ações mantém nomes; importador recebe `open`; busca e consequências continuam explícitas. | `account-rules-*`; `demo-rules-*`; `rule-importer-*`; editor, composição, menu, exclusão cancelada e proteção de rascunho. | Nenhum pacote gravado no preview por esta revisão; importação/idempotência cobertas por integração. |

## Grupos — `/account/groups`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Trinta e três categorias abertas, “Editar” e “Categoria fixa” repetidos. | Revelar gestão sob demanda, com quantidade e nomes claros. | Categorias/etiquetas recolhidas; canetas e + contextual; editor sempre presente com `open`; filtro de grupo único removido. Condições de categoria fixa aparecem no editor. | `account-groups-*`; `demo-groups-*`; `category-editor-light-desktop`; teclado, continuar edição, descarte e retorno de foco. | Leitor de tela completo não executado. |

## Sincronizações — `/account/sync`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Bancos diferentes apareciam como o mesmo perfil Pluggy. | Mostrar banco e conservar referência histórica. | Nome/logo verificados no resumo; acesso Pluggy fica no detalhe; perfil continua como fallback se a conexão não estiver no catálogo; filtros e atualização no cabeçalho. | `account-sync-*`; rodada concluída e falha sintéticas; histórico por conexão. | Falha de rede do SVG e histórico sem conexão atual não provocados no navegador. Fallback compartilhado preservado. |

## Auditoria — `/account/audit`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Título de autorizações repetido no vazio; atividade detalhada aberta por padrão. | Priorizar acesso e abrir detalhes quando solicitados. | Título redundante fica acessível sem repetição visual; atividade recolhida com contagem; aviso de falha continua visível e “Ver atividade” abre o conteúdo. | `account-audit-*`; `audit-activity-*`; quatro eventos sintéticos, falha e interrupção. | Não foram concedidas/revogadas autorizações reais para produzir uma captura. Fluxos cobertos pela integração. |

## Pessoas e onboarding — `/account/connections`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Botões com destinos diferentes quase iguais na falha da importação; ajustes de bancos com nome da pessoa repetido; ações de formulário espalhadas. | Nomear o destino e preservar a sequência Pessoas → Importar → Consultar. | Atualização de progresso compacta; “Conectar assistente” distinto de consultar dados; banco identificado também nos ajustes; Salvar/Cancelar próximos; saída adiada só na lista de Pessoas. Botões de ícone compartilham implementação de 40 px. | `account-connections-*`; `people-settings-*`, `new-person-*`, `credentials-*`, `import-*`, `assistant-*`. | Validação de credenciais, widget Pluggy e importação externa não executados. Loading/falha visual usam fixtures locais; runtime exercita Workflow real local com provedor sintético. |

## Referência visual — `/account/design-system`

| Problema | Decisão | Alteração | Evidência | Pendência |
| A galeria tem mais conteúdo que uma tarefa financeira comum. | Conservar a função de referência de componentes. | Sem redução estrutural: exemplos, tokens, campos com erro e confirmações são o conteúdo desta página. Recebe os componentes compartilhados atualizados. | `account-design-system-*`; conferência das seções e controles sob demanda. | Não é demonstração de todas as combinações possíveis do Kumo. |

## Demo da visão geral — `/demo`

| Problema | Decisão | Alteração | Evidência | Pendência |
| A demo poderia divergir da composição real. | Compartilhar cabeçalho, filtros, métricas e identidades. | Cabeçalho compacto e melhorias do FinancialDashboard; marcador único de dados fictícios mantido. | `demo-overview-*`, quatro combinações; gráfico, tabela exata, recentes e contas. | Nenhuma chamada bancária; fixtures de maio–outubro de 2026. |

## Demo de transações — `/demo/transactions`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Regressão possível de identidade/escopo ao compactar filtros. | Conservar avatares, bancos e exceções. | ScopeFields compartilhado; busca, moedas por linha, pendência/futuro/parcela e detalhes mantidos. Sem atualização remota: os dados estão na sessão da demo. | `demo-transactions-*`; detalhe e filtros por teclado, busca vazia e retorno. | A demo não implementa paginação de servidor. |

## Demo de cartões — `/demo/cards`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Manter outra implementação visual produziria deriva. | Usar CardsView/CardsDashboard reais. | Mesmas melhorias de cabeçalho, escolhas e métricas. | `demo-cards-*`; gastos, limites, meses e parcelas recebidas. | Números sintéticos; não representam pagamento da fatura. |

## Demo de investimentos — `/demo/investments`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Densidade móvel e filtros podiam divergir do produto. | Usar os mesmos componentes da carteira. | Mesmas melhorias; valores exatos e composição por classe/instituição mantidos. | `demo-investments-*`, quatro combinações; posições e detalhes. | Fixture, sem valorização/cotação ao vivo. |

## Demo de regras — `/demo/rules`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Gestão repetia botões textuais. | Compartilhar OrganizationView. | Caneta/menu reais; consequências de reaplicar continuam visíveis. | `demo-rules-*`; edição, descarte e exclusão cancelada. | Alterações da demo duram só a sessão; não são regras privadas. |

## Demo de grupos — `/demo/groups`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Lista de categorias dominava a página. | Mesma divulgação progressiva do produto. | Categorias recolhidas, contagens, ícones de edição e formulário com rascunho. | `demo-groups-*`; edição de cor não salva preservada e depois descartada. | Sem alteração de dados reais. |

## Landing e instalação — `/`, âncoras públicas

| Problema | Decisão | Alteração | Evidência | Pendência |
| Instruções usavam nomes antigos de páginas. | Conservar a composição pública e corrigir continuidade. | Pessoas e Auditoria MCP substituem os nomes antigos. Hero, custos, consentimento, FAQ, instalação e diagrama não viram uma barra de ícones: explicam o produto antes de instalar. | `landing-*`; seções completas em capturas full-page; claro/escuro e móvel/desktop. | Clique final do Deploy to Cloudflare não executado; instalação pessoal não autorizada. |

## Acesso — `/account/login`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Texto inicial repetia o objetivo do formulário. | Texto curto com identidade da instalação visível. | Introdução reduzida; origem, erro, recuperação e distinção login/consentimento preservados. Chave gerada continua usando ClipboardText. | `login-*`, `login-error-*`, `generated-access-*`; senha incorreta e entrada posterior correta. | Instalação sem binding e rate limit conferidos por integração; sem novo deploy. Conteúdo da área de transferência não confirmado pela ferramenta do navegador. |

## Consentimento — `/authorize`

| Problema | Decisão | Alteração | Evidência | Pendência |
| Reduzir texto ocultaria consequências; o alternador de tema dependia de JavaScript bloqueado pela CSP. | Preservar consentimento explícito e a política sem scripts. | Autorizar e Negar mantêm rótulos; removidos script de tema e controle inoperante somente nesta superfície. | `consent-dark-{1280,391}`; cliente local, login conserva continuação e nenhum acesso concedido. | Tema claro indisponível sob a política atual; OAuth ponta a ponta no ChatGPT/Claude não executado. |

## Página inexistente — HTTP 404

| Problema | Decisão | Alteração | Evidência | Pendência |
| Recuperação repetia explicações e a proposta inicial apontava para um painel ausente no site público. | Retornar ao início do site, onde este HTML é publicado. | Mensagem curta e “Voltar ao início” para `/`. | `not-found-*`; HTML de `dist/site/404.html` nos dois temas/tamanhos e link de retorno. | Conferência visual em servidor estático local; roteamento 404 do Pages não validado. O Worker privado mantém sua resposta 404 existente. |

## Estados e caminhos auxiliares

| Caminho | Conferência local | Limite |
| --- | --- | --- |
| Nome/foto, nova pessoa e cancelar | Identidade, nome obrigatório, foto opcional, disclaimer de Meu Pluggy próprio, Cancelar e retomar Pessoas. | Não foi anexada outra foto nesta revisão. |
| Credenciais e adicionar banco | Formulário com Client ID/Secret, reutilização explicada, cancelar e retornar sem salvar. | Nenhum segredo real enviado; widget externo permanece pendente. |
| Ajuda/ajustes | Ajuda sob demanda; acesso existente, banco e titular distinguíveis; revogação preserva confirmação. | Nenhuma credencial/atribuição privada alterada. |
| Importação | Uma de duas conexões em andamento; reload conserva o estado; falha mantém os dados e a elegibilidade; destinos dos botões distintos. | Estado visual sintetizado no D1 local; não representa execução Pluggy real. Fixture restaurada ao final. |
| Assistente/conclusão | URL MCP real da instalação local, escolha de cliente e abertura do painel. | Copiar não é autorizar; nenhum sucesso de conexão foi fabricado. |
| Filtros/consulta | Aplicar GET; cancelar não altera URL; voltar/retomar; busca conservada; limpar consulta inválida recupera a tela. | Sem todas as permutações de filtros. |
| Detalhes e editores | Transação/parcela, conta, regra, grupo, categoria, referência técnica e confirmação. Teclado, Escape, descarte e foco exercitados. | Conferência de leitor de tela completo/zoom de 200% não executada. |
| Navegação | Sidebar e menu móvel, fechar ao trocar de rota, foco no conteúdo, links públicos e alternância de tema. | Não é certificação de acessibilidade. |

## Ajustes solicitados em 26/10/2026

Esta rodada complementa a revisão global acima. A landing, a aba Sem categoria
e Cartões foram novamente conferidos nos dois temas em 1280 e 391 CSS px,
sem transbordamento horizontal. A edição do limite foi conferida em diálogo
desktop e em gaveta móvel. Os arquivos `adjustments-*` são as evidências desta
rodada; `adjustments-limit-restored-*` e `adjustments-limit-editor-light-391`
registram uma composição intermediária, substituída pelas capturas finais.

| Página / problema | Decisão | Alteração | Evidência | Pendência |
| --- | --- | --- | --- | --- |
| Cartões: Parcelas por mês duplicava a consulta de período. | Retirar a seção, conservar o seletor de mês e os parcelamentos. | Removida a tabela mensal; categorias e limites lado a lado no desktop, empilhados no celular. | `adjustments-cards-{light,dark}-{1280,391}`; testes de apresentação. | A API mensal continua disponível aos agentes. |
| Transações: somente a descrição abria detalhes. | Acionar o mesmo botão nativo ao clicar na linha. | Data, conta e valor abrem o diálogo; controles secundários e seleção de texto não disparam a abertura. Enter/Space e retorno de foco ao botão da mesma transação preservados. | Clique na data e no valor de Curso de especialização; fechar devolve foco a “Ver detalhes de Curso de especialização”. | Leitor de tela completo não exercitado. |
| Transações: itens sem categoria não tinham uma tarefa própria. | Criar aba filtrada e orientação curta antes da lista. | Tabs e ClipboardText do Kumo; Ver prompt sob demanda; filtro no servidor antes da paginação, preservando todas as ocorrências da compra agrupada. | `adjustments-uncategorized-*`, `adjustments-product-uncategorized-light-1280`, `adjustments-uncategorized-empty-light-1280`; busca sem resultado e Limpar preservam a aba. Integração cobre cursor e agrupamento. | A UI confirmou “Prompt copiado”; o conteúdo do clipboard não pôde ser lido pela ferramenta. Nenhuma classificação real executada. |
| Grupos: orçamento aparecia sem uso atual. | Retirar o orçamento da apresentação. | Removida a indicação “Sem orçamento”; grupos, categorias e etiquetas permanecem. | `adjustments-groups-light-391`; texto de orçamento ausente no DOM. | Contratos financeiros e ferramentas existentes preservados. |
| Identidade: avatares não destacavam o hover. | Usar contorno com token Kumo, sem deslocar a composição. | Outline de 2 px e offset de 2 px em pessoa/banco; foco visível nas escolhas. | `adjustments-avatar-highlight-{light,dark}-1280`; hover real e outline calculado observados nos dois temas. | Dispositivos de toque usam o foco/controle, sem depender de hover. |
| Cartões: limite não podia ser corrigido pelo usuário. | Preferência local persistente, separada do valor importado. | Caneta abre editor; salvar usa D1, revisão e idempotência. Disponível estimado usa a ocupação importada. “Usar limite do banco” restaura o acompanhamento da fonte. | Produto local: 1.000 → 1.200 BRL, ocupado 300, disponível estimado 900; reload preserva 1.200; restauração volta a 1.000/700. `adjustments-product-limit-final-*`, `adjustments-limit-editor-final-*`. Integração cobre nova importação, replay, revisão obsoleta e campos permitidos. | Não altera limite no banco. Na demo, alterações duram a sessão. Sem novo schema/migração. |
| Landing: hero afastado da experiência concreta do produto. | Proposta curta com amostra do produto ao lado. | “Suas finanças, na sua IA.”, CTAs compactos, transações sintéticas com logos reais e pergunta de exemplo. Inter, Kumo, custos e instalação preservados. | `adjustments-landing-{light,dark}-{1280,391}`. | Nenhum deploy ou instalação pessoal executado. |

O prompt usa somente ferramentas presentes neste checkout: `status`,
`get_categories`, `get_rules`, `get_transaction_purchases`, `get_transactions`,
`preview_rule`, `batch_edit_transactions` e `create_rule`. Inclui o recorte atual,
IDs e descrições como evidência, categorias disponíveis, paginação e limites da
amostra. Exige revisão e aprovação antes de escrever; preserva alterações
humanas, não trata descrições como instruções e mantém dúvidas sem categoria.
Na demo, identifica dados e IDs fictícios e inclui o período visível, sem sugerir
aplicá-los a uma instalação real.

O Worker da porta 8916 usa D1 local com fixtures sintéticas. Foram adicionados
um cartão de exemplo (`qa-credit`) e uma transação sem categoria para permitir
revisar a nova experiência; a preferência de limite foi restaurada para o valor
importado ao terminar. Nenhum banco, segredo Pluggy ou dado remoto foi alterado.

## Comentários do navegador — revisão final em 26/10/2026

Escopo: os dez comentários sobre modais, expansão de sincronizações, Pessoas,
Transações e Sidebar. Revisão crítica guiada por `kumo-design` e Product Design
Audit, com captura do estado inicial antes da implementação. A identidade,
Inter em 16/14 px, precisão financeira e autorização permanecem as do produto.

As capturas desta rodada estão em `.wrangler/design-comments-20261026/`, com
árvores acessíveis, `captures.json`, logs e galeria. Os prefixos `01` a `05`
mostram os problemas iniciais. As amostras `16`, `17` e `25` são intermediárias;
`23` registra o editor final com categoria obrigatória. Capturas durante resize
ou carregamento foram substituídas antes de aceitar a evidência.

| Comentário / superfície | Diagnóstico | Decisão e alteração | Evidência aceita | Limite |
| --- | --- | --- | --- | --- |
| 1 — Importar regras e modais | Moldura externa e camada interna disputavam a hierarquia; seletor de arquivo nativo destoava dos controles. | Dialog nativo do Kumo, uma superfície e composição compartilhada de cabeçalho/corpo/ações. Botão Kumo abre o seletor; arquivo nativo oculto não duplica o controle no teclado. | `02-before-rule-import-*` → `11-after-rule-import-{light,dark}-{997,391}`. | Novo envio de arquivo não executado; parser e importação mantêm testes existentes. |
| 2 — Expansão de sincronizações | Borda de citação e recuo separavam os detalhes do próprio registro. | Collapsible.Panel, alinhamento com o resumo, separador discreto, campos relacionados e “Ver conexão” compacto. Etapa não recebida não gera um campo vazio. | `03-before-sync-expansion-*` → `12-after-sync-expansion-{light,dark}-{997,391}`. | Erro/progresso conservam os dados reais do contrato; não foi iniciada importação Pluggy. |
| 3 — Pessoas | “Continuar depois” encostava no fim da lista. | Espaçamento de 24 px e ação ghost com largura do conteúdo. | `04-before-people-spacing-*` → `13-after-people-spacing-{light,dark}-{997,391}`. | Nenhum cadastro, foto ou segredo real alterado. |
| 4 — Detalhe de transação | Mesmo peso para descrição, estado e IDs; duas molduras. | Identidade, descrição e valor lideram; dados da transação e estabelecimento em grupos; origem adicional e IDs sob demanda. Rodapé permite Categorizar/Criar regra. | `01-before-transaction-dialog-*` → `18-after-rich-details-{light,dark}-{1280,391}`; campos de origem expandidos. | Somente campos recebidos; não se inventam estabelecimento ou situação de pagamento. |
| 5 — Texto de paginação | Contagem da página não orientava uma decisão. | Removida a contagem decorativa do componente compartilhado e da demo; avançar/reiniciar continuam disponíveis com cursor. | `05-before-uncategorized-*` → `09-after-uncategorized-*`, `22-after-demo-uncategorized-*`. | Paginação e escopo continuam cobertos por integração. |
| 6 — Aba Sem categoria | Não indicava o trabalho pendente. | Badge warning com quantidade de compras/lançamentos sem categoria em todo o recorte recebido, antes da paginação; some quando não há pendências. | Produto: 1 → 0 após salvar, conserva 0 no reload; restauração para sem categoria volta a 1. Integração: duas páginas mantêm contador 2 e busca reduz para 1. | Contagem de grupos, não de parcelas. Cobertura parcial da importação continua explícita. |
| 7 — Ajuda de categorização | Orientação e ClipboardText ocupavam a listagem continuamente. | “Resolva com sua IA” abre ajuda e prompt em Dialog; revisão da proposta permanece clara. | `10-after-ai-help-*`; Ver prompt; UI mostra Prompt copiado; Escape devolve foco ao botão. | Conteúdo do clipboard não confirmado pela ferramenta; nenhum agente externo acionado. |
| 8 — Classificar e criar regra | Fluxo dependia exclusivamente do agente. | Caneta na categoria, menu da linha e ações do detalhe. Categoria usa escrita limitada a categoria/IDs, revisão e idempotência; regra nasce preenchida com descrição literal, conta, moeda e movimento, sem reaplicar histórico. Categoria ausente exige escolha antes de criar. | `15-after-transaction-menu-*`, `19-after-demo-category-*`, `23-after-rule-empty-category-*`, `21-after-demo-rule-saved-*`; prévia encontrou 6 correspondências na demo e regra apareceu em Regras. | Na demo, reload restaura as fixtures. No produto, categoria foi salva/recarregada/restaurada no D1 sintético; criação de regra bancária real não executada. |
| 9 — Recolher navegação | Controle distante da marca. | Trigger/Close no Header, ao lado de Caderninho; modo recolhido conserva o controle acessível. | `14-after-sidebar-collapsed-*`; Sidebar expandida nas capturas de desktop. | Navegação móvel usa o comportamento modal existente. |
| 10 — Rodapé da navegação | Contagem de pessoas/conexões repetia informação sem ação. | Texto removido; tema permanece no rodapé. | `09`, `12`, `13`, `18`, `22` em desktop. | Nenhuma mudança no modelo de pessoas/conexões. |

### Cobertura dos componentes compartilhados

| Superfície / estado | Conferência desta rodada | Evidência / pendência |
| --- | --- | --- |
| Importador, filtros, regra a partir da transação, confirmação, limite | Temas claro/escuro e larguras normal/estreita. Corpo longo rola e ações permanecem visíveis; confirmação começa em Cancelar e foi cancelada. | `11`, `23`, `24`, `26`, `27`; nenhuma exclusão confirmada. |
| Detalhe, categorização e ajuda IA | Produto e demo; clique na data abre o detalhe; detalhe abre editor; menu cria regra; origem adicional consultável; retorno de foco exercitado. | `06` a `10`, `18` a `24`. Editor de categoria claro no desktop e no celular; escuro também nos dois tamanhos. Ajuda IA clara no celular e escura no desktop. |
| Rascunho de regra | Cancelar pede descarte; Continuar editando conserva o nome alterado; descartar retorna à lista. | `17-after-draft-discard-*`; rascunho temporário encerrado sem salvar. |
| Lista móvel e ações por linha | Espaço do menu não comprime o valor; descrição conserva fonte e avatares. | `28-after-mobile-transactions-*`; ajuste final de gaps e posição do menu específico ao container estreito. |
| Outros consumidores de BackofficeDialog/DisclosureItem | Herdam a mesma composição nativa por código. | Não foram reabertos individualmente todos os editores de categoria/grupo, revogação MCP e referência visual nesta rodada; a revisão global anterior está registrada acima. |

A gravação de categoria preservou dinheiro acima do inteiro seguro, descrição e
direção em integração; reimportar conservou a escolha humana. Escritas com valor,
direção, confirmação ausente ou sem revisão foram recusadas. Replay não duplica;
revisão antiga retorna conflito. No navegador, a categoria da fixture local foi
restaurada para sem categoria ao terminar. A regra de teste da demo desapareceu
na recarga prevista pelo contrato. Nenhum dado financeiro remoto foi alterado.

Amostras finais da demo, sem dados privados:

- [Detalhe com estabelecimento](docs/qa/2026-10-26-transaction-dialog-dark.jpg)
- [Sem categoria e ações](docs/qa/2026-10-26-review-tab-dark.jpg)
- [Regra a partir da transação](docs/qa/2026-10-26-rule-from-transaction-light.jpg)

## Checks

O produto usa `mise run check`, incluindo tipos, formato, lint, testes de domínio,
integração Cloudflare, build/dry-run e runtime local D1/Workflow. `test:sites` é
da POC e não existe neste pacote; não é um check do produto.

**Resultado final desta rodada: `mise run check` aprovado (saída 0).** Tipos,
formato e lint; 103 testes Node; 173 testes de integração em 30 arquivos; build/dry-run;
runtime D1/Workflow com 10 mil e 100 mil registros, falha parcial, retomada e
reinício persistente. Nenhuma publicação.

Logs finais: `.wrangler/design-comments-20261026/check-full.log`,
`check-quick-final.log`, `tests-node-final.log` e `build-portal-final.log`.
Após os refinamentos de campos/controles e espaçamento, check:quick, os 103
testes Node e o build foram repetidos com sucesso; o último ajuste só de CSS
teve check:quick e build repetidos novamente. Os logs de
`.wrangler/design-review-20261025/` registram as rodadas anteriores.
Um build ou HTTP 200 isolado não comprova a jornada inteira.

A prévia Pages da porta 8918 herdou bindings do Worker e falhou antes de
servir o site. O artefato `404.html` foi conferido em servidor estático, sem
simular a resolução de rotas do Pages. A porta 8916 mantém o produto local.


## Revisão crítica de tipografia e copy — 26/10/2026

Aplicada ao produto e à demo, no mesmo checkout e preview 8916. A POC não foi
alterada. O recorte desta rodada é tipografia, copy e composição dos detalhes;
não repete a prova dos fluxos externos da revisão anterior.

### Crítica e decisões

| Evidência atual | Crítica | Decisão implementada |
| --- | --- | --- |
| `02-before-landing-light-1280` | A mesma voz da interface ocupava todo o título editorial. A landing tinha hierarquia de tamanho, mas pouca diferenciação de função. | Source Serif 4, peso 500, nos títulos editoriais; Inter em texto, navegação, botões, diagrama e prévia do painel. |
| Capturas fornecidas pelo usuário e `03-before-account-expanded-light-402` | Origem óbvia, IDs e seções técnicas competiam com a informação que ajuda a agir. | Removidos Critérios, Referência técnica, o aviso repetido de cartão e a nota de movimentos sem classificação. Titular com avatar e ação compacta de transações; detalhes compartilham 14/16 px e espaçamento. |
| `20-account-overview-*`, `12-demo-overview-*` | O tamanho de leitura já era adequado. Encolher texto para compactar criaria uma regressão. | Corpo 16/24 px, metadados 14/21 px, títulos 28/35 px e métricas 32/26 px. Dinheiro continua em Inter tabular, com sinal e moeda exatos. |
| `type-readings.json`, `contrast-readings.json` | O texto secundário claro merecia mais contraste. | Token secundário claro reforçado para #64646c. Na superfície medida: corpo 17,913:1 e metadados 5,864:1 no claro; 17,396:1 e 9,157:1 no escuro. Isso mede esses pares, não todos os estados da biblioteca. |
| `01-before-overview-light-402`, `20-account-overview-*` | A altura fixa dos gráficos vazios deixava espaço sem informação. | Altura reservada somente quando há conteúdo de análise; o vazio aproxima mensagem e ação. A classe de layout permanece aplicada também ao vazio. |

As fontes vêm de arquivos locais, sem serviço externo em runtime. Source Serif 4
é a distribuição oficial Adobe, commit `80d3f8894c09c937bebfa9011247d2e1c79fd6f4`,
com licença OFL preservada. A landing antecipa a fonte editorial; páginas de
trabalho usam Inter e carregam a serifada somente no espécime da referência.
Monoespaçada do sistema fica restrita a URLs, chaves, comandos e prompts.
Login, consentimento e 404 conservam Inter porque são tarefas funcionais.

Fontes da decisão: [Adobe Source Serif](https://adobe-fonts.github.io/source-serif/),
[contraste WCAG](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
e [reflow WCAG](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

### Matriz desta rodada

20 páginas-base vistas. Cada linha com `*` inclui claro/escuro e 997/391 CSS px,
exceto consentimento, que mantém escuro estático. Detalhes adicionais foram
conferidos nos estados indicados; a primeira dobra não representa todos os
estados possíveis. Não houve rolagem horizontal da página nas capturas aceitas.

| Página / estado | Problema e decisão | Alteração | Evidência | Pendência |
| --- | --- | --- | --- | --- |
| `/account` | Cópia e blocos técnicos competiam com os valores. | Remoções solicitadas; conta com titular/avatar/ação; vazios compactos; Inter e contraste compartilhados. | `20-account-overview-*`, `31-account-detail-*` | Semântica de saldos/categorias preservada; dados reais não consultados. |
| `/account/transactions` | Detalhe ainda tinha referência genérica. | Referência removida; dados financeiros, titular, situação e edição mantidos; escala compartilhada. | `23-account-transactions-*`, `25-reflow-detail-light-320` | Reflow 320 px validado; gravação de categorias já coberta na rodada anterior e pela suíte. |
| `/account/cards` | Critérios extensos repetiam a ajuda. | Critérios removidos; política na ajuda do valor; números tabulares e formulário de limite mantidos. | `26-account-cards-*`, `27-limit-editor-light-391` | Limite não foi alterado nesta rodada; persistência coberta pela suíte. |
| `/account/investments` | Carteira vazia precisava manter a escala. | Inter/contraste compartilhados; estrutura do vazio preservada porque tem uma única mensagem. | `01-investments-*` | Posições preenchidas verificadas na demo. |
| `/account/rules` | Referências não ajudavam a criar/revisar regras. | Removido o identificador recolhido; fonte e contraste compartilhados. | `02-rules-*`, `18-rule-detail-light-391` | Nenhuma regra privada foi criada. |
| `/account/groups` | Detalhes tinham hierarquia diferente. | Rótulos/valores e espaçamento unificados; referência genérica removida. | `03-groups-*`, `04-group-detail-light-391` | Categorias/etiquetas continuam sob demanda. |
| `/account/sync` | Metadados técnicos ocupavam o detalhe. | Removidos referência e contador interno de etapas; acesso Pluggy, fase disponível, encerramento e recuperação permanecem. | `05-sync-*`, `06-sync-detail-light-391` | Sem nova importação externa ou falha provocada. |
| `/account/audit` | Referência genérica e concordância da falha. | Sem seção técnica; identidade do aplicativo fica no detalhe da autorização; mensagem usa singular/plural correto. | `07-audit-*` | Não há autorização na fixture; detalhe de uma autorização não foi reaberto nesta rodada. Nenhum acesso concedido/revogado. |
| `/account/connections` | Tipografia precisava acompanhar o sistema. | Inter e contraste compartilhados; composição compacta mantida porque já atende à tarefa. | `08-people-*` | Credenciais, widget, importação e chave gerada não foram exercitados novamente nesta rodada. |
| `/account/design-system` | Faltava um contrato visual de tipografia por função. | Espécimes reais de interface, editorial, dinheiro e código; acentos e valores exatos. | `09-design-reference-*`, `10-type-specimen-*`, `11-value-specimen-light-997` | Exemplos intencionais de loading/erro não significam falha da página. |
| `/demo` | Precisava receber as mesmas remoções da visão geral. | Mesmo FinancialDashboard e tokens; valores/categorias exatos mantidos. | `12-demo-overview-*` | Fixtures somente. |
| `/demo/transactions` | Leitura densa de nomes, estados e moedas. | Mesmo tema, lista e detalhe; pendentes/futuros preservados. | `13-demo-transactions-*` | Sem paginação remota. |
| `/demo/cards` | Política e escala deviam coincidir com produto. | Mesmo CardsDashboard, sem Critérios. | `14-demo-cards-*` | Fixtures, sem fatura bancária real. |
| `/demo/investments` | Detalhes de posição usavam outra escala. | Grade de detalhes com rótulo 14 px, conteúdo 16 px e grupos consistentes. | `15-demo-investments-*`, `16-investment-detail-light-391` | Dados informados, sem cotações ao vivo. |
| `/demo/rules` | Texto e detalhes deviam coincidir com produto. | Mesma composição de regra e tokens; referência técnica removida. | `17-demo-rules-*`, `18-rule-detail-light-391` | Consequências de reaplicar continuam visíveis. |
| `/demo/groups` | Precisava acompanhar os detalhes do produto. | Mesma OrganizationView e tema. | `19-demo-groups-*` | Dados temporários da sessão. |
| `/` | Landing precisava de voz editorial própria. | Source Serif 4 no hero/seções; apoio 18 px no hero; prévia e controles em Inter. | `28-landing-*`, `29-landing-costs-*`, `30-landing-hero-dark-1280` | Card social/favicon mantêm Inter; nenhum deploy. |
| `/account/login` | Acesso deve continuar reconhecível como formulário. | Inter 16/14 e contraste compartilhados; estrutura preservada. | `34-login-*` | Entrada sintética confirmada; senha/chave real não acessadas. |
| `/authorize` | Consentimento precisa permanecer claro e sem scripts. | Inter, entrelinha e cores do tema estático; texto e ações explícitos preservados. | `32-consent-dark-{997,391}` | Só leitura; sem autorizar. Tema claro indisponível por CSP. |
| 404 do site público | Documento funcional precisa acompanhar a leitura do produto. | Inter e tokens compartilhados; ação de retorno preservada. | `33-not-found-*`, documento `dist/site/404.html` em 8918 | Conferência estática; o fallback HTTP de produção Pages não foi exercitado. O Worker local devolve 404 simples para uma rota estática desconhecida. |

### Evidências e limites

A seleção aceita está em `.wrangler/typography-review-20261026/final/`:
`captures.json` contém URL, tema e dimensões; `gallery.html` mostra as imagens;
`type-readings.json` registra estilos calculados; `contrast-readings.json` contém
as razões dos pares medidos. As capturas iniciais ficam na pasta pai.
Capturas de outra aba, primeiros frames de redimensionamento e imagens com
escala/corte inconsistente foram rejeitadas. Não contam como prova de layout.

Amostra preservada no repositório, somente com dados sintéticos:

- [Landing](docs/qa/2026-10-26-typography-landing-dark.jpg)
- [Conta e cartão](docs/qa/2026-10-26-typography-account-light.jpg)
- [Referência tipográfica](docs/qa/2026-10-26-typography-reference-dark.jpg)

Reflow em 320 CSS px foi confirmado na lista e no detalhe de transações;
320 px é uma prova de reflow, não de zoom nativo a 200%. O controle de teclado
nativo alterou a geometria da superfície de captura, portanto zoom a 200%
permanece para conferência manual. Foco visível foi observado no link de
transações da conta; não houve uma nova passagem completa de leitor de tela,
reduced motion ou todos os estados de erro/hover. Não se declara conformidade
WCAG integral com esses pares de contraste e capturas.

Fontes e composições são do produto inteiro; Kumo continua responsável por
controles e interação. Ajuda contextual conserva política financeira; erros,
parcialidade, consentimento, revisão/idempotência e dinheiro exato permanecem.
A instalação POC 8914 não foi alterada; nada foi publicado nesta rodada.


### Checks da entrega

`mise run check` concluiu com exit 0 na árvore final de código: tipos, formato,
lint, 103 testes Node, 173 testes de integração em 30 arquivos, build do portal,
dry-run do Worker e runtime D1/Workflow local. O runtime incluiu 10 mil e 100 mil
registros sintéticos, falha/retry, acumulação e reinício com banco preservado.
Log: `.wrangler/typography-review-20261026/check-delivery.log`.

O teste existente de leitura de transações foi ajustado ao novo contrato de
ocultar IDs da interface; continua verificando valor, direção, categoria e
identidade. Não foram criados testes que inspecionam fontes/configurações.
`git diff --check` também passou. Mudanças anteriores no checkout foram
preservadas. Resultado local/sintético; sem Pluggy, OAuth em host externo,
publicação GitHub ou deploy nesta rodada.

## Refinamentos de composição — 26/10/2026

Rodada dos nove comentários em Cartões, painel, navegação móvel e landing.
Mudanças aplicadas aos componentes do produto e da demo; a POC 8914 permanece
isolada. As evidências desta rodada ficam em
`.wrangler/ui-refinements-20261026/`; as últimas conferências de teclado e
reflow ficam em `.wrangler/theme-review-20261026/`.

| Página / estado | Problema | Decisão e alteração | Evidência aceita | Pendência / limite |
| --- | --- | --- | --- | --- |
| Visão geral, Cartões e Investimentos, produto e demo | Títulos ora dentro, ora fora das superfícies. | `AnalysisSection` coloca título, moeda e ajuda fora do LayerCard; limites e compras mantêm seus níveis próprios. | `account-cards-wide-light-1280.jpg`, `account-overview-{light,dark}-1280.jpg`; `investments-final-{light,dark}-1280.png` na pasta da revisão de temas. | Carteira populada verificada com fixtures; não houve consulta a provedor real. |
| Avatares de conta, pessoa e bandeira | Sobreposição sem separação suficiente; hover pouco polido. | Linha discreta, anel da superfície e contorno imediato sem alterar tamanho; avatar sob o ponteiro vem à frente. | `account-card-avatar-hover-light-674.jpg`; SVG do banco e bandeira carregados, tamanho preservado. | Tema escuro compartilha a regra; nenhuma inferência de logo por nome. |
| Navegação do produto e demo, desktop/móvel | Lista longa sem agrupamento. | Grupos nativos Finanças / Organização / Instalação; demo tem grupo próprio. | `demo-grouped-navigation-light-674.jpg`, `account-grouped-navigation-dark-674.jpg`. | Páginas continuam acessíveis sem abrir um grupo intermediário. |
| Cartões: compra parcelada expandida | Só a parcela do mês aparecia. | Consulta exata da compra no escopo; tabela compartilhada com avatares, datas, valores, lançamento e pagamento da fatura. | `demo-card-purchase-dark-1280.jpg`, `demo-card-purchase-mobile-final-light-674.jpg`, `demo-card-purchase-mobile-dark-674.jpg`; `installment-header-final-light-320.png`. | Só parcelas recebidas. Confirmada não significa paga; desconhecido permanece explícito. |
| Detalhe de transação parcelada | Faltava a compra completa no detalhe. | Mesma tabela e leitura sob demanda com carregamento, falha e retry; abertura pela linha continua funcional. | `demo-transaction-installment-list-{light,dark}-674.jpg`; clique na célula de data abriu o detalhe com 12 parcelas. | Fixtures de maio/2026 a abril/2027; três faturas sintéticas pagas, futuras sem pagamento inventado. |
| Séries e seleção mensais | Linha afastada das pontas; janela fixa. | Extremos alinhados e janela acessível; seletor compartilhado usa rascunho, Cancelar e Ver mês. | `demo-period-picker-dark-674.jpg`, `demo-transaction-month-draft-dark-674.jpg`; `monthly-keyboard-dark-1280.png`. | Home/End alternou maio–julho e agosto–outubro. Mês anterior/próximo restaurou a janela correta; a tabela conserva todos os valores. |
| Cabeçalho móvel | Marca sem link e ausência de atualização dos dados. | Marca leva à visão geral mantendo recorte; atualização vem da importação concluída. Demo identifica a data como exemplo. | `account-cards-{light,dark}-674.jpg`; produto mostrou 25/10/2026, 09:05; demo “Exemplo de 24/10/2026”. | Não usar hora de renderização como atualização. |
| Landing: FAQ | Marcador textual e aparência fora do Kumo. | Collapsible nativo, caret SVG, linha inteira acionável; fallback HTML funcional. | `landing-faq-final-mobile-light-light-674.jpg`, `landing-faq-final-mobile-dark-dark-674.jpg`; padding calculado 16 × 20 px. | Sem nova passagem integral de leitor de tela. |
| Landing: Código aberto | Link GitHub duplicado sob os CTAs. | Ícone GitHub com currentColor junto de Código aberto; link inferior removido. | `landing-hero-final-{light,dark}-1280.jpg`; cor calculada do SVG acompanha o texto. | Nenhuma publicação de site nesta rodada. |

Capturas com escala/corte inconsistente (1067/562/267 CSS px), primeiros frames
em branco e imagens que voltaram ao hero após alternar tema foram rejeitadas.
Não são prova das dimensões pretendidas. A conferência final em 320 CSS px não
teve rolagem horizontal da página nem quebras isoladas no nome da compra.

Validação do comportamento: testes focados de workspace/cartões passaram
(19 testes em dois arquivos), incluindo consulta exata, escopo da conta e
evidência bancária/manual/ausente de pagamento. Node passou com 104 testes.
O `check-delivery.log` desta rodada registra uma suíte completa aprovada com
174 testes de integração; a validação final após o ajuste adicional dos temas
será registrada separadamente abaixo. Capturas locais e testes sintéticos não
comprovam Pluggy, OAuth externo ou produção.

## Equilíbrio de temas — 26/10/2026

Etapa adicional solicitada após os nove refinamentos. A diferença observada não
exigia sombras isoladas em cada página: canvas e base eram próximos demais no
claro, os contornos tinham pouca presença e a sombra inline do Dialog era fixa
em 3%. A correção está na fundação compartilhada de `styles/design.css` e no
adaptador `WorkspaceDialog`, preservando os componentes, rings e foco do Kumo.

Claro: fundo cinza neutro, superfície branca, divisores e contornos distintos.
Escuro: fundo carvão, faixas discretas e conteúdo mais claro. Elevação curta em
conteúdo, maior em sobreposições, com opacidade adequada a cada modo. Texto de
aviso claro foi escurecido após medir aproximadamente 3,7:1 no token anterior.
Inter, Source Serif 4, semântica financeira, logos e tamanhos permanecem nos
papéis já documentados. DESIGN.md, AGENTS.md e docs/design-system.md registram
os tokens, escala e critérios; a referência visual demonstra superfícies reais.

### Cobertura por página e superfície

Esta é uma revisão de tema sobre a jornada já revisada acima. “Compartilhado”
indica propagação pelo mesmo componente/documento, sem alegar uma nova passagem
manual em todos os seus estados. Capturas estão em
`.wrangler/theme-review-20261026/`; os nomes abaixo sem extensão são PNG.

| Página / superfície | Alteração / decisão | Conferência desta etapa | Evidência / limite |
| --- | --- | --- | --- |
| `/account` | Canvas, resumo, análises, tabela, navegação e metadados compartilham tokens. | Claro/escuro em 1280 e 674 CSS px; vazio e transação sintética. | `account-overview-theme-*`, `account-overview-theme-mobile-*`. |
| `/account/transactions` | Tabela e detalhe usam a mesma superfície; modal recebe elevação de sobreposição. | Claro/escuro 1280; o mesmo detalhe foi reaberto pela visão geral a 674. | `transaction-dialog-theme-*`, `transaction-dialog-final-mobile-*`; nenhuma categoria gravada. |
| `/account/cards` | Gastos, limites e edição persistente usam a fundação; títulos continuam externos. | Claro/escuro 674, gráfico preenchido e limite; editor claro aberto/cancelado. | `account-cards-theme-mobile-*`, `account-card-limit-theme-mobile-light-674`, `card-limit-dialog-theme-mobile-light-674`. |
| `/account/investments` | Mesmos AnalysisSection, FinancialMetric e LayerCard. | Propagação compartilhada; vazio já visto na revisão anterior. | Carteira preenchida conferida nos dois modos em `/demo/investments`; não consultou provedor. |
| `/account/rules` | Editor/importação conserva uma superfície e ações nativas. | Importar regras aberto/cancelado nos dois modos, 1280. | `rules-import-theme-*`; nenhum arquivo importado. |
| `/account/groups` | Grupo expandido mostra rótulos e ações com contraste compartilhado. | Claro/escuro 1280. | `groups-theme-*`; nenhuma gravação. |
| `/account/sync` | Expansão usa a mesma superfície e leitura secundária. | Claro/escuro 1280, rodada Nubank expandida. | `sync-theme-*`; nenhuma sincronização externa iniciada. |
| `/account/audit` | Aviso claro mais escuro; fundo, vazio e atividade consistentes. | Claro/escuro 1280; aviso final medido e visto em 674. | `audit-theme-*`, `audit-warning-final-mobile-*`; nenhuma autorização concedida/revogada. |
| `/account/connections` | Pessoas, logos, ações e linhas usam tokens comuns. | Claro/escuro 1280 no estado com dois bancos. | `people-theme-*`; credenciais/widget/importação não repetidos nesta etapa. |
| `/account/design-system` | Paleta real, exemplo de LayerCard e Popover; confirmação e campos existentes. | Claro/escuro 1280 e 320; foco do campo visível, modal cancelado, Popover fechado por Escape. | `reference-{popover,dialog,field-focus}-*`, `reference-{popover,dialog}-compact-*`. |
| `/demo` | Mesmos resumos, tabelas, gráficos e seleção mensal. | Gráfico e slider nos dois temas em 1280; Home/End e janela preservada. | `monthly-theme-final-*`; Home/End alternou maio–julho / agosto–outubro. |
| `/demo/transactions` | Mesmo ledger, diálogo e tabela de parcelas. | Jornada e rascunho mensal verificados na rodada dos nove; tema propagado pelo mesmo componente. | `demo-transaction-installment-list-*` na pasta dos refinamentos; sem nova mutação nesta etapa. |
| `/demo/cards` | Compra completa recebida e pagamento continuam distintos. | Claro/escuro 1280 e 320, 12 parcelas e três faturas sintéticas pagas. | `installments-theme-final-*`, `installments-theme-final-compact-*`; sem overflow da página ou do workspace. |
| `/demo/investments` | Carteira e donuts usam as mesmas superfícies e títulos externos. | Claro/escuro 1280, carteira preenchida. | `investments-theme-final-*`. |
| `/demo/rules` | Organization/RuleEditor e tokens idênticos ao produto. | Compartilhado; jornada populada foi vista na revisão anterior. | Não houve nova passagem manual em todas as composições de regra. |
| `/demo/groups` | OrganizationView e tokens idênticos ao produto. | Compartilhado; detalhe equivalente visto em `/account/groups`. | Nenhuma edição temporária adicional. |
| `/` e instalação pública | Hero, prévia, exemplos e FAQ usam a mesma fundação; Source Serif 4 preservada. | Claro/escuro 1280; FAQ aberto nos dois temas em 674. | `landing-theme-wide-*`, `landing-faq-theme-wide-*`, `landing-faq-theme-mobile-*`; botão de deploy não acionado. |
| `/account/login` | Formulário e LayerCard conservam contraste e foco nativos. | Claro/escuro 1280 e 674; login local sintético concluído. | `login-theme-*`, `login-theme-mobile-*`; nenhum acesso real usado. |
| `/authorize` | Document compartilha o tema escuro; consentimento conserva sua CSP sem scripts. | Propagação do tema estático; não houve novo consentimento. | Tema claro continua indisponível por contrato; conferência anterior não equivale a uma nova autorização. |
| 404 público | Document e assets do build recebem a mesma fundação. | Compartilhado, sem nova conferência do fallback HTTP. | O limite de validação do 404 descrito acima permanece. |

### Medições e evidências aceitas

`theme-readings.json` registra os tokens lidos do CSS no navegador.
`contrast-readings.json` calcula luminância relativa com esses valores e
composição alfa em sRGB. Sobre a superfície: corpo **17,91:1** / secundário
**5,86:1** no claro; corpo **16,12:1** / secundário **8,49:1** no escuro. No canvas
claro o secundário conserva **5,22:1**. Aviso claro sobre o tint usado ficou em
**5,94:1**, escuro em **7,28:1**. Esses pares não certificam todos os controles,
gradientes, estados, leitor de tela ou conformidade WCAG integral.

Estilos calculados confirmaram ring + sombra curta no LayerCard, `shadow-md`
temático no Popover e `shadow-dialog` no Dialog, sem moldura adicional. O campo
conservou 16 px e ring de foco de 1,5 px. Capturas em 320/674/1280 registram as
dimensões reais. Frames de escala inconsistente e capturas ainda carregando o
gráfico foram rejeitados como prova do estado preenchido.

Amostras preservadas, somente com dados sintéticos:

- [Painel claro](docs/qa/2026-10-26-theme-account-light.png)
- [Painel escuro](docs/qa/2026-10-26-theme-account-dark.png)
- [Parcelas no claro](docs/qa/2026-10-26-theme-installments-light.png)
- [Modal no claro](docs/qa/2026-10-26-theme-dialog-light.png)
- [Landing no claro](docs/qa/2026-10-26-theme-landing-light.png)

### Validação final

`mise run check` passou: tipos, formato, lint, **104 testes Node**, **174 testes
de integração em 30 arquivos**, build, dry-run do Worker e runtime nativo
D1/Workflow com 10 mil/100 mil registros, retry, falha parcial e reinício com
banco preservado. Log: `.wrangler/theme-review-20261026/check-final.log`.
Após o último ajuste isolado no token laranja claro, `check:quick` e
`build:portal` passaram novamente; o resultado foi conferido no aviso real do
preview (`check-quick-warning.log`, `build-portal-final.log`). Não foram criados
testes que apenas reproduzem CSS ou configuração.

Resultado local/sintético, aplicado ao código do produto, demo e landing.
POC 8914 não alterada. Sem publicação GitHub, deploy, migração remota ou consulta
a bancos reais nesta rodada. A cobertura não repete todos os erros externos,
retomadas e estados de autorização já delimitados nas etapas anteriores.


## 26/10/2026 — contorno externo e filtros por avatar

Esta revisão substitui a decisão anterior de anéis entre os círculos e de elevar
o avatar apontado. Produto e demo usam `AvatarStack`: contorno de 0,75 px somente
nos arcos externos, 1,5 px em hover/seleção, 2 px no foco por teclado. As
interseções ficam sem borda. A geometria e a ordem das camadas permanecem fixas.

Pessoa seleciona titular; instituição reúne todas as contas pelo ID normalizado;
bandeira reúne os cartões correspondentes, inclusive em instituições diferentes.
Os filtros se combinam, conservam período/grupo/moeda/busca, removem conta
individual e cursor e têm controles para desfazer a seleção. Dados sem identidade
conhecida mantêm fallback estático; não inferimos banco pelo nome da conta.

| Página/estado | Problema e decisão | Alteração | Evidência local | Limite |
| --- | --- | --- | --- | --- |
| `/account` | Avatar competia com o botão de expansão; banco não tinha seleção própria. | Links independentes do trigger, recorte antes dos totais e gráfico. Nubank reúne conta e cartão; Santander sai do recorte. | `account-bank-light-674.png`; URL/DOM observados; zero links aninhados em botões. | Instalação sintética. |
| `/account/transactions` e detalhe | Clique no avatar deveria filtrar sem abrir detalhe. | Banco e bandeira geram chips; o clique na data abre o modal; o avatar no modal fecha o detalhe ao navegar. | `transactions-bank-brand-{light,dark}-674.png`; período/grupo/moeda preservados e zero controles aninhados. | Nenhuma categoria ou transação gravada. |
| `/account/cards` | Seleção por banco/bandeira precisava refletir contas e totais. | Consulta privada seleciona identidades antes da atividade/paginação. | `account-cards-{light,dark}-1280.png`; Nubank + Mastercard na URL e nos chips. | Fixture com um cartão; múltiplos cartões/bancos cobertos em D1 sintético. |
| `/account/investments` vazio | Um filtro sem resultado precisava permanecer removível. | Identidade chega à consulta e os chips permanecem no vazio. | `account-investments-empty-light-1280.png`; “Nenhum investimento neste recorte”. | Fixture sem posições; estado preenchido validado na demo. |
| `/demo` | Recorte precisava alimentar toda a visão, não apenas os avatares. | `scopedDemoData` compartilhado por contas, lançamentos, resumo e série mensal. | `demo-overview-bank-light-1280.png`; instituição 201 reúne conta, reserva e cartão. | Simulação em memória. |
| `/demo/transactions` | Navegação poderia perder o banco escolhido. | Escopo retido nos links financeiros e formulários GET. | `demo-transactions-bank-{light,dark}-1280.png`; 16 registros e URL com instituição/período/moeda. | Demo sem paginação de servidor. |
| `/demo/cards`, parcelas e vazio | Sobreposição/hover precisavam manter a expansão independente. | Avatares fora do trigger; tabela conserva seus links; pessoa + bandeira sem interseção mostra vazio recuperável. | `cards-light-1280.png`, `cards-light-320.png`, `cards-dark-focus-320.png`, `cards-person-filter-dark-320.png`; foco calculado de 2 px e sem overflow a 320. | Pagamento e limite não foram alterados. |
| `/demo/investments` | Valor quebrava em colunas estreitas a 674 px. | Grade por largura do container; links de instituição/titular fora da expansão. | `investments-final-{light,dark}-674.png`, `investments-final-dark-320.png`; filtro Itaú mantém quatro posições e não há overflow. | Detalhes e dados financeiros preservados. |
| `/account/design-system` | Faltava exemplo real dos novos alvos. | Seção “Avatares e filtros”, com três links reais para a demo. | `reference-hover-{light,dark}-1280.png`, `reference-focus-dark-1280.png`; hover observado de 1,5 px e demais arcos a 0,75 px. | Exemplo sintético. |
| Seletores e páginas auxiliares | Links dentro de opções/triggers criariam interação aninhada. | `AccountIdentity` permanece estático nos seletores; rotas não financeiras não produzem filtros. | Tipos/lint e inspeção DOM das superfícies financeiras; contratos de rotas testados. | Não foi repetida a auditoria global do onboarding/landing; a POC isolada não mudou nesta revisão. |

Capturas em `.wrangler/avatar-filters-20261026/`; cinco exemplos também em
`docs/qa/2026-10-26-avatar-*.png`. Os registros antigos “investments-bank-*” foram
substituídos pelas capturas “investments-final-*” após a correção do reflow.

Validação: `mise run check` completo retornou **0** (registrado em
`.wrangler/avatar-check-exit.json`): **107 testes Node, 176 integrações em 31
arquivos, build/dry-run e runtime nativo com 10 mil/100 mil registros e reinício**.
O ajuste final somente de CSS passou novamente por `check:quick`, build e navegador.
O invólucro do terminal reportou sinal 143 após o fim, mas o subprocesso isolado
registrou retorno 0; os testes e o runtime terminaram com zero falhas.

Novos testes cobrem aliases de bandeiras, metadados ausentes, preservação de URL,
paridade da demo, agrupamento por banco entre contas, bandeira entre instituições,
interseção com titular, 72 registros através de três páginas, invalidação de
cursor, resumo/série no mesmo escopo e identidade efetiva após edição persistida.
O fixture D1 fornece metadados de instituição normalizados; esta validação não
comprova autorização ou enriquecimento de bancos no provedor real.

Preview local: `http://localhost:8916`. Nenhum deploy, push, migração remota ou
alteração em dados financeiros reais foi realizado nesta revisão.


## 26/10/2026 — respiro nas parcelas, filtros e cards de posições

Escopo: os três comentários de navegador recebidos a 490 × 657 px. O pedido
posterior de afinar os avatares foi cancelado pelo usuário antes de qualquer
alteração; o contorno conserva 0,75 px, 1,5 px em hover/seleção e 2 px no foco.

Revisão crítica pelo agente `designer_critica_espacamento`, usando Kumo,
AGENTS/DESIGN e capturas atuais. A primeira passagem confirmou as três causas;
a segunda aprovou filtros e cards e pediu pagamento em linha inteira a 320 px.
O ajuste foi aplicado e verificado. Não houve nova auditoria global do produto.

| Etapa / saúde final | Problema observado | Decisão e alteração | Evidência atual | Limite |
| --- | --- | --- | --- | --- |
| 1. Parcelas — corrigido | Faixa móvel sem padding horizontal; avatar e valor encostados na borda. | Table nativa conserva a superfície da compra; cada linha móvel recebe padding de 16 px e gap de 12 × 16 px. Até 280 px de container, status e pagamento ocupam linhas inteiras. | `02-before-installments-490.png` → `05-after-installments-light-490.png`; escuro em `06-after-installments-dark-490.png`; final a 320 em `13-final-installments-dark-320.png` e `14-final-installments-light-320.png`. | Só parcelas já recebidas; valores/status/pagamento não foram alterados. |
| 2. Filtros — corrigido | PersonStack era filho do Toolbar e parecia um segmento espremido do botão. | Avatares passam a ser irmãos do Toolbar, num grupo com gap de 12 px e quebra de linha. Filtros/Limpar conservam o componente nativo e largura intrínseca. | `03-before-filters-490.png` → `04-after-filters-light-490.png`; `08-after-filters-dark-320.png`; DOM confirmou zero PersonStack dentro de Toolbar. | O formulário GET e a contagem de filtros permanecem iguais. |
| 3. Posições — corrigido | Registros estavam soltos no canvas, separados apenas por divisores. | LayerCards nativos irmãos com gap de 16 px; título externo. Insets de 16 × 20 px no desktop e 16 px no móvel, preservados no painel expandido. | `01-before-investments-490.png` → `10-after-investments-light-490.png`; abertura `09-after-investment-expanded-light-490.png`, foco `11-after-investment-focus-light-490.png`; escuro `12-after-investments-dark-490.png`; finais a 320/1280 em `15`/`16`/`17`. | Sem LayerCard aninhado; a grade e valores continuam comparáveis no desktop. |

Capturas aceitas e inspecionadas em `.wrangler/spacing-review-20261026/`;
exemplos de entrega também em `docs/qa/2026-10-26-spacing-*.png`. A captura
`07-after-installments-dark-320.png` foi substituída por `13-final-*` após a
crítica sobre quebra do texto de pagamento.

Os componentes são compartilhados pelo produto e pela demo: WorkspaceFilters,
InstallmentTable (Cartões e detalhe de transação) e InvestorDashboard. A validação
visual desta revisão usou a demo com dados sintéticos, a 320, 490 e 1280 px,
nos dois temas. Foram conferidos expansão por Enter, foco visível, abertura e
fechamento de Filtros e filtro por avatar: Ana mostra quatro posições, limpar
retorna às seis; o clique no avatar não expande o card. DOM confirmou ausência
de links dentro de botões e ausência de overflow horizontal. Isso não equivale
a uma auditoria completa de leitor de tela ou conformidade WCAG.

`mise run check` retornou **0**, registrado em `.wrangler/spacing-check-exit.json`:
**107 testes Node, 176 integrações em 31 arquivos, build/dry-run e runtime com
10 mil/100 mil registros e reinício**. Depois do último ajuste somente de CSS a
320 px, `check:quick`, build e navegador foram executados novamente, com sucesso.
Diretrizes ajustadas em DESIGN.md, AGENTS.md, docs/design-system.md e docs/cards.md.
Nenhuma alteração em dados reais, deploy, push ou POC isolada nesta revisão.


Capturas da revisão, em ordem:

1. Parcelas — padding lateral/vertical corrigido, sem alterar o estado financeiro.

![Parcelas com respiro](docs/qa/2026-10-26-spacing-installments-light.png)

2. Filtros — avatares separados do grupo nativo de ações.

![Filtros com separação entre identidade e ações](docs/qa/2026-10-26-spacing-filters-light.png)

3. Posições — LayerCards irmãos com título externo e expansão alinhada.

![Posições em cards](docs/qa/2026-10-26-spacing-investments-light.png)

## 26/10/2026 — tooltips, sincronização, importação e fluidez no cliente

Escopo desta rodada: os quatro comentários finais e os caminhos de carregamento
compartilhados pelo produto, demo e landing. O diretório da POC não foi alterado.
O contorno dos avatares foi preservado. Esta seção não declara uma nova auditoria
visual integral do onboarding ou do produto.

| Página / estado | Problema | Decisão e alteração | Evidência | Pendência / limite |
| --- | --- | --- | --- | --- |
| Investimentos — preenchido / tooltip | Texto do hover parecia transparente; o shell da demo carregava código financeiro e editores de outras páginas. | Tooltip HTML opaco, texto/borda do tema e resposta imediata; demo financeira em módulo próprio. Canvas só monta perto da tela, preservando legenda e altura. | `2026-10-26-client-investments-tooltip-light.png`, `2026-10-26-client-investments-tooltip-dark.png`; ambas a 490 px. | Produto sintético sem investimentos conferido como vazio a 1280 px. Não foram consultadas posições reais. |
| Visão geral — preenchido / mensal / vazio | Gráfico abaixo da dobra era inicializado imediatamente; havia botão de recarga. | `ChartViewport` posterga o canvas; recarga removida. Série e valores exatos mantidos. | Demo a 490 px: zero canvases com mensal a 972 px da borda superior; gráfico apareceu ao rolar. `2026-10-26-client-monthly-tooltip-light.png`. Produto a 1280 px com vazios reais do fixture. | Sem mudança na consulta financeira nem em valores/status. |
| Cartões — preenchido / vazio de parcelas | Recarga redundante e tooltip com o mesmo problema. | Mesma política de tooltip/montagem; botão removido. Limite, parcela e ações reais preservados. | Produto sintético a 1280 px: compras, limite e vazio de parcelas carregados; `product-routes.json` no registro local. | A semântica financeira não mudou; os testes de parcelas e limite continuam na suíte. |
| Transações — listagem / detalhe / categoria | Botão redundante; código carregado antes de entrar na rota da demo. | Botão removido e rota financeira separada do shell. Ações continuam distintas da abertura da linha. | Produto a 1280 px; demo a 490 px: categoria abriu, cancelar voltou à lista e clique na célula de data abriu o detalhe de Farmácia. | Nenhuma categoria real foi alterada na validação. |
| Regras — importar / falhar / recuperar / cancelar / concluir | Importar não estava disponível na demo. | Mesmo RuleImporter do produto; preview e gravação local, com revisão, recibo e fila de escritas. Resolver de categorias do domínio; regras existentes/edições e histórico preservados. Seletor corrigido para reflow a 320 px. | JSON inválido recuperado com arquivo válido; confirmação adicionou Livraria QA; cancelar pediu descarte. `2026-10-26-client-rules-import-dark-320.png` e `2026-10-26-client-rules-import-confirmed.png`. | JSON de teste sintético. Não foi importado um pacote no D1 do produto. |
| Grupos — preenchido | Nenhum problema novo no formulário. | Sem alteração específica; continua com carregamento por rota e shell compartilhado. | Produto a 1280 px abriu grupo Pessoal e categorias; testes de isolamento/edição/reset da demo passaram. | Formulário não precisava de uma nova variação visual. |
| Sincronizações — histórico preenchido | Recarga redundante. | Removida; mudanças da origem invalidam cache e notificam recursos montados. | Produto a 1280 px abriu dois registros concluídos, sem recarga. Testes do monitor verificam pausa em aba oculta, retomada e backoff. | Não foi iniciada uma sincronização com provedor real. |
| Auditoria MCP — preenchido / vazio de assistentes | Recarga redundante. | Removida, preservando consultas e revogação explícita. | Produto a 1280 px abriu atividade e vazio de assistentes, sem recarga. | Nenhum acesso foi revogado. |
| Pessoas / importação — conexões preenchidas | Botão de atualizar progresso sem tarefa útil. | Removido; sincronização bancária e retry reais preservados. | Produto a 1280 px abriu pessoas/conexões e o caminho Importar. | Não foram repetidos cadastro, credenciais ou autorização externa; seu layout não mudou nesta rodada. |
| Shell — mobile / desktop / teclado / hover | Data só aparecia em tela pequena e ocupava espaço. | Relógio com Popover Kumo: topo móvel e rodapé da Sidebar no desktop. Loader depende de pending/running; verde expira três minutos após conclusão recebida; falha/indisponibilidade são distintas. Demo identifica sua data fictícia. | Clique, Enter e hover abriram a data; produto mostrou 25/10/2026 09:05, proveniente do snapshot. `2026-10-26-client-clock-mobile-dark.png` e `2026-10-26-client-clock-desktop-light.png`. | Progresso, falha e expiração cobertos por testes determinísticos; não foi fabricado progresso no preview. |
| Landing — hero / MCP / performance / regra / FAQ | As ilhas partilhavam o mesmo módulo e inicializavam dependências desnecessárias. | Entradas independentes, HTML estático preservado, helper de resultado sem cliente HTTP; entradas de 220/160 ms. | Hero a 320 px nos dois temas; primeira área com cerca de 5 KB de JS. MCP trocou para Claude, performance para 10 mil e regra para restaurante sem correspondência; FAQ abriu nos dois temas. | Nenhum dado ou fluxo de instalação foi publicado. |
| Autenticação / referência visual / POC | Nenhuma mudança de tarefa necessária. | Login existente preservado; referência continua usando tokens reais. Guias recebem a nova política de movimento e sincronização. POC isolada permanece intacta. | Login sintético no produto funcionou; AGENTS/DESIGN/guia atualizados. | Não constitui repetição da auditoria anterior dessas superfícies. |

### Medição local

A ferramenta disponível não expõe trace do Chrome, Lighthouse ou throttling.
Usei um observador temporário somente nos assets do preview, com FCP/LCP/CLS,
long tasks, recursos e dois frames após navegação. A instrumentação e seus
controles são retirados do preview ao concluir; ficam fora do código distribuído.
Os registros brutos estão em `.wrangler/client-perf-20261026/`.

| Medida — demo Investimentos | Antes | Depois | Interpretação |
| --- | --- | --- | --- |
| Arquivos JavaScript solicitados na carga | 81 | 60 | 21 arquivos a menos; não é a contagem de todas as rotas combinadas. |
| JS sem compressão dos recursos observados | 1,76 MB | cerca de 1,51 MB | Aproximadamente 14% menor, incluindo bibliotecas do gráfico. |
| Gzip calculado por arquivo | 588,5 KB | cerca de 504 KB | Tamanho potencial de transporte; não confundir com bytes de uma navegação em cache. |
| FCP / LCP | 276 / 656 ms, uma amostra | 188 / 536 ms, mediana de três cargas | Dados locais com cache, 490 × 657; amostras insuficientes para alegar melhoria de percentis ou Core Web Vitals de campo. |
| CLS após alteração | — | 0,000246 | Três cargas; não equivale a uma certificação de ausência de saltos em todas as páginas. |
| Navegação fria para Regras | 377 ms | 369 ms | Tempo observado até dois frames de conteúdo; não é INP. |

A landing mediu FCP/LCP de 280 ms e CLS zero nessa amostra local. Antes das ilhas,
foram observados `landing.js` (3.191 B), helper do Vite (1.519 B), resultado (190 B)
e bootstrap de tema; React, Flow e editor de regra não estavam na primeira carga.
Não foi feito benchmark equivalente da versão anterior da landing.

Telas a 320/490/1280 CSS px foram usadas conforme a matriz. Tooltips claro/escuro
apresentaram opacidade 1 e cores do tema; reflow do modal a 320 px ficou sem
scroll horizontal. Movimento reduzido continua previsto em CSS e no estado
acessível; a ferramenta não permitiu emular a preferência do sistema nesta rodada.

A dependência de `crypto.subtle.digest` foi retirada da importação sintética:
IDs de prévia/gravação são mantidos por aba usando getRandomValues, compatível
com HTTP. Há regressão com digest indisponível. O endereço LAN antigo
192.168.1.16:8916 não pôde ser alcançado pelo navegador desta sessão; a evidência
visual e funcional foi colhida em localhost:8916.

Validação final: `mise run check` retornou **0**, registrado em
`.wrangler/client-perf-20261026/check-exit-final.json`: **113 testes Node,
176 integrações em 31 arquivos, build/dry-run e runtime de 10 mil/100 mil
registros com reinício e persistência**. O invólucro do terminal pode reportar
sinal 143 depois da conclusão; o subprocesso isolado registrou retorno 0. Não há comando `test:sites` neste repositório;
`mise run check` agrega tipos, formatação, lint, testes Node, integrações,
build/dry-run e runtime local. Validação local não comprova produção, OAuth,
Pluggy nem um host MCP externo. Nenhum deploy, push ou dado financeiro real foi
alterado nesta rodada.

Referências de API usadas: [React lazy](https://react.dev/reference/react/lazy),
[ECharts TooltipHTMLContent](https://github.com/apache/echarts/blob/master/src/component/tooltip/TooltipHTMLContent.ts)
e a implementação instalada do Kumo 2.14.0.


Capturas representativas desta rodada:

![Tooltip claro com superfície opaca](docs/qa/2026-10-26-client-investments-tooltip-light.png)

![Tooltip escuro com superfície opaca](docs/qa/2026-10-26-client-investments-tooltip-dark.png)

![Importação de regras com reflow a 320 px](docs/qa/2026-10-26-client-rules-import-dark-320.png)

## 26/10/2026 — paridade entre produto e demo na importação de regras

A interface já era compartilhada, mas `web/demo-rule-import.ts` repetia a
orquestração de importação do Worker. Essa implementação foi removida. Agora os
dois adaptadores usam `prepareRuleImport`, em `domain/rule-import.entity.ts`,
para resolver categorias, planejar criações e reconhecer regras existentes.
O plano não grava dados; o Worker conserva referências, revisão, IDs persistidos
e transação D1, enquanto a demo grava somente na memória da aba. O contrato
JSON público e o `RuleImporter` permanecem os mesmos.

| Página / estado | Problema | Decisão / alteração | Evidência | Pendência / limite |
| --- | --- | --- | --- | --- |
| `/account/rules` — prévia e cancelamento | A política de importação estava repetida em dois lugares. | Worker chama o plano de domínio compartilhado; mantém seus validadores e persistência. Nenhuma alteração visual necessária, pois usa `OrganizationView` e `RuleImporter`. | Navegador, 1280 × 720, escuro: pacote sintético com uma regra/categoria novas; cancelar e descartar retornam ao vazio. `2026-10-26-shared-import-product.png`. | No navegador, a prévia foi descartada sem gravação no fixture. Escrita/repetição/rollback D1 foram exercitados pelas integrações. Nenhum dado real. |
| `/demo/rules` — prévia e confirmação | `demo-rule-import.ts` duplicava decisões do backend. | Arquivo removido; a sessão adapta o plano compartilhado ao catálogo em memória. Mesmo modal, contrato e JSON do produto. | Mesma prévia de uma regra/categoria; confirmação mostrou “Livraria QA compartilhada”. `2026-10-26-shared-import-demo-preview.png`, `2026-10-26-shared-import-demo-saved.png`. | Estado por aba; recarregar restaura a fixture. Não simula persistência D1. |
| Importação — regras editadas, pausadas, duplicatas e categorias inválidas | Duas implementações podiam divergir. | Política única; assinatura semântica independe da ordem das propriedades JSON. Recibos e revisão continuam nos adaptadores. | Novo teste em `tests/integration/rule-import.test.ts` compara as duas APIs com o mesmo JSON e repete após editar/pausar. Três testes puros; quatro testes da sessão sintética, inclusive digest indisponível em HTTP. | IDs e revisões locais são próprios de cada armazenamento; a comparação preserva essa diferença. |
| Visão geral, Transações, Cartões e Investimentos — composição | Dúvida sobre componentes exclusivos da demo. | Conferidos os imports: `FinancialDashboard`, `TransactionList`/`TransactionEditing`, `CardsView` e `InvestmentsView` são usados pelos dois caminhos. Tabela dos adaptadores registrada em `docs/frontend-workspace.md`; orientação adicionada a AGENTS/DESIGN. | Conferência do código e typecheck de todos os consumidores. | Nenhuma alteração visual necessária nesta correção. Esta rodada não repete a auditoria visual dessas páginas ou do onboarding. |

Validação completa: `mise run check` retornou **0**, com **116 testes Node,
177 integrações em 31 arquivos, build/dry-run e runtime local de 10 mil/100 mil
registros, incluindo reinício e persistência**. Registro em
`.wrangler/shared-rule-import-20261026/check-final.log` e
`check-exit-final.json`. A primeira tentativa encontrou `SQLITE_IOERR_WRITE`
no temporário do workerd; a execução final usou TMPDIR isolado dentro do projeto,
sem mudar código ou testes para contornar a falha. Assets do preview local foram
atualizados, mantendo os chunks antigos para abas já abertas. Sem deploy ou push.
