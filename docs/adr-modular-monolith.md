# Arquitetura do Caderninho

Um monólito modular, um pacote npm e um deploy Cloudflare atendem OAuth, MCP,
API, Workflows e assets. `package.json` concentra comandos e dependências;
`package-lock.json` é o único lockfile. O desenvolvimento usa Node 24.

## Código

| Diretório | Responsabilidade |
| --- | --- |
| `src/web` | React, Kumo, painel e páginas públicas |
| `src/worker` | HTTP, OAuth, MCP, D1 e Workflows |
| `src/domain` | Dinheiro, normalização, regras e recorrências |
| `src/contracts` | Schemas Zod e tipos dos contratos públicos |
| `src/shared` | Utilitários genéricos, sem dependência da aplicação |

Dentro de `src/worker`, o código fica junto do módulo:

| Módulo | Responsabilidade |
| --- | --- |
| `account` | Instalação, conexões e ações do painel |
| `auth` | Login, sessões, OAuth e consentimento |
| `finance` | Consultas, regras, correções e projeções persistidas |
| `sync` | Agenda, webhooks, operações e publicação durável |
| `mcp` | Transporte, capacidades, Tasks e subscriptions |

Os módulos de aplicação usam `entity.ts`, `controller.ts`, `service.ts`,
`repository.ts` e testes em `__tests__` como estrutura padrão. Entidades locais
concentram modelos e portas; entidades de domínio concentram as regras puras.
Controllers validam transporte e delegam ações. Services coordenam casos de uso
com dependências explícitas, sem SQL, Bindings, cliente HTTP ou tipos derivados
dos factories de repositories. Repositories concretos implementam as portas e
concentram SQL. `composition.ts` vincula implementações por requisição ou operação,
sem estado privado global, repository genérico ou container de DI.

Há exceções concretas: `finance` separa consultas, regras e gravações de entidades
em repositories especializados; `sync` separa despacho e execução durável. MCP
é transporte, Pluggy é adapter de origem, e OAuth/Workflow mantêm seus adapters.
Esses módulos não ganham services ou repositories vazios para completar o layout.
`entity.ts` pode inferir modelos de linhas por imports exclusivamente de tipo do
schema Drizzle; builders e dependências D1 permanecem nos repositories.

As entidades do domínio reúnem tipos, enums e regras puras no mesmo arquivo
`*.entity.ts`, organizado por conceito. Recebem fatos já lidos pelos adaptadores;
não consultam D1, HTTP, Bindings nem relógio global. São funções e modelos tipados.
A revisão inclui conta, autenticação, finanças, sincronização, Pluggy, MCP e interface:

| Conceito | Entidade | Responsabilidade |
| --- | --- | --- |
| Conta e conexão | `account.entity.ts`, `connection.entity.ts` | Estado da conta, resultado da importação, conector Meu Pluggy e capacidade de conexões |
| Operação | `operation.entity.ts` | Intenção, idempotência, webhook, migração, agenda, watermark, cobertura e totais |
| Origem e finanças | `provider.entity.ts`, `finance.entity.ts` | Payloads de origem, identidade, relacionamentos, projeção, mudanças e correções locais |
| Consulta e recorrência | `query.entity.ts`, `recurrence.entity.ts` | Filtros, revisão de leitura, cursores e detecção de recorrências |
| Regras e falhas | `rules/rule.entity.ts`, `fault.entity.ts` | Catálogo, condições, ações, compilação e erros de domínio |

`finance-model.ts` mantém a normalização e as definições de métricas, e `exact.ts`
mantém os cálculos monetários e de datas. Schemas de uma mesma entidade ficam
juntos em `*.schema.ts`; DTOs de importação sem comportamento podem usar `.types.ts`.

Os enums e modelos de operações e estado da conta pertencem ao domínio. Os caminhos
históricos de `contracts` os reexportam, preservando os imports públicos e os valores
persistidos. Schemas continuam validando as entradas externas uma vez na fronteira.
SQL traduz seleção, ordenação, precedência de overrides e atualização condicional;
os limites de parâmetros e a codificação monetária do banco permanecem no adaptador.
As condições SQL de maturidade preservam a seleção no banco e os testes de
integração verificam sua correspondência com as políticas de domínio.
Sessão, CSRF, OAuth, HTTP, parsing e ciclo de vida visual têm donos nos respectivos
adaptadores. Guards que fazem narrowing de uniões mantêm essa informação de tipos.
Steps, recibos e batches conservam a ordem e os limites atômicos existentes.

