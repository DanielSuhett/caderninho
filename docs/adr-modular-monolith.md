# Arquitetura do Caderninho

Um monólito modular, um pacote npm e um deploy Cloudflare atendem OAuth, MCP,
API, Workflows e assets. `package.json` concentra comandos, dependências e imports;
`package-lock.json` é o único lockfile. O desenvolvimento usa Node 24.

## Código

| Diretório | Responsabilidade |
| --- | --- |
| `src/web` | React, Kumo, painel e páginas públicas |
| `src/worker` | HTTP, OAuth, MCP, D1 e Workflows |
| `src/domain` | Dinheiro, normalização, regras e recorrências |
| `src/contracts` | Schemas Zod e tipos dos contratos públicos |
| `src/shared` | Utilitários genéricos, sem dependência da aplicação |

Dentro de `src/worker`, o código fica junto da funcionalidade:

| Módulo | Responsabilidade |
| --- | --- |
| `account` | Instalação, conexões e ações do painel |
| `auth` | Login, sessões, OAuth e consentimento |
| `finance` | Consultas, regras, correções e projeções persistidas |
| `sync` | Agenda, webhooks, operações e publicação durável |
| `mcp` | Transporte, capacidades, Tasks e subscriptions |

Controllers validam o transporte e delegam ações. Services recebem dependências
explícitas, sem SQL, Bindings ou código HTTP. Repositories concretos concentram SQL;
seus tipos podem descrever as dependências dos services. `composition.ts` vincula
as implementações por requisição ou operação, sem estado privado global ou container
de DI. Não há repository genérico nem obrigação de criar todas as camadas em cada
módulo.

Os fluxos `publication`, `resources`, `events`, `reapplication` e `migration`
permanecem em `sync`, com seus steps e batches atômicos. `workflow.ts` é a entrada
Cloudflare. O cliente Pluggy, sua configuração e o adapter Fetch ficam em `pluggy`; `database.ts`, `schema.ts`,
`http.ts` e `bindings.ts` são compartilhados entre funcionalidades.

## Instalação pessoal

Uma pessoa e uma aplicação Pluggy usam cada instalação. Não há cadastro de usuários,
identidade configurável, login GitHub ou cofre próprio. Os três secrets vêm do deploy.
O banco inicia com uma única configuração e não contém colunas de tenant. A migração
inicial exige banco novo; não converte a arquitetura anterior.

## Persistência e finanças

D1 é a base canônica de dados, regras, operações e progresso. Consultas reutilizam
essa base; não iniciam importações. Workflows executam as operações duráveis.
A mesma operação identifica a Task MCP e o Workflow. A outbox recupera o intervalo
entre a gravação D1 e o despacho do Workflow.

Publicação de dados, derivados, cobertura, checkpoint, progresso, revisão e recibo
ocorre no mesmo batch. Replay verifica o recibo antes de buscar a página novamente.
Um lock da instalação serializa publicações; cancelamento preserva commits já feitos.
Nenhuma transação SQL fica aberta durante chamadas HTTP.

Dinheiro usa valores exatos e moedas separadas. Normalização e elegibilidade recebem
a data de referência explicitamente. Regras ativadas não reescrevem o histórico sem
reaplicação; overrides permanecem separados da origem e dos derivados. Revisões de
leitura invalidam cursores durante publicação.

Cada requisição privada valida a sessão ou o grant OAuth. `live_balance` autoriza a conta
antes de consultar a Pluggy com as credenciais do proprietário. R2 é somente fonte
de migração explícita; o histórico importado conserva sua origem.

### Independência da origem e recuperação

Pluggy é o adaptador de ingestão e leitura pontual, não a base de consultas do
produto. Consulta, agregação, correção local, explicação, reaplicação de regras e
progresso das operações usam D1, sem executar o cliente ou acessar rede Pluggy.
Isso permite usar o histórico importado durante uma indisponibilidade da origem;
não transforma informação antiga em saldo atual. Cobertura e falha permanecem
explícitas. Novos dados, validação de conexão e `live_balance` dependem da origem.

`FinancialSource` recebe o adaptador por operação e só o resolve quando necessário.
Não há fallback silencioso para outra instituição, credencial de outra aplicação ou saldo
persistido na leitura pontual. Uma futura fonte deve adaptar os dados e capacidades
de origem, preservando precisão, identidade e cobertura; não exige uma camada
genérica de providers antecipadamente. O payload heterogêneo continua preservado.

