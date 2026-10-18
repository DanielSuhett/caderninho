# Identidade visual do Caderninho

Direção visual das telas próprias do produto: conexão Pluggy, gestão e consentimento OAuth.

## Produto e público

Caderninho é um MCP financeiro pessoal para pessoas técnicas. O conteúdo deve explicar ferramentas, contratos, sincronização, autenticação e operação na própria Cloudflare. O wizard facilita a configuração; não transforma o produto em um chat financeiro para leigos.

Nomeie componentes e ações concretamente: cliente MCP, Pluggy, D1, Workflows, OAuth, sincronizar, validar credenciais, consultar cobertura. Não invente dashboards, funções de orçamento ou aconselhamento. Exemplos são identificados como fictícios e não executam operações.

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

Hanken Grotesk variável, servida localmente, com licença OFL em `src/web/assets/fonts/`. Fallback sans-serif. Corpo 17 px, entrelinha 1,55. Títulos com peso 550–600 e tracking negativo moderado. Hero 44–88 px; títulos de fluxo 34–58 px; seções 26–42 px. Linhas de texto até 65 caracteres. Monoespaçada somente em código, IDs, argumentos e valores técnicos.

Títulos de uma cor. Sem palavra isolada em laranja, etiquetas em caixa alta ou subtítulo decorativo acima de cada seção. O wordmark é tipográfico: `caderninho.`

## Composição

Telas operacionais: largura máxima 850 px, formulários alinhados à esquerda. Margens móveis entre 18 e 24 px. Espaçamento cria hierarquia antes de bordas e fundos.

Superfícies só para agrupar trabalho relacionado. Raios: 10 px nos grupos; 6 px nos controles; 4 px nos badges. Sem brilhos, gradientes, sombras decorativas, texturas, avatares fictícios ou grids de cards para preencher espaço. Numeração apenas para sequências reais.

## Componentes e implementação

- `src/web/design.tsx`: tokens, fonte e estilos compartilhados; incluir `DesignHead` uma vez no head e `data-mode="dark"` no HTML.
- `src/web/ui.tsx`: adaptadores SSR dos componentes Kumo. Botão principal laranja com texto escuro; secundário sobre superfície escura. O adaptador usa a variante neutra Kumo para evitar o gradiente e o texto branco obrigatório da variante primary, mantendo suas semânticas e estados.
- `src/web/portal-view.tsx`: shell operacional compartilhado. O painel em `src/web/account/account-view.tsx` usa React e Kumo; `src/web/consent-view.tsx` exporta o formulário React renderizado no servidor.
- Fonte copiada para assets no build, CSP `font-src 'self'`; nenhum carregamento de fonte externa. Sem JavaScript para identidade visual.
- Botões, inputs e summaries com alvos de pelo menos 44 px, preferencialmente 48 px. Foco visível, labels associados, estados disabled legíveis. Cor nunca é a única indicação.

## Conteúdo e interação

CTAs descrevem o destino: “Instalar na minha Cloudflare” abre o formulário nativo da Cloudflare; “Entrar nesta instância” vai para `/account`. Exemplos MCP exibem nomes e argumentos do contrato real. Identificar recortes de respostas; não representar exemplos como conexões ou resultados reais.

Manter validações, proteção CSRF, campos ocultos e decisões OAuth ao alterar a apresentação. O widget Pluggy é de terceiros; não aplicar CSS do produto dentro delas.

## Verificação

Revisar desktop e celular, teclado, contraste, quebra de código/IDs e estado de carregamento/erro. Rodar tipagem, lint, build e testes de integração das páginas. Alterações de identidade futuras devem atualizar este arquivo e os tokens compartilhados; não criar temas locais divergentes.

Decisões de implementação e evidências ficam em `.localdocs`, ignorado pelo Git. Este `DESIGN.md` é o contrato visual solicitado explicitamente pelo usuário.

## Telas da aplicação

A instalação é documentada no README; o guia de uso explica manutenção e recuperação.
Não inclui simuladores, reprodução automática, exemplos bancários interativos nem motor de
regras no navegador. A lógica financeira continua no domínio e no Worker.

A cor de ação usa o token `kumo-brand` (#f6821f) da biblioteca oficial Kumo.
Preserve fonte local, foco visível e navegação por teclado em desktop e celular.

## Playground da instância

`/account` reúne onboarding e manutenção. Dois passos, Bancos e Assistente, concentram a configuração; o progresso da cópia aparece junto dos bancos. A origem e o ambiente ficam visíveis. A distribuição e a recuperação de acesso são documentadas no README.

Use Hanken, os tokens existentes e controles Kumo. A trilha fica à esquerda no desktop e permite rolagem horizontal no celular. A seleção usa laranja persistente; transição breve de posição respeita reduced-motion. Atualizações de status preservam os elementos e alteram apenas texto/valor. Não adicionar flashes, terminais fictícios, medalhas ou progresso baseado em tempo.

Confirmação de configuração, autorização OAuth e requisição autenticada são evidências diferentes. A UI não atribui marca verificada a um nome declarado pelo cliente. Falhas de leitura preservam a evidência anterior e oferecem renovação de sessão ou nova verificação. Privacidade e manutenção ficam em disclosures, sem esconder falhas da missão ativa.