Publicação, recursos, eventos, reaplicação e migração são casos de uso em
`sync/execution.service.ts`; não executam queries nem montam statements.
`sync/execution.repository.ts` faz leituras e commits atômicos por portas tipadas.
A preparação financeira retorna um plano de observação ou publicação, sem builders;
o repository traduz esse plano junto com os checkpoints, progresso e recibos no
mesmo batch. `workflow.ts` é a entrada Cloudflare. O cliente Pluggy, sua configuração
e o adapter Fetch ficam em `pluggy`; `database.ts`, `schema.ts`,
`http.ts` e `bindings.ts` são compartilhados entre funcionalidades.

## Instalação pessoal

Uma pessoa e uma aplicação Pluggy usam cada instalação. Não há cadastro de usuários,
identidade configurável, login GitHub ou cofre próprio. Os três secrets vêm do deploy.
O banco mantém uma única configuração. Todas as conexões e registros pertencem
ao dono da instalação; não há permissões por Item, recurso, conta ou operação.
O histórico de migrações é preservado. A migração `0002_owner_data.sql` remove
os campos antigos de permissões e o vínculo com o Client ID sem alterar os dados
financeiros. A migração inicial exige banco novo; não converte a arquitetura anterior.

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

Cada requisição privada valida a sessão ou o grant OAuth. `live_balance` recebe
`accountId` e consulta a Pluggy com as credenciais atuais da instalação. R2 é somente fonte
de migração explícita; o histórico importado conserva sua origem.

### Independência da origem e recuperação

Pluggy é o adaptador de ingestão e leitura pontual, não a base de consultas do
produto. Consulta, agregação, correção local, explicação, reaplicação de regras e
progresso das operações usam D1, sem executar o cliente ou acessar rede Pluggy.
Isso permite usar o histórico importado durante uma indisponibilidade da origem;
não transforma informação antiga em saldo atual. Cobertura e falha permanecem
explícitas. Novos dados, validação de conexão e `live_balance` dependem da origem.

`FinancialSource` recebe o adaptador por operação e só o resolve quando necessário.
Não há fallback para saldo persistido na leitura pontual. Uma futura fonte deve adaptar os dados e capacidades
de origem, preservando precisão, identidade e cobertura; não exige uma camada
genérica de providers antecipadamente. O payload heterogêneo continua preservado.

`src/worker/sync/entity.ts` concentra modelos, progresso, checkpoints e portas.
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
`use-account.ts` mantém o estado React, a montagem e os timers de polling. O controlador
coordena comandos e cancelamento e publica o estado por uma callback para essa
única view; `account-browser.ts` concentra os efeitos no navegador.
`account-api.ts` valida HTTP e preserva CSRF, deadlines e ausência de retry de
mutações. Leituras concorrentes são consolidadas; confirmar
uma mutação invalida a leitura anterior. Desmontar cancela requisições e timers.
Falha transitória conserva o último estado confirmado; expiração da sessão
interrompe polling. `connect-widget.ts` isola o SDK, serializa sua destruição e
descarta eventos atrasados. A view controla a apresentação e o foco nos títulos;
o adaptador do navegador restaura o foco ao fechar o widget.

Painel e Pluggy estendem o cliente Ky de `src/shared/http.ts`, que concentra
os padrões de transporte. Os consumidores definem prazo total, parsing e limites
de resposta; schemas validam JSON pela API nativa do Ky. Falhas de sessão e da
Pluggy continuam traduzidas nos respectivos adaptadores. `src/shared/crypto.ts`
concentra os hashes estáveis persistidos e a comparação de secrets por digests.

`requestJson` concentra classificação de autorização, redirects e status HTTP,
normalização de falhas de rede, timeout e parsing, e descarte dos corpos rejeitados.
O erro genérico contém apenas categoria, status e metadados de `Retry-After`.
O painel traduz as falhas para sua sessão e mensagens; a Pluggy conserva os códigos
e metadados esperados pelo SDK. O transporte usa retry zero. `rateLimitRetry`
define orçamento e backoff de 429; o adaptador de Steps executa as esperas fora
dos steps duráveis, preservando seus nomes e checkpoints.

O domínio `src/domain/account.entity.ts` decide o estado e o resultado da importação.
O módulo `src/worker/account/entity.ts` projeta esse resultado, a etapa
inicial, a política de atualização e os dados permitidos no diagnóstico. O serviço de conta
inclui essa projeção no campo aditivo `panel` do estado e fornece a configuração
do widget junto ao token. A interface consome essas decisões por contratos tipados;
`account-presentation.ts` contém os textos e formata o diagnóstico seguro. Foco, seleção
visual, visibilidade, cancelamento e ciclo de vida do SDK pertencem ao navegador.

