# Contribuir com o Caderninho

Consulte [AGENTS.md](AGENTS.md) para convenções de código, imports, camadas e
tratamento de falhas; [arquitetura](docs/adr-modular-monolith.md) para persistência,
importação e segurança; [design](DESIGN.md) para mudanças de interface.

## Preparar e validar

Use Node 24 pelo mise, igual à `.nvmrc` da CI:

```sh
mise trust
mise install
mise run setup
mise run check
```

`package.json` define comandos; `package-lock.json` fixa dependências. Repita
`setup` ao mudar o lockfile. Sem mise, selecione a `.nvmrc`, execute `npm ci`
e use os scripts npm. `activate_aggressive` mantém o mise à frente do nvm no PATH.

| Intenção | Comando |
| --- | --- |
| Conferir uma edição | `mise run check:quick` |
| Validar a entrega | `mise run check` |
| Corrigir lint e layout | `mise run lint:fix` e `mise run format` |
| Ver todos os diagnósticos | `mise run lint:all` ou `mise run --quiet lint:json` |
| Abrir o ambiente local | `mise run dev` |

Consulte `mise tasks ls`; comandos avulsos usam `mise exec -- <comando>`.
Os checks são sequenciais, param na primeira falha e não instalam, corrigem nem
publicam. O rápido verifica configuração, tipos gerados, TypeScript, formato e
lint; o completo acrescenta testes, build dry-run e runtime local D1/Workflow.

`types` regenera bindings usando somente os nomes de secrets de
`docs/dev.vars.example`; `types:check` confere sem reescrever. O exemplo fica fora
da raiz para não gerar campos de secrets no Deploy to Cloudflare. `migrate:local` usa
somente D1 local. Deploy é separado e inclui inicialização do D1 remoto.

Enquanto o projeto estiver em pré-produção, mantenha o modelo inicial completo
em `migrations/0001_initial.sql` e seus tipos em `src/worker/schema/index.ts`.
Não acrescente upgrades ou backfills para schemas experimentais descartados.
Os testes iniciam bancos novos com esse mesmo schema.

## Ferramentas e revisão

`biome.json` define as regras ativas sobre os presets Ultracite core/react/vitest:
camadas, imports, promises e layout de 80 colunas. TypeScript estrito verifica
fontes e testes pelo mesmo `tsconfig.json`; Biome não substitui o compilador.
Não desative regras nem use `--unsafe` global para eliminar diagnósticos.

`mise exec -- npx ultracite doctor` diagnostica a instalação; `check` verifica e
`fix` aplica correções seguras. Revise o diff após lint/formato; nova execução deve
convergir sem alterações. Preserve comentários e imports com efeitos colaterais.
O lint verifica dependências entre camadas; a revisão ainda deve conferir a
localização das decisões de produto e o uso de `tryCatch` descrito em AGENTS.

Domínio e shared não importam contratos de transporte. Entities e repositories
não consomem os índices de aplicação de planning/household. No frontend, importe
Kumo pela entrada específica, como `@cloudflare/kumo/components/banner`;
o barrel principal carrega dependências de navegador nas páginas do Worker.

Use `shared/logger` e siga o [roteiro de observabilidade](docs/observability.md).
Não registre secrets, dados financeiros ou texto arbitrário de exceções.

Teste comportamentos observáveis: dinheiro, autorização, persistência, transporte
e efeitos da interface. Evite testes que inspecionam fontes/configurações, o
próprio harness ou repetem cenários sem integração adicional. Helpers e fixtures
exclusivos de testes removidos devem sair junto deles. Benchmarks usam dados
sintéticos e não impõem asserts de duração na CI.

## Entregar um PR

Descreva o comportamento resultante, os checks executados e os limites da prova.
Preserve contratos públicos, dinheiro exato, identidade da origem, replay e
batches atômicos. A CI usa dados sintéticos e não faz deploy nem consulta bancos
reais; build dry-run não comprova Pluggy, OAuth em host MCP ou produção.
Merge, deploy e migração remota exigem autorização separada.

Secrets, dados privados e configuração local de agentes ficam fora dos commits:
`.agents/`, `.codex/` e `skills-lock.json`. O setup gera o hook de formatação do
Codex; revise-o em `/hooks` antes de habilitá-lo em um projeto confiável.
Preserve avisos de autoria e licenças de terceiros.
