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
| Ação e seleção | `--accent` `#f6821f`, `--on-accent` `#17100a`, `--selected-bg` `#332316`, `--selected-text` `#ffc291` | Laranja orienta ação/foco; seleção usa fundo, texto e `aria-current`, sem faixa lateral. |
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

Telas operacionais: largura máxima 1280 px; workspace com navegação lateral e conteúdo flexível, formulários alinhados à esquerda. Margens móveis entre 18 e 24 px; o workspace usa 16 px no compacto e recupera a largura da navegação em um menu. Espaçamento cria hierarquia antes de bordas e fundos.

Superfícies só para agrupar trabalho relacionado. Raios: 10 px nos grupos; 6 px nos controles; 4 px nos badges. Sem brilhos, gradientes, texturas, avatares fictícios ou grids de cards para preencher espaço. Numeração apenas para sequências reais.

Linhas e métricas planas; as listas de registros usam uma superfície delimitada com `--shadow-low`, sem elevar cada registro; `--shadow-low` no editor de perfil aberto; `--shadow-raised` em tooltips; `--shadow-public` no grupo principal de landing/login e nos drawers modais. Formulários dentro do drawer são planos. Sombras neutras não substituem borda, contraste nem hierarquia. Não elevar cada nível de uma composição.

### Bordas e superfícies

A auditoria de 23/10/2026 fixou três papéis. `--line` é um separador fino entre
registros ou partes de um mesmo bloco, desenhado **uma vez por encontro**; listas
contínuas usam uma divisória por encontro. Cada lista de registros pode ter um único
contorno neutro de 1 px e raio de 10 px para delimitar a área de leitura. `--control-border`
é o contorno de campos, botões e outros controles que precisam de limite visível.
Avisos usam a borda de seu estado, com 1 px uniforme nos quatro lados; a cor e o
texto continuam a explicar o estado. O foco de teclado usa outline laranja e
permanece independente da seleção.

Linhas expansíveis, métricas e etiquetas informativas são planas. Hover e expansão
podem usar `--surface`, sem transformar cada registro em card. Grupos de trabalho
que realmente precisam de superfície usam raio de 10 px; controles usam 6 px e
etiquetas 4 px. Bordas laterais coloridas e molduras tracejadas decorativas não
fazem parte da linguagem. A navegação ativa usa `--selected-bg`,
`--selected-text` e `aria-current="page"`, sem faixa laranja à esquerda. A
borda vertical do drawer separa uma sobreposição da página; a do campo mantém o
controle reconhecível. Não remover essas fronteiras funcionais para simplificar.

### Auditoria de bordas — 23/10/2026

| Área inspecionada | Ruído encontrado | Padrão aplicado |
| --- | --- | --- |
| Navegação e visão geral | Faixa laranja na seleção; métrica com linha superior e inferior; vazio tracejado | Seleção por fundo e texto; um separador após as métricas; vazio pela superfície. |
| Contas, transações, auditoria e regras | Molduras repetidas em registros, categorias, parcelas e prévias | Listas contínuas com uma linha por encontro; etiquetas por fundo; campos preservam contorno de controle. |
| Drawers e detalhes | Estilos globais de `section` e `footer` invadiam conteúdo aninhado; parcela somava separadores no primeiro item | Seletores restritos aos filhos de `main`; entrada do detalhe única e divisórias apenas entre parcelas. |
| Landing, acesso, 404 do site e avisos | Notas com barra lateral colorida, estados com borda assimétrica e 404 sem layout público | Separador neutro nas notas, avisos com contorno uniforme e 404 no shell público. |
| Galeria visual e componentes compartilhados | Faltavam exemplos de parcelas e seus estados; amostras precisavam refletir a nova gramática | Exemplos de parcelas na galeria e mesmos tokens e raios por função em todas as páginas. |

A revisão de código cobriu os estilos do workspace, auditoria, galeria, landing,
acesso, consentimento, 404 do site e shell. As oito páginas autenticadas foram
inspecionadas em desktop e largura compacta com dados sintéticos; landing e acesso
também foram vistos no compacto. O consentimento foi renderizado com um cliente
fictício e o `404.html` do site foi revisado em largura compacta. Dados reais,
widget externo, fluxo OAuth real, outros navegadores e teclado completo exigem
verificação própria antes de um deploy; não são resultados desta auditoria.

## Componentes e implementação