Os contratos de wizard descrevem dados. A tradução de falhas pertence ao Worker.
A política do conector Meu Pluggy pertence ao domínio e valida os dados da origem
no servidor. As credenciais Pluggy são secrets da instalação; o painel não recebe
nem persiste essas credenciais.

O parsing e dispatch de `ToolCall` ficam em `src/worker/mcp/invoke.ts`. Operações financeiras
recebem intenções tipadas após autenticação. Correções usam política do
domínio, mantendo alterações e revisão no repositório concreto.
`exact.ts::assertMinor` concentra a precisão persistível; `moneyKey` mantém o
encoding de ordenação no adaptador SQL. Não há divisão global dos modelos por
simetria nem alteração do catálogo MCP.

`npm run build` gera assets em `dist/web` e executa o dry-run do Worker em
`dist/worker`. Não publica o serviço.

As entidades reúnem modelos e comportamento em `*.entity.ts`, independentes de Zod
e de schemas de validação. Contratos de transporte e DTOs sem comportamento usam
`.types.ts`. Os parsers de entrada permanecem nas fronteiras HTTP/MCP, Pluggy,
configuração e importação; `satisfies z.ZodType<T>`
verifica sua compatibilidade com os modelos. Tipos de linhas e projeções SQL
continuam inferidos do Drizzle. Dados produzidos internamente não ganham schemas
apenas para definir seus tipos. O catálogo de campos do provedor é TypeScript
controlado e verificado no build.

Tasks seguem a revisão 2026-07-28; a JSON Schema
oficial e sua licença ficam em `src/worker/vendor/ext-tasks`. D1 fornece o progresso
canônico e é a única fonte de subscriptions. Os testes de wire exercitam a entrega
do catálogo e as operações MCP; não há snapshot paralelo das declarações internas.

## Ferramentas e testes

Um único `tsconfig.json` verifica fontes e testes com resolução `Bundler` e os
tipos de Node, navegador e Cloudflare. Ele define os aliases `@/` para `src/` e
`@/testing/` para `tests/support/`. Imports de código omitem `.ts`/`.tsx`, e
imports relativos curtos conectam arquivos do mesmo módulo. Vite e Vitest ativam
`resolve.tsconfigPaths`; Wrangler usa os mesmos paths. Scripts e testes Node usam
o loader de desenvolvimento `tsx` nos comandos npm, sem alterar o runtime do Worker.

Entradas `index.ts` de regras, account/auth/finance/sync e do painel account
reexportam services e contratos explicitamente, sem repositories ou adapters.
Internos usam imports diretos; controllers e Workflows que dependem da composição
ficam fora desses índices. Não há índice global de domínio, contratos ou shared misturando código do
navegador com inicialização de logger, persistência ou entrypoints do Worker.

Helpers novos das funcionalidades são tratados como aplicação, mesmo quando
não se chamam `service.ts`. Repositórios/adaptadores e os fluxos de publicação
durável têm papéis explícitos; renomear um serviço não libera SQL ou HTTP.
Views não importam a API, o hook nem o widget, e aplicação/persistência não importam
envelopes MCP. As dependências dos services são contratos explícitos em `entity.ts`.
MCP, Tasks e cron chamam esses services; não acessam repositories diretamente.

Testes unitários ficam em `__tests__` junto ao módulo. `tests/integration` contém
fixtures e testes de D1, HTTP, OAuth e Workflows; `tests/support` contém helpers
exclusivos de testes. `biome.json` concentra lint, formatação e organização de
imports com regras nativas. Restrições de imports bloqueiam SQL fora de repositories,
transporte/composição em services e helpers, services em repositories e imports
do Worker no frontend. Os controles testam casos permitidos e proibidos, incluindo
aliases, imports dinâmicos e tentativas de reexportar persistência por índices.
Os adapters e os imports de tipos de linhas têm exceções explícitas. A localização
semântica de regras de negócio continua na revisão; o lint não interpreta o produto.
Políticas sem cobertura de lint ficam nas
[convenções de contribuição](../CONTRIBUTING.md#layout-e-typescript).
As migrações SQL em `migrations` mantêm sua ordem.

Os comandos e convenções de contribuição estão em [CONTRIBUTING.md](../CONTRIBUTING.md).
A identidade visual está em [DESIGN.md](../DESIGN.md), e a instalação e operação em
[cloudflare-product.md](cloudflare-product.md).
