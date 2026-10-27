# Orientações para agentes

## Economia de contexto e navegador

- **Navegador/computer use é proibido para Claude.** Não use Chrome, browser
  embutido, computer use, `run`, ferramentas `preview_*` (t3-code), snapshots de
  acessibilidade, screenshots nem scripts Playwright/Puppeteer para validar UI. QA visual no navegador é feita pelo **Codex**, somente quando o
  dono autorizar explicitamente e no ciclo final, depois que os PRs estiverem
  abertos. Ao entregar mudança de frontend, liste as rotas/estados que o Codex
  deve conferir em vez de validá-los. Para economizar tokens, o QA visual usa
  somente o tema escuro em dois viewports: mobile (390 px) e desktop (1440 px).
  Tema claro, outros tamanhos e zoom só entram quando o dono pedir ou quando a
  mudança for específica deles.
- Leia sob demanda: use `grep`/`rg` e leituras parciais antes de abrir arquivos
  inteiros. Não leia DESIGN.md, `docs/` ou guias por completo para mudanças
  locais; abra só a seção da área tocada.
- Não abra artefatos grandes ou gerados: `design-qa.md`, `*.log`, `outputs/`,
  `work/`, `dist/`, `.wrangler/`, `node_modules/`, `package-lock.json`,
  `.localdocs/`, `.taste-skill/`. Consulte-os por `grep` apenas se o pedido exigir.
- Não carregue skills de `.agents/` nem crie subagentes sem pedido explícito.
- Escopo segue o pedido: correção local não vira revisão global. Revisão global
  (inventário de rotas, jornadas e matriz por página) só quando pedida.
- Não carregue transcrições de outras threads inteiras; peça o trecho.
- Não despeje arquivos com `cat`/`sed -n 1,N` longos; leia faixas pequenas
  localizadas por `grep -n`. Agrupe edições do mesmo arquivo numa só operação.
- Não faça polling com `sleep` + `curl`; espere o processo ou use monitoramento
  em background.
- Saídas de comandos: filtre (`| tail`, `--max-diagnostics`, `grep`) em vez de
  despejar logs completos. Não repita um comando que já passou sem mudança no
  código entre as execuções.

## Como escrever código

- Prefira TypeScript ESM estrito. No domínio, reúna interfaces, uniões, enums e
  regras puras por conceito em arquivos `*.entity.ts`. Use `.types.ts` para DTOs
  de transporte e modelos técnicos sem comportamento. Mantenha schemas nas
  fronteiras que validam entradas em runtime, compatíveis com os tipos via
  `satisfies`. Use tipos inferidos de tabelas/projeções Drizzle. Sem `any`, casts
  para convencer o compilador, non-null assertions ou supressões; `as const` é
  permitido.
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
- Prefira enums para conjuntos fechados de valores do produto, no padrão de objetos
  `as const` com uniões derivadas, declarados no entity do conceito (sem arquivos
  genéricos de enums). Reutilize-os em schemas, tipos e consumidores; preserve
  valores e ordem dos contratos existentes. Nomes de propriedades, textos livres e
  valores abertos de terceiros continuam strings.
- Mantenha funções relacionadas próximas. Extraia para isolar I/O, políticas ou
  repetição relevante; não crie um helper por booleano, camadas genéricas ou DI
  container. Remova código substituído e abstrações sem uso.
- Use Strategy com funções quando variantes compartilham um contrato e tabelas
  para correspondências fixas. Use `Record` completo para enums e `Map` para
  chaves abertas. Explicite a prioridade de decisões concorrentes; mantenha
  `switch` quando ele preserva o narrowing de uma união discriminada.
- É obrigatório usar `tryCatch` para falhas assíncronas. Desestruture sempre
  `{ data, error }` e use `error` como discriminante antes de consumir `data`.
  Aliases são permitidos para colisões e campos sem uso (`data: _data`). Passe a
  operação como função para capturar lançamentos síncronos; promises já criadas
  podem entrar diretamente. Await direto propaga ao chamador; recuperações ficam na
  fronteira responsável. Normalize falhas para `Error`. Catches síncronos de parse
  e `try/finally` para liberar recursos são válidos. Documente recuperações best
  effort.
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
  `composition/index.ts`. `index.ts` do módulo não exporta repositories. Fluxos
  duráveis de `sync` e persistência de `finance` podem ter arquivos especializados
  com o mesmo sufixo de camada; adapters de provedor, OAuth e Workflow permanecem
  explícitos.
