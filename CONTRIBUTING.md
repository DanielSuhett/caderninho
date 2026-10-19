# Contribuir com o Caderninho

O produto usa Cloudflare Workers, OAuth, D1 e Workflows. O domínio em `src/domain`
não depende do transporte nem do framework. Consulte
[a arquitetura](docs/adr-modular-monolith.md) antes de alterar essa fronteira.

Comece pelo módulo da funcionalidade em `src/worker`: `account`, `auth`,
`finance`, `sync` ou `mcp`. Mantenha funções relacionadas no mesmo arquivo;
controllers cuidam do transporte, services coordenam ações e repositories
encapsulam SQL. Passe dependências por funções ou factories. Preserve entradas
de build e fronteiras de segurança mesmo quando os arquivos são pequenos.

## Validar uma mudança

Use o mise para selecionar Node 24 e executar a rotina local:

```sh
mise trust
mise install
mise run setup
mise run check
```

`mise.toml` seleciona Node 24, igual à `.nvmrc` usada pela CI. O npm acompanha o
Node; as dependências locais e suas versões estão no `package-lock.json`.
`activate_aggressive` mantém as ferramentas do mise à frente do nvm no `PATH`.
Execute `setup` novamente ao mudar o lockfile. `package.json` define os comandos;
o mise fornece o ambiente e as sequências de validação.

| Intenção | Task |
| --- | --- |
| Conferir uma edição | `mise run check:quick` |
| Validar uma entrega local | `mise run check` |
| Corrigir lint e layout | `mise run lint:fix` e `mise run format` |
| Ver todos os diagnósticos | `mise run lint:all` ou `mise run --quiet lint:json` |
| Verificar tipos gerados sem reescrever | `mise run types:check` |
| Diagnosticar Ultracite e Biome | `mise run lint:doctor` |
| Abrir o ambiente local | `mise run dev` |

Consulte `mise tasks ls` para todas as tasks. Para comandos avulsos, use
`mise exec -- <comando>`. Os checks executam em sequência e param na primeira
falha; não instalam dependências, corrigem arquivos ou publicam o projeto.
O check rápido e o completo verificam os tipos gerados; lint e tipos rodam antes
dos testes e do build. `lint:doctor` é um diagnóstico explícito da instalação.
`types` regenera os bindings e `migrate:local` aplica migrações apenas no D1 local.
Para manter a geração igual à CI, `types` lê os nomes de secrets do arquivo
versionado `.dev.vars.example`, sem consultar o `.dev.vars` local.
Deploy é um comando explícito separado e inclui migração remota.

Os scripts npm continuam disponíveis sem o mise: selecione Node 24 pela `.nvmrc`
com `nvm use`, execute `npm ci` e os comandos de `package.json`.

A CI executa os checks com dados sintéticos, SQLite e workerd locais. Não faz
deploy nem consulta bancos reais. Build dry-run e execução local são provas distintas.

O [relatório visual da sessão de 18/10/2026](docs/visuals/sessao-arquitetura-2026-10-18.html)
registra as refatorações, evidências e arquivos alterados naquele ciclo.

## Layout e TypeScript

