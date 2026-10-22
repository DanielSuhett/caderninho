# Identidade visual do Caderninho

Direção visual das telas próprias do produto: conexão Pluggy, gestão e consentimento OAuth.

Para compor páginas desde a base, use a [referência de interface para desenvolvimento](docs/design-system.md): tokens, peças existentes, estados, layouts e três receitas de composição.

## Produto e público

Caderninho é um MCP financeiro pessoal para pessoas técnicas. O conteúdo deve explicar ferramentas, contratos, sincronização, autenticação e operação na própria Cloudflare. O painel facilita a conexão e a autorização do assistente; não transforma o produto em um chat financeiro para leigos.

Nomeie componentes e ações concretamente: cliente MCP, Pluggy, D1, Workflows, OAuth, sincronizar, validar credenciais, consultar parcialidade. O dashboard de gestão mostra pessoas, perfis e contas autorizados pelo escopo do produto; não simula aconselhamento. Exemplos são identificados como fictícios e não executam operações.

## Tokens

| Uso | Token CSS | Valor |
| --- | --- | --- |
| Fundo | `--page` | `#000000` |
| Superfície de trabalho | `--surface` | `#171717` |
| Texto principal | `--text` | `#edece8` |
| Texto secundário | `--muted` | `#adadad` |
| Ação principal e foco | `--accent` | `#f6821f` |
| Separadores e bordas | `--line` | `#414141` |

Feedback: sucesso usa `#c3d7bd` sobre `#263126`; pendência usa `#e4cc96` sobre `#2e291e`. Sempre acompanhar cor com texto explícito. Não usar verde como falsa indicação de conexão em tempo real.

## Tipografia

Hanken Grotesk variável, servida localmente, com licença OFL em `src/web/assets/fonts/`. Fallback sans-serif. Apresentação pública: corpo 17 px e entrelinha 1,55; hero 44–88 px. Workspace operacional: corpo 15 px e entrelinha 1,5; página 28–32 px; seção 20 px; registro 17 px; tabela 14 px; metadado 12 px. Títulos com peso 550–600 e tracking negativo moderado. Linhas de texto até 65 caracteres. Valores financeiros usam algarismos tabulares; fonte monoespaçada não substitui a hierarquia. Monoespaçada somente em código, IDs, argumentos e valores técnicos.

Títulos de uma cor. Sem palavra isolada em laranja, etiquetas em caixa alta ou subtítulo decorativo acima de cada seção. O laranja identifica ação, foco e página ativa; não é decoração repetida. O wordmark é tipográfico: `caderninho.`

## Composição

Telas operacionais: largura máxima 850 px; workspace com navegação até 1480 px, formulários alinhados à esquerda. Margens móveis entre 18 e 24 px. Espaçamento cria hierarquia antes de bordas e fundos.

Superfícies só para agrupar trabalho relacionado. Raios: 10 px nos grupos; 6 px nos controles; 4 px nos badges. Sem brilhos, gradientes, sombras decorativas, texturas, avatares fictícios ou grids de cards para preencher espaço. Numeração apenas para sequências reais.

## Componentes e implementação

- `src/web/design.tsx`: tokens, fonte e estilos compartilhados; incluir `DesignHead` uma vez no head e `data-mode="dark"` no HTML.
- `src/web/ui.tsx`: adaptadores SSR dos componentes Kumo. Botão principal laranja com texto escuro; secundário sobre superfície escura. O adaptador usa a variante neutra Kumo para evitar o gradiente e o texto branco obrigatório da variante primary, mantendo suas semânticas e estados.
- `src/web/portal-view.tsx`: shell operacional compartilhado. O painel em `src/web/account/account-view.tsx` usa React e Kumo; `src/web/consent-view.tsx` exporta o formulário React renderizado no servidor.
- Fonte copiada para assets no build, CSP `font-src 'self'`; nenhum carregamento de fonte externa. Sem JavaScript para identidade visual.
- Botões, inputs e summaries com alvos de pelo menos 44 px no workspace e 48 px nos fluxos de apresentação. Compactar conteúdo e espaços, nunca diminuir a área de toque. Foco visível, labels associados, estados disabled legíveis. Cor nunca é a única indicação.

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

`/account` apresenta a visão geral. Auditoria MCP, Transações, Regras, Grupos, Sincronizações e
Conexões têm páginas próprias; a navegação permanece à esquerda no desktop e
vira uma grade de três colunas no celular. A página ativa tem texto e borda
laranja, além de `aria-current`. O link de salto permite ir direto ao conteúdo.

A leitura financeira fica separada da gestão de credenciais. Filtros principais
permanecem visíveis; filtros avançados de transações usam disclosure e abrem quando
ativos. Tabelas viram registros com rótulos no celular. Regras explicam condições
em linguagem legível; grupos exibem espaços, categorias e tags. Falhas e dados
parciais aparecem com texto e ações de recuperação.

Confirmação de configuração, autorização OAuth e requisição autenticada são
evidências diferentes. A UI não atribui marca verificada a um nome declarado pelo
cliente. Privacidade e manutenção ficam em disclosures, sem esconder falhas.
O [guia das páginas](docs/frontend-workspace.md) documenta os recortes e limites.

## Gestão de múltiplas pessoas

A marca e os tokens permanecem. O titular em cada conta é a identificação visual
principal. Filtros “Todos” e por pessoa alteram a seleção; números de pessoas,
conexões e contas resumem a seleção real. Contas usam grupos com saldo, moeda,
origem e data; cartões deixam explícito que o saldo não é dinheiro disponível.
Formulários de credenciais ficam recolhidos e nunca mostram valores persistidos.
Em telas até 700 px, listas de contas e formulários ocupam uma coluna.

## Densidade e estados operacionais

O painel é suporte ao MCP. Uma primeira tela deve mostrar dados ou a próxima ação,
não repetir o nome da navegação em um eyebrow. Cabeçalhos operacionais usam
`WorkspaceHeading`; atualização usa `RefreshButton`. A marca, fonte e paleta não
mudam ao navegar entre leitura financeira e gestão.

`UiButton` conserva a semântica do Kumo. Na área operacional os controles têm altura
mínima de 44 px, texto de 14 px e padding de 8 × 14 px. Há um destaque principal por
tarefa; atualização/importação auxiliar usa secundário. Ícones são do Phosphor,
compartilhado com o Kumo, com nome acessível e dica no foco/hover. Ações de impacto,
como revogar acesso, mantêm texto explícito e confirmação.

`WorkspaceSkeleton` aparece na carga inicial. Na atualização da mesma consulta, os
dados existentes permanecem visíveis; um aviso indica atualização ou falha, sem
transformar dados antigos em resultado novo. Mudanças de consulta limpam o recorte
anterior. Skeletons respeitam `prefers-reduced-motion`. Não animar valores monetários
nem usar brilhos, shimmer ou spinners contínuos como decoração.

A [crítica de produto](docs/design-critical-review.md) registra evidências e cinco
prioridades, incluindo a distinção entre titular financeiro, perfil Pluggy,
concessão OAuth, cliente declarado e modelo informado.
