# Simplificação e clareza do Caderninho

Data: 18 de outubro de 2026.

Status atual: revisão manual aplicada por funcionalidade após a migração para
Biome. A [continuação da revisão](#continuação-da-revisão-manual-no-projeto)
registra os contratos e fluxos simplificados. `mise run check` passou, com 41 testes
Node, 49 testes Worker, build dry-run e runtime sintético.
`prepareEntity` é um exemplo dos critérios, não o limite do escopo.

Histórico: regras de Oxlint ativadas e seus diagnósticos corrigidos. Os 70 erros
registrados na ativação foram resolvidos sem desativar regras ou adicionar
supressões. O estado intencionalmente reprovado foi uma etapa intermediária,
encerrada pelo pedido posterior de corrigir todos os erros.

As mudanças preservam os contratos públicos e a publicação atômica. As propostas
mais amplas de arquitetura abaixo continuam sendo critérios de revisão; passar no
lint não significa que todos os antipadrões possíveis do projeto foram eliminados.

Ferramenta atual: **Biome 2.5.15**, por decisão posterior do usuário. O
[mapeamento da migração](biome-migration.md) é a referência atual para regras,
comandos e diferenças de cobertura. As seções específicas de Oxlint/Oxfmt abaixo
registram o diagnóstico e as decisões anteriores. As configurações e o código
vendorizado dessas ferramentas foram removidos.

## Histórico: ampliação posterior das regras

Após a correção dos 70 erros iniciais, foram ativadas as seis novas regras de
legibilidade solicitadas: chaves obrigatórias, newline-before-return e as quatro
regras Shopify. O novo snapshot registra **811 erros e 0 warnings**. O inventário
completo está em [lint-legibilidade.md](./reports/lint-legibilidade.md).

O lint voltou a reprovar naquela etapa de adoção. Não houve correção em massa da
aplicação. O conflito entre binary-assignment-parens: always e Oxfmt foi confirmado
por teste. A avaliação de Biome é uma discussão posterior; nenhuma migração foi
iniciada. Os resultados de validação do ciclo anterior abaixo são históricos.

## Intenção do usuário

Encerrar o padrão de código que mistura extração de dados, verificações defensivas,
decisões financeiras, controle de processamento e SQL dentro da mesma função.
Reduzir overengineering e tornar o caminho dos dados compreensível pela leitura.

Dados externos devem ser validados na entrada. Dados internos devem carregar as
garantias conquistadas nessa entrada, na normalização e na persistência. Não devemos
reinvestigar a estrutura de um objeto em cada consumidor nem trocar um parse
redundante por uma sequência equivalente de `typeof` e throws.

O objetivo é reduzir decisões locais, contratos ambíguos e navegação desnecessária.
Não é criar o maior número de funções pequenas ou aplicar uma nova arquitetura.

## Escopo e evidências

O ponto de partida do diagnóstico original foi `prepareEntity`, em
[entities.repository.ts](../src/worker/finance/entities.repository.ts), e seus
contratos e colaboradores imediatos:

- [schemas.ts](../src/domain/schemas.ts): `ProviderRecordSchema` e `FinanceRecordSchema`.
- [entity.ts](../src/domain/entity.ts): projeção e campos para persistência.
- [rules.ts](../src/domain/rules/rules.ts): `txContext` e avaliação de regras.
- [publication.ts](../src/worker/sync/publication.ts): preparação e publicação atômica.
- [biome.json](../biome.json): configuração atual; o inventário histórico das regras anteriores está no [mapa da migração](biome-migration.md).

O repositório já contém alterações em andamento, inclusive remoção de parses
internos. O diagnóstico considera o conteúdo de trabalho observado nesta data.
As direções para o restante do projeto são critérios de revisão, não uma alegação
de que todos os módulos foram auditados.

## O que podemos confiar

### Zod garante o contrato descrito

Um parse bem-sucedido garante a estrutura descrita pelo schema. Não torna um campo
opcional obrigatório, não elimina ausências válidas e não estabelece automaticamente
relações entre dois objetos. Ver [fundamentos do Zod](https://zod.dev/basics).

`ProviderRecordSchema` aceita identificadores ausentes e campos extras. Já
`FinanceRecordSchema` reúne vários recursos, muitos campos opcionais e um
`catchall`. Esses contratos preservam flexibilidade, mas deixam o consumidor sem
garantias específicas sobre o recurso recebido.

### Drizzle não substitui validação de entrada

Tipos inferidos de tabelas e projeções evitam reconstrução manual de tipos de linha.
Entretanto, `.$type<T>()` em JSON não verifica em runtime que o conteúdo satisfaz
`T`. A confiança deve vir de caminhos de escrita controlados, normalização correta
e constraints aplicáveis. Ver [tipos de colunas do Drizzle](https://orm.drizzle.team/docs/column-types).

A resposta não é adicionar Zod em todo SELECT. Dados históricos ou importados por
outro caminho precisam de uma fronteira explícita de entrada/migração. Leituras
ordinárias de linhas tipadas não precisam repetir validação estrutural.

### Invariantes continuam necessárias

`SOURCE_ID_MISMATCH` verifica a relação entre a identidade solicitada e o payload.
Dois objetos válidos separadamente ainda podem não corresponder. Essa garantia
deve ser estabelecida uma vez no ponto adequado do fluxo.

Regras como registro excluído, renormalização forçada, precisão monetária e
elegibilidade temporal também não desaparecem por existir Zod ou Drizzle.

## Antipadrões e sinais de dificuldade

Os itens abaixo distinguem problemas observados de sinais que exigem avaliação.
Nenhum deles autoriza remover regras financeiras ou proteção de escopo.

### Responsabilidades e fluxo

| Problema observado | Evidência | Direção |
| --- | --- | --- |
| Responsabilidades acumuladas | `prepareEntity` seleciona campos, calcula hash, consulta estado, decide reutilização, normaliza, avalia regras e monta SQL | Separar projeção, coordenação e persistência nos limites já existentes |
| Política de relevância dentro do repositório | Lista de campos de transação, exclusão de timestamps/saldo e participação do pai no hash | Dar à política de projeção uma função pura no domínio; o cálculo técnico do hash pode continuar fora dele |
| Coordenação de regras dentro da persistência | `engine.evaluate(txContext(record))` aparece entre builders Drizzle | Coordenar avaliação fora do mapper SQL, mantendo o resultado no mesmo batch |
| Objeto de operação amplo | A função recebe `Operation`, mas usa um subconjunto de campos | Receber um objeto nomeado com os dados necessários, sem copiar o modelo inteiro |
| Dependências e dados em argumentos posicionais | Oito parâmetros, incluindo opcionais e objetos genéricos | Usar entrada nomeada e dependências explícitas conforme os padrões atuais |

### Contratos e extração de dados

| Problema observado | Evidência | Direção |
| --- | --- | --- |
| Recurso e registro sem correlação de tipos | `resource` e `ProviderRecord`/`FinanceRecord` são independentes | Introduzir contratos específicos onde houver ganho real; preservar a relação ao longo do fluxo |
| Navegação dinâmica no caminho principal | `path.split`, laço por segmentos, `typeof`, `Array.isArray` e `Object.entries(...).find` | Confinar a seleção dinâmica em um único projetor; usar acesso tipado para campos conhecidos |
| Campos conhecidos acessados como chave arbitrária | `text(k: string)` em `projectEntity` e `txContext` | Declarar campos estáveis no schema e acessá-los diretamente |
| Verificação posterior causada por contrato amplo | `typeof amount !== "string"` após selecionar valores de um registro genérico | Tipar os campos monetários consumidos e estabelecer validade na produção do modelo |
| Representação de ausência variável | `parentInput` admite `null` e `undefined`, depois é convertido | Escolher uma representação na API interna; converter apenas ao cruzar a fronteira que exige outra |

O custo de `Object.entries(...).find` é também percorrer propriedades para procurar
uma chave. A prioridade aqui é clareza e confinamento da operação dinâmica; não há
medição que justifique alegar um gargalo de desempenho.

### Expressões, mapeamento e vocabulário

| Problema ou sinal | Evidência | Direção |
| --- | --- | --- |
| Representação SQL misturada com projeção | `moneyKey`, padding de 30 posições, sinal e flags no objeto da entidade | Concentrar o mapeamento em persistência e nomear a convenção de ordenação monetária |
| Predicado de identidade repetido | As mesmas quatro colunas aparecem no SELECT e UPDATE | Reutilizar um predicado local se reduzir ruído; não criar repositório genérico |
| Vocabulário pouco informativo | `i`, `raw`, `value`, além de `old` seguido de `previous = old` | Usar nomes de papel e eliminar aliases sem transformação |
| Ausência convertida em valor aparentemente normal | `amount_sign` resulta em `1` mesmo com valor ausente; `txContext` transforma ausências em string vazia | Documentar e verificar a semântica antes de mudar; não há evidência suficiente para chamar de bug |
| Densidade de expressões condicionais | Escolha de data por ternário aninhado em `projectEntity`; flags numéricas em resultados | Usar branches claros quando há decisões encadeadas; limitar flags numéricas à representação que as exige |

### Defesas e comportamentos que precisam de rastreabilidade

`projectEntity` varre propriedades terminadas em `Minor` e valida novamente o valor
monetário selecionado. Isso é um sinal de garantia dispersa. É necessário rastrear
normalização e `legacyProjection` antes de concluir quais verificações são
redundantes. Um tipo `string` sozinho não garante uma quantia canônica.

`legacyProjection` também altera a projeção, o hash de transações e a identificação
do normalizador. Esse modo precisa ficar explícito. Separar a entrada legada pode
ajudar se ela estiver restrita à migração; não devemos criar duas implementações
divergentes nem remover compatibilidade sem verificar os chamadores.

## O que não é antipadrão por si só

1. A condição de reutilização combina três fatos legítimos: ausência de força,
   mesmo hash e entidade ativa. Extrair `canReuseProjection` só ajuda se melhorar a
   leitura; dividir cada comparação em um helper não ajuda.
2. `?? null` pode representar ausência válida. Removê-lo exige primeiro melhorar
   a garantia do contrato; não basta desejar que o campo exista.
3. Um objeto grande de colunas pode ser um mapper SQL legível. O problema é misturar
   nesse objeto políticas financeiras e decisões de fluxo.
4. Retornar builders não executados permite a publicação atômica posterior.
   Executá-los dentro de helpers mudaria a garantia transacional.
5. `as`, non-null assertions e supressões TypeScript não aparecem no trecho
   fornecido. Não confundir essas asserções com guardas, conversões e invariantes.

## Oxlint: o que resolver por configuração

### Proteções já existentes

A configuração já bloqueia `any`, non-null assertions, comentários de supressão e
vários problemas de imports, promises e exports. O lint já usa informação de tipos.
As regras próprias de asserções encadeadas, espaçamento e comentário de segurança
estão limitadas a `src/domain` e `src/shared`.

Essa diferença de escopo é relevante: o repositório financeiro do exemplo não
recebe essas regras próprias. Ampliar um override é possível, mas cada regra precisa
fazer sentido no novo contexto. Não se deve aplicar todas indiscriminadamente ao
Worker, testes ou adaptadores.

### Regras ativadas

As seguintes entradas foram adicionadas ao objeto `rules` existente. Este
fragmento documenta a mudança e não substitui a configuração inteira:

```json
{
  "typescript/no-unnecessary-condition": "error",
  "typescript/no-unnecessary-type-assertion": "error",
  "typescript/no-unnecessary-type-conversion": "error",
  "typescript/no-unsafe-type-assertion": "error",
  "eslint/no-nested-ternary": "error"
}
```

| Regra | Benefício | Limite |
| --- | --- | --- |
| `typescript/no-unnecessary-condition` | Aponta condições e acessos opcionais redundantes segundo os tipos | Não percebe garantias que os tipos ainda não expressam; regra classificada como nursery na documentação consultada |
| `typescript/no-unnecessary-type-assertion` | Aponta asserções que não alteram o tipo | Não remove toda defesa runtime, não substitui validação financeira |
| `typescript/no-unnecessary-type-conversion` | Aponta conversões de tipo redundantes | Conversões legítimas de dados externos e flags continuam permitidas |
| `typescript/no-unsafe-type-assertion` | Aponta asserções que estreitam o tipo sem uma garantia verificável pelo compilador | Não substitui parse ou narrowing na fronteira |
| `eslint/no-nested-ternary` | Impede decisões condicionais aninhadas nessa sintaxe | Não escolhe a função ou responsabilidade correta para a decisão |

As regras constam no schema da versão instalada, Oxlint 1.87.0. Referências:
[catálogo de regras](https://oxc.rs/docs/guide/usage/linter/rules),
[condições redundantes](https://oxc.rs/docs/guide/usage/linter/rules/typescript/no-unnecessary-condition.html)
e [ternários aninhados](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-nested-ternary.html).

Também foram ativadas métricas em `src/**/*.ts` e `src/**/*.tsx`, com override
posterior que desativa somente essas três métricas em `src/**/__tests__/**`.
As demais regras continuam cobrindo testes. Scripts não recebem essas métricas.

| Regra | Limite inicial | Intenção |
| --- | --- | --- |
| `eslint/complexity` | 20 | Sinalizar funções com muitas decisões |
| `eslint/max-depth` | 4 | Sinalizar fluxo excessivamente aninhado |
| `eslint/max-params` | 4 | Sinalizar assinaturas posicionais extensas |

São limites locais iniciais, não uma definição universal de código limpo nem um
preset Airbnb. Complexidade 20 e profundidade 4 correspondem aos defaults
documentados dessas regras; quatro parâmetros é uma escolha deste projeto para
favorecer entradas nomeadas. Os limites servem para abrir revisão: não autorizam
fragmentar funções mecanicamente, criar objetos sem significado ou esconder
branches apenas para baixar uma métrica. Referências:
[complexidade](https://oxc.rs/docs/guide/usage/linter/rules/eslint/complexity),
[profundidade](https://oxc.rs/docs/guide/usage/linter/rules/eslint/max-depth) e
[parâmetros](https://oxc.rs/docs/guide/usage/linter/rules/eslint/max-params).

### Sondagem executada

Foi executado, sem `--fix`, com Node 24 via mise:

```sh
mise exec node@24 -- node_modules/.bin/oxlint \
  --config .oxlintrc.json \
  --deny typescript/no-unnecessary-condition \
  --deny typescript/no-unnecessary-type-assertion \
  --deny no-nested-ternary \
  src/domain/entity.ts \
  src/worker/finance/entities.repository.ts \
  src/domain/rules/rules.ts
```

O comando reportou ternários aninhados em `entity.ts` e `rules.ts`, além de uma
condição sempre falsa em `rules.ts`. Não houve diagnóstico de asserção de tipo
desnecessária nesse recorte. Isso não equivale a uma auditoria completa.

O nome não qualificado `no-nested-ternary` na CLI acionou tanto a regra ESLint como
a Unicorn. Por isso a configuração aplicada seleciona explicitamente a regra
ESLint. Não ativar duas regras para policiar a mesma expressão.

### Resultado após ativação no projeto

O baseline `mise exec node@24 -- npm run lint` passou antes da edição. Após ativar
as oito regras, o mesmo comando terminou com código 1 e 70 erros, sem executar
`--fix`. A configuração foi carregada; as falhas são diagnósticos do código.

| Grupo | Erros |
| --- | ---: |
| Ternários aninhados | 28 |
| Condições redundantes | 14 |
| Complexidade | 11 |
| Muitos parâmetros / profundidade | 6 / 5 |
| Asserções inseguras / desnecessárias | 5 / 1 |

A regra de conversão desnecessária não apontou violações nessa execução.
`prepareEntity` foi reportada com complexidade 35 e sete parâmetros contabilizados
pelo lint; sua assinatura contém oito parâmetros, sendo o último opcional. O
diagnóstico de parâmetros não deve ser confundido com uma transcrição da assinatura.

O relatório completo desta sessão foi salvo em
`/tmp/caderninho-lint-clarity.log`. É um arquivo temporário, não um artefato
versionado. Os totais são um retrato desta revisão; executar `npm run lint` volta a
gerar o diagnóstico atual. Na etapa de ativação, nenhuma violação foi corrigida ou
suprimida; a correção posterior está registrada ao final deste documento.

### Regras que exigem cautela

- `complexity`, `max-depth` e `max-params` estão ativadas conforme os limites acima.
  Revisar os casos pelo significado; não corrigir métricas por extração artificial.
- `typescript/strict-boolean-expressions` pode tornar alguns testes explícitos,
  mas também aumentar o ruído. Não é a primeira intervenção recomendada.
- `typescript/no-unsafe-type-assertion` está ativada. Corrigir contratos e narrowings;
  não contornar o diagnóstico com outra asserção ou uma supressão.
- Uma regra customizada que proíba todo `typeof`, `unknown`, `??` ou parse de Zod
  seria incorreta: fronteiras legítimas precisam dessas operações.
- O comentário exigido para uma asserção não prova sua segurança. Preferir corrigir
  o contrato a acumular comentários para justificar uma modelagem fraca.

O comando atual de lint usa `--deny-warnings`; portanto, mudar uma regra para `warn`
não cria uma etapa não bloqueante no CI. Uma avaliação exploratória deve usar um
comando separado, sem esse argumento, antes de alterar a política obrigatória.

### O que Oxlint não resolve

Nenhuma edição de configuração decide quais campos participam do hash, quais
ausências são válidas, se uma transação tem o pai correto ou onde começa a
atomicidade da publicação. A ferramenta também não cria a correlação entre recurso
e registro nem escolhe a responsabilidade de um módulo.

As fronteiras de imports já possuem um checker próprio em
[check-imports.ts](../scripts/check-imports.ts). Preservá-lo e evoluí-lo onde houver
necessidade concreta; não criar um segundo sistema equivalente de regras.

### Pesquisa: existe um equivalente ao setup Airbnb?

Pesquisa feita em 18 de outubro de 2026, em documentação e repositórios dos autores.

| Referência | O que oferece | Aplicação neste projeto |
| --- | --- | --- |
| [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) | Guia e configurações do ecossistema ESLint | Referência de convenções; não presumir compatibilidade direta com Oxlint |
| [oxlint-config-presets](https://github.com/popup-plus/oxlint-config-presets) | Port comunitário com Airbnb, Standard, Google e configurações TypeScript, incluindo `strict-type-checked` | Existe uma opção semelhante à experiência de presets do ESLint, mas não foi instalada |
| [Plugins nativos do Oxlint](https://oxc.rs/docs/guide/usage/linter/plugins) | Implementações de regras dos ecossistemas ESLint, TypeScript, Unicorn e outros | Base já utilizada pela configuração local |

O pacote comunitário permite usar `airbnb.json` via `extends`. Isso não o torna
uma distribuição oficial da Airbnb ou do projeto Oxc, nem garante que todas as
convenções do guia original tenham equivalente. A compatibilidade de um preset
com a versão instalada precisa ser executada e verificada.

Recomendação para o Caderninho: manter Oxfmt responsável por estilo e usar regras
semânticas de TypeScript e regras de clareza selecionadas explicitamente no
Oxlint. `strict-type-checked` é uma referência útil para avaliar cobertura futura;
importar Airbnb inteiro traz convenções além do problema que queremos resolver.
Essa recomendação é uma decisão técnica para este contexto, não uma conclusão de
que existe um preset universalmente melhor ou dominante no ecossistema.

Nenhum pacote foi adicionado. Presets foram pesquisados como alternativas, não
adotados. As regras próprias e sua proveniência permanecem preservadas.

## Oxfmt: o que resolver por configuração

A configuração atual já cobre largura de 80 colunas, espaços, atributos JSX em
linhas separadas, quebra preservada de objetos e agrupamento de imports. A ordem
de imports com efeitos colaterais permanece preservada.

Não há uma nova opção indispensável de Oxfmt para o problema analisado. A prioridade
é manter a configuração atual e executar o formatter depois dos recortes de
refatoração. O formatter uniformiza apresentação, não reorganiza responsabilidades.
Ver [configuração do Oxfmt](https://oxc.rs/docs/guide/usage/formatter/config).

| Necessidade | Oxfmt atende? | Observação |
| --- | --- | --- |
| Layout, espaços e quebras | Sim | Já configurado |
| Ordem e agrupamento de imports | Sim | Já configurado; revisão semântica continua necessária |
| Retirar guardas redundantes | Não | Depende dos tipos, lint e revisão |
| Extrair política de hash ou separar SQL | Não | Refatoração manual |
| Formatar este Markdown no comando atual | Não | `**/*.md` está em `ignorePatterns` |

Retirar o ignore de Markdown seria uma escolha editorial separada, sem resolver os
antipadrões do código. Não adicionar outro formatter ou preset estilístico.

## Direção de refatoração

### Preservar a arquitetura atual

Manter um pacote npm, um deploy e os diretórios `src/domain`, `src/contracts`,
`src/worker`, `src/web` e `src/shared`. Usar os limites de controllers, services,
repositórios e composição que o projeto já adota.

Não introduzir container de DI, repositório genérico, fábrica de estratégias por
recurso, nova camada de DTOs duplicados ou uma reorganização global de pastas.
Uma extração pode continuar no mesmo arquivo quando isso mantém a leitura local.

### Fluxo desejado

```text
Payload externo
  → validação e adaptação de entrada
  → registro com garantias explícitas
  → projeção relevante e consulta do estado anterior
  → decisão de reutilizar ou reprocessar
  → normalização e regras, quando necessárias
  → builders de persistência
  → batch atômico com progresso e checkpoint
```

Esse desenho representa responsabilidades, não exige oito funções ou arquivos.
O caminho sem mudança deve continuar evitando normalização e avaliação de regras.

### Cinco recortes de implementação

1. **Contratos consumidos:** declarar os campos conhecidos hoje acessados pelo
   `catchall`; melhorar os contratos dos recursos efetivamente usados. Preservar
   campos extras no payload de origem e não tornar obrigatório o que o provedor
   legitimamente omite. Derivar tipos com `z.infer`.
2. **Projeção relevante:** extrair a seleção de campos e a contribuição do pai
   para uma função pura. Preservar conteúdo e representação usados no hash,
   incluindo a semântica legada. Não alterar o algoritmo junto com a extração.
3. **Coordenação:** usar entrada nomeada, receber apenas dados necessários da
   operação e deixar explícita a escolha entre reutilização e reprocessamento.
   Fornecer o instante observado à lógica pura, mantendo o relógio na borda.
4. **Persistência:** reunir predicado de identidade e mapper de colunas onde isso
   reduzir duplicação. Usar tipos inferidos do Drizzle, builders nativos e ordem
   existente. Preservar `first_seen_at`, ressurreição de excluídos e batch externo.
5. **Aplicação ao projeto:** revisar módulos por feature usando os mesmos critérios,
   remover código substituído e ativar apenas regras de lint com benefício
   demonstrado. Não pressupor que todos precisam da mesma extração.

### Como impedir que a limpeza vire overengineering

Uma extração deve ter um motivo concreto: isolar I/O, concentrar uma política,
remover repetição relevante ou tornar um contrato preciso. Um nome que apenas
repete a expressão não justifica um helper.

Não transformar cada booleano em função nem retornar um grande plano genérico
para um interpretador novo executar. Uma função coordenadora pode continuar
sequencial e explícita. SQL pode continuar verboso quando representa fielmente a
operação de persistência.

## Critérios de aceitação

### Clareza e confiança

- Campos conhecidos são acessados pelos seus tipos; acesso dinâmico fica confinado.
- Não há validação estrutural repetida de dados internos já garantidos.
- Invariantes financeiras e de escopo têm um responsável identificável.
- Decisões de negócio não ficam escondidas no mapper SQL.
- Há menos caminhos e contratos ambíguos, sem dependências ou camadas especulativas.

### Comportamentos a preservar

| Cenário | Garantia |
| --- | --- |
| Fonte sem mudança relevante | Atualiza observação e fonte sem reclassificar |
| Mudança relevante ou renormalização forçada | Reprojeta e aplica regras quando cabível |
| Entidade excluída reaparece | Não é tratada como uma entidade ativa inalterada |
| Repetição na mesma operação e update posterior | Contagem idempotente e `first_seen_at` preservado |
| Falha na publicação | Entidades, derivados, progresso e checkpoint não ficam parcialmente publicados |

Complementar os cenários com precisão monetária, ausência válida, identidade
divergente e projeção legada onde houver mudança. Reutilizar a cobertura existente;
adicionar testes apenas para lacunas de comportamento. Não criar testes que
simplesmente reproduzam a implementação dos novos helpers.

### Verificação da implementação futura

Usar Node 24. A cada recorte, executar os checks pertinentes. Ao concluir a
refatoração, cumprir a sequência definida no `AGENTS.md`:

```sh
npm test
npm run test:product
npm run lint
npm run format:check
npm run typecheck
npm run check:imports
npm run build
npm run test:product:runtime
```

Em mudanças de configuração, verificar também que `npm run lint:fix` seguido de
`npm run format` converge: uma segunda execução não deve criar novas alterações.
Revisar fixes de imports separadamente de mudanças de comportamento.

O diagnóstico inicial foi produzido por leitura do código, pesquisa de fontes
oficiais e dos autores dos presets, sondagem e execução completa do lint antes e
depois da configuração. O relatório de 70 erros acima é histórico.

Na etapa de correção, foram aplicadas entradas nomeadas, extrações locais por
responsabilidade, campos monetários explícitos, remoção de condições redundantes e
substituição de asserções inseguras por contratos corretos. A seleção de campos do
hash passou ao domínio; o repositório mantém builders Drizzle não executados e o
fluxo externo publica o batch com progresso e checkpoints.

Verificações de cancelamento após `await` foram preservadas, usando leituras do
estado vivo onde o analisador mantinha um narrowing anterior. Fixtures agora usam
bindings completos e helpers oficiais de OAuth. O fixture de steps executa os
callbacks; os testes de replay verificam receipts em D1 e o runtime real.

Nenhum preset externo foi instalado e nenhuma regra foi afrouxada. Esta etapa é
local e sintética, sem deploy ou alteração de dados reais.

### Resultado dos checks após as correções

| Verificação | Resultado |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm run check:imports` | Passaram; nenhum diagnóstico de lint restante |
| `npm run format:check` e convergência `lint:fix` → `format` | Passaram; segunda execução sem novas alterações |
| `npm test` | 37 testes passaram |
| `npm run test:product` | 47 testes passaram, incluindo descarte do polling enquanto o leitor aguarda |
| `npm run build` e `npm run test:product:runtime` | Passaram; build do portal e Worker em dry-run, runtime sintético de D1/Workflows e exportação/restauração local |

Todos os comandos usaram Node 24. Os testes que abrem servidores locais precisaram
de acesso a loopback fora do sandbox; a execução restrita havia falhado com
`listen EPERM`. Essa falha de ambiente não foi tratada como defeito da aplicação.
Os resultados acima são das execuções locais concluídas, sem publicação remota.

## Histórico: resultado do primeiro recorte

`projectEntity` agora acessa diretamente os atributos de texto conhecidos e os
campos monetários consumidos estão explícitos no schema. A seleção dinâmica dos
campos do provedor ficou concentrada na projeção relevante para o hash.
`prepareEntity` recebe entrada nomeada, consulta o estado anterior e produz os
builders, com o mapeamento de colunas em uma função local própria.

As extrações de normalização, classificação, conversão de regras, recorrência e
sincronização permanecem locais aos módulos existentes. O lint serve como proteção
contra regressões; decisões de domínio e invariantes continuam exigindo revisão.

## Continuação da revisão manual no projeto

A revisão percorreu domínio, contratos, funcionalidades do Worker, painel e
scripts, buscando os mesmos padrões do exemplo original: acesso dinâmico a campos
conhecidos, parses estruturais repetidos, garantias que se perdiam entre funções,
políticas dentro do mapper e decisões de fluxo misturadas com persistência.
O código que já tinha uma fronteira clara foi mantido.

### Mudanças por responsabilidade

| Área | Mudança aplicada |
| --- | --- |
| Normalização e projeção | `accountName`, `amount` e `investmentId` do provedor ganharam campos conhecidos nos schemas. `txContext` lê esses campos diretamente. A navegação dos campos dinâmicos do provedor usa um único seletor, compartilhado pela normalização e pelo fingerprint. |
| Regras e conversão | Relatórios de importação discriminam sucesso com documento e falha sem documento. Importação nativa e conversão v1 reutilizam o resultado validado. A gravação recebe `Rules`, sem novo parse estrutural; verificações de catálogo, fases e referências continuam na compilação. Os caminhos de diagnósticos perderam referências acidentais à antiga árvore de diretórios. |
| Recorrências | A seleção retorna o registro elegível com seus campos obrigatórios ou o motivo de exclusão. O agrupamento consome essa garantia sem repetir as quatro verificações de estrutura. Cada grupo é ordenado uma vez; o nome exibido continua vindo da primeira cobrança em ordem cronológica. |
| Fronteiras e adaptadores | Comandos do painel fazem um único parse com o schema da ação, seguido da comparação CSRF. O serviço recebe o UUID validado. `boundedJson` reutiliza o JSON exato já validado; a releitura de saldo confia na checagem de identidade do adaptador. Retry de rate limit consome `Fault`, sem parse do erro interno. A CLI de migração deixa a validação da linha completa verificar a ausência do pai. |
| Preparação e publicação | `finance/entity-preparation.ts` coordena comparação, normalização e regras com dependências explícitas, sem SQL ou bindings. `entityPersistence` lê o estado e monta builders. A composição fornece relógio e implementações; os fluxos recebem a função de preparação por operação, sem importar a implementação da composição. Reaplicação avalia regras antes de montar os statements, usando entrada nomeada. |

### Donos das garantias

- A normalização verifica a representação canônica e o limite de 30 dígitos ao
  produzir cada campo monetário, inclusive medidas secundárias. A projeção comum
  não varre novamente todos os campos `Minor`. A entrada legada conserva essa
  verificação porque não passa pela normalização. Filtros monetários validam sua
  própria entrada antes de gerar a chave de ordenação SQL.
- O domínio continua responsável pela política de correção, inclusive a presença
  da chave de tag e os valores permitidos de `ignored`. O repositório mantém a
  autorização e verifica a existência da entidade e da categoria; não repete a
  política do flag `ignored`.
- Preparação recebe `observedAt`, `operationId`, `referenceDay`, `rulesRevision` e
  `renormalize`, sem o objeto de operação inteiro. Ausência de pai nesse contrato
  interno usa `undefined`; `null` continua onde representa uma linha SQL ausente.
- O repositório reúne o predicado de identidade da entidade e usa o tipo de insert
  inferido do Drizzle. Continua devolvendo builders não executados. Dados,
  derivados, progresso, checkpoint e recibo permanecem no batch externo.

### Verificações mantidas de propósito

`ProviderRecord` e `FinanceRecord` continuam preservando campos extras; a revisão
não criou uma família de modelos por simetria. O catálogo dinâmico do provedor
ainda precisa validar os valores não descritos pelos campos conhecidos.
`typeof` também continua adequado nos operadores de regras, que recebem fatos de
tipos diferentes, e na leitura da projeção legada.

Datas e quantias opcionais ainda podem ser ausentes ou inadequadas para uma análise
específica. A recorrência continua registrando essas exclusões e separando moedas;
um tipo `string` sozinho não estabelece validade financeira. Checagens de escopo,
consentimento, expiração, identidade de origem e cancelamento após `await` foram
mantidas. O parsing do contexto OAuth permanece uma fronteira de confiança.

Os fluxos React/SDK mantêm controle de geração, cancelamento e descarte de respostas
atrasadas. Essa inspeção não exige alterar sua estrutura quando as responsabilidades
já estão separadas. Nenhuma regra de lint foi afrouxada e nenhuma dependência foi
adicionada.

### Evidência desta continuação

Os testes de comportamento acrescentam cobertura para limite monetário em medidas
secundárias, campos de regras ausentes e escalares, caminhos de erro de conversão,
observação sem reclassificação, preservação de `first_seen_at`, ressurreição de
excluídos e mudança relevante do pai. A cobertura existente de agrupamento agora
recebe registros fora de ordem; a do adaptador verifica divergência da conta na
leitura pontual. Entrada legada inválida continua rejeitada antes de publicar.

| Verificação desta continuação | Resultado |
| --- | --- |
| `mise run check:quick` | Passou: configuração, imports, tipos, formatação e lint |
| `mise run check` | Passou, incluindo 41 testes Node e 49 testes Worker |
| Build e runtime do check | Portal, Worker dry-run, D1/Workflows, OAuth sintético, subscribers e exportação/restauração local passaram |
| `lint:fix` → `format` | Segunda aplicação sem novas alterações; nenhuma regra alterada |
| Contratos e persistência | Catálogo MCP de referência, replay e rollback conjunto de dados/progresso/checkpoint/recibo passaram |

A primeira execução restrita do teste da CLI recebeu stdout vazio de subprocessos;
a suíte completa passou fora do sandbox. Os testes usam dados sintéticos e o runtime
aplica migrações somente em bancos locais isolados. O build conserva os avisos de
diretivas `use client` de dependências Kumo. Esta revisão não publicou o Worker,
não migrou dados reais e não valida OAuth/Pluggy reais nem o host ChatGPT.