- `src/web/design-tokens.ts`: cores e elevação; `src/web/design.tsx`: publicação dos tokens, fonte e estilos compartilhados; incluir `DesignHead` uma vez no head e `data-mode="dark"` no HTML.
- `src/web/ui.tsx`: adaptadores SSR dos componentes Kumo. Botão principal laranja com texto escuro; secundário sobre superfície escura. O adaptador usa a variante neutra Kumo para evitar o gradiente e o texto branco obrigatório da variante primary, mantendo suas semânticas e estados.
- `src/web/portal-view.tsx`: shell operacional compartilhado. O painel em `src/web/account/account-view.tsx` usa React e Kumo; `src/web/consent-view.tsx` exporta o formulário React renderizado no servidor.
- Fonte copiada para assets no build, CSP `font-src 'self'`; nenhum carregamento de fonte externa. Sem JavaScript para identidade visual.
- Controles operacionais com 36 px no desktop e 44 px no compacto ou com ponteiro de toque; navegação mantém 44 px. Landing e acesso conservam os controles públicos de 44 px e o campo de senha de 48 px. Foco visível, labels associados, estados disabled legíveis. Cor nunca é a única indicação.

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
Sincronizações e Conexões têm páginas próprias. A navegação usa uma lateral de 208 px com nomes no desktop. Até 760 px, o
trilho de ícones sai da composição: um botão de 44 × 44 px junto ao título abre
o drawer à esquerda com todos os destinos nomeados, referência visual e saída.
O conteúdo recupera a largura inteira. Ícones Phosphor de 20 px; não diminuir
áreas de toque para compactar. O destino ativo usa fundo/texto de seleção e
`aria-current`; foco laranja e link de salto permanecem.

O wordmark operacional tem 24 px; a assinatura “MCP financeiro pessoal” fica
fora do workspace. Essa redução é restrita ao painel e preserva landing e acesso.

As páginas de consulta do workspace usam `FilterDrawer`. O botão “Filtros” abre à direita; o recorte aplicado continua
visível fora do drawer. Uma linha resume o contexto relevante (pessoa, grupo ou período); o botão
mostra a quantidade de condições adicionais, sem contar defaults ou vazios. Em
Grupos, a seleção identifica explicitamente o recorte de categorias e etiquetas;
a lista de grupos continua completa.
Os critérios completos são os campos aplicados ao reabrir o drawer; limpar e
selecionar lançamentos futuros ficam dentro dele.
Editar campos é rascunho; “Aplicar filtros” submete GET. X, Escape e “Cancelar”
fecham sem aplicar; reabrir recupera o recorte da URL. “Limpar filtros” volta ao
caminho sem query: remove também pessoa, grupo e paginação, restaurando os padrões.

`WorkspaceDrawer` usa `<dialog>` nativo, `showModal()` e botões Kumo. Cabeçalho e
rodapé permanecem visíveis; somente o corpo rola. Filtros: até 440 px à direita,
largura inteira até 480 px; navegação: até 300 px à esquerda. Não manter “Mais
filtros” aninhado dentro do drawer. Entrada de 180 ms, sem animação com movimento
reduzido. Validar foco, Escape e retorno ao gatilho no navegador; o componente
nativo não dispensa essa revisão.

A leitura financeira fica separada da gestão de credenciais. Transações usam
uma lista contínua delimitada: descrição e valor/moeda primeiro, sentido junto ao
valor, data e conta em uma linha secundária. Titular permanece no resumo quando
a consulta abrange várias pessoas; não inferir o escopo pelos registros da página.
Categoria, descrição completa, IDs e explicações ficam na expansão. Pendências,
parcialidade, parcelas, futuros e exclusão continuam explícitos quando relevantes. A linha inteira
abre detalhes por clique, Enter ou Espaço; não converter cada célula em um campo
rotulado no compacto. Regras explicam condições em linguagem legível; grupos exibem espaços, categorias e tags. Falhas e dados parciais ficam
junto aos resultados, fora dos drawers.

Confirmação de configuração, autorização OAuth e requisição autenticada são
evidências diferentes. A UI não atribui marca verificada a um nome declarado pelo
cliente. Privacidade e manutenção ficam em disclosures, sem esconder falhas.
O [guia das páginas](docs/frontend-workspace.md) documenta os recortes e limites.

## Hierarquia das páginas

A visão geral começa pelas contas; o resumo da instalação fica recolhido depois
delas. A jornada de conexão completa pertence a Conexões, reaparecendo na visão
geral quando ainda falta importar dados. Progresso real, erros e parcialidade
continuam visíveis; conclusão não se repete antes de cada consulta.

`WorkspaceDetails` agrupa conteúdo secundário com título explícito: atividade e
referências da auditoria, categorias/etiquetas, explicações das regras e histórico,
e amostras da galeria. Autorizações precedem métricas na auditoria. Falhas não
ficam escondidas nessa expansão. Cada regra mostra uma condição reconhecível,
destino, prioridade e Ativa/Pausada; condições compostas preservam seu alcance
completo nos detalhes. Datas trazem seu significado: “Saldo em” e “Início”.

O catálogo visual é uma referência recolhida por assunto; não simula filtros sem
consulta. Editores mantêm labels permanentes, validação e ação fixa no rodapé.
Tabelas técnicas viram registros rotulados no celular, sem exigir arrastar a página.

## Gestão de múltiplas pessoas

