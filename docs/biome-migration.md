# Migração para Biome

Data: 18 de outubro de 2026. Versão fixada: **2.5.15**.

Decisão do usuário: usar equivalentes nativos e documentar diferenças, reduzindo manutenção. Não manter plugins próprios para reproduzir regras indisponíveis.

## O que mudou

- biome.json concentra lint, formatação e organização de imports.
- Foram removidos Oxlint, Oxfmt, oxlint-tsgolint, @oxlint/plugins, as duas configurações antigas e tools/oxlint inteiro.
- oxc-parser permanece porque scripts/check-imports.ts fiscaliza fronteiras arquiteturais, não formatação.
- Os testes de tooling foram adaptados para Biome; os testes do adaptador Shopify foram removidos com o código substituído.
- As violações e diferenças de layout existentes não foram corrigidas em massa.

## Comandos

```sh
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run typecheck
npm run check:imports
```

lint executa biome check sem o formatter, incluindo organização de imports e error-on-warnings. lint:fix aplica somente fixes classificados como seguros. format aplica o formatter; format:check verifica seu resultado. tsc e o checker de arquitetura continuam separados.

O autofix de chaves do Biome é classificado como unsafe. Não adicionamos --unsafe ao comando geral, evitando aplicar indiscriminadamente correções que exigem revisão.

## Política de estilo

80 colunas, dois espaços, LF, aspas duplas, ponto e vírgula, vírgulas finais e atributos JSX em múltiplas linhas. A expansão de objetos usa auto. Os grupos de imports são builtin, pacote, alias e caminho. sortBareImports=false preserva a ordem dos imports com efeitos colaterais.

O preset recommended nativo também permanece ativo. Ele pode acrescentar diagnósticos que não existiam no setup anterior. Cada regra anterior explícita está inventariada abaixo; não há promessa de paridade entre motores de inferência.

## Mapeamento das 45 regras explícitas anteriores