`src/worker/sync/operation-storage.ts` é dono da linha D1 e dos tipos de checkpoint/progresso.
O serviço de despacho recebe apenas identidade/status da operação e consulta a
elegibilidade na outbox. O repositório entrega o estado de leitura com resultado
parseado; o adaptador MCP traduz esse estado para Tasks. Flags e JSON de persistência
não fazem parte das dependências de aplicação. Os valores D1 e os steps existentes
permanecem estáveis: `completed` com fase `error` continua sendo falha financeira,
e não confirmação de cobertura integral no wizard.

## Interface e contratos

`src/web/document.tsx` compõe e renderiza o documento React em HTML. Login e
consentimento usam formulários nativos; o painel monta a aplicação pelo
`account-entry.ts`. A página inicial pública foi removida.
Hono mantém as rotas, cookies, redirects e headers no Worker.

`src/web/account/account-view.tsx` recebe apresentação e ações nomeadas.
`use-account.ts` mantém o estado React, a montagem e o polling. O controlador
coordena comandos e cancelamento e publica o estado por uma callback para essa
única view; `account-browser.ts` concentra os efeitos no navegador.
`account-api.ts` valida HTTP e preserva CSRF, deadlines e ausência de retry de
mutações. Leituras concorrentes são consolidadas; confirmar
uma mutação invalida a leitura anterior. Desmontar cancela requisições e timers.
Falha transitória conserva o último estado confirmado; expiração da sessão
interrompe polling. `connect-widget.ts` isola o SDK, serializa sua destruição e
descarta eventos atrasados. A view controla a apresentação e o foco nos títulos;
o adaptador do navegador restaura o foco ao fechar o widget.

Os contratos de wizard descrevem dados. Textos e progresso visual pertencem à
funcionalidade web; tradução de falhas pertence ao Worker. A política de conexão
pessoal tem dono no domínio e é revalidada no servidor. O callback do widget
nunca substitui autorização. As credenciais Pluggy são secrets da instalação; o painel não recebe nem persiste essas credenciais.

O parsing e dispatch de `ToolCall` ficam em `src/worker/mcp/invoke.ts`. Operações financeiras
recebem intenções tipadas após autenticação. Correções usam política do
domínio, mantendo autorização e alterações/revisão no repositório concreto.
`exact.ts::assertMinor` concentra a precisão persistível; `moneyKey` mantém o
encoding de ordenação no adaptador SQL. Não há divisão global dos modelos por
simetria nem alteração do catálogo MCP.

`npm run build` gera assets em `dist/web` e executa o dry-run do Worker em
`dist/worker`. Não publica o serviço.

Os modelos compartilhados usam interfaces e uniões em arquivos `.types.ts`,
independentes de Zod e de schemas de validação. Os parsers de entrada permanecem
nas fronteiras HTTP/MCP, Pluggy, configuração e importação; `satisfies z.ZodType<T>`
verifica sua compatibilidade com os modelos. Tipos de linhas e projeções SQL
continuam inferidos do Drizzle. Dados produzidos internamente não ganham schemas
apenas para definir seus tipos. O catálogo de campos do provedor é TypeScript
controlado e verificado no build.

Tasks seguem a revisão 2026-07-28; a JSON Schema
oficial e sua licença ficam em `src/worker/vendor/ext-tasks`. D1 fornece o progresso
canônico e é a única fonte de subscriptions. Os testes de wire exercitam a entrega
do catálogo e as operações MCP; não há snapshot paralelo das declarações internas.

## Ferramentas e testes

Um único `tsconfig.json` verifica fontes e testes com NodeNext e os tipos
de Node, navegador e Cloudflare. Os imports `#shared/`, `#domain/`, `#contracts/`,
`#worker/`, `#web/` e `#testing/` são definidos somente no `package.json`, com extensões
explícitas.

Helpers novos das funcionalidades são tratados como aplicação, mesmo quando
não se chamam `service.ts`. Repositórios/adaptadores e os fluxos de publicação
durável têm papéis explícitos; renomear um serviço não libera SQL ou HTTP.
Views não importam a API, o hook nem o widget, e aplicação/persistência não importam
envelopes MCP. Tipos de dependências concretas continuam permitidos onde escondem
implementação.

Testes unitários ficam em `__tests__` junto ao módulo. `tests/integration` contém
fixtures e testes de D1, HTTP, OAuth e Workflows; `tests/support` contém helpers
exclusivos de testes. `biome.json` concentra lint, formatação e organização de
imports com regras nativas. Políticas sem cobertura de lint ficam nas
[convenções de contribuição](../CONTRIBUTING.md#layout-e-typescript).
As migrações SQL em `migrations` mantêm sua ordem.

Os comandos e convenções de contribuição estão em [CONTRIBUTING.md](../CONTRIBUTING.md).
A identidade visual está em [DESIGN.md](../DESIGN.md), e a instalação e operação em
[cloudflare-product.md](cloudflare-product.md).