- O Biome bloqueia imports entre camadas. Use caminhos relativos sem extensões
  `.ts`/`.tsx` nem o sufixo `/index`. Consuma outros módulos pelo seu `index.ts`,
  com exports nomeados explícitos; dentro do módulo, importe implementações
  diretamente para evitar ciclos pelo próprio barrel. Agrupe imports do mesmo
  módulo; use `type` inline junto de valores e `import type` para somente tipos.
  Reserve `import()` para carregamento dinâmico. Persistência, transporte,
  composição e logger têm entradas separadas; índices de aplicação expõem casos de
  uso e contratos. A landing estática pode importar `shared/result` diretamente.
  Execute scripts e testes Node com o loader `tsx` pelos comandos npm/mise.
- D1 é a fonte das consultas e do progresso. Preserve precisão monetária, moedas,
  semântica do provedor, nomes dos steps e batches atômicos com checkpoints.
  Dados sintéticos nos testes; secrets e dados financeiros privados fora do Git.
- Preserve contratos públicos. Deploy, merge, migração real e remoção de dados
  remotos exigem instrução explícita separada.

## Frontend

- Ao mexer em UI, consulte em [DESIGN.md](DESIGN.md) apenas as seções da área
  (tipografia, minimalismo, “Regras de área do painel”) e preserve Kumo,
  semântica financeira e acessibilidade.
- Tipografia: Inter no sistema/controles, Source Serif 4 só nos títulos editoriais
  da landing, Inter tabular em valores, monoespaçada só em código/URLs/chaves/
  prompts. Conteúdo/controles 16 px, metadados 14 px, peso até 600.
- Minimalismo é global: simplifique hierarquia, cópia e ações; remova repetições
  e pilhas de botões largos.
- Repetição real vai para componentes compartilhados; confira os consumidores.
  Produto e demo compartilham telas; regras de negócio ficam no domínio.
- Fluidez: carregue código por rota/intenção e gráficos perto da área visível
  com altura reservada; não antecipe consultas financeiras, não invente progresso
  nem mantenha polling ocioso.
- Validação do Claude é por tipos, lint, testes e build. A conferência visual
  (tema escuro em mobile e desktop) fica para o QA do Codex descrito em
  “Economia de contexto e navegador”; registre-a como “não validado no
  navegador” na entrega.

## Processo de desenvolvimento

1. Confira `git status` e o diff; preserve alterações existentes. Consulte a
   documentação da área antes de mudar contratos ou arquitetura. Skills em
   `.agents/`, hooks em `.codex/` e `skills-lock.json` são locais e ficam fora dos
   commits.
2. Use mise com Node 24: `mise install` e `mise run setup` no primeiro preparo;
   repita setup ao mudar o lockfile. Para comandos avulsos, use
   `mise exec -- <comando>`.
3. Ultracite usa Biome (presets `core`, `react`, `vitest`). Preserve as restrições
   de `biome.json`; não desative regras, não use `--unsafe` global nem crie
   plugins para eliminar diagnósticos. Não crie metatestes de ferramentas, fontes
   ou configurações. Remova fixtures e helpers sem consumidores.
4. Durante a edição, rode só o necessário: `mise run lint:fix`/`format` para
   corrigir, `mise run typecheck` e os testes do arquivo/módulo tocado
   (`mise exec -- node --import tsx --test <arquivo>` no domínio/worker,
   `mise exec -- npx vitest run <caminho>` no produto). `mise run check:quick` ao fechar um
   bloco de mudanças.
5. `mise run check` (suíte completa com build e runtime) roda **uma vez**, antes
   de entregar ou commitar, não a cada edição. Informe o que passou e as
   pendências. Testes locais e build dry-run não comprovam deploy ou OAuth real.
   Mudanças só de documentação dispensam a suíte.

Comunique resultado, progresso e próxima ação de forma breve e concreta.