| Regra anterior | Biome / política atual | Diferença |
| --- | --- | --- |
| `eqeqeq` | suspicious/noDoubleEquals | ignoreNull=true; o antigo smart também tinha outras exceções. |
| `eslint/complexity` | complexity/noExcessiveCognitiveComplexity | Limite 20 em src; complexidade cognitiva difere da ciclomática anterior. |
| `eslint/curly` | style/useBlockStatements | Chaves obrigatórias; o autofix nativo é classificado como unsafe. |
| `eslint/max-depth` | Sem equivalente exato | O limite de profundidade 4 não é reproduzido pela métrica cognitiva. |
| `eslint/max-params` | complexity/useMaxParams | Máximo 4 em src; exceção de testes mantida. |
| `eslint/no-nested-ternary` | style/noNestedTernary | Regra nativa ativada como error. |
| `import/first` | nursery/useImportsFirst | Regra nativa; nursery requer acompanhamento da versão fixada. |
| `import/newline-after-import` | assist/source/organizeImports + formatter | Grupos com linhas em branco; sem port do fiscal de espaçamento anterior. |
| `import/no-duplicates` | assist/source/organizeImports | Mescla declarações compatíveis; preserva barreiras de imports com efeitos colaterais. |
| `no-duplicate-imports` | assist/source/organizeImports | Inclui organização de exports compatíveis; não promete as mesmas condições de diagnóstico. |
| `no-unused-vars` | correctness/noUnusedVariables | ignoreRestSiblings=true; parâmetros seguem também o preset nativo. |
| `no-var` | suspicious/noVar | Regra nativa ativada como error. |
| `oxc/no-accumulating-spread` | performance/noAccumulatingSpread | Equivalente nativo para acumulação com spread. |
| `prefer-const` | style/useConst | Regra nativa ativada como error. |
| `project/binary-assignment-parens` | Sem equivalente; política retirada | A opção always conflita com formatters; não foi criado plugin ou ignore. |
| `project/jsx-no-complex-expressions` | Cobertura parcial: style/noNestedTernary | Proíbe ternários aninhados; ternário simples diretamente em JSX continua permitido. |
| `project/newline-before-return` | Sem equivalente nativo | Biome preserva linhas existentes, sem impor uma antes de cada return. |
| `project/no-array-filter-map` | Sem equivalente exato | Não foi criado fiscal customizado para a sequência filter().map(). |
| `project/no-chained-type-assertions` | nursery/noUnsafeTypeAssertion | Mais restritiva: rejeita toda asserção fora as const, não só encadeamentos. |
| `project/no-reduce-accumulator-copy` | Cobertura parcial: performance/noAccumulatingSpread | A verificação de spread nativa não reproduz toda a regra OPF. |
| `project/prefer-early-return` | Cobertura parcial: style/noUselessElse | Remove else após saída; não fiscaliza o corpo inteiro sob um único if como Shopify. |
| `project/prefer-module-scope-constants` | Sem equivalente exato | Não ativamos noShoutyConstants: ela expressa uma convenção diferente. |
| `project/require-readable-spacing` | Formatter nativo | Sem port das convenções próprias de linhas em branco. |
| `project/require-safety-comment-for-type-assertion` | nursery/noUnsafeTypeAssertion | Um comentário não libera uma asserção proibida pela regra nativa. |
| `project/require-try-catch` | Sem equivalente exato | A política tryCatch continua no AGENTS.md; análise de promises não exige esse helper. |
| `typescript/await-thenable` | nursery/useAwaitThenable | Análise própria de tipos do Biome; cobertura não é idêntica ao tsgolint. |
| `typescript/ban-ts-comment` | Cobertura parcial: suspicious/noTsIgnore | Sem garantia de cobertura idêntica para toda forma de comentário TypeScript. |
| `typescript/consistent-type-exports` | style/useExportType | Regra nativa para exportações de tipos. |
| `typescript/consistent-type-imports` | style/useImportType | style=auto: permite tipos inline em imports mistos e import type quando cabível. |
| `typescript/no-duplicate-enum-values` | suspicious/noDuplicateEnumValues | Regra nativa ativada como error. |
| `typescript/no-empty-object-type` | complexity/noBannedTypes | Cobertura nativa de tipos enganosos, sem equivalência exata de todas as opções. |
| `typescript/no-explicit-any` | suspicious/noExplicitAny | Regra nativa ativada como error. |
| `typescript/no-floating-promises` | nursery/noFloatingPromises | Análise própria de tipos do Biome; tsc continua obrigatório. |
| `typescript/no-import-type-side-effects` | style/useImportType | Normalização nativa de imports somente de tipos. |
| `typescript/no-misused-promises` | nursery/noMisusedPromises | Análise própria de tipos; diferenças documentadas, sem engine tsgolint. |
| `typescript/no-non-null-assertion` | style/noNonNullAssertion | Regra nativa ativada como error. |
| `typescript/no-require-imports` | style/noCommonJs | Mais ampla: restringe também exports CommonJS. |
| `typescript/no-unnecessary-condition` | suspicious/noUnnecessaryConditions | Inferência nativa; pode divergir nos estados alterados após await. |
| `typescript/no-unnecessary-type-assertion` | nursery/noUnsafeTypeAssertion | Mais restritiva: rejeita também asserções não redundantes, exceto as const. |
| `typescript/no-unnecessary-type-conversion` | nursery/noUselessTypeConversion | Regra nativa de conversões redundantes. |
| `typescript/no-unsafe-function-type` | complexity/noBannedTypes | Cobertura de Function e outros tipos enganosos. |
| `typescript/no-unsafe-type-assertion` | nursery/noUnsafeTypeAssertion | Mais restritiva que o estreitamento inseguro do tsgolint. |
| `typescript/no-wrapper-object-types` | complexity/noBannedTypes | Cobertura dos wrappers primitivos. |
| `typescript/prefer-as-const` | style/useAsConstAssertion | Regra nativa ativada como error. |
| `typescript/return-await` | Sem equivalente exato | Não foi substituída por useAwait, que fiscaliza outro comportamento. |

O antigo conjunto automático correctness não é equivalente um a um ao preset recommended do Biome. Essa troca de baseline foi feita em favor do conjunto nativo; a tabela registra todas as regras explicitamente configuradas.

## Fontes

- [Configuração do Biome](https://biomejs.dev/reference/configuration/).
- [Catálogo de regras JavaScript](https://biomejs.dev/linter/javascript/rules/).
- [Organização de imports](https://biomejs.dev/assist/actions/organize-imports/javascript/).
- [Chaves obrigatórias](https://biomejs.dev/linter/rules/use-block-statements/javascript/).
- [Asserções de tipo](https://biomejs.dev/linter/rules/no-unsafe-type-assertion/javascript/).

Os relatórios anteriores de Oxlint são históricos. Os números de Biome devem ser lidos no diagnóstico desta migração, sem comparar totais como se medissem as mesmas regras.

## Resultado local

Instalação limpa, 38 testes Node, 47 testes Worker, typecheck, fronteiras de imports,
formatação, build dry-run e runtime sintético passaram. Os testes de tooling
validam convergência em fixtures, aliases, comentários e efeitos colaterais.

O baseline tinha 630 erros, 3 warnings e 86 diagnósticos informativos do preset
nativo. A correção posterior zerou os erros, warnings e informações. O
[relatório da migração](reports/biome-migration.md) preserva o inventário inicial
e descreve as correções. Nenhuma regra foi desativada para esconder diagnósticos.
As diferenças sem equivalente foram aceitas
explicitamente na escolha por regras nativas.