A marca e os tokens permanecem. O titular em cada conta é a identificação visual
principal. O filtro de pessoa no drawer altera a seleção; números de pessoas,
conexões e contas resumem a seleção real. Contas usam linhas expansíveis com saldo,
moeda, titular e data observada no resumo; origem e identificadores ficam nos
detalhes. Cartões deixam explícito que o saldo não é dinheiro disponível.
Formulários de credenciais ficam recolhidos e nunca mostram valores persistidos.
As listas mantêm uma sequência vertical em todas as larguras; o conteúdo de cada
resumo se rearranja conforme o espaço, sem altura fixa.

`BankMark` mantém um catálogo local de oito marcas, derivado de bancos-brasil com
licença e revisão registradas. Marcas são sinais auxiliares de 28 px na galeria e
24 px nas linhas de conta; não substituem
o titular nem o nome da instituição em texto. O contrato atual das contas não
fornece uma chave confiável de instituição: elas usam o ícone bancário neutro.
Nunca inferir banco pelo nome da conta, perfil Pluggy, pessoa ou saldo. Cores de
marca ficam restritas ao selo; não viram cor da página ou estado de sucesso.

## Densidade e estados operacionais

Minimalismo é seleção de informação. Cada tela tem um título e uma ação principal;
subtítulos, etiquetas e explicações só aparecem se mudarem a próxima decisão.
Dados precisam aparecer na primeira tela do celular. Filtros padrão não viram
chips; explicações e metadados secundários ficam em drawers ou expansões.
Preservar valor, moeda, sentido e exceções financeiras. Ganhar espaço removendo
repetições, sem diminuir fonte, contraste ou alvos de toque. Hover e foco dão
resposta discreta; uma superfície delimita a lista sem criar cards em cada linha.

O painel é suporte ao MCP. Uma primeira tela deve mostrar dados ou a próxima ação,
não repetir o nome da navegação em um eyebrow. Cabeçalhos operacionais usam
`WorkspaceHeading`; atualização usa `RefreshButton`. A marca, fonte e paleta não
mudam ao navegar entre leitura financeira e gestão.

`UiButton` conserva a semântica do Kumo. Na área operacional os controles têm altura
mínima de 36 px, texto de 14 px e padding de 6 × 10 px no desktop; até 760 px ou
com ponteiro de toque, a altura mínima passa a 44 px.
Essa densidade não reduz a fonte de dados ou valores financeiros. Há um destaque principal por
tarefa; atualização/importação auxiliar usa secundário. Ícones são do Phosphor,
compartilhado com o Kumo, com nome acessível e dica no foco/hover. Ações de impacto,
como revogar acesso, mantêm texto explícito e confirmação. `UiButton tone="danger"`
aplica o tratamento destrutivo sem inventar uma variante Kumo. Hover, pressionado,
desabilitado e inválido usam tokens centrais; seleção usa `aria-current` ou
`aria-pressed`, conforme a função do controle.

`DisclosureItem` é a peça comum das listas de transações, contas, regras, grupos e
sincronizações. Fornece apenas `details/summary`, chevron Phosphor de 16 px e estados
compartilhados. Cada domínio compõe seu resumo e detalhe. Toda a linha abre/fecha;
links e botões pertencem ao detalhe, nunca ao `summary`. Usar divisórias e espaço,
sem cards individuais, alturas fixas ou um controle minúsculo exclusivo para abrir.

O resumo conserva o que muda a interpretação: titular, sinal/moeda e pendência ou
exclusão nas transações; natureza do saldo e parcialidade nas contas; estado,
prioridade e alcance das regras; moeda e orçamento dos grupos; estado, titular,
início, falha e recuperação histórica nas sincronizações. IDs e explicações longas
ficam na expansão. Resumo e detalhe compartilham o recuo lateral de 16 px;
o contêiner controla os intervalos de 16 px entre blocos e 24 px entre colunas.
Dados precedem ações. “Editar” e “Excluir” são botões locais discretos, com nome
acessível que identifica o objeto; a confirmação de exclusão continua explícita.
O grupo base Pessoal não oferece a exclusão que o domínio proíbe.
Uma única “Referência técnica” recolhe IDs de grupos, regras, contas, rodadas e
clientes MCP, sem outra superfície. Erros, escopos, condições completas,
parcialidade e consequências permanecem fora dessa referência.
Categorias e etiquetas sem informação adicional permanecem
listas simples; não adicionar expansão vazia só para uniformizar aparência.

O editor de grupo usa diálogo com até 560 px e altura do conteúdo; confirmação
curta usa até 440 px. Ambos têm limite de 90dvh e corpo rolável, com cabeçalho e
ações preservados. Até 480 px, ficam na base com margem de 16 px. O editor longo
de regra continua no drawer de 720 px. Cancelar recebe o foco inicial em uma
confirmação destrutiva; Escape e fechamento devolvem o foco ao gatilho.

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
