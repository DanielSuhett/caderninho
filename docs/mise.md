# Ambiente e tasks com mise

Na raiz do repositório:

```sh
mise trust
mise install
mise run setup
mise run check:quick
```

O [mise](https://mise.jdx.dev/getting-started.html) precisa estar instalado no
computador; estas tasks foram verificadas com a versão 2026.10.7.
`mise trust` autoriza a configuração deste checkout; revise
`mise.toml` antes de confiar em um repositório desconhecido. `mise install`
instala Node 24, e `setup` executa `npm ci`. Não é necessário ativar o mise no
shell para usar `mise run` ou `mise exec`.

## Dependências e versões

`mise.toml` seleciona a linha Node 24, igual à `.nvmrc` usada pela CI. A versão
disponível e validada nesta máquina é 24.21.0. A configuração permite atualizações
de patch nessa linha; ela não fixa um patch nem substitui o lockfile do npm.
Ao mudar a linha do Node, atualize os dois arquivos.

`activate_aggressive=true` mantém as ferramentas do mise à frente de entradas
adicionadas ao `PATH` pelo nvm. A primeira execução de `setup` revelou que, sem
isso, o npm ainda encontrava Node 22 no ambiente herdado e falhava com
`EBADENGINE`. A precedência fica configurada no projeto, sem editar o shell do
usuário. Veja a [opção oficial](https://mise.jdx.dev/configuration/settings.html#activate-aggressive).

O npm acompanha o Node. Biome, TypeScript, Vite, Vitest, Wrangler, esbuild e o
parser Oxc continuam como dependências locais, fixadas em `package-lock.json`.
Não há instalações globais duplicadas, novo gerenciador de pacotes ou dependência
de Python para executar as tasks. `package.json` continua definindo os comandos;
o mise fornece ambiente, atalhos e sequências de validação.

## Rotina de desenvolvimento

| Intenção | Task | Comportamento |
| --- | --- | --- |
| Instalar dependências | `mise run setup` | `npm ci`; execute ao preparar o checkout ou após mudar o lockfile |
| Conferir uma edição | `mise run check:quick` | Configuração do mise, imports, tipos, layout e lint |
| Validar uma entrega local | `mise run check` | Checks rápidos, testes unitários, integração, build e runtime; lint ao final |
| Desenvolver | `mise run dev` | Build do portal e servidor local do Wrangler |
| Consultar as tasks | `mise tasks ls` | Lista com a descrição de cada comando |

As sequências são seriais e interrompem na primeira falha. O lint fica por último
para que novos diagnósticos não impeçam a execução dos outros checks.
Uma falha de testes ou de tipos ainda interrompe a sequência imediatamente.
Nenhum check executa `npm ci`, aplica correções ou publica o projeto.
O próprio mise pode instalar Node se a versão configurada estiver ausente.
O build gera artefatos locais e o runtime usa dados sintéticos.
Não há cache de tasks que possa pular uma validação após uma mudança.

As tasks individuais mantêm os nomes dos scripts npm:

| Grupo | Tasks |
| --- | --- |
| Código | `check:imports`, `typecheck`, `lint`, `lint:fix` |
| Layout | `format`, `format:check` |
| Testes | `test`, `test:product`, `test:product:runtime` |
| Build e ambiente local | `build`, `build:portal`, `dev`, `types`, `migrate:local` |
| Diagnóstico do Biome | `lint:all`, `lint:json` |

`format` formata o código com Biome e o TOML com `mise fmt`. `format:check`
verifica o código; as sequências `check` e `check:quick` verificam também o TOML.
`lint:fix` só solicita as correções seguras do Biome, sem `--unsafe`, e pode sair
com erro se restarem problemas. Nesse caso, execute `mise run format`
separadamente e revise o diff; as tasks de validação não corrigem arquivos.

`types` regenera `src/worker/runtime.d.ts`; revise o diff quando mudar bindings.
`migrate:local` altera somente o D1 local. Nenhuma sequência chama essa task.
O deploy permanece no comando explícito `npm run deploy`, que inclui migração
remota. Ele não faz parte das tasks do mise nem da validação local.

## O que o histórico recente mostrou

Estas escolhas vêm dos comandos usados durante a refatoração de clareza, a adoção
das regras e a migração para Biome:

| Repetição observada | Atalho atual | Benefício concreto |
| --- | --- | --- |
| `mise exec node@24 -- npm ...` em cada chamada, porque o shell tinha Node 22 | `mise run <task>` | Executa com Node 24 automaticamente, inclusive sem ativação do shell |
| Imports, `tsc`, formatação e lint executados separadamente a cada edição | `mise run check:quick` | Mantém uma sequência explícita e deixa o `tsc` independente do lint |
| Testes Node, Vitest, build dry-run e teste real do workerd local | `mise run check` | Executa cada prova, em sequência, sem disputar os recursos dos testes pesados |
| Biome truncando diagnósticos e necessidade de contar regras/arquivos | `mise run lint:all` ou `lint:json` | Exibe todos os diagnósticos ou permite analisá-los em formato estruturado |
| Wrangler tentando gravar logs fora do workspace | Ambiente do `mise.toml` | Grava logs em `.wrangler/logs/wrangler.log`, já ignorado pelo Git |

O ambiente também desativa a telemetria do Wrangler e usa
`CLOUDFLARE_CF_FETCH_ENABLED=false`, como a CI. Não carrega automaticamente
arquivos com credenciais. Os scripts existentes continuam responsáveis pelo
ciclo de vida dos servidores, fixtures e subprocessos.

Para obter JSON sem prefixos ou banners do npm:

```sh
mise run --quiet lint:json > /tmp/caderninho-lint.json
```

A saída é JSON mesmo quando o processo termina com código de erro por causa dos
diagnósticos. Não use `|| true` para transformar esse resultado em aprovação.

Para executar um script administrativo que não tenha task:

```sh
mise exec -- node scripts/import-rules.ts --help
```

## Limites e verificação

O mise não resolve os diagnósticos de clareza nem adiciona equivalentes ausentes
do Biome. O [relatório da migração](reports/biome-migration.md) preserva o baseline
de 630 erros, 3 warnings e 86 informações. A correção posterior zerou todos esses
diagnósticos, mantendo as regras ativas e a falha do comando em futuros warnings.

Testes Node com servidores HTTP, Vitest e o runtime precisam abrir portas locais.
Em execução restrita, `listen EPERM` indica falta de permissão de loopback: o mise
seleciona ferramentas, mas não concede permissões ao sandbox. Logs em um diretório
gravável também não resolvem essa restrição de rede.

Valide a definição das tasks com `mise tasks validate` e visualize a sequência
sem executá-la com `mise run --dry-run check`. Veja as referências oficiais sobre
[tasks](https://mise.jdx.dev/tasks/) e
[configuração de tasks](https://mise.jdx.dev/tasks/task-configuration.html).

Checks locais e build dry-run não provam deploy, login OAuth real ou funcionamento
em um cliente MCP. O mise não altera essa distinção.
