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
| Abrir o ambiente local | `mise run dev` |

Consulte `mise tasks ls` para todas as tasks. Para comandos avulsos, use
`mise exec -- <comando>`. Os checks executam em sequência e param na primeira
falha; não instalam dependências, corrigem arquivos ou publicam o projeto.
`types` regenera os bindings e `migrate:local` aplica migrações apenas no D1 local.
Deploy é um comando explícito separado e inclui migração remota.

Os scripts npm continuam disponíveis sem o mise: selecione Node 24 pela `.nvmrc`
com `nvm use`, execute `npm ci` e os comandos de `package.json`.

A CI executa os checks com dados sintéticos, SQLite e workerd locais. Não faz
deploy nem consulta bancos reais. Build dry-run e execução local são provas distintas.

## Layout e TypeScript

Biome aplica 80 colunas e atributos JSX em múltiplas linhas. Execute `npm run lint:fix`
para correções seguras e organização de imports e `npm run format` para layout.
Revise consolidação de imports separadamente da formatação global; repetir os
dois comandos depois da consolidação deve produzir zero alterações adicionais.
Imports com valores e tipos usam `import { value, type Type }`; imports só de
tipos usam `import type`. Preserve aliases, comentários e a ordem dos imports
com efeitos colaterais. Reexports usam bindings locais quando já importados.

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

`tsconfig.json` é a única definição dos aliases: `@/` aponta para `src/` e
`@/testing/` para `tests/support/`. Vite e Vitest ativam `resolve.tsconfigPaths`;
Wrangler lê os mesmos paths. Os testes e scripts Node usam `node --import tsx`
pelos comandos npm/mise, pois o Node nativo não resolve esses aliases nem procura
extensões TypeScript em imports relativos.

- Omita `.ts`/`.tsx` em imports, reexports e imports dinâmicos. Preserve extensões
  de assets, como `.css` e `.json`, e os caminhos exigidos por pacotes externos.
- Use `./arquivo` ou `../arquivo` para implementações próximas do mesmo módulo.
  Use `@/domain/account.entity`, por exemplo, para cruzar módulos e evitar cadeias
  de `../../`. Imports de dependências mantêm o nome do pacote.
- `index.ts` define APIs públicas com exports nomeados, inclusive `export type`.
  Arquivos internos usam imports diretos para evitar ciclos pelo próprio índice.
  Controllers, Workflows e outros entrypoints que dependem de `composition.ts`
  permanecem fora dos índices consumidos pela composição.
- Há entradas públicas para regras, account/auth/finance/sync do Worker e o
  painel account do frontend. `shared` mantém imports por utilitário para evitar
  que um índice global carregue logger, HTTP e criptografia juntos no navegador.

O lint nativo bloqueia os aliases antigos `#`, as extensões `.ts`/`.tsx` e
dependências proibidas entre camadas, com paths relativos ou aliases, incluindo
imports dinâmicos, reexports e helpers que não se chamam `service.ts`.
O check executa o Biome diretamente.

### Camadas dos módulos

Use `entity.ts`, `controller.ts`, `service.ts`, `repository.ts` e `__tests__` como
estrutura padrão de `account`, `auth`, `finance` e `sync`. As entidades locais
definem os contratos de dependências; as regras puras compartilhadas continuam
em `src/domain/*.entity.ts`. Types de linhas podem ser inferidos de Drizzle por
imports exclusivamente de tipo em `entity.ts`, sem carregar o schema em runtime.

- Controllers validam transporte e chamam casos de uso. Não recebem builders,
  repositories ou funções que exigem D1.
- Services coordenam as ações por portas tipadas, sem `Bindings`, cliente HTTP,
  ORM ou tipos inferidos dos factories concretos. Helpers seguem a mesma regra.
- Repositories recebem D1 e executam SQL, inclusive batches atômicos. Não chamam
  services, controllers, composição ou rede. A composição injeta cada porta.
- Índices públicos exportam services e contratos. Implementações de persistência
  ficam acessíveis à composição e aos testes de integração por imports diretos.
- `sync/execution.service.ts` concentra os steps duráveis e
  `sync/execution.repository.ts` concentra sua persistência atômica. Os repositories
  especializados de `finance`, os adapters Pluggy/OAuth e os transportes MCP e
  Workflow são exceções por responsabilidade; não precisam de camadas vazias.

O lint restringe dependências; a revisão ainda precisa confirmar que decisões de
produto estão em entidades ou casos de uso. Mudar um nome de arquivo não justifica
misturar rede, regra e persistência em um repository.

```ts
import { tryCatch } from "@/shared/result";
import { createAccountService } from "@/worker/account";

import { accountPanel } from "./panel";
```

Use `if (objeto)` e `if (!lista.length)` para presença de objetos e coleções
vazias, `!!valor` quando for necessário produzir um booleano e
`...(condição && { campo })` para campos opcionais. Ausência e falsy são decisões
diferentes: use `valor == null` para `null`/`undefined` e `valor ?? padrão` para
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

Use `@/shared/logger` para todos os logs da aplicação e dos scripts. O Pino
filtra níveis antes de serializar: `LOG_LEVEL` aceita `fatal`, `error`, `warn`,
`info`, `debug`, `trace` ou `silent`; ausência ou valor inválido usa `warn`.
Requisições com sucesso e redirecionamentos ficam em `debug`, respostas 4xx em
`warn` e 5xx em `error`. Diagnósticos HTTP incluem apenas correlação, categoria
da rota, status e duração, sem URLs, corpos, identidades ou texto de exceções.

No Node, a saída JSON usa escrita assíncrona com buffer limitado a 64 KiB;
sob saturação, novas mensagens que excedem o limite são descartadas. No Worker,
Wrangler seleciona o build browser do Pino, com objetos estruturados enviados ao
logger nativo da plataforma. Essa saída não usa transportes Node nem buffer
assíncrono próprio. O filtro de nível reduz o volume antes da saída; a amostragem
configurada no Wrangler controla a retenção. Pino não elimina o custo de CPU dos
logs. O lint impede chamadas diretas de `console` no código mantido pelo projeto.

## Critério para testes

Teste comportamentos observáveis do produto: resultados financeiros, autorização,
persistência, contratos de transporte e efeitos da interface. Evite snapshots de
declarações internas, inspeção de fontes/configurações, testes do próprio harness e
casos repetidos em camadas diferentes sem exercitar uma integração adicional.
Lint, formatação, tipos e fronteiras de imports são executados diretamente pelo
check. Helpers e fixtures exclusivos de um teste removido devem sair junto dele.

Skills em `.agents/` e o arquivo `skills-lock.json` são configuração local do
agente e ficam fora dos commits.

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
