# Referência técnica do Caderninho

Uma instalação pessoal usa um Worker, D1, KV, Workflows e assets. O painel React/Kumo
fica em `/account`; o MCP remoto usa OAuth em `/mcp`.

A [instalação](../README.md#começar) e o [guia de uso](usage.md) concentram as instruções
para o proprietário. A versão pessoal inicia com banco novo e aplica o histórico
de migrações do projeto. Não converte bancos da arquitetura anterior.

## Configuração e acesso

`ADMIN_PASSWORD`, `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` são secrets do Worker.
O formulário não coleta UUID, hash administrativo ou chave de cofre. A aplicação
não armazena credenciais Pluggy no D1. A origem vem do URL da requisição entregue
pela Cloudflare, com HTTPS em produção; headers de identidade não autenticam.

O painel usa sessão de oito horas, CSRF, cookies HttpOnly/Secure/SameSite e limite
atômico de dez tentativas de login por minuto. A sessão guarda o ID da versão do
Worker; um novo deploy invalida as sessões anteriores. O OAuth oficial mantém seus
grants em KV, com subject interno `owner`. A ação de desconectar assistentes revoga
todos esses grants e exige novo consentimento para conexões futuras.

D1 mantém a revisão financeira, as regras ativas e a agenda da instalação. Todos
os Items, recursos, contas e operações pertencem ao dono da ferramenta, sem
listas de permissões ou vínculos de Client ID. A migração `0002_owner_data.sql`
remove os campos antigos de permissões sem alterar o histórico financeiro.

O botão provisiona D1/KV; o deploy aplica migrações por `DB` e declara o Workflow.
A instalação completa em conta nova, incluindo provisionamento, precisa de validação
real separada. Previews ficam desabilitados. Fontes: [botão Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
e [secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
`WEBHOOK_SECRET` é opcional e só deve ser configurado ao habilitar webhooks; sem ele,
o endpoint recusa recebimentos. A agenda funciona sem webhooks.

## Primeira carga e manutenção

`caderninho_sync` recebe `itemIds` e `requestKey` estável para tentativas da mesma
intenção. A primeira operação percorre recursos e pais em ordem, com paginação
integral por conta/recurso. `coverage` diferencia disponível, vazio, parcial,
unsupported, not_enabled, not_authorized e unavailable. Página, resultados,
checkpoints e progresso são confirmados juntos. A operação guarda regras e dia
`America/Sao_Paulo` no início. Uma página incompleta não confirma bootstrap nem
avança o marco de criações. Um recurso com erro não vira cobertura integral.

Após bootstrap de transações:

- `createdAtFrom` inclusivo por conta descobre criações, incluindo retrodatadas;
  cursor e filtro permanecem fixos até o fim. Hash relevante evita normalização
  e regras quando um ID reaparece inalterado. `createdAt` não é uma captura de updates.
- Webhooks são sinais para reler o estado corrente dos IDs, inclusive deletes.
  Um delete atrasado não apaga um ID ainda presente. A inbox confirma persistência
  antes do ACK; cron recupera despachos perdidos. EventId deduplica, não prova sequência.
- Pendências são selecionadas pelo índice e processadas em lotes por conta.
  Futuros amadurecem pelo índice de data, sem rodar regras novamente. O dia financeiro
  vem do calendário `date` da Pluggy; `timestampLocalDate` é um campo distinto.
- Contas, faturas, investimentos, empréstimos e metadados são releituras de conjuntos
  por Item/pai, com comparação de conteúdo e marcação de ausências após completar o conjunto. Movimentos de investimento têm apenas
  paginação documentada: após bootstrap, são relidos quando o conteúdo do pai muda
  ou em reconciliação explícita. Alterações sem mudança observável no pai não são
  detectáveis por essa estratégia; **exigem reconciliação**. Não existe CDC universal.
- `caderninho_reconcile` refaz os dados dos Items indicados e resolve ausências
  somente depois de concluir o conjunto. Não usa `updatedAtFrom`. Reconciliação
  não remove registros legados cuja única origem seja projeção R2, pois o provedor
  pode já não devolver aquele histórico.

Webhooks têm retries limitados e podem se perder. Falhas/backlog aparecem em status;
a ausência de backlog não comprova ausência de lacunas. O onboarding deve comunicar
isso. O produto nunca faz PATCH de Item nem escrita financeira. MeuPluggy mantém o
Item proxy, seguindo a origem, sem atualização manual.

## Consultas, filtros e dinheiro

`query`, `aggregate` e `get_subscriptions` leem D1; não importam por cache miss.
Não exigem snapshotId ou capabilities. Cobertura ausente aponta para sync; cobertura
parcial ou lacuna conhecida aponta para recuperação/reconciliação.

Filtros são a mesma árvore Zod usada por query, aggregate, preview e reapply:
`and`, `or`, predicados `field/op/value` e tags `tag/value`. Campos incluem date,
account, currency, direction, status, eligible, ignored, original/effective category
ou description, effective.group e amountMinor. SQL parametrizado seleciona todo o
universo. Não existe filtro salvo nomeado nesta interface. Limites de complexidade
rejeitam entradas excessivas em vez de truncar resultados.

```json
{"name":"caderninho_aggregate","arguments":{"metric":"amount","filter":{"and":[{"field":"date","op":"gte","value":"2026-09-01"},{"field":"date","op":"lte","value":"2026-09-30"},{"field":"currency","op":"eq","value":"BRL"},{"field":"direction","op":"eq","value":"DEBIT"}]}}}
```

Métricas disponíveis: `amount`
(magnitude bruta), `cashFlow` (BANK), `consumption_v1` e `unclassifiedDebits` para
transações, e medidas específicas dos outros recursos. Fluxos exigem POSTED e
elegibilidade; métricas excluem ignore. Sem metric, aggregate retorna soma assinada
da medida principal original, **não gasto**. Resultado vazio/medida ausente não é
zero observado; consulte coverage, count, known e partial. Saldos retornados por query
incluem observed_at/source_updated_at. `live_balance` lê a conta pontualmente e
informa readAt; não declara atualização bancária em tempo real.

Dinheiro fica em TEXT canônico (até 30 dígitos em minor units), jamais REAL.
Agregação SQL soma blocos assinados de três dígitos, faz CAST TEXT antes do binding
e recompõe em BigInt. Os testes fazem ida e volta e agregação de valores superiores
a int64/Number seguro. Moedas não são somadas entre si. A revisão D1 aumenta junto
com publicação/override: resposta verifica revisão antes/depois e o cursor exige
mesma revisão. RESTART_REQUIRED significa reiniciar paginação, não mesclar versões.

## Regras e correções

Uma revisão contém catálogo de grupos/categorias/aliases e regras, com normalizador
fixado. Edição, exclusão, desativação e ordenação são alterações do documento completo
salvo em nova revisão imutável; ativação é explícita. Isso evita CRUD ambíguo de uma
regra pertencente a operações em andamento. Prioridade crescente e ordem original
resolvem empates. Primeiro set_category vence; enrich enxerga resultado acumulado;
primeiro set_description e tag por chave vencem; ignore é cumulativo. Templates
aceitam campos tx permitidos. RE2JS evita regex com backtracking arbitrário.

O documento ativo usa `version: 2`, com `groups`, `categories` e `rules`.
Cada regra conserva `id`, `name`, `priority` e `is_active`. `conditions` contém
`all`/`any`/`not`; predicados usam fatos explícitos, operadores registrados e
literais. A fase fica em `event.type` (`classify` ou `enrich`) e as ações em
`event.params.actions`. Exemplo:

```json
{
  "id": "example", "name": "Exemplo", "priority": 1, "is_active": true,
  "conditions": { "all": [{ "fact": "tx.description", "operator": "regex", "value": "^cafe$" }] },
  "event": { "type": "enrich", "params": { "actions": [{ "op": "set_tag", "key": "tipo", "value": "cafe" }] } }
}
```

`json-rules-engine` avalia condições e eventos. Cada avaliação cria motores
isolados para classify/enrich, com prioridades internas únicas em ordem inversa à
prioridade pública crescente. Condições também recebem prioridades internas únicas
para preservar o curto-circuito da esquerda para a direita. `all: []` é a condição
sempre verdadeira; a falsa usa `not: { all: [] }`, e `any` vazio é rejeitado. Classify para no primeiro vencedor; enrich recebe os
fatos derivados atualizados, sem cache entre regras. O domínio mantém catálogo,
aliases, templates, ações e evidências. Não há interpretador JSONLogic no runtime.
Fatos não consultam banco/rede; `path`, parâmetros de fatos e nomes arbitrários
são rejeitados. O schema limita regras, ações, tamanho, profundidade, operadores,
prioridades seguras e referências.

Operadores: `equal`, `notEqual`, `contains` (o literal contém o fato), `regex`,
`decimalCompare`, `decimalBetween` e `dateCompare`. Comparações exatas recebem
`{ "op": "eq|ne|gt|gte|lt|lte", "value": "literal" }`; intervalo decimal recebe
`["mínimo", "máximo"]`. Regex usa RE2JS, remove acentos por NFD/Mn e rejeita
lookaround/backreferences. Decimais e datas são strings exatas.

A importação converte explicitamente v1→v2 ou Securo→v2. O padrão é dry-run.
`var` em predicados exatos, and/or, !/!! de condições booleanas, igualdade estrita,
`in` com literal e `if` com ramos booleanos e fallback explícito têm conversão.
Expressões incompatíveis (como valores calculados, missing/missing_some ou
fallbacks de var) retornam caminho e motivo, sem documento parcialmente convertido.
Nenhuma revisão antiga ou operação é reescrita. Revisões v1 continuam legíveis pela
ferramenta; avaliação/ativação de v1 é recusada até conversão e ativação explícitas.
Ao atualizar uma instalação que ainda usa v1, converta as regras ativas e conclua
as operações vinculadas ao formato antigo antes da troca de runtime.

`lossless-json` substitui o parsing financeiro próprio e preserva lexemas numéricos;
na importação, literais `value` são texto exato e prioridades/versões continuam
números inteiros seguros. O leitor limitado do SDK atende MCP e importações.

`/mcp/rules/import` é autenticado, aceita dry-run/save/activate, limita 1 MiB e usa a
mesma validação de domínio. O Worker recebe o documento enviado explicitamente ao
endpoint autenticado.

Preview recebe os mesmos itemIds e filtro da reaplicação e mostra quantidade selecionada exata e amostra de diferenças derivadas,
não a quantidade total de registros que mudariam. Reapply materializa a seleção,
preserva a revisão e não muda overrides. A classificação tem evidência das ações
aplicadas, não um log de todas as regras não correspondentes. Origem, derivados,
overrides por campo e tags por origem ficam separados. Value=null remove override;
ignore não remove a transação; transferência não cria cópia física.

## Tasks e subscribers

O SDK MCP atende o protocolo comum. Um adaptador pequeno valida a extensão
`io.modelcontextprotocol/tasks` pela JSON Schema oficial de 2026-07-28 incluída com
licença, e subscriptions pelos schemas oficiais do SDK. `server/discover` anuncia
a extensão. Não são usados métodos experimentais tasks/result ou tasks/list.

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"caderninho_sync","arguments":{"requestKey":"synthetic-first-sync","itemIds":["11111111-1111-4111-8111-111111111111"]},"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{"extensions":{"io.modelcontextprotocol/tasks":{}}}}}}
```

Envie Content-Type JSON, Accept JSON/SSE, Mcp-Protocol-Version 2026-07-28,
Mcp-Method e Mcp-Name correspondentes. CreateTaskResult tem resultType=task e campos
Task no próprio resultado. A operação já é consultável no D1 ao devolver o handle,
mesmo que o despacho precise de recuperação. `tasks/get` inclui estado/resultado
terminal; `tasks/update` valida a Task e ignora respostas desconhecidas pois estas
operações não pedem entrada intermediária. `tasks/cancel` sinaliza parada entre lotes,
sem rollback fictício. Falha de execução financeira produz resultado terminal de
tool com isError, separado de erro JSON-RPC de protocolo/autorização.

`subscriptions/listen` usa POST SSE com filtro notifications.taskIds, ack inicial
e notifications/tasks com estado completo e meta subscriptionId. O ID é da request;
Last-Event-ID não é usado. Até dez Tasks por escuta, cinco minutos por conexão,
backpressure com fila limitada. Desconexão libera fontes/timers e não cancela a
operação. Reconexão cria nova assinatura e recupera estado corrente.

D1 é a única fonte de progresso. Cada subscriber consulta o estado a cada cinco
segundos; o timer do SSE não executa trabalho financeiro. O teste wire em workerd
verifica dois subscribers, desconexão e reconexão terminal. Isso não comprova suporte
nativo no ChatGPT ou Claude.
Clientes sem negociação recebem erro de capability, nunca CreateTaskResult indevido;
consultas pequenas/status continuam disponíveis. A implementação não oferece um
segundo executor para contornar essa limitação do cliente.

## Falhas, upgrade e retenção

A operação D1 e a criação do Workflow não formam uma transação. A operação canônica
é o outbox e tem identidade idempotente; cron recupera dispatched=0. Resposta de
create perdida é resolvida consultando a instância pelo mesmo ID. Cron também
finaliza operações cujo Workflow terminou com erro, liberando a fila da instalação.
Lock persistente serializa sync, eventos, migração e reapply; não expira enquanto
um executor possa publicar. Não existe transação SQL atravessando HTTP.

429 respeita Retry-After por sleep durável entre steps; outros erros chegam ao
retry exponencial de Workflow. Erros de paginação deixam coverage parcial e mantêm
a base já publicada. Retomar a mesma execução usa checkpoints; uma nova intenção
usa nova requestKey. Uma Task terminal não é reiniciada reutilizando sua chave.

Schema migrations são incrementais e separadas de backfill. Não edite uma migration
já aplicada em uma instalação; acrescente `0002_...`, valide banco vazio e upgrade,
faça backup/time-travel e aplique antes do código que exige o schema. Mudança de
normalizador exige nova versão e reconciliação explícita com `renormalize: true`, nunca invalidação global
silenciosa. Mantenha o avaliador compatível com revisões referenciadas.

Retenção financeira e de regras/proveniência é indefinida nesta versão. Tasks e
chaves idempotentes permanecem consultáveis (ttlMs=null). A cada cron, compaction
remove no máximo 200 checkpoints de páginas e 200 alvos de operações terminais com
mais de 30 dias, limpa até 200 checkpoints por recurso, compacta os payloads de migração de até 200 operações (preservando hash idempotente) e limpa payload de até 200 eventos processados antigos; preserva
IDs de deduplicação. Não apaga entidades financeiras ou revisões de regras.


Depois de comparação e aprovação do corte: pare imports da instalação anterior, faça
backup D1 e aponte o cliente para um único MCP. Rollback é voltar o endpoint ao
legado preservado, reconhecendo sua data de corte; mantenha as novas correções D1
para reentrada posterior. Não sincronize duas bases em paralelo como estado oficial.
Remoção de R2 é uma operação separada, posterior ao corte e à aprovação explícita.

## Limites de operação

O Worker usa bindings D1/KV/Workflows e `cloudflare:workers`. Execução Node/SQLite
genérica ou em outro runtime exige validação específica. Checks locais não comprovam
primeiro deploy pelo botão, login com senha, eventos reais Pluggy ou suporte de Tasks
em clientes MCP externos.

Desconectar um subscriber não equivale a reiniciar o executor. Encerrar o Wrangler
encerra também o serviço Workflows emulado; continuidade após reinício completo
precisa de validação própria. A recuperação da outbox não reinicia automaticamente
uma instância marcada como `running`.

Os contratos de referência são [Tasks](https://modelcontextprotocol.github.io/ext-tasks/specification/2026-07-28/tasks.html),
[subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
e [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http).

## Desenvolvimento

As dependências e versões ficam em `package.json` e `package-lock.json`.
Hono cuida do transporte; React renderiza as páginas e escapa o conteúdo dinâmico.
Drizzle define o modelo D1 em `src/worker/schema.ts`; statements e checkpoints
compartilham batches nativos. As migrações SQL ficam em `migrations`.

Consulte [a arquitetura](adr-modular-monolith.md) para as fronteiras entre módulos,
[CONTRIBUTING.md](../CONTRIBUTING.md) para os checks. O adapter de transporte preserva os métodos do SDK Pluggy com Fetch, parsing exato, deadlines, limites de bytes e recusa de redirects; não modifica node_modules.
