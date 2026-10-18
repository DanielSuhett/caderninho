# Diagnóstico após migração para Biome

Data: 18 de outubro de 2026. Biome 2.5.15, Node 24.

Estado atual após correção: **0 erros, 0 warnings e 0 informações** em 113
arquivos verificados. `mise run lint` passa com as mesmas regras e
`--error-on-warnings`, sem supressões.

O baseline abaixo registra o momento imediatamente após a migração:
**630 erros, 3 warnings e 86 informações**, em 78 arquivos com diagnósticos.
Naquele momento, só as cinco diferenças do formatter tinham sido aplicadas.

## Correções posteriores

- Chaves em todas as cláusulas, organização de imports, templates e acesso por
  chave literal; correções automáticas limitadas às regras revisadas.
- Projeção de campos, conversão/aplicação de regras, leitura limitada de streams,
  filtros e fluxos de sync separados em funções locais com responsabilidades
  explícitas. Mantidos batches atômicos e nomes dos passos de Workflow.
- Estado mutável de autenticação e React explicitamente tipado; leitura de
  cancelamento preservada após awaits. Contagem recursiva de manifests passa
  pelo retorno da função em vez de depender de mutação capturada.
- Promessas Drizzle de fixtures executadas com `.run()`, respostas terminais
  tipadas pelo retorno do parser existente e callbacks sem retornos indevidos.
- Seletor CSS geral antes dos específicos e parâmetro OAuth não usado removido,
  com seus chamadores atualizados.

## Diagnósticos do baseline por regra

| Regra | Quantidade |
| --- | ---: |
| `lint/style/useBlockStatements` | 556 |
| `lint/style/useTemplate` | 65 |
| `assist/source/organizeImports` | 48 |
| `lint/complexity/useLiteralKeys` | 21 |
| `lint/complexity/noExcessiveCognitiveComplexity` | 14 |
| `lint/suspicious/noUnnecessaryConditions` | 5 |
| `lint/suspicious/useIterableCallbackReturn` | 2 |
| `lint/suspicious/noImplicitAnyLet` | 2 |
| `lint/nursery/useAwaitThenable` | 2 |
| `lint/style/noDescendingSpecificity` | 1 |
| `lint/complexity/useOptionalChain` | 1 |
| `lint/correctness/noUnusedFunctionParameters` | 1 |
| `lint/nursery/noMisusedPromises` | 1 |

## Warnings do baseline que também bloqueavam o comando

| Local | Regra | Mensagem |
| --- | --- | --- |
| `src/web/account.css:39:1` | `lint/style/noDescendingSpecificity` | Descending specificity selector found. This selector specificity is (0, 0, 1) |
| `src/web/account/use-account.ts:94:5` | `lint/complexity/useOptionalChain` | Change to an optional chain. |
| `src/worker/auth/controller.ts:29:23` | `lint/correctness/noUnusedFunctionParameters` | This parameter env is unused. |

## Arquivos com diagnósticos no baseline

