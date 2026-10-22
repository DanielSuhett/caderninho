# Identidade visual do Caderninho

Direção visual das telas próprias do produto: landing, acesso privado, conexão Pluggy, gestão e consentimento OAuth.

Para compor páginas desde a base, use a [referência de interface para desenvolvimento](docs/design-system.md): tokens, peças existentes, estados, layouts e três receitas de composição.

## Produto e público

Caderninho é um MCP financeiro pessoal para pessoas técnicas. O conteúdo deve explicar ferramentas, contratos, sincronização, autenticação e operação na própria Cloudflare. O painel facilita a conexão e a autorização do assistente; não transforma o produto em um chat financeiro para leigos.

Nomeie componentes e ações concretamente: cliente MCP, Pluggy, D1, Workflows, OAuth, sincronizar, validar credenciais, consultar parcialidade. O dashboard de gestão mostra pessoas, perfis e contas autorizados pelo escopo do produto; não simula aconselhamento. Exemplos são identificados como fictícios e não executam operações.

## Tokens

`src/web/design-tokens.ts` é a fonte única de `colorTokens` e `shadowTokens`.
`DesignHead`, em `src/web/design.tsx`, publica cada chave como variável CSS. A
galeria autenticada `/account/design-system` consome essa mesma fonte. Não criar
cores ou sombras locais para uma página; o [guia](docs/design-system.md) registra
os valores, os estados e os pares de contraste calculados.

| Papel | Tokens principais | Regra |
| --- | --- | --- |
| Base e texto | `--page` `#000000`, `--surface` `#171717`, `--text` `#edece8`, `--muted` `#adadad` | Hanken sobre neutros; superfície agrupa trabalho. |
| Superfície e limite | `--surface-raised` `#242424`, `--line` `#414141`, `--control-border` `#858585` | Linha separa conteúdo; borda de controle identifica o campo/ação. |
| Ação e seleção | `--accent` `#f6821f`, `--on-accent` `#17100a`, `--selected-bg` `#332316`, `--selected-text` `#ffc291` | Laranja orienta ação/foco; seleção também usa estado semântico e marcador. |
| Feedback | Famílias `--success-*`, `--warning-*`, `--error-*`, `--info-*` | Cada família tem texto, fundo e borda. Cor acompanha mensagem explícita. |
| Gráficos e profundidade | `--chart-1` a `--chart-4`; `--shadow-flat`, `--shadow-low`, `--shadow-raised`, `--shadow-public` | Séries têm rótulos; elevação segue a função da superfície. |

`notice`, `status-label` e `sync-state` aceitam `data-tone="success|warning|error|info|neutral"`;
informação é o padrão. Sucesso indica resultado confirmado; atenção indica
pendência/parcialidade; erro indica falha. Os aliases `run-succeeded`/`sync-succeeded`,
`run-pending`/`sync-pending` e `run-failed`/`sync-failed` usam, respectivamente,
sucesso, atenção e erro. Execução em andamento é informação. Regra ativa, registro
contabilizado ou concessão vigente não são prova de sucesso recente nem conexão online.

## Tipografia

Hanken Grotesk variável, servida localmente, com licença OFL em `src/web/assets/fonts/`. Fallback sans-serif. Apresentação pública: corpo 16–17 px e entrelinha 1,55; hero 36–64 px; login 28–32 px. Workspace operacional: corpo 15 px e entrelinha 1,5; página 28–32 px; seção 20 px; registro 17 px; tabela 14 px; metadado 12 px. Títulos com peso 550–600 e tracking negativo moderado. Linhas de texto até 65 caracteres. Valores financeiros usam algarismos tabulares; fonte monoespaçada não substitui a hierarquia. Monoespaçada somente em código, IDs, argumentos e valores técnicos.

Títulos de uma cor. Sem palavra isolada em laranja, etiquetas em caixa alta ou subtítulo decorativo acima de cada seção. O laranja identifica ação, foco e página ativa; não é decoração repetida. O wordmark é tipográfico: `caderninho.`

## Composição

Telas operacionais: largura máxima 850 px; workspace com navegação lateral e conteúdo flexível, formulários alinhados à esquerda. Margens móveis entre 18 e 24 px; o workspace usa 12 px para acomodar a navegação lateral. Espaçamento cria hierarquia antes de bordas e fundos.

Superfícies só para agrupar trabalho relacionado. Raios: 10 px nos grupos; 6 px nos controles; 4 px nos badges. Sem brilhos, gradientes, texturas, avatares fictícios ou grids de cards para preencher espaço. Numeração apenas para sequências reais.

