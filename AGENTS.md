# Orientações para agentes

## Como escrever código

- Prefira TypeScript ESM estrito, tipos inferidos de schemas Zod (`z.infer`) e
  tabelas/projeções Drizzle. Sem `any`, casts para convencer o compilador,
  non-null assertions ou supressões; `as const` é permitido.
- Valide entradas externas com Zod na fronteira. Confie nos contratos internos e
  nas escritas controladas; não repita parses, `typeof` ou guardas estruturais em
  cada consumidor. Preserve invariantes de identidade, autorização e finanças.
- Use entradas nomeadas, campos conhecidos e early returns. Toda cláusula tem
  chaves. Evite ternários aninhados, regras de negócio e extração dinâmica inline.
  Trate ausências reais; omita opcionais ausentes em vez de passar `undefined`.
- Mantenha funções relacionadas próximas. Extraia para isolar I/O, políticas ou
  repetição relevante; não crie um helper por booleano, camadas genéricas ou DI
  container. Remova código substituído e abstrações sem uso.
- Recupere falhas assíncronas com `tryCatch` e seu `Result` discriminado;
  normalize valores capturados para `Error`. Catches síncronos de parse são válidos.

## Limites do projeto

- Preserve um pacote npm e um deploy: `src/domain`, `contracts`, `worker`, `web`
  e `shared`. Controllers tratam transporte; services recebem dependências
  explícitas, sem SQL/HTTP/Bindings; repositories concentram SQL. `composition.ts`
  liga implementações. Use aliases `#` do `package.json` com extensões explícitas.
- D1 é a fonte das consultas e do progresso. Preserve precisão monetária, moedas,
  semântica do provedor, nomes dos steps e batches atômicos com checkpoints.
  Dados sintéticos nos testes; secrets e dados financeiros privados fora do Git.
- Preserve contratos públicos. Deploy, merge, migração real e remoção de dados
  remotos exigem instrução explícita separada.

## Processo de desenvolvimento

1. Confira `git status` e o diff; preserve alterações existentes. Consulte a
   documentação da área antes de mudar contratos ou arquitetura.
2. Use mise com Node 24: `mise install` e `mise run setup` no primeiro preparo;
   repita setup ao mudar o lockfile. `package.json` define comandos e dependências.
   Consulte `mise tasks ls`; para comandos avulsos, use `mise exec -- <comando>`.
3. Faça mudanças pequenas e verificáveis. Durante a edição, execute
   `mise run check:quick`; mantenha testes de comportamento relevantes.
4. Use `mise run lint:fix` e `mise run format`; revise o diff e garanta convergência.
   Biome cuida de lint, layout e imports. Prefira regras nativas, documente lacunas
   e corrija a causa dos diagnósticos; não desative regras nem use `--unsafe` global.
5. Antes de entregar código, execute `mise run check`. Informe o que passou e
   qualquer pendência. Testes locais e build dry-run não comprovam deploy ou OAuth
   real. Mudanças só de documentação dispensam repetir a suíte.

Comunique resultado, progresso e próxima ação de forma breve e concreta.