| Arquivo | Erros | Warnings | Informações |
| --- | ---: | ---: | ---: |
| `scripts/__tests__/cli.test.ts` | 0 | 0 | 1 |
| `scripts/__tests__/imports.test.ts` | 2 | 0 | 0 |
| `scripts/admin-request.ts` | 1 | 0 | 1 |
| `scripts/check-imports.ts` | 21 | 0 | 0 |
| `scripts/import-rules.ts` | 5 | 0 | 1 |
| `scripts/migrate-r2.ts` | 13 | 0 | 1 |
| `src/contracts/mcp-contract.ts` | 2 | 0 | 0 |
| `src/contracts/queries.ts` | 1 | 0 | 0 |
| `src/domain/__tests__/exact.test.ts` | 7 | 0 | 4 |
| `src/domain/__tests__/finance.test.ts` | 1 | 0 | 0 |
| `src/domain/__tests__/record-correction.test.ts` | 1 | 0 | 0 |
| `src/domain/__tests__/subscriptions.test.ts` | 1 | 0 | 6 |
| `src/domain/entity.ts` | 9 | 0 | 0 |
| `src/domain/exact.ts` | 11 | 0 | 0 |
| `src/domain/fault.ts` | 2 | 0 | 0 |
| `src/domain/finance-model.ts` | 23 | 0 | 4 |
| `src/domain/outputs.ts` | 1 | 0 | 0 |
| `src/domain/provider-state.ts` | 6 | 0 | 0 |
| `src/domain/record-correction.ts` | 2 | 0 | 0 |
| `src/domain/rules/__tests__/rules.test.ts` | 3 | 0 | 0 |
| `src/domain/rules/convert-rules.ts` | 20 | 0 | 0 |
| `src/domain/rules/import-rules.ts` | 18 | 0 | 2 |
| `src/domain/rules/rules.ts` | 45 | 0 | 0 |
| `src/domain/schemas.ts` | 1 | 0 | 0 |
| `src/domain/subscriptions.ts` | 40 | 0 | 1 |
| `src/web/account-entry.ts` | 1 | 0 | 0 |
| `src/web/account.css` | 0 | 1 | 0 |
| `src/web/account.tsx` | 1 | 0 | 0 |
| `src/web/account/__tests__/account.test.ts` | 2 | 0 | 0 |
| `src/web/account/account-api.ts` | 1 | 0 | 2 |
| `src/web/account/account-model.ts` | 5 | 0 | 0 |
| `src/web/account/account-view.tsx` | 5 | 0 | 4 |
| `src/web/account/connect-widget.ts` | 7 | 0 | 0 |
| `src/web/account/use-account.ts` | 18 | 1 | 2 |
| `src/web/document.tsx` | 1 | 0 | 0 |
| `src/web/ui.tsx` | 1 | 0 | 3 |
| `src/worker/account/__tests__/service.test.ts` | 1 | 0 | 0 |
| `src/worker/account/controller.ts` | 9 | 0 | 0 |
| `src/worker/account/errors.ts` | 6 | 0 | 0 |
| `src/worker/account/repository.ts` | 5 | 0 | 0 |
| `src/worker/account/service.ts` | 6 | 0 | 0 |
| `src/worker/auth/controller.ts` | 12 | 1 | 1 |
| `src/worker/auth/repository.ts` | 3 | 0 | 0 |
| `src/worker/auth/service.ts` | 4 | 0 | 0 |
| `src/worker/auth/session.ts` | 1 | 0 | 0 |
| `src/worker/composition.ts` | 2 | 0 | 0 |
| `src/worker/database.ts` | 3 | 0 | 0 |
| `src/worker/finance/entities.repository.ts` | 10 | 0 | 0 |
| `src/worker/finance/repository.ts` | 21 | 0 | 2 |
| `src/worker/finance/rules.repository.ts` | 8 | 0 | 0 |
| `src/worker/finance/service.ts` | 7 | 0 | 0 |
| `src/worker/http.ts` | 7 | 0 | 0 |
| `src/worker/index.ts` | 7 | 0 | 0 |
| `src/worker/mcp/controller.ts` | 16 | 0 | 0 |
| `src/worker/mcp/invoke.ts` | 1 | 0 | 0 |
| `src/worker/mcp/tasks.ts` | 17 | 0 | 1 |
| `src/worker/pluggy/client.adapter.ts` | 8 | 0 | 1 |
| `src/worker/pluggy/source.ts` | 24 | 0 | 0 |
| `src/worker/schema.ts` | 1 | 0 | 0 |
| `src/worker/sync/controller.ts` | 3 | 0 | 0 |
| `src/worker/sync/events.ts` | 14 | 0 | 0 |
| `src/worker/sync/migration.ts` | 6 | 0 | 0 |
| `src/worker/sync/publication.ts` | 25 | 0 | 0 |
| `src/worker/sync/reapplication.ts` | 5 | 0 | 0 |
| `src/worker/sync/repository.ts` | 12 | 0 | 2 |
| `src/worker/sync/resources.ts` | 16 | 0 | 0 |
| `src/worker/sync/service.ts` | 13 | 0 | 2 |
| `src/worker/sync/workflow.ts` | 2 | 0 | 0 |
| `tests/integration/access.test.ts` | 4 | 0 | 2 |
| `tests/integration/landing.test.ts` | 1 | 0 | 0 |
| `tests/integration/persistence.test.ts` | 21 | 0 | 22 |
| `tests/integration/personal-fixture.ts` | 1 | 0 | 2 |
| `tests/integration/personal.test.ts` | 5 | 0 | 6 |
| `tests/integration/pluggy.test.ts` | 15 | 0 | 1 |
| `tests/integration/run-runtime.ts` | 3 | 0 | 4 |
| `tests/integration/runtime-check.ts` | 7 | 0 | 8 |
| `tests/integration/runtime.ts` | 10 | 0 | 0 |
| `tests/support/process.ts` | 10 | 0 | 0 |

## Reproduzir o inventário completo

```sh
npm run lint -- --max-diagnostics=none
npm run lint -- --max-diagnostics=none --reporter=json
```

A saída JSON limpa desta sessão está em `/tmp/caderninho-biome-final.json`. Esse arquivo é temporário; os comandos acima regeneram o diagnóstico atual.

## Validação da migração

| Verificação | Resultado |
| --- | --- |
| npm ci | Passou com o lockfile atualizado |
| npm test | 38 testes passaram |
| npm run test:product | 47 testes passaram |
| npm run typecheck / npm run check:imports / npm run format:check | Passaram |
| npm run build / npm run test:product:runtime | Passaram; dry-run e runtime sintético local |

O teste de imports/formatação executa uma segunda aplicação do Biome em fixtures
e verifica igualdade do resultado, aliases, comentários, imports só de tipos,
atributos JSX e ordem dos imports com efeitos colaterais. Na correção posterior,
`lint:fix` foi aplicado à aplicação; correções marcadas como inseguras foram
limitadas às regras de chaves, templates, chaves literais e optional chaining.

Os resultados não são prova de deploy, OAuth real ou execução em um cliente MCP externo. O mapa completo de cobertura está em [biome-migration.md](../biome-migration.md).