Elevação plana nas linhas e métricas; `--shadow-low` nos grupos de contas e editor de perfil aberto; `--shadow-raised` em tooltips; `--shadow-public` no grupo principal de landing/login e nos drawers modais. Formulários dentro do drawer são planos. Sombras neutras não substituem borda, contraste nem hierarquia. Não elevar cada nível de uma composição.

## Componentes e implementação

- `src/web/design-tokens.ts`: cores e elevação; `src/web/design.tsx`: publicação dos tokens, fonte e estilos compartilhados; incluir `DesignHead` uma vez no head e `data-mode="dark"` no HTML.
- `src/web/ui.tsx`: adaptadores SSR dos componentes Kumo. Botão principal laranja com texto escuro; secundário sobre superfície escura. O adaptador usa a variante neutra Kumo para evitar o gradiente e o texto branco obrigatório da variante primary, mantendo suas semânticas e estados.
- `src/web/portal-view.tsx`: shell operacional compartilhado. O painel em `src/web/account/account-view.tsx` usa React e Kumo; `src/web/consent-view.tsx` exporta o formulário React renderizado no servidor.
- Fonte copiada para assets no build, CSP `font-src 'self'`; nenhum carregamento de fonte externa. Sem JavaScript para identidade visual.
- Botões, inputs e summaries com alvos de pelo menos 44 px; o campo de senha mantém 48 px. Compactar conteúdo e espaços, nunca diminuir a área de toque. Foco visível, labels associados, estados disabled legíveis. Cor nunca é a única indicação.

## Conteúdo e interação

CTAs descrevem o destino: “Instalar na minha Cloudflare” abre o formulário nativo da Cloudflare; “Entrar nesta instância” vai para `/account`. Exemplos MCP exibem nomes e argumentos do contrato real. Identificar recortes de respostas; não representar exemplos como conexões ou resultados reais.

Manter validações, proteção CSRF, campos ocultos e decisões OAuth ao alterar a apresentação. O widget Pluggy é de terceiros; não aplicar CSS do produto dentro dele.

## Verificação

Revisar desktop e celular, teclado, contraste, quebra de código/IDs e estado de carregamento/erro. Rodar tipagem, lint, build e testes de integração das páginas. Alterações de identidade futuras devem atualizar este arquivo e os tokens compartilhados; não criar temas locais divergentes.

Decisões de implementação e evidências ficam em `.localdocs`, ignorado pelo Git. Este `DESIGN.md` é o contrato visual solicitado explicitamente pelo usuário.

## Telas da aplicação

A instalação é documentada no README; o guia de uso explica manutenção e recuperação.
Não inclui simuladores, reprodução automática, exemplos bancários interativos nem motor de
regras no navegador. A lógica financeira continua no domínio e no Worker.

