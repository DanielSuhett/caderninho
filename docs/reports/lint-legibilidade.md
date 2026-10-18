# Diagnóstico das regras de legibilidade

Data: 18 de outubro de 2026. Snapshot histórico de Oxlint, sem correções em massa. A ferramenta atual é [Biome](../biome-migration.md); as adaptações locais antigas foram removidas.

Total: **811 erros, 0 warnings, 73 arquivos afetados**. Foram analisados 106 arquivos.

O baseline de lint passou antes desta ampliação. Todas as seis regras foram ativadas como error; o comando npm run lint termina com código 1 por violações existentes, não por falha de carregamento do plugin.

| Regra | Intenção | Erros |
| --- | --- | ---: |
| `eslint(curly)` | Chaves em condicionais e laços | 557 |
| `project(newline-before-return)` | Linha em branco antes de return | 231 |
| `project(prefer-early-return)` | Retorno antecipado no caso definido pela Shopify | 0 |
| `project(jsx-no-complex-expressions)` | Ternários diretamente em containers JSX | 11 |
| `project(binary-assignment-parens)` | Parênteses em comparações atribuídas: always | 12 |
| `project(prefer-module-scope-constants)` | Nomes maiúsculos em const no escopo de módulo | 0 |

## Implementação e fontes

- Chaves: regra nativa `eslint/curly`, opção `all`.
- Retornos: configuração específica do helper de padding já vendorizado, seguindo o [contrato ESLint](https://eslint.org/docs/latest/rules/newline-before-return). A regra anterior de espaçamento delega retornos para evitar diagnósticos duplicados.
- Shopify: quatro fontes adaptados para ESM e reports em objeto; [fontes no commit original](https://github.com/Shopify/web-configs/tree/6a9bca4e0474fee9f3af4000ee4615dbcf37ba6c/packages/eslint-plugin/lib/rules) registrados. Nenhuma dependência adicionada.

As regras da Shopify mantêm seus defaults: early return com maximumStatements=1; JSX verifica ConditionalExpression diretamente no container; constantes considera identificadores maiúsculos, não todo const; comparações atribuídas usam always.

## Conflito confirmado com Oxfmt

O teste de contrato confirmou que Oxfmt 0.72.0 transforma `const value = (left === right)` em `const value = left === right`. A opção always de binary-assignment-parens reprova o resultado formatado. Esta política não converge com o formatter atual. Não foram adicionados ignores, nem alterada a opção para never.

## Verificações desta etapa

- 38 testes Node passaram, incluindo testes de contrato das seis regras com casos válidos e inválidos, opções e CommonJS.
- Typecheck, format:check e check:imports passaram.
- Lint reprovou intencionalmente com o inventário abaixo; não foi usado lint:fix no código da aplicação.
- Os testes de runtime da aplicação não foram repetidos nesta etapa de configuração e tooling.

## Arquivos afetados

| Arquivo | Erros |
| --- | ---: |
| `scripts/__tests__/cli.test.ts` | 1 |
| `scripts/__tests__/format.test.ts` | 1 |
| `scripts/__tests__/imports.test.ts` | 2 |
| `scripts/admin-request.ts` | 2 |
| `scripts/check-imports.ts` | 27 |
| `scripts/import-rules.ts` | 6 |
| `scripts/migrate-r2.ts` | 11 |
| `src/contracts/mcp-contract.ts` | 2 |
| `src/domain/__tests__/exact.test.ts` | 7 |
| `src/domain/__tests__/subscriptions.test.ts` | 1 |
| `src/domain/entity.ts` | 9 |
| `src/domain/exact.ts` | 11 |
| `src/domain/fault.ts` | 1 |
| `src/domain/finance-model.ts` | 25 |
| `src/domain/provider-state.ts` | 5 |
| `src/domain/record-correction.ts` | 2 |
| `src/domain/rules/__tests__/rules.test.ts` | 3 |
| `src/domain/rules/convert-rules.ts` | 19 |
| `src/domain/rules/import-rules.ts` | 15 |
| `src/domain/rules/rules.ts` | 39 |
| `src/domain/subscriptions.ts` | 41 |
| `src/web/access-view.tsx` | 1 |
| `src/web/account.tsx` | 1 |
| `src/web/account/__tests__/account.test.ts` | 6 |
| `src/web/account/account-api.ts` | 3 |
| `src/web/account/account-model.ts` | 6 |
| `src/web/account/account-view.tsx` | 14 |
| `src/web/account/connect-widget.ts` | 8 |
| `src/web/account/use-account.ts` | 23 |
| `src/web/ui.tsx` | 3 |
| `src/worker/account/__tests__/service.test.ts` | 1 |
| `src/worker/account/controller.ts` | 18 |
| `src/worker/account/errors.ts` | 7 |
| `src/worker/account/repository.ts` | 11 |
| `src/worker/account/service.ts` | 9 |
| `src/worker/auth/controller.ts` | 21 |
| `src/worker/auth/repository.ts` | 4 |
| `src/worker/auth/service.ts` | 8 |
| `src/worker/auth/session.ts` | 2 |
| `src/worker/composition.ts` | 2 |
| `src/worker/database.ts` | 6 |
| `src/worker/finance/entities.repository.ts` | 15 |
| `src/worker/finance/repository.ts` | 33 |
| `src/worker/finance/rules.repository.ts` | 11 |
| `src/worker/finance/service.ts` | 12 |
| `src/worker/http.ts` | 10 |
| `src/worker/index.ts` | 9 |
| `src/worker/mcp/controller.ts` | 30 |
| `src/worker/mcp/invoke.ts` | 2 |
| `src/worker/mcp/tasks.ts` | 26 |
| `src/worker/pluggy/client.adapter.ts` | 11 |
| `src/worker/pluggy/source.ts` | 31 |
| `src/worker/sync/controller.ts` | 5 |
| `src/worker/sync/events.ts` | 15 |
| `src/worker/sync/migration.ts` | 7 |
| `src/worker/sync/publication.ts` | 27 |
| `src/worker/sync/reapplication.ts` | 7 |
| `src/worker/sync/repository.ts` | 24 |
| `src/worker/sync/resources.ts` | 22 |
| `src/worker/sync/service.ts` | 19 |
| `src/worker/sync/workflow.ts` | 2 |
| `tests/integration/access.test.ts` | 4 |
| `tests/integration/landing.test.ts` | 1 |
| `tests/integration/persistence.test.ts` | 30 |
| `tests/integration/personal-fixture.ts` | 4 |
| `tests/integration/personal.test.ts` | 6 |
| `tests/integration/pluggy.test.ts` | 27 |
| `tests/integration/run-runtime.ts` | 2 |
| `tests/integration/runtime-check.ts` | 7 |
| `tests/integration/runtime.ts` | 14 |
| `tests/support/helpers.ts` | 1 |
| `tests/support/network.ts` | 2 |
| `tests/support/process.ts` | 11 |

## Todos os diagnósticos

| Local | Regra | Mensagem |
| --- | --- | --- |
| `scripts/__tests__/cli.test.ts:129:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `scripts/__tests__/format.test.ts:51:7` | `eslint(curly)` | Expected { after 'for-of'. |
| `scripts/__tests__/imports.test.ts:107:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `scripts/__tests__/imports.test.ts:135:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `scripts/admin-request.ts:7:39` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/admin-request.ts:8:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `scripts/check-imports.ts:14:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:35:24` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:45:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:51:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `scripts/check-imports.ts:63:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:65:30` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:67:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:69:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `scripts/check-imports.ts:86:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:106:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:108:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:114:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:129:7` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `scripts/check-imports.ts:148:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:153:9` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `scripts/check-imports.ts:158:33` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:160:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:161:34` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:162:20` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:167:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:170:18` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `scripts/check-imports.ts:178:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:182:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/check-imports.ts:184:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `scripts/check-imports.ts:191:7` | `eslint(curly)` | Expected { after 'for-of'. |
| `scripts/check-imports.ts:203:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `scripts/check-imports.ts:208:26` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/import-rules.ts:37:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/import-rules.ts:40:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/import-rules.ts:71:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `scripts/import-rules.ts:74:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/import-rules.ts:83:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/import-rules.ts:92:21` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:43:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:62:61` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:66:61` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:69:34` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:72:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:99:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:103:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:107:52` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:114:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:126:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `scripts/migrate-r2.ts:141:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/contracts/mcp-contract.ts:129:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/contracts/mcp-contract.ts:130:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/domain/__tests__/exact.test.ts:15:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/__tests__/exact.test.ts:27:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/__tests__/exact.test.ts:50:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/__tests__/exact.test.ts:65:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/__tests__/exact.test.ts:68:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/__tests__/exact.test.ts:83:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/__tests__/exact.test.ts:100:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/__tests__/subscriptions.test.ts:140:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/entity.ts:29:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/entity.ts:30:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/entity.ts:41:28` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/entity.ts:124:63` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/entity.ts:127:30` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/entity.ts:130:25` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/entity.ts:140:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/entity.ts:148:50` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/entity.ts:150:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:14:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:25:46` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:29:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:33:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:39:46` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:59:34` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:62:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:65:28` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:79:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:107:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/exact.ts:110:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/fault.ts:43:24` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:318:29` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:331:26` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:339:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:348:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:356:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:360:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:363:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:392:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:405:12` | `eslint(curly)` | Expected { after 'else'. |
| `src/domain/finance-model.ts:409:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:412:32` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:442:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:444:41` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:453:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/finance-model.ts:480:16` | `eslint(curly)` | Expected { after 'else'. |
| `src/domain/finance-model.ts:486:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:498:37` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:500:16` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:661:5` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `src/domain/finance-model.ts:663:5` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `src/domain/finance-model.ts:664:5` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `src/domain/finance-model.ts:666:5` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `src/domain/finance-model.ts:694:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:707:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/finance-model.ts:714:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/provider-state.ts:56:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/provider-state.ts:67:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/provider-state.ts:78:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/provider-state.ts:85:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/provider-state.ts:97:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/record-correction.ts:38:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/record-correction.ts:49:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/__tests__/rules.test.ts:88:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/rules/__tests__/rules.test.ts:203:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/rules/__tests__/rules.test.ts:236:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/rules/convert-rules.ts:47:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:60:24` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:70:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:72:31` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:75:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:80:39` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:86:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:94:37` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:96:20` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:106:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:121:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:129:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:144:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:192:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:202:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:209:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:219:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:234:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/convert-rules.ts:267:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:78:51` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:82:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:95:36` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:98:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:142:28` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:145:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:152:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:178:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:189:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:214:28` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:239:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:247:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:272:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:274:26` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/import-rules.ts:277:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:44:20` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:48:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:51:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:78:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:80:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:82:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:84:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:93:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:99:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:104:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:143:24` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:144:29` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:157:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:167:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:173:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:176:36` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:183:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:192:26` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:197:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:200:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:203:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:207:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:233:17` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:236:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:249:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:259:9` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/rules/rules.ts:270:13` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:274:27` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:276:27` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:278:27` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:289:34` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:295:37` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:303:61` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:309:37` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:315:61` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:324:43` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:328:54` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:360:48` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/rules/rules.ts:362:36` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:116:20` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:126:27` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `src/domain/subscriptions.ts:137:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:144:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:158:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:160:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:162:17` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:165:5` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `src/domain/subscriptions.ts:184:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:191:43` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:193:48` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:201:59` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:204:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:214:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:220:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:222:47` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:224:23` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:226:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:243:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:247:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:257:14` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:291:28` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:297:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:300:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:303:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:306:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:309:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:311:30` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:314:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:402:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:407:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:423:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:424:10` | `eslint(curly)` | Expected { after 'else'. |
| `src/domain/subscriptions.ts:424:40` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/domain/subscriptions.ts:431:16` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:433:16` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:520:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:527:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:539:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:547:14` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/domain/subscriptions.ts:549:25` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/access-view.tsx:32:7` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/account.tsx:12:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/__tests__/account.test.ts:20:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/__tests__/account.test.ts:21:41` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/__tests__/account.test.ts:22:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/__tests__/account.test.ts:89:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/__tests__/account.test.ts:144:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/__tests__/account.test.ts:148:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/account-api.ts:58:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/account-api.ts:66:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/account-api.ts:80:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/account-model.ts:75:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/account-model.ts:81:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/account-model.ts:87:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/account-model.ts:97:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/account-model.ts:103:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/account-model.ts:108:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/account-view.tsx:49:36` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/account-view.tsx:54:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/account-view.tsx:58:11` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/account/account-view.tsx:62:9` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/account/account-view.tsx:71:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/account-view.tsx:82:28` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/account/account-view.tsx:95:11` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/account/account-view.tsx:108:15` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/account/account-view.tsx:207:19` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/account/account-view.tsx:209:11` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/account/account-view.tsx:237:35` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/account/account-view.tsx:284:31` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/account-view.tsx:285:21` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/account-view.tsx:286:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/connect-widget.ts:34:21` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/connect-widget.ts:40:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/connect-widget.ts:46:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/connect-widget.ts:48:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/connect-widget.ts:57:39` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/connect-widget.ts:60:39` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/connect-widget.ts:63:39` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/connect-widget.ts:68:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:46:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:47:39` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:53:74` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:62:11` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/use-account.ts:76:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/use-account.ts:85:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/use-account.ts:98:19` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `src/web/account/use-account.ts:100:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:102:20` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:106:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/use-account.ts:122:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:123:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/account/use-account.ts:127:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:134:32` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:143:32` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:149:45` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:162:66` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:168:26` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:175:32` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:178:31` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:195:38` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:203:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/web/account/use-account.ts:207:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/web/ui.tsx:17:15` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/ui.tsx:32:15` | `project(jsx-no-complex-expressions)` | Don’t use conditional expressions inside JSX; they generally make your component harder to read. Instead, break that expression out into its own variable, and include the variable in JSX. |
| `src/web/ui.tsx:45:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/__tests__/service.test.ts:49:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/account/controller.ts:26:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/controller.ts:28:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/controller.ts:29:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/controller.ts:50:34` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/controller.ts:52:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/controller.ts:54:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/controller.ts:68:31` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/controller.ts:69:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/controller.ts:75:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/controller.ts:82:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/controller.ts:87:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/controller.ts:92:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/controller.ts:97:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/controller.ts:112:7` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/account/controller.ts:113:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/controller.ts:118:13` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/controller.ts:120:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/controller.ts:122:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/errors.ts:12:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/errors.ts:13:57` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/errors.ts:15:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/errors.ts:16:39` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/errors.ts:25:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/errors.ts:35:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/errors.ts:36:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/repository.ts:26:20` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/repository.ts:29:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/repository.ts:30:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/repository.ts:34:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/repository.ts:37:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/repository.ts:77:16` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/repository.ts:109:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/repository.ts:122:25` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/repository.ts:138:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/repository.ts:142:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/repository.ts:174:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/service.ts:28:65` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/service.ts:29:20` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/service.ts:30:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/service.ts:59:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/account/service.ts:75:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/service.ts:78:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/service.ts:79:27` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/service.ts:88:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/account/service.ts:89:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/controller.ts:38:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/controller.ts:55:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/controller.ts:64:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:70:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:73:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:78:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/controller.ts:89:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/controller.ts:104:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:109:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/controller.ts:140:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:147:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/controller.ts:156:31` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:160:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/controller.ts:175:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:181:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:183:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:187:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:190:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/controller.ts:206:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/controller.ts:220:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/controller.ts:222:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/repository.ts:15:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/repository.ts:49:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/repository.ts:68:17` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/repository.ts:69:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/service.ts:20:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/service.ts:28:5` | `eslint(curly)` | Expected { after 'for' condition. |
| `src/worker/auth/service.ts:29:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/service.ts:34:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/service.ts:36:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/service.ts:50:28` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/auth/service.ts:52:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/service.ts:63:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/session.ts:24:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/auth/session.ts:37:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/composition.ts:163:24` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/composition.ts:165:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/database.ts:6:26` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/database.ts:7:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/database.ts:12:27` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/database.ts:14:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/database.ts:19:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/database.ts:21:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/entities.repository.ts:78:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/finance/entities.repository.ts:89:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/entities.repository.ts:117:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/entities.repository.ts:138:18` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `src/worker/finance/entities.repository.ts:140:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/entities.repository.ts:196:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/entities.repository.ts:204:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/entities.repository.ts:227:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/entities.repository.ts:279:16` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/entities.repository.ts:281:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/entities.repository.ts:300:20` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/entities.repository.ts:401:10` | `eslint(curly)` | Expected { after 'else'. |
| `src/worker/finance/entities.repository.ts:402:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/entities.repository.ts:452:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/entities.repository.ts:476:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:56:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:96:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:97:21` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:98:20` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:101:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:116:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:122:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:123:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:125:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:127:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:136:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:137:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:145:14` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:147:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:173:45` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:196:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:204:13` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:205:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:234:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:237:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:257:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:258:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:282:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:285:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:337:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:338:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:345:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:359:9` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/finance/repository.ts:360:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:406:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:458:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/repository.ts:488:32` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/repository.ts:489:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/rules.repository.ts:28:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/finance/rules.repository.ts:51:7` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/finance/rules.repository.ts:63:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/finance/rules.repository.ts:80:16` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/rules.repository.ts:88:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/rules.repository.ts:93:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/rules.repository.ts:113:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/rules.repository.ts:120:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/rules.repository.ts:122:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/rules.repository.ts:123:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/rules.repository.ts:144:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/service.ts:66:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/service.ts:86:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/service.ts:88:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/service.ts:89:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/service.ts:92:54` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/service.ts:93:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/service.ts:117:44` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/service.ts:118:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/service.ts:136:44` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/service.ts:137:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/finance/service.ts:152:55` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/finance/service.ts:153:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/http.ts:37:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/http.ts:39:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/http.ts:40:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/http.ts:44:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/http.ts:46:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/http.ts:49:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/http.ts:49:41` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/http.ts:50:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/http.ts:60:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/http.ts:61:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/index.ts:25:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/index.ts:26:43` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/index.ts:27:31` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/index.ts:28:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/index.ts:52:24` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/index.ts:54:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/index.ts:60:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/index.ts:61:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/index.ts:68:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:65:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:75:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:89:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:112:33` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:113:11` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:127:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:133:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:159:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:168:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:173:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:184:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:216:27` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:218:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:224:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:232:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:234:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:242:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:244:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:252:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:262:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:272:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:280:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:294:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:295:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:301:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:304:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:305:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/controller.ts:318:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:321:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/controller.ts:335:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/invoke.ts:33:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/invoke.ts:34:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/tasks.ts:54:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:56:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:57:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/tasks.ts:74:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/tasks.ts:85:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/tasks.ts:101:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:134:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:147:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:149:41` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:153:39` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:160:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/tasks.ts:167:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:170:15` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/tasks.ts:174:37` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:194:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:196:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:201:49` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:232:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/tasks.ts:247:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/tasks.ts:249:21` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:255:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/tasks.ts:259:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:280:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:281:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/mcp/tasks.ts:293:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/mcp/tasks.ts:294:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/client.adapter.ts:48:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/client.adapter.ts:57:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/client.adapter.ts:65:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/client.adapter.ts:80:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/client.adapter.ts:108:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/client.adapter.ts:130:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/client.adapter.ts:134:33` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/client.adapter.ts:156:11` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/client.adapter.ts:161:29` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/client.adapter.ts:163:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/client.adapter.ts:166:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/source.ts:29:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:53:43` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:55:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:56:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:58:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:73:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:94:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:102:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/source.ts:117:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/source.ts:128:32` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:129:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/source.ts:186:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/source.ts:194:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:206:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:211:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:212:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/source.ts:219:49` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:223:31` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:229:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:230:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/source.ts:240:23` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:243:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:253:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:255:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:256:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/source.ts:273:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:282:32` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:283:13` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/pluggy/source.ts:295:41` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:330:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/pluggy/source.ts:349:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/controller.ts:10:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/controller.ts:15:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/controller.ts:25:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/sync/controller.ts:26:13` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/controller.ts:30:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/events.ts:57:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/events.ts:71:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/events.ts:72:44` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/events.ts:73:10` | `eslint(curly)` | Expected { after 'else'. |
| `src/worker/sync/events.ts:87:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/sync/events.ts:88:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/events.ts:153:20` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/events.ts:155:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/events.ts:160:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/events.ts:186:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/events.ts:209:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/events.ts:211:27` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/events.ts:212:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/events.ts:222:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/events.ts:224:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/migration.ts:33:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/migration.ts:37:27` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/migration.ts:48:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/migration.ts:62:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/migration.ts:86:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/migration.ts:87:55` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/migration.ts:124:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/publication.ts:67:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:69:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:85:16` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:94:14` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:114:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:118:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:119:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:145:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:200:16` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:202:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/publication.ts:238:37` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:255:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:256:45` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:282:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/publication.ts:286:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/publication.ts:316:39` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:321:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:338:36` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:340:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:341:44` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:342:10` | `eslint(curly)` | Expected { after 'else'. |
| `src/worker/sync/publication.ts:348:46` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:372:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:401:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:422:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:423:44` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/publication.ts:424:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/reapplication.ts:38:29` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/sync/reapplication.ts:65:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/reapplication.ts:81:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/reapplication.ts:83:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/reapplication.ts:168:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/reapplication.ts:172:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/reapplication.ts:174:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:54:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:55:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:103:38` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:104:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:109:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:129:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:206:26` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:213:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:229:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:335:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:349:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:381:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:385:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:390:37` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:392:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:395:37` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:397:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:407:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:532:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:546:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/repository.ts:550:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:555:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:570:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/repository.ts:572:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/resources.ts:54:40` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:66:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:69:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/resources.ts:90:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:107:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:126:70` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:156:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:186:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/resources.ts:205:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/resources.ts:207:24` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:221:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:233:16` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:252:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:271:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/resources.ts:273:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/resources.ts:316:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/resources.ts:331:22` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:333:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:355:19` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/resources.ts:392:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/resources.ts:396:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/resources.ts:398:23` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:75:32` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:79:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/service.ts:81:65` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:111:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/service.ts:115:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/service.ts:144:13` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:148:25` | `project(binary-assignment-parens)` | You must include parentheses around a binary assignment expression. |
| `src/worker/sync/service.ts:157:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:172:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:176:27` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:180:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/service.ts:184:9` | `eslint(curly)` | Expected { after 'for-of'. |
| `src/worker/sync/service.ts:188:11` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:210:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:215:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:216:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/service.ts:221:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:231:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/service.ts:245:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `src/worker/sync/workflow.ts:36:13` | `eslint(curly)` | Expected { after 'if' condition. |
| `src/worker/sync/workflow.ts:37:11` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/access.test.ts:107:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/access.test.ts:122:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `tests/integration/access.test.ts:130:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `tests/integration/access.test.ts:161:5` | `eslint(curly)` | Expected { after 'for' condition. |
| `tests/integration/landing.test.ts:22:11` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:135:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `tests/integration/persistence.test.ts:188:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:226:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:235:36` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:238:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:240:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:246:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:519:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `tests/integration/persistence.test.ts:646:5` | `eslint(curly)` | Expected { after 'for' condition. |
| `tests/integration/persistence.test.ts:894:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:930:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:934:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:969:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:971:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:973:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:977:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:978:41` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:979:42` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:980:43` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:981:12` | `eslint(curly)` | Expected { after 'else'. |
| `tests/integration/persistence.test.ts:982:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:1177:5` | `eslint(curly)` | Expected { after 'for' condition. |
| `tests/integration/persistence.test.ts:1258:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:1259:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:1301:46` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:1302:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:1508:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:1732:9` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/persistence.test.ts:1810:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/persistence.test.ts:1811:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/personal-fixture.ts:43:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/personal-fixture.ts:63:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/personal-fixture.ts:87:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/personal-fixture.ts:108:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/personal.test.ts:43:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/personal.test.ts:45:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/personal.test.ts:47:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/personal.test.ts:87:5` | `eslint(curly)` | Expected { after 'for-of'. |
| `tests/integration/personal.test.ts:223:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/personal.test.ts:226:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:42:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:43:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:68:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:73:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:74:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:106:50` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:107:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:121:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:154:52` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:156:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:187:50` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:188:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:208:9` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:209:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:223:48` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:224:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:243:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:247:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:251:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:331:48` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:333:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:347:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/pluggy.test.ts:371:35` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:373:41` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:374:45` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:376:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/pluggy.test.ts:377:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/run-runtime.ts:76:73` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/run-runtime.ts:82:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/runtime-check.ts:40:5` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/runtime-check.ts:43:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/runtime-check.ts:76:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/runtime-check.ts:105:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/runtime-check.ts:114:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/runtime-check.ts:156:3` | `eslint(curly)` | Expected { after 'for' condition. |
| `tests/integration/runtime-check.ts:186:17` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/runtime.ts:41:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/runtime.ts:54:38` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/runtime.ts:60:18` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/runtime.ts:62:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/runtime.ts:66:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/runtime.ts:92:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/runtime.ts:117:9` | `eslint(curly)` | Expected { after 'for-of'. |
| `tests/integration/runtime.ts:137:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/runtime.ts:140:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/runtime.ts:147:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/runtime.ts:159:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/runtime.ts:167:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/integration/runtime.ts:171:26` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/integration/runtime.ts:172:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/support/helpers.ts:41:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/support/network.ts:7:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/support/network.ts:22:7` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/support/process.ts:15:23` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/support/process.ts:16:12` | `eslint(curly)` | Expected { after 'else'. |
| `tests/support/process.ts:24:15` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/support/process.ts:27:43` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/support/process.ts:28:14` | `eslint(curly)` | Expected { after 'else'. |
| `tests/support/process.ts:35:7` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/support/process.ts:41:27` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/support/process.ts:55:5` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/support/process.ts:60:25` | `eslint(curly)` | Expected { after 'if' condition. |
| `tests/support/process.ts:71:3` | `project(newline-before-return)` | Expected blank line before this statement. |
| `tests/support/process.ts:76:25` | `eslint(curly)` | Expected { after 'if' condition. |
