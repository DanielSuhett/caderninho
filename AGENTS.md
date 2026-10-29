# Orientações para agentes

## Economia de contexto e navegador

- **Navegador/computer use é proibido para Claude.** Não use Chrome, browser
  embutido, computer use, `run`, ferramentas `preview_*` (t3-code), snapshots de
  acessibilidade, screenshots nem scripts Playwright/Puppeteer para validar UI.
  A conferência no navegador é **delegada ao Codex** (procedimento abaixo).
  **Autorização permanente do dono:** Claude pode disparar essa delegação
  sempre que quiser validar algo com navegador/computer use, em qualquer
  momento do trabalho, sem pedir licença e sem esperar PRs abertos. Ao entregar
  mudança de frontend, delegue ou liste as rotas/estados a conferir. Para
  economizar tokens, o QA visual usa somente o tema escuro em dois viewports:
  mobile (390 px) e desktop (1440 px). Tema claro, outros tamanhos e zoom só
  entram quando o dono pedir ou quando a mudança for específica deles.
- **Delegar QA ao Codex (procedimento recomendado).** O sandbox Linux do Codex
  (`workspace-write`) nega `setsockopt` por seccomp; o Crashpad do Chromium
  trata o `EPERM` como fatal e o navegador morre ao abrir (`setsockopt:
  Operation not permitted`). O mesmo sandbox impede Wrangler/Vite de subir
  servidores, e a ferramenta de navegador interativa do Codex exige aprovação
  humana de origem. Não há correção oficial (openai/codex#47452 e #8011);
  `--no-sandbox`, `--disable-crashpad` e rede liberada não resolvem. Por isso:
  1. **Rode o Codex com `-s danger-full-access`** (recomendado e autorizado pelo
     dono para este QA). Compense a perda do sandbox no prompt: só leitura do
     repositório, scripts fora dele, sem editar, commitar nem subir servidores.
  2. Claude prepara o ambiente antes: `mise exec -- npm run build:portal`, e
     serve `dist/web` com `python3 -m http.server 4173 --bind 127.0.0.1` em
     background (rodando a partir de `dist/web`). A demo fica em
     `http://127.0.0.1:4173/demo/connections/`. Use sempre a porta 4173.
  3. O Codex roda scripts Playwright em janela anônima (`browser.newContext()`
     novo, `colorScheme: 'dark'`, um contexto por viewport) com o Chromium do
     sistema (`/usr/bin/chromium`), escritos fora do repositório. Claude
     instala `playwright-core` num diretório do scratchpad (`npm i
     playwright-core`, nunca no repositório) para o Codex importar de lá.
  4. Escreva o prompt em arquivo no scratchpad e rode em background:
     `codex exec -C <repo> -s danger-full-access -o <relatório.md> - < <prompt.md>`.
     O prompt cita AGENTS.md, aponta as issues/critérios, informa a URL pronta,
     proíbe subir/encerrar servidores e editar arquivos ou commitar, fixa tema
     escuro em 390 px e 1440 px e pede relatório curto (tabela item × resultado,
     bugs com passos, limitações). Autorização real do Pluggy não existe na
     demo: é limitação do ambiente, não bug.
  5. Se o Claude Code negar o comando com `danger-full-access` (classificador de
     permissões), não contorne: peça ao dono para rodar o mesmo comando com `!`
     no prompt, ou para liberar a regra de Bash correspondente em
     `.claude/settings.json`.
  6. Ao terminar, Claude encerra o servidor estático (`fuser -k 4173/tcp`),
     lê o relatório e resume bugs e limitações.
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
- Padrão de gestão (Conexões, Grupos, Regras, Sincronização, Auditoria MCP,
  primeiro uso): escolha o dono no topo (`ScopePicker`: pessoa ou grupo, com a
  ação de criar ao lado) e mostre tudo dele em **um painel** (`entity-panel`),
  com as ações no cabeçalho do próprio painel, sem seções soltas nem trilhas de
  etapas. Criações em várias etapas viram wizard em um Dialog único (indicador
  de etapas, uma ação principal, voltar que preserva o rascunho). Progresso e
  pendências vêm do D1 (`SetupProgress`, faixa "Importar"); links de checklist
  abrem o wizard por `?wizard=` uma vez. Novas telas de gestão seguem este
  padrão.
- Tipografia: Inter no sistema/controles, Source Serif 4 só nos títulos editoriais
  da landing, Inter tabular em valores, monoespaçada só em código/URLs/chaves/
  prompts. Conteúdo/controles 16 px, metadados 14 px, peso até 600.
- Minimalismo é global: simplifique hierarquia, cópia e ações; remova repetições
  e pilhas de botões largos.
- Sem textos de rodapé, notas de observação ou parágrafos explicativos sob
  cards e seções. Resolva pela navegação e pela estrutura: linhas curtas
  colapsáveis (resumo no topo, detalhes ao expandir), badges curtos, `InfoTip`
  ou estados vazios. Listas aninhadas não repetem avatar/identidade que o item
  pai já mostra.
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