A cor de ação usa o token `kumo-brand` (#f6821f) da biblioteca oficial Kumo.
Preserve fonte local, foco visível e navegação por teclado em desktop e celular.

## Navegação da instalação

`/account` apresenta a visão geral. Auditoria MCP, Transações, Regras, Grupos,
Sincronizações e Conexões têm páginas próprias. A navegação permanece lateral em
todas as larguras: 208 px com nomes no desktop e uma faixa de 56 px com ícones no
compacto. “Abrir navegação” revela um drawer à esquerda com os mesmos destinos e
nomes completos. Ícones Phosphor de 20 px, nomes acessíveis e alvos de 44 px; não
misturar famílias para imitar outra biblioteca. O destino ativo usa fundo/texto de
seleção, borda laranja e `aria-current`. O link de salto leva ao conteúdo.

Todas as oito páginas do workspace, incluindo a referência visual, usam
`FilterDrawer`. O botão “Filtros” abre à direita; o recorte aplicado continua
visível fora do drawer, com pessoa, grupo, período e condições pertinentes à página.
Editar campos é rascunho; “Aplicar filtros” submete GET. X, Escape e “Cancelar”
fecham sem aplicar; reabrir recupera o recorte da URL. “Limpar filtros” volta ao
caminho sem query: remove também pessoa, grupo e paginação, restaurando os padrões.

`WorkspaceDrawer` usa `<dialog>` nativo, `showModal()` e botões Kumo. Cabeçalho e
rodapé permanecem visíveis; somente o corpo rola. Filtros: até 440 px à direita,
largura inteira até 480 px; navegação: até 300 px à esquerda. Não manter “Mais
filtros” aninhado dentro do drawer. Entrada de 180 ms, sem animação com movimento
reduzido. Validar foco, Escape e retorno ao gatilho no navegador; o componente
nativo não dispensa essa revisão.

A leitura financeira fica separada da gestão de credenciais. Tabelas financeiras
viram registros com rótulos no compacto. Regras explicam condições em linguagem
legível; grupos exibem espaços, categorias e tags. Falhas e dados parciais ficam
junto aos resultados, fora dos drawers.

Confirmação de configuração, autorização OAuth e requisição autenticada são
evidências diferentes. A UI não atribui marca verificada a um nome declarado pelo
cliente. Privacidade e manutenção ficam em disclosures, sem esconder falhas.
O [guia das páginas](docs/frontend-workspace.md) documenta os recortes e limites.

## Gestão de múltiplas pessoas

A marca e os tokens permanecem. O titular em cada conta é a identificação visual
principal. O filtro de pessoa no drawer altera a seleção; números de pessoas,
conexões e contas resumem a seleção real. Contas usam grupos com saldo, moeda,
origem e data; cartões deixam explícito que o saldo não é dinheiro disponível.
Formulários de credenciais ficam recolhidos e nunca mostram valores persistidos.
Em telas até 700 px, listas de contas e formulários ocupam uma coluna.

`BankMark` mantém um catálogo local de oito marcas, derivado de bancos-brasil com
licença e revisão registradas. Marcas são sinais auxiliares de 28 px; não substituem
o titular nem o nome da instituição em texto. O contrato atual das contas não
fornece uma chave confiável de instituição: elas usam o ícone bancário neutro.
Nunca inferir banco pelo nome da conta, perfil Pluggy, pessoa ou saldo. Cores de
marca ficam restritas ao selo; não viram cor da página ou estado de sucesso.

## Densidade e estados operacionais

O painel é suporte ao MCP. Uma primeira tela deve mostrar dados ou a próxima ação,
não repetir o nome da navegação em um eyebrow. Cabeçalhos operacionais usam
`WorkspaceHeading`; atualização usa `RefreshButton`. A marca, fonte e paleta não
mudam ao navegar entre leitura financeira e gestão.

`UiButton` conserva a semântica do Kumo. Na área operacional os controles têm altura
mínima de 44 px, texto de 14 px e padding de 8 × 14 px. Há um destaque principal por
tarefa; atualização/importação auxiliar usa secundário. Ícones são do Phosphor,
compartilhado com o Kumo, com nome acessível e dica no foco/hover. Ações de impacto,
como revogar acesso, mantêm texto explícito e confirmação. `UiButton tone="danger"`
aplica o tratamento destrutivo sem inventar uma variante Kumo. Hover, pressionado,
desabilitado e inválido usam tokens centrais; seleção usa `aria-current` ou
`aria-pressed`, conforme a função do controle.

`WorkspaceSkeleton` aparece na carga inicial. Na atualização da mesma consulta, os
dados existentes permanecem visíveis; um aviso indica atualização ou falha, sem
transformar dados antigos em resultado novo. Mudanças de consulta limpam o recorte
anterior. Skeletons respeitam `prefers-reduced-motion`. Não animar valores monetários
nem usar brilhos, shimmer ou spinners contínuos como decoração.

A [crítica de produto](docs/design-critical-review.md) registra evidências e cinco
prioridades, incluindo a distinção entre titular financeiro, perfil Pluggy,
concessão OAuth, cliente declarado e modelo informado.


## Landing e entrada

`PublicLayout` compartilha estrutura, fonte, componentes Kumo e tokens com o
produto. `UiLink` é o equivalente semântico de `UiButton` para navegação. A landing
é HTML estático gerado pelo Vite; o login é renderizado pelo Worker com CSRF e
retorno OAuth preservados. Nenhum dos dois precisa de JavaScript para funcionar.

Estas superfícies usam `--shadow-public`, a elevação mais ampla do sistema, com
sombra neutra e luz interna de 1 px. O workspace usa os níveis baixos definidos
acima. A landing entra em 400 ms, com deslocamento de 8 px e atraso
máximo de 80 ms; hover usa 150 ms e deslocamento de 1 px. No login, só a sombra
aparece gradualmente: título, senha e erro permanecem disponíveis imediatamente.
`prefers-reduced-motion` desativa animações/transições. Sem loops, parallax,
animação de dinheiro ou indicadores fictícios de conexão.

O visitante novo pode instalar; quem já usa a instância encontra “Entrar”. A
explicação mostra instalar → conectar e importar → autorizar o assistente. O
exemplo financeiro é identificado como fictício e não é executado. O login
distingue acesso normal, continuação OAuth e configuração ausente. Entrar não é
consentir; a autorização continua na próxima tela. Recuperação não simula e-mail.
