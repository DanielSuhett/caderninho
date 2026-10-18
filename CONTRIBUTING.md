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
`tryCatch` e a separação de responsabilidades são convenções de revisão em
`AGENTS.md`; o lint de promises complementa essa revisão e o `tsc`.

TypeScript 7 verifica acessos indexados e propriedades opcionais exatas: valide
a presença antes de consumir e omita campos opcionais ausentes. Um único
`tsconfig.json` verifica fontes e testes com NodeNext. O lint semântico
complementa o `tsc`, que continua separado.

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

## Critério para testes

Teste comportamentos observáveis do produto: resultados financeiros, autorização,
persistência, contratos de transporte e efeitos da interface. Evite snapshots de
declarações internas, inspeção de fontes/configurações, testes do próprio harness e
casos repetidos em camadas diferentes sem exercitar uma integração adicional.
Lint, formatação, tipos e fronteiras de imports são executados diretamente pelo
check. Helpers e fixtures exclusivos de um teste removido devem sair junto dele.

## Escopo dos PRs

- Descreva o comportamento resultante e a validação obtida.
- Preserve precisão monetária, validação de Item/conta e campos da Pluggy.
- Use interfaces e uniões em arquivos `.types.ts` para modelos compartilhados.
  Zod valida dados externos nas fronteiras; schemas devem satisfazer os tipos
  correspondentes. A recuperação assíncrona exige `tryCatch` com desestruturação
  de `{ data, error }` e checagem de `error` antes do uso de `data`. Prefira passar
  uma função para capturar falhas no início da operação; promises já criadas são
  aceitas. Campos sem uso recebem alias como `_data`, mantendo o lint ativo.
- Não inclua secrets, dados bancários ou exportações privadas em código e logs.
- Separe merge, deploy, migração real e verificação no cliente MCP.

As convenções estão em [AGENTS.md](AGENTS.md). Código de terceiros mantém seus
avisos de autoria e licenças.
