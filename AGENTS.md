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
  executável no Node. Declare-os no entity do conceito, junto de suas regras;
  evite arquivos genéricos de enums. Reutilize-os em schemas, tipos e consumidores;
  preserve os valores e a ordem das opções dos contratos existentes. Mantenha
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
  pelo seu `index.ts`, com exports nomeados explícitos. Agrupe imports do mesmo
  módulo; use `type` inline junto de valores e `import type` para somente tipos.
  Mantenha tipos importados no topo; reserve `import()` para carregamento dinâmico.
  Dentro do módulo, importe implementações diretamente para evitar ciclos pelo
  próprio barrel. Persistência,
  transporte, composição e logger têm entradas separadas; índices de aplicação
  expõem casos de uso e contratos. A entrada estática da landing pode importar
  `shared/result` diretamente para não inicializar o cliente HTTP pelo barrel.
  Execute scripts e testes Node com o loader `tsx`
  pelos comandos npm/mise, que resolvem os índices de diretórios em ESM.
- D1 é a fonte das consultas e do progresso. Preserve precisão monetária, moedas,
  semântica do provedor, nomes dos steps e batches atômicos com checkpoints.
  Dados sintéticos nos testes; secrets e dados financeiros privados fora do Git.
- Preserve contratos públicos. Deploy, merge, migração real e remoção de dados
  remotos exigem instrução explícita separada.

## Frontend: revisar a experiência inteira

1. Leia [DESIGN.md](DESIGN.md), especialmente “Minimalismo em toda a experiência”,
   e os guias de componentes e da área. Preserve o contrato atual de Kumo,
   tipografia, semântica financeira e acessibilidade. O feedback de minimalismo
   é global; não o trate como exceção exclusiva de Pessoas ou de uma rota.
2. Antes de uma revisão global, inventarie as rotas, tarefas, componentes
   compartilhados, diálogos e estados alcançáveis. Percorra a jornada desde a
   entrada até a conclusão, incluindo voltar, cancelar, erro e retomada. Uma
   correção local é válida para um pedido local; não encerre um pedido global
   após atualizar só o primeiro exemplo.
3. Aplique os papéis de tipografia de DESIGN.md: Inter no sistema e nos
   controles, Source Serif 4 nos títulos editoriais da landing, Inter tabular em
   valores e monoespaçada somente em código/URLs/chaves/prompts. Não troque a
   fonte por página arbitrariamente nem aplique a fonte editorial a uma prévia
   do painel. Preserve conteúdo/controles de 16 px, metadados de 14 px, peso até
   600, tracking nativo e entrelinha adequada. Confira acentos, valores longos,
   contraste, reflow a 320 CSS px e zoom de 200%. Atualize a referência visual
   quando mudar esses papéis. Simplifique hierarquia, cópia, estados e
   posicionamento das ações. Use ícones
   para ações secundárias familiares, com nome acessível e Tooltip por foco;
   preserve rótulos quando necessários à decisão. Remova repetições e pilhas de
   botões largos. Ajuda sob demanda não pode ocultar erro, consentimento ou
   contexto indispensável. Não obtenha densidade encolhendo a fonte.
   Não reintroduza seções genéricas “Critérios”/“Referência técnica”, explicações
   óbvias de cartão ou contagens técnicas na leitura financeira. Política dos
   valores fica na ajuda contextual; erros e parcialidade continuam visíveis.
   Temas claro/escuro compartilham os papéis de superfície e a escala de elevação
   de `styles/design.css`. Claro usa fundo cinza e conteúdo branco; escuro usa
   carvão e superfícies mais claras. Ajuste tokens Kumo compartilhados, nunca
   branco/preto, bordas ou sombras isolados por página. Preserve ring nativo,
   foco e contraste de texto/controles; sombra não pode ser a única separação.
   Ao mudar tema ou elevação, atualize a referência visual e confira LayerCard,
   Dialog, Popover e campos em ambos os modos.
4. Faça mudanças nos componentes compartilhados quando houver repetição real
   e confira seus consumidores. Produto e demo usam as mesmas telas e editores;
   adaptadores `demo-*` cuidam de fixtures, navegação e estado em memória.
   Regras de negócio compartilhadas ficam no domínio, nunca em uma segunda
   implementação exclusiva da demo. Ao mudar um fluxo, teste os dois adaptadores
   pelo mesmo contrato, preservando a persistência privada do produto.
   Preserve contratos, credenciais, rascunhos,
   identidade, precisão financeira, progresso e limites de autorização. Títulos
   de seção ficam fora das superfícies (`AnalysisSection`); identidades usam
   contorno somente nos arcos externos, sem linhas nas interseções, nos dois temas.
   Hover/seleção reforçam o contorno; foco usa o token de foco. Não elevar avatar
   nem mudar a sobreposição. Pessoa filtra titular, banco reúne contas por ID de
   instituição e bandeira reúne cartões entre bancos. Preserve período/grupo,
   remova cursor/conta específica e ofereça filtros removíveis. Aplique o recorte
   antes de agregar/paginar, com paridade na demo. Links ficam fora de triggers
   de expansão; opções de Select/Combobox usam avatares estáticos. Navegação
   usa grupos nativos. Avatares ficam fora do Toolbar, com gap de 12 px entre
   identidade e ações. Preserve padding de 16 px nas linhas móveis de parcelas;
   status/pagamento usam linhas completas em containers muito estreitos. Posições
   de investimentos usam LayerCards irmãos com gap de 16 px e título externo,
   sem cards aninhados. Trigger e expansão compartilham os mesmos insets.
   Controles mensais compartilham a janela acessível; a marca móvel volta à visão
   geral e a atualização vem da importação concluída, nunca da renderização.
   Parcelas mostram toda a compra recebida na mesma tabela, inclusive fora do
   mês. Pagamento depende da fatura vinculada, com marcação manual distinta;
   confirmado não significa pago. FAQs usam Kumo e mantêm fallback funcional. POC
   continua isolada até instrução explícita para alterar o produto; documentação
   de uma proposta não comprova sua implementação.
5. Trate fluidez como critério de aceitação. Meça recursos e interação local antes
   de otimizar. Preserve o shell; carregue código por rota/intenção e gráficos
   perto da área visível com altura reservada. Landing mantém HTML funcional e
   ilhas independentes. Não antecipe consultas financeiras nem use animação para
   esconder latência. Tooltips de gráficos usam tokens opacos. Estado do relógio
   vem da origem; não invente progresso/sucesso, nem mantenha polling ocioso.
   Importação de regras deve funcionar no produto e na demo, com prévia,
   categorias resolvidas, revisão, idempotência e histórico preservado.
6. Valide cada superfície alterada no navegador, em tamanho normal e estreito,
   nos dois temas, com teclado e estados relevantes. Entregue uma matriz por
   página/estado: revisado, alterado, sem mudança necessária ou não validado,
   com justificativa e evidência. Registre limites e checks executados; não
   declare revisão global com páginas omitidas ou apenas build aprovado.

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
