# Orientações para agentes

## Como escrever código

- Prefira TypeScript ESM estrito. No domínio, reúna interfaces, uniões, enums e
  regras puras por conceito em arquivos `*.entity.ts`. Use `.types.ts` para DTOs
  de transporte e modelos técnicos sem comportamento. Mantenha schemas nas
  fronteiras que validam entradas em runtime, compatíveis com os tipos via `satisfies`.
  Use tipos inferidos de tabelas/projeções Drizzle. Sem `any`, casts para convencer
  o compilador,
  non-null assertions ou supressões; `as const` é permitido.
- Valide entradas externas com Zod na fronteira. Confie nos contratos internos e
  nas escritas controladas; não repita parses, `typeof` ou guardas estruturais em
  cada consumidor. Preserve a identidade dos registros, a autenticação da
  instalação e os invariantes financeiros. Toda a base pertence ao dono da
  instalação; não crie permissões por Item, recurso, conta ou operação.
- Use entradas nomeadas, campos conhecidos e early returns. Toda cláusula tem
  chaves. Evite ternários aninhados, regras de negócio e extração dinâmica inline.
  Trate ausências reais; omita opcionais ausentes em vez de passar `undefined`.
- Use truthiness para objetos opcionais, flags e coleções vazias. Use `!!` quando
  o resultado precisa ser booleano e `condição && { campos }` em spreads opcionais.
  Preserve `0`, `false` e `""` válidos: para ausência, use `??` ou comparações
  explícitas com `null`, `undefined` e o sentinel definido pelo contrato.
- Prefira enums para conjuntos fechados de valores do produto. Siga o padrão
  existente de objetos `as const` e uniões derivadas, compatível com TypeScript
  executável no Node. Reutilize-os em schemas, tipos e consumidores; mantenha
  nomes de propriedades, textos livres e valores abertos de terceiros como strings.
- Mantenha funções relacionadas próximas. Extraia para isolar I/O, políticas ou
  repetição relevante; não crie um helper por booleano, camadas genéricas ou DI
  container. Remova código substituído e abstrações sem uso.
- Use Strategy com funções quando variantes compartilham um contrato e tabelas
  para correspondências fixas. Use `Record` completo para enums e `Map` para
  chaves abertas. Explicite a prioridade de decisões concorrentes; mantenha
  `switch` quando ele preserva o narrowing de uma união discriminada.
- É obrigatório usar `tryCatch` para tratar falhas assíncronas. Desestruture sempre
  as propriedades `{ data, error }`; use `error` como discriminante antes de
  consumir `data`. Aliases são permitidos para colisões de escopo e campos sem uso
  (`data: _data`), preservando o lint. Passe a operação como função para capturar
  também lançamentos síncronos; promises já criadas podem entrar diretamente.
  Await direto propaga ao chamador; recuperações ficam na fronteira responsável.
  Normalize falhas para `Error`. Catches síncronos de parse e `try/finally` para
  liberar recursos são válidos. Documente recuperações best effort.
- Meça gargalos com dados sintéticos antes de otimizar loops. Agrupe leituras
  independentes e reutilize trabalho estático; `Promise.all` não paraleliza CPU
  JavaScript. Preserve limites de concorrência, ordem dos steps e batches atômicos.

## Limites do projeto

- Preserve um pacote npm e um deploy: `src/domain`, `contracts`, `worker`, `web`
  e `shared`. Controllers tratam transporte; services recebem dependências
  explícitas, sem SQL/HTTP/Bindings; repositories concentram SQL. Cada módulo de
  aplicação concentra modelos e portas em `entity/index.ts`, transporte em
  `controller/index.ts`, casos de uso em `service.ts`, SQL em `repository/` e testes
  em `__tests__`. Services dependem das portas, nunca dos factories ou
  `ReturnType` de repositories concretos. A composição liga implementações em
  `composition/index.ts`.
  `index.ts` do módulo não exporta repositories. Fluxos duráveis de `sync` e
  persistência de `finance` podem ter arquivos especializados com o mesmo sufixo
  de camada; adapters de provedor, OAuth e Workflow permanecem explícitos.
  O Biome bloqueia imports entre camadas, inclusive em novos helpers. Use caminhos
  relativos sem extensões `.ts`/`.tsx` nem o sufixo `/index`. Consuma outros módulos
  pelo seu `index.ts`, com exports nomeados explícitos. Dentro do módulo, importe
  implementações diretamente para evitar ciclos pelo próprio barrel. Persistência,
  transporte, composição e logger têm entradas separadas; índices de aplicação
  expõem casos de uso e contratos. Execute scripts e testes Node com o loader `tsx`
  pelos comandos npm/mise, que resolvem os índices de diretórios em ESM.
- D1 é a fonte das consultas e do progresso. Preserve precisão monetária, moedas,
  semântica do provedor, nomes dos steps e batches atômicos com checkpoints.
  Dados sintéticos nos testes; secrets e dados financeiros privados fora do Git.
- Preserve contratos públicos. Deploy, merge, migração real e remoção de dados
  remotos exigem instrução explícita separada.

## Processo de desenvolvimento

1. Confira `git status` e o diff; preserve alterações existentes. Consulte a
   documentação da área antes de mudar contratos ou arquitetura.
   Skills em `.agents/`, hooks em `.codex/` e `skills-lock.json` são locais e
   ficam fora dos commits.
2. Use mise com Node 24: `mise install` e `mise run setup` no primeiro preparo;
   repita setup ao mudar o lockfile. `package.json` define comandos e dependências.
   Consulte `mise tasks ls`; para comandos avulsos, use `mise exec -- <comando>`.
3. Ultracite usa Biome com presets `core`, `react` e `vitest`. Execute
   `mise exec -- npx ultracite fix`, `check` e `doctor` para corrigir, verificar e
   diagnosticar a configuração. Preserve as restrições locais de `biome.json`;
   não desative regras para eliminar diagnósticos.
   Faça mudanças pequenas e verificáveis. Durante a edição, execute
   `mise run check:quick`; mantenha testes de comportamento relevantes.
   Execute lint, tipos e formatação diretamente; não crie metatestes de ferramentas,
   fontes ou configurações. Remova fixtures e helpers sem consumidores.
4. Use `mise run lint:fix` e `mise run format`; revise o diff e garanta convergência.
   Biome cuida de lint, layout e imports. Use regras nativas, documente lacunas
   e corrija a causa dos diagnósticos; não crie plugins próprios para reproduzir
   regras indisponíveis, desative regras ou use `--unsafe` global.
5. Antes de entregar código, execute `mise run check`. Informe o que passou e
   qualquer pendência. Testes locais e build dry-run não comprovam deploy ou OAuth
   real. Mudanças só de documentação dispensam repetir a suíte.

Comunique resultado, progresso e próxima ação de forma breve e concreta.
