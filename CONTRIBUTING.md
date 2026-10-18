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

Use a linha Node 24 indicada por `.nvmrc`:

```sh
nvm use
npm ci
npm run check:imports
npm test
npm run lint
npm run format:check
npm run typecheck
npm run test:product
npm run build
npm run test:product:runtime
```

A CI executa os checks com dados sintéticos, SQLite e workerd locais. Não faz
deploy nem consulta bancos reais. Build dry-run e execução local são provas distintas.

## Layout e TypeScript

Oxfmt aplica 80 colunas e um atributo JSX por linha. Execute `npm run lint:fix`
para correções seguras de imports e `npm run format` para layout e ordenação.
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
- Preserve precisão monetária, isolamento por principal/Item e campos da Pluggy.
- Use schemas Zod para modelos e `tryCatch` para recuperação assíncrona.
- Não inclua secrets, dados bancários ou exportações privadas em código e logs.
- Separe merge, deploy, migração real e verificação no cliente MCP.

As convenções estão em [AGENTS.md](AGENTS.md). Código de terceiros mantém seus
avisos de autoria e licenças.
