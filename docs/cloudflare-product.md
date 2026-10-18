# Caderninho instalável: D1, Workflows e MCP Tasks

O produto executa em `src/worker`, com domínio compartilhado em `src/domain`.
A configuração de produção é `wrangler.jsonc` na raiz. O painel fica em `src/web`;
a raiz inteira é necessária para instalar ou desenvolver o produto.

## Instalação na própria conta

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/DanielSuhett/caderninho)

O botão usa a raiz inteira do repositório: `src/worker` depende de `src/domain` e não
é um template isolado para um botão apontando à subpasta. Escolha a branch que
contém a versão desejada antes de instalar; mudanças locais não alteram o código
usado pelo botão.

1. Clique no botão **Deploy to Cloudflare** acima. O formulário da própria Cloudflare permite configurar o projeto, os recursos e as secrets. A Cloudflare copia o repositório público para sua conta GitHub/GitLab.
2. Confirme o nome do Worker e configure `OWNER_ID`, `PUBLIC_ORIGIN`, `ADMIN_KEY_SHA256`, `CREDENTIAL_KEY` e `WEBHOOK_SECRET` com seus valores. Os dois primeiros também são coletados como secrets para dispensar edição de arquivos. `PUBLIC_ORIGIN` deve ser a URL HTTPS da instalação. Guarde sua chave administrativa separadamente: ela não é o hash nem um token MCP. Os formatos e comandos estão no [README](../README.md#instale-na-sua-cloudflare).
3. Mantenha a raiz do projeto, o build `npm run build` e o deploy `npm run deploy`. O botão prevê provisionar D1/KV; o deploy declara `FINANCE`/`FinanceWorkflow` e aplica as migrações pelo binding `DB`. O comando de migração não cria D1 por conta própria: no terminal, provisione/vincule o banco antes. A combinação do botão, migrações e Workflow ainda precisa ser validada em uma conta Cloudflare nova. O build inclui somente assets e dry-run, sem publicar.
4. Após o deploy, abra `/account` e entre com a chave administrativa que você guardou. As cinco missões verificam sua instalação, validam suas próprias credenciais Pluggy e conectam Meu Pluggy pelo widget oficial. **Não configure secrets Pluggy globais nem cadastre Items diretamente por SQL.** `/account/setup` preserva links antigos. `WEBHOOK_SECRET` fica preparado para webhooks opcionais; a agenda funciona sem cadastrá-los na Pluggy.
5. Acompanhe a primeira importação e conecte `/mcp` em um cliente com OAuth, escopo `finance` e, quando necessário, `offline_access`. Confira cobertura antes de usar totais. Sync diário e reconciliação semanal respeitam a atualização da origem.

### Pendências antes de recomendar instalações de terceiros

O código-fonte público não confirma que o provisionamento está pronto para contas novas.
Antes de recomendar instalações de terceiros, conclua estes itens da auditoria:

1. Isolar recursos por instalação. `wrangler.jsonc` ainda fixa D1 como `caderninho` e
   Workflow como `caderninho-finance`; mudar só o Worker não garante isolamento.
   Preserve os identificadores e recursos de instalações existentes.
2. Validar o primeiro deploy real pelo botão: provisionamento de D1, aplicação de migrações,
   criação do Workflow, entrada no painel e autorização MCP numa conta nova.

URLs de preview permanecem desabilitadas por `preview_urls: false`, como informado no
README. Habilitar previews requer configuração e validação próprias.

As limitações do botão estão na [documentação Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/#limitations).
A configuração de [Workflows](https://developers.cloudflare.com/workers/wrangler/configuration/#workflows)
deve ser conferida antes de definir nomes por instalação. Esses itens não autorizam
publicação, deploy, migração real ou alteração de recursos existentes.

### Atualizações e instalações existentes

Não gere nova identidade ou chave de cofre para atualizar. Preserve `OWNER_ID` ou
`OWNER_GITHUB_ID`, `CREDENTIAL_KEY` e o domínio já configurado. As variáveis existentes
no painel são preservadas por `keep_vars`; instalações novas coletam os valores pelo
formulário de secrets. GitHub permanece opcional com `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET` e callback `/callback`.

Os valores obrigatórios e a recuperação da chave administrativa estão no
[README](../README.md#instale-na-sua-cloudflare). Não troque a identidade ou a chave
do cofre para recuperar somente o login.

Fontes: [Deploy to Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/),
[provisionamento Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning)
e [migrações D1](https://developers.cloudflare.com/workers/wrangler/commands/d1/#d1-migrations-apply).

A landing é estática e abre o botão Cloudflare diretamente. O painel privado fica em `/account`.
As páginas usam Kumo, com recursos servidos pela própria instalação. O checklist
verifica configuração e estrutura D1; não comprova OAuth, banco ou cliente MCP reais.
A aplicação não cobra assinatura, mas os limites/custos das contas Cloudflare e
Pluggy continuam aplicáveis. Cada proprietário controla a instalação; o criador
não recebe acesso administrativo padrão. Isso não equivale a E2EE contra os
provedores que processam os dados.

### Recuperar e atualizar

Em `/account`, pause ou retome a agenda e solicite captura manual. Falhas preservam
os dados já confirmados; consulte cobertura antes de usar valores. Para renovar
Client Secret, volte à etapa 2 e use a mesma aplicação. Uma aplicação diferente
exige migração explícita; não reaproveitar seus Items silenciosamente.

Para trocar a chave do cofre sem perder acesso: guarde backup e a chave antiga,
configure a antiga como `CREDENTIAL_PREVIOUS_KEY`, configure a nova chave aleatória
como `CREDENTIAL_KEY` e use **Proteger credenciais com a chave atual** em `/account`.
Após sucesso, remova a chave anterior do Worker. Guarde-a junto dos backups antigos;
eles continuam dependendo dela. Não digite essas chaves no portal ou no assistente.

Antes de atualizar, exporte D1 para armazenamento privado e guarde separadamente
secrets e configuração. O SQL exportado contém dados financeiros em claro; não o
adicione ao Git. Restaure primeiro em um banco novo e isolado, com cron e acessos
externos desativados. Backup D1 não inclui secrets, grants KV ou estado nativo dos
Workflows: restabeleça configuração, invalide sessões restauradas e refaça OAuth.
Nunca substitua o banco ativo antes de conferir cobertura e operações pendentes.
O teste `test:product:runtime` verifica exportação/restauração de D1 sintético local;
recuperação completa de infraestrutura real continua uma validação separada.

O OAuth usa `@cloudflare/workers-oauth-provider` mantido pela Cloudflare, com
registro de cliente, consentimento, PKCE, sessão do dono e principal verificado
pela identidade configurada da instalação. Headers de identidade fornecidos pelo cliente
não autenticam a entrada pública.
A identidade é por request. Revogar `items.enabled` impede novas leituras da Task,
resultado, cancelamento, stream e dados; a execução revalida a autorização em
fronteiras de publicação. O banco é privado por instalação e cada tabela financeira
é isolada por principal/Item. Os testes com headers sintéticos estão **somente**
em `tests/integration/runtime.ts`, nunca no entrypoint de produção.

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
- `caderninho_reconcile` refaz o escopo dos Items indicados e resolve ausências
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

```sh
# Local, sem acesso à rede ou ativação:
node scripts/import-rules.ts --file /private/rules.json --catalog /private/catalog.json
# Converter v1 para um novo arquivo privado, sem sobrescrever ou ativar:
node scripts/import-rules.ts --file /private/rules-v1.json --output /private/rules-v2.json
# Somente após relatório e ativação solicitada; token em CADERNINHO_TOKEN:
node scripts/import-rules.ts --file /private/rules.json --catalog /private/catalog.json --endpoint https://finance.example.com --activate
```

`/mcp/rules/import` é autenticado, aceita dry-run/save/activate, limita 1 MiB e usa a
mesma validação de domínio. Arquivos locais são lidos somente pelo script; o Worker
recebe o documento enviado explicitamente ao endpoint autenticado.

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
terminal; `tasks/update` valida/autoriza e ignora respostas desconhecidas pois estas
operações não pedem entrada intermediária. `tasks/cancel` sinaliza parada entre lotes,
sem rollback fictício. Falha de execução financeira produz resultado terminal de
tool com isError, separado de erro JSON-RPC de protocolo/autorização.

`subscriptions/listen` usa POST SSE com filtro notifications.taskIds, ack inicial
e notifications/tasks com estado completo e meta subscriptionId. O ID é da request;
Last-Event-ID não é usado. Até dez Tasks por escuta, cinco minutos por conexão,
backpressure com fila limitada. Desconexão libera fontes/timers e não cancela a
operação. Reconexão cria nova assinatura e recupera estado corrente.

**D1 é a fonte padrão de progresso**, conforme decisão do usuário. Cada subscriber
consulta estados autorizados a cada cinco segundos (inclui consultas de autorização
por Task); isso tem custo de leituras, não de reprocessamento financeiro.
`TASK_EVENT_SOURCE=workflow` habilita WorkflowInstance.subscribe como sinal interno;
D1 continua sendo a autoridade do estado e um polling de segurança cobre ausência/falha do stream nativo. A abertura nativa tem timeout de dois segundos; falha mantém D1. O cursor eventId dessa API não é MCP.
Não há broker/DO adicional. A execução financeira não depende de Promise solta/waitUntil. O lifecycle da escuta usa waitUntil exclusivamente para manter a resposta SSE e liberar recursos.

O teste wire em workerd verifica D1 e a opção nativa, dois subscribers, desconexão,
reconexão terminal e isolamento. Isso **não prova suporte nativo no ChatGPT**.
Clientes sem negociação recebem erro de capability, nunca CreateTaskResult indevido;
consultas pequenas/status continuam disponíveis. A implementação não oferece um
segundo executor para contornar essa limitação do cliente.

## Falhas, upgrade e retenção

A operação D1 e a criação do Workflow não formam uma transação. A operação canônica
é o outbox e tem identidade idempotente; cron recupera dispatched=0. Resposta de
create perdida é resolvida consultando a instância pelo mesmo ID. Cron também
finaliza operações cujo Workflow terminou com erro, liberando a fila por principal.
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

## Migração do R2 e corte

Exporte **todos** os manifests snapshots e objetos collections úteis, mantendo
os caminhos das chaves R2 dentro de um diretório privado. Uma cópia do último
snapshot não substitui o inventário. O script não acessa nem remove o bucket.

```sh
node scripts/migrate-r2.ts --directory /private/export --item ITEM_ID
# Após revisar overlaps, --overlap newest escolhe readAt mais recente;
# empate divergente exige resolução manual em uma cópia do export.
node scripts/migrate-r2.ts --directory /private/export --item ITEM_ID --overlap newest --endpoint https://finance.example.com
# Apply é separado do dry-run e sempre explícito:
node scripts/migrate-r2.ts --directory /private/export --item ITEM_ID --overlap newest --endpoint https://finance.example.com --apply --policy keep-current
```

Cada lote de até vinte registros torna-se uma operação durável idempotente. Consulte
as operações retornadas via MCP, confirme conclusão e compare contagens/totais por
moeda, conta, período e recurso antes do corte. Policies refuse-conflicts (padrão),
keep-current e prefer-bundle são explícitas; conflitos são rechecados sob lock.
Overlaps não viram novas cópias. Formato legado v1 não reconhecido é recusado; o
conversor cobre snapshots multi-recurso schema v2 deste repositório.

R2 armazenava projeções: a importação marca `legacy-projection-v1`, preserva registro
e chave de origem e **não inventa payload original que não foi salvo**. Não marca
bootstrap integral. Uma coleta posterior substitui a projeção pela origem quando
esse ID ainda existe. Histórico legado ausente na API permanece preservado.

Depois de comparação e aprovação do corte: pare imports da instalação anterior, faça
backup D1 e aponte o cliente para um único MCP. Rollback é voltar o endpoint ao
legado preservado, reconhecendo sua data de corte; mantenha as novas correções D1
para reentrada posterior. Não sincronize duas bases em paralelo como estado oficial.
Remoção de R2 é uma operação separada, posterior ao corte e à aprovação explícita.

## Limites de operação

O Worker usa bindings D1/KV/Workflows e `cloudflare:workers`. Execução Node/SQLite
genérica ou em outro runtime exige validação específica. Checks locais não comprovam
primeiro deploy pelo botão, login GitHub, eventos reais Pluggy ou suporte de Tasks
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
[CONTRIBUTING.md](../CONTRIBUTING.md) para os checks e
[a documentação do patch Pluggy](../patches/README.md) antes de atualizar o SDK.
