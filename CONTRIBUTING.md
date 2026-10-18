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

Durante uma edição, use `mise run check:quick`. Consulte `mise tasks ls` e o
[guia do mise](docs/mise.md) para tasks individuais, diagnóstico completo do
Biome e as decisões baseadas no histórico recente. O lint ainda tem os
diagnósticos pendentes registrados no [relatório](docs/reports/biome-migration.md);
por isso as sequências que o incluem ainda terminam com erro.

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

TypeScript 7 verifica acessos indexados e propriedades opcionais exatas: valide
a presença antes de consumir e omita campos opcionais ausentes. Um único
`tsconfig.json` verifica fontes, ferramentas e testes com NodeNext. O lint
semântico complementa o `tsc`, que continua separado. O checker de imports usa
o parser Oxc e resolução nativa de aliases `#`, sem loader ou aliases duplicados.

Os CLIs `scripts/import-rules.ts` e `scripts/migrate-r2.ts` usam dry-run por
padrão. Operações remotas exigem flags explícitas, endpoint HTTPS e token no
ambiente; as requisições têm prazo de 45 segundos, sem retries automáticos.
O prerender encerra naturalmente; as fixtures encerram seus servidores e
subprocessos em falhas, SIGINT e SIGTERM.

## Escopo dos PRs

- Descreva o comportamento resultante e a validação obtida.
- Preserve precisão monetária, validação de Item/conta e campos da Pluggy.
- Use schemas Zod para modelos e `tryCatch` para recuperação assíncrona.
- Não inclua secrets, dados bancários ou exportações privadas em código e logs.
- Separe merge, deploy, migração real e verificação no cliente MCP.

As convenções estão em [AGENTS.md](AGENTS.md). Código de terceiros mantém seus
avisos de autoria e licenças.