Ultracite 8 usa Biome com os presets `core`, `react` e `vitest`. As regras próprias
de camadas, imports, promises e layout continuam após os presets em `biome.json`.
Os extras `type-aware` e `js-plugins` permanecem desativados. A regra que proíbe
barrels tem uma exceção nos arquivos `index.ts`, que definem as entradas dos
módulos. Consulte o
[setup oficial](https://www.ultracite.ai/docs/setup) para atualizar a integração.

Execute `mise exec -- npx ultracite fix` para lint e formatação,
`mise exec -- npx ultracite check` para verificar e
`mise exec -- npx ultracite doctor` para diagnosticar a instalação.
Não desative regras para eliminar diagnósticos; preserve invariantes financeiros,
ordem dos checkpoints e contratos ao revisar sugestões de performance.

Biome aplica 80 colunas e atributos JSX em múltiplas linhas. Execute `npm run lint:fix`
para correções seguras e organização de imports e `npm run format` para layout.
Revise consolidação de imports separadamente da formatação global; repetir os
dois comandos depois da consolidação deve produzir zero alterações adicionais.
Imports com valores e tipos usam `import { value, type Type }`; imports só de
tipos usam `import type`. Preserve caminhos relativos, comentários e a ordem
dos imports com efeitos colaterais. Reexports declaram a origem com `export { nome } from`;
imports usados localmente permanecem separados.

`biome.json` é a fonte das regras ativas. Use regras nativas, sem plugins próprios
para reproduzir regras indisponíveis. Políticas como a forma de consumir
`tryCatch` e a localização semântica das regras de negócio são convenções de
revisão em `AGENTS.md`. As dependências entre camadas são verificadas pelas
restrições nativas de imports; o lint de promises complementa essa revisão e o `tsc`.

TypeScript 7 verifica acessos indexados e propriedades opcionais exatas: valide
a presença antes de consumir e omita campos opcionais ausentes. Um único
`tsconfig.json` verifica fontes e testes com resolução `Bundler`. O lint semântico
complementa o `tsc`, que continua separado.

### Imports e entradas públicas

Imports locais usam caminhos relativos em fontes, testes e configurações. Vite,
Vitest e Wrangler resolvem esses caminhos sem aliases do projeto. Os testes e
scripts Node usam `node --import tsx` pelos comandos npm/mise para resolver
extensões TypeScript e os índices de diretórios em ESM.

- Omita `.ts`/`.tsx` em imports, reexports e imports dinâmicos. Preserve extensões
  de assets, como `.css` e `.json`, e os caminhos exigidos por pacotes externos.
- Consuma outros módulos pelo diretório, como `../../domain`, `../../contracts`
  ou `../finance`. Omita `/index`; imports de dependências mantêm o nome do pacote.
- Use `./arquivo` ou `../arquivo` para implementações do mesmo módulo. Um arquivo
  interno não importa o próprio barrel; testes podem consumir a entrada pública.
- `index.ts` define APIs públicas com exports nomeados, inclusive `export type`.
  Controllers, Workflows e outros entrypoints que dependem da composição mantêm
  entradas separadas dos índices consumidos por ela.
- Domínio, regras, contratos, utilitários e módulos da aplicação expõem índices.
  Persistência, transporte e modelos do Worker têm índices próprios. O logger,
  os helpers de processos Node e os mocks de Vitest ficam em módulos separados
  para preservar seus ambientes de execução. O barrel de `shared` não inicializa
  o logger; `mount-account.tsx` inicializa o navegador fora do índice de páginas.

O lint nativo bloqueia aliases locais `@/` e `#`, as extensões `.ts`/`.tsx` e
dependências proibidas entre camadas, com paths relativos ou aliases, incluindo
imports dinâmicos, reexports e helpers que não se chamam `service.ts`.
O check executa o Biome diretamente.

### Camadas dos módulos

Use `entity/index.ts`, `controller/index.ts`, `service.ts`, `repository/` e
`__tests__` como estrutura padrão de `account`, `auth`, `finance` e `sync`. As entidades locais
definem os contratos de dependências; as regras puras compartilhadas continuam
em `src/domain/*.entity.ts`. Types de linhas podem ser inferidos de Drizzle por
imports exclusivamente de tipo em `entity/index.ts`, sem carregar o schema
em runtime.

- Controllers validam transporte e chamam casos de uso. Não recebem builders,
  repositories ou funções que exigem D1.
- Services coordenam as ações por portas tipadas, sem `Bindings`, cliente HTTP,
  ORM ou tipos inferidos dos factories concretos. Helpers seguem a mesma regra.
- Repositories recebem D1 e executam SQL, inclusive batches atômicos. Não chamam
  services, controllers, composição ou rede. A composição injeta cada porta.
- Índices públicos exportam services e contratos. Implementações de persistência
  têm um índice próprio, acessível à composição e aos testes de integração.
- `sync/execution.service.ts` concentra os steps duráveis e
  `sync/repository/execution.repository.ts` concentra sua persistência atômica.
  Os repositories especializados de `finance`, os adapters Pluggy/OAuth e os transportes MCP e
  Workflow são exceções por responsabilidade; não precisam de camadas vazias.

O lint restringe dependências; a revisão ainda precisa confirmar que decisões de
produto estão em entidades ou casos de uso. Mudar um nome de arquivo não justifica
misturar rede, regra e persistência em um repository.

```ts
// A partir de src/worker/composition/index.ts:
import { hash } from "../../shared";
import { createAccountService } from "../account";
```

Use `if (objeto)` e `if (!lista.length)` para presença de objetos e coleções
vazias, `!!valor` quando for necessário produzir um booleano e
`...(condição && { campo })` para campos opcionais. Ausência e falsy são decisões
diferentes: compare explicitamente `null` e `undefined` e use `valor ?? padrão` para
preservar zero, falso e texto vazio. Mantenha comparações exatas quando o contrato
exigir um sentinel específico, como IDs de JSON-RPC, exclusão de override e flags
numéricas do banco. Um array vazio continua sendo um objeto presente.

Prefira enums nos conjuntos fechados do produto, como `Resource.transactions`,
`OperationKind.sync` e `RuleAction.set_category`. O padrão do projeto é um objeto
`as const` com a união dos valores derivada quando necessária; ele funciona com
`erasableSyntaxOnly` e a execução direta de TypeScript no Node. Declare o conjunto
no módulo que o possui e reutilize os valores nos schemas Zod, tipos e regras.
Preserve os valores públicos; chaves de objetos, textos livres e valores abertos
do provedor continuam strings. Nos testes de contrato, mantenha valores literais
esperados para verificar a representação pública de forma independente dos enums.

Para revisar performance, use dados sintéticos e compare resultados além do tempo.
Benchmarks pontuais não entram na CI nem definem asserts de duração. Medições
no Node não estimam latência de rede ou CPU do Worker em produção.
Agrupe leituras de I/O independentes; mantenha paginação, publicação e checkpoints
na ordem exigida pelo fluxo. Evite acumular engines de regras com `Promise.all`
em trabalho que só executa CPU JavaScript, e preserve os batches atômicos.

## Logs

Use o módulo `shared/logger`, por caminho relativo, para os logs da aplicação e
dos scripts. O Pino
filtra níveis antes de serializar: `LOG_LEVEL` aceita `fatal`, `error`, `warn`,
`info`, `debug`, `trace` ou `silent`; ausência ou valor inválido usa `warn`.
Sucesso, polling, recusas esperadas e cancelamento normal ficam em `debug`.
Recuperações pendentes e resultados parciais geram resumos em `warn`; falhas
inesperadas geram um diagnóstico primário em `error`. Classifique o resultado do
processo: erros MCP também podem chegar com HTTP 200, e configuração incompleta
pode responder 503 sem representar falha inesperada.

No Worker, use a fronteira `worker/observability` para contexto isolado,
classificação segura, deduplicação e spans nativos. Controllers e adapters
instrumentam transporte; composição envolve as portas. Services comunicam
recuperações por callbacks estreitos e continuam sem logger ou SDK de tracing.
Use nomes fixos e contagens por lote. Logs e spans customizados não incluem URLs,
corpos, identidades financeiras, argumentos ou texto arbitrário de exceções.

No Node, a saída JSON usa escrita assíncrona com buffer limitado a 64 KiB;
sob saturação, novas mensagens que excedem o limite são descartadas. No Worker,
Wrangler seleciona o build browser do Pino, com objetos estruturados enviados ao
logger nativo da plataforma. Essa saída não usa transportes Node nem buffer
assíncrono próprio. O filtro de nível reduz o volume antes da saída. Logs têm
amostragem 1 e traces 0.1 no Wrangler, com invocation logs desabilitados.
Pino não elimina o custo de CPU dos logs. O lint impede chamadas diretas de
`console` no código mantido pelo projeto. Consulte o
[roteiro de observabilidade](docs/observability.md) para investigar processos e
entender os limites da coleta nativa.

## Critério para testes

Teste comportamentos observáveis do produto: resultados financeiros, autorização,
persistência, contratos de transporte e efeitos da interface. Evite snapshots de
declarações internas, inspeção de fontes/configurações, testes do próprio harness e
casos repetidos em camadas diferentes sem exercitar uma integração adicional.
Lint, formatação, tipos e fronteiras de imports são executados diretamente pelo
check. Helpers e fixtures exclusivos de um teste removido devem sair junto dele.

Skills em `.agents/`, hooks em `.codex/` e o arquivo `skills-lock.json` são
configuração local do agente e ficam fora dos commits. O setup gera o hook de
formatação do Codex; revise-o em `/hooks` para habilitá-lo em um projeto confiável.

## Escopo dos PRs

- Descreva o comportamento resultante e a validação obtida.
- Preserve precisão monetária, validação de Item/conta e campos da Pluggy.
- No domínio, reúna tipos, enums e regras puras por conceito em `*.entity.ts`.
  Use `.types.ts` para DTOs e modelos técnicos sem comportamento.
  Zod valida dados externos nas fronteiras; schemas devem satisfazer os tipos
  correspondentes. A recuperação assíncrona exige `tryCatch` com desestruturação
  de `{ data, error }` e checagem de `error` antes do uso de `data`. Prefira passar
  uma função para capturar falhas no início da operação; promises já criadas são
  aceitas. Campos sem uso recebem alias como `_data`, mantendo o lint ativo.
- Não inclua secrets, dados bancários ou exportações privadas em código e logs.
- Separe merge, deploy, migração real e verificação no cliente MCP.

As convenções estão em [AGENTS.md](AGENTS.md). Código de terceiros mantém seus
avisos de autoria e licenças.
