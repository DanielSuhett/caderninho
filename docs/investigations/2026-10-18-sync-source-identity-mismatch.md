# Sincronização interrompida em consentimentos MeuPluggy

> Registro histórico do modelo anterior. Para a arquitetura atual, consulte [a spec](../spec-refatoracao.md).

Data: 18/10/2026. Investigação feita pelos MCPs Cloudflare, com leitura do código
local. Horários locais usam `America/Sao_Paulo` (UTC−3).

## Estado após a contenção inicial

Às **17:38:16** (20:38:16 UTC), a sincronização da instalação foi pausada no D1,
usando a mesma alteração feita pelo botão Pausar: `settings.sync_enabled=0`.
A atualização condicional alterou uma linha.

A releitura às **17:38:35** (20:38:35 UTC) confirmou:

| Verificação | Resultado |
| --- | --- |
| Sincronização habilitada | `0` |
| Operações `working` no D1 | `0` |
| Operações ativas sem despacho | `0` |
| Locks financeiros | `0` |
| Instâncias Workflow | Uma instância, terminal em `errored` |

A execução defeituosa já tinha encerrado às 17:13:53. Não havia executor vivo
para terminar. Sua instância e os checkpoints foram preservados como evidência.
Não houve exclusão de dados, mudança de código em produção, migração, novo ciclo,
reinício da instância ou alteração dos secrets.

O cron permanece configurado para `0 9 * * *`. A seleção de novos ciclos exige
`sync_enabled=1`; portanto, a agenda pausada não admite novas importações.
O cron ainda pode executar manutenção e recuperação de outbox. No momento da
verificação, não existia trabalho ativo ou pendente para recuperar.

## Recursos e método

| Recurso | Identificação |
| --- | --- |
| Worker publicado | `cloudflare-finance-mcp` |
| Nome padrão no `wrangler.jsonc` local | `caderninho` |
| Workflow / classe | `caderninho-finance` / `FinanceWorkflow` |
| D1 / binding | `caderninho` / `DB` |
| Operação e instância investigadas | `7eeac186-a0a2-40ee-835e-ac8dda5d5e61` |

A identificação usou `whoami`, descoberta de endpoints no OpenAPI por `search`
e consultas por `execute`. O binding remoto `DB` foi conferido antes de consultar
ou alterar o banco; o nome do Worker em produção difere do padrão local.

Foram consultados os scripts, bindings, deployments, cron, lista de Workflows,
lista de instâncias, detalhes dos steps, schema e metadados operacionais do D1.
As leituras não coletaram transações, saldos, credenciais ou payloads financeiros.
IDs de Items e dados pessoais foram omitidos deste registro.

Os bindings `DB`, `FINANCE`, `OAUTH_KV`, `ASSETS` e `CF_VERSION_METADATA` estavam
presentes. Os nomes dos secrets `ADMIN_PASSWORD`, `PLUGGY_CLIENT_ID` e
`PLUGGY_CLIENT_SECRET` estavam presentes; seus valores não foram lidos.
As migrações `0001_personal.sql`, `0002_owner_data.sql` e
`0003_daily_cycles.sql` constavam como aplicadas.

O deployment ativo consultado usava a versão Worker
`efdf1f51-0968-41de-97b2-d9b94af20b9f`, publicado às 20:11:37 UTC.
A instância registra a versão Workflow `5eb7cace-4e9e-48bf-9e09-731063d9f51f`.
Esses são identificadores de versões de recursos diferentes. Não foi feita uma
comparação do bundle remoto com o checkout; as referências de código abaixo
explicam o comportamento encontrado no código local.

## Linha do tempo e evidências

| Evento | UTC em 18/10/2026 | São Paulo |
| --- | --- | --- |
| Admissão da operação `reconcile` no D1 | 20:13:12.344 | 17:13:12.344 |
| Início detalhado do Workflow | 20:13:19.892 | 17:13:19.892 |
| Primeira tentativa de consentimentos | 20:13:21.421 | 17:13:21.421 |
| Término do Workflow com erro | 20:13:53.433 | 17:13:53.433 |
| Pausa solicitada pelo proprietário | 20:38:16.170 | 17:38:16.170 |

O Workflow apresentou seis steps. Aquisição do lock, maturação, checkpoint e página
de `connections`, e checkpoint de `consents` terminaram com sucesso. O sexto step,
a primeira página de `consents`, falhou nas três tentativas:

| Tentativa | Início UTC | Fim UTC | Erro |
| --- | --- | --- | --- |
| Inicial | 20:13:21.421 | 20:13:22.000 | `SOURCE_IDENTITY_MISMATCH` |
| Retry 1 | 20:13:32.000 | 20:13:32.489 | `SOURCE_IDENTITY_MISMATCH` |
| Retry 2 | 20:13:52.489 | 20:13:52.738 | `SOURCE_IDENTITY_MISMATCH` |

A configuração era de dois retries, atraso inicial de dez segundos, backoff
exponencial e timeout de cinco minutos. A execução levou aproximadamente
34 segundos; cerca de 30 segundos corresponderam às esperas dos retries.
O erro observado foi de identidade, sem evidência de timeout ou rate limit
nessa execução.

A conexão persistida tinha conector `200` / `MeuPluggy`, `status=UPDATED` e
`executionStatus=SUCCESS`. Isso confirma a leitura bem-sucedida da conexão, mas
não comprova a completude dos recursos financeiros.

| Estado persistido | Resultado |
| --- | --- |
| `connections` | Um registro; coverage `available`; bootstrap completo |
| `consents` | Coverage `partial`; bootstrap incompleto; zero registros coletados |
| Contas e transações | Nenhum registro importado |
| Última importação bem-sucedida | `last_import_at=null` |
| Operação terminal | `status=completed`, `phase=error`, `result.isError=true` |

O progresso guardava `pages=1`, `received=1`, `new=1`, `resources=1` e
`errors=0`. O campo `operations.error` estava `null`, apesar da falha real
registrada pelo Workflow. O lock foi liberado.

## O que está confirmado e o que falta confirmar

O ponto de interrupção confirmado é a validação de identidade da resposta de
consentimentos. Em
[`pluggy/source.ts`](../../src/worker/pluggy/source.ts),
`financialSource.page` chama `client.fetchConsents(item)`, valida a página com
Zod e aplica `assertSourceRecords` aos resultados.

Em
[`provider.entity.ts`](../../src/domain/provider.entity.ts),
`assertSourceRecords` rejeita um `record.itemId` presente que seja diferente de
`context.item`. `null` também é rejeitado. Consentimentos não têm pai de conta
ou investimento na definição local; essa é a comparação relevante para esse
recurso. O SDK instalado, `pluggy-sdk@0.92.0`, envia `itemId` como filtro de
`fetchConsents`.

Em
[`sync/execution.service.ts`](../../src/worker/sync/execution.service.ts),
`resourceOrder` lê `connections`, depois `consents`, antes de contas e
transações. A exceção de identidade interrompe a sequência. Isso explica o banco
com apenas uma conexão mesmo quando a conexão do provedor aparece como atualizada.

**Hipótese ainda não comprovada:** o consentimento devolvido ao consultar o Item
proxy MeuPluggy pode referenciar o Item original. A documentação diferencia os
dois Items, mas não confirma que essa diferença apareça no `itemId` da resposta
de consentimentos. O payload que falhou não foi capturado. Também não foi
determinado se o campo veio `null` ou com outro identificador.

Para fechar essa hipótese, inspecionar a resposta da consulta de consentimentos
do Item autorizado em ambiente privado e registrar somente o resultado da
comparação: campo ausente, nulo, igual, ou diferente. Se houver vínculo de origem,
comprovar sua semântica com o contrato do provedor antes de adaptar a validação.
Não remover a proteção nem aceitar qualquer `itemId` diferente.

## Por que a recuperação e o diagnóstico ficaram difíceis

1. **Espera de 24 horas preservada após falha.** A admissão reservou o próximo
   ciclo para **19/10/2026 às 17:13:12** (20:13:12 UTC). Isso segue a política
   atual: falhas não devolvem a janela. Sem a pausa, o cron de 19/10 às 06h
   passaria antes da elegibilidade; a próxima oportunidade automática seria
   20/10 às 06h, se nenhuma ação intermediária alterasse a agenda.
2. **Estado terminal exige leitura de múltiplos campos.** O executor encerra a
   falha com `completed` e fase `error`; o resultado tem `isError=true`.
   `completed` isolado não significa sucesso financeiro. Esse contrato já é
   documentado e precisa continuar compatível.
3. **Causa não preservada no D1 e contador zerado.** O caminho fatal chama
   `repository.finish(op, completed, true)` sem gravar a causa. `sourceFailure`
   incrementa `progress.errors` somente quando recebe `countError=true`;
   este caso ficou parcial e fatal, sem incremento. O erro detalhado permaneceu
   apenas na instância Workflow.
4. **Retries repetiram uma validação determinística.** As três tentativas
   falharam com o mesmo erro. A configuração genérica do step repetiu a leitura
   mesmo sem indício de falha transitória.
5. **Telemetria e fixtures não esclareceram o caso real.** As consultas de logs
   por erro do Worker e por `SOURCE_IDENTITY_MISMATCH` na janela da falha
   retornaram vazias. Há amostragem de 10% e `invocation_logs=false`; ausência
   de logs não significa ausência de erro. A fixture genérica do teste
   `every financial resource uses the public SDK operation with one-page
   checkpoints`, em `tests/integration/pluggy.test.ts`, omite `itemId` nos
   consentimentos, passando sem exercitar essa comparação. O teste de domínio
   cobre divergência e `null`, mas não demonstra o contrato real de proxy/origem.

## Melhorias propostas, em ordem

1. **Confirmar o contrato de identidade MeuPluggy.** Obter evidência privada da
   forma da resposta e criar fixtures sintéticas equivalentes. Cobrir Item
   correto, ausente, nulo e divergente, além de proxy/origem somente quando esse
   vínculo estiver comprovado. Corrigir a fronteira mantendo a identidade local
   e rejeitando respostas sem vínculo válido.
2. **Preservar diagnóstico terminal seguro.** Registrar código, recurso, step e
   operação sem payload, URLs com parâmetros, secrets ou IDs financeiros.
   Manter `phase=error` e `result.isError` visíveis e tornar o contador coerente
   com falhas fatais, sem mudar silenciosamente os contratos públicos.
3. **Distinguir falhas transitórias de permanentes.** Considerar
   `NonRetryableError` na fronteira Workflow para identidade inválida e outros
   contratos determinísticos. Preservar checkpoints, liberação do lock e a
   política específica já existente para 429/timeout.
4. **Validar o percurso completo com dados sintéticos.** Exercitar a resposta de
   consentimentos através do adapter, executor e D1, incluindo falha, pausa,
   cooldown e progresso. A revisão do adapter também deve considerar que o SDK
   aceita opções de paginação em `fetchConsents`, mas a chamada atual não as
   passa e `consents` não está no conjunto `paged`. Isso é um risco separado,
   não a causa demonstrada da execução atual.
5. **Retomar somente após validação e autorização.** Não reiniciar a mesma Task
   terminal nem liberar a janela por SQL como correção. Validar o comportamento
   local, obter instrução explícita para deploy e para nova importação real,
   respeitar a janela por Item e conferir coverage, progresso e conclusão no D1
   e no Workflow. A instalação ficou pausada na contenção inicial; a atualização
   abaixo registra o estado observado durante a correção.

Na contenção inicial, não foi implementada uma correção funcional. A contenção
foi validada remotamente; a correção posterior está registrada a seguir.

## Correção preparada após integrar observabilidade

O PR de observabilidade #2 foi integrado na `main` em `328bb9a`. A branch
`fix/meupluggy-consent-identity` foi criada diretamente dessa revisão, preservando
este registro. Uma nova consulta encontrou a sincronização habilitada novamente
e a instância antiga ainda terminal; a pausa acima descreve a contenção inicial.

Uma leitura restrita da API real confirmou a divergência: o Item consultado
correspondia à conexão MeuPluggy (`200`), a página de consentimentos tinha um
registro com ID válido e `itemId` string **diferente do proxy solicitado**.
A evidência preservada contém somente tipos, contagens e o resultado da
comparação. Credenciais, tokens, IDs financeiros e payloads não foram gravados.
Isso confirma a incompatibilidade da comparação anterior com essa resposta;
não permite identificar nominalmente o Item upstream como sendo o original.
Uma leitura adicional confirmou que as contas devolvidas mantêm o `itemId` igual
ao proxy, sustentando a restrição da exceção aos consentimentos.

A correção implementada trata a resposta do endpoint autenticado e filtrado por Item
como o conjunto de consentimentos do proxy consultado. O conector vem da conexão
já validada e persistida. Somente consentimentos MeuPluggy podem manter um
`itemId` upstream diferente: contas, transações, outros recursos e conectores
continuam sujeitos às comparações anteriores. O registro bruto mantém o ID do
provedor; `entities.item_id` continua associado ao proxy local. Consentimentos
sem `itemId`, com `null` ou string vazia são recusados na fronteira.

Também foram implementados paginação de consentimentos pelo SDK, interrupção de
retries determinísticos de identidade e diagnóstico terminal seguro no D1.
Novas falhas guardam apenas um código conhecido em `operations.error`, com
contador coerente, no mesmo batch que finaliza a operação e libera o lock.
Os estados públicos `completed` com fase `error` e `result.isError` permanecem.
Operações antigas não foram reescritas nem reiniciadas.

Os testes sintéticos cobrem paginação, preservação das duas identidades, rejeição
de identidades estrangeiras fora dessa exceção, passagem até contas/transações,
dinheiro exato, replay sem nova leitura e erros terminais sem payload privado.
A validação completa e a publicação estão registradas a seguir.

O adapter corrigido também foi executado localmente contra a API real, somente
por leitura: conexão correspondente, conector MeuPluggy, consentimento aceito com
identidade upstream preservada e contas mantendo o vínculo com o proxy. As páginas
consultadas terminaram sem continuação. Esse probe não iniciou Workflow, não
gravou dados no D1 e não comprova uma importação financeira completa em produção.

## Validação e publicação da correção

| Evidência | Resultado |
| --- | --- |
| `TMPDIR=<local> VITEST_MAX_WORKERS=1 mise run check` | Passou: tipos, lint, formatação, 73 testes Node, 103 testes Worker em 11 arquivos, build dry-run e Workflow nativo com backup/restore D1 sintético |
| CI GitHub do commit publicado | Run `39190648141`, conclusão `success` |
| Código publicado | `b35df69cce36e6e9d59da9e08ca0a6103f6c716b`, branch `fix/meupluggy-consent-identity`, PR #3 |
| Build Cloudflare | `20100836-62b2-45d8-a896-950df9c3d85e`, conclusão `success` |
| Versão publicada a 100% | `db7ed9e1-bd31-4743-9547-8aec021e1ef5`, deploy em 19/10 às 02:37:29 UTC, ou 18/10 às 23:37:29 em São Paulo |

A publicação usou a conexão Git autenticada já existente no Workers Builds. O
repositório da instalação, `cloudflare-finance-mcp`, recebeu a mesma branch e SHA
do repositório fonte; sua `main` não foi alterada. O trigger recebeu branch e
commit explícitos. A tentativa anterior, com `seed_repo`, falhou na clonagem do
repositório privado com código 128, antes de build ou publicação; seu ID era
`75e11411-1d08-4839-a08b-3a34822168ed`. Não foi necessário alterar o código nem
criar credenciais de deploy para resolver essa falha de transporte.

O pipeline executou o comando `npm run deploy` existente e confirmou **nenhuma
migração pendente**. O ambiente CI direcionou o nome genérico `caderninho` ao
Worker instalado `cloudflare-finance-mcp`. Após publicar, a API confirmou os
mesmos bindings D1, KV e Workflow, os mesmos nomes de secrets, logs com amostragem
1 e traces com 0.1. Nenhum recurso de dados novo foi provisionado.

A conferência remota às **02:38:10 UTC** confirmou a versão ativa, sincronização
habilitada, zero operações ativas e zero locks. O smoke HTTP confirmou
`/account/login` com 200 e `/api/account` sem sessão com 401; ambas as respostas
incluíam `X-Request-ID`. Esses sinais comprovam publicação e fronteira de acesso,
sem serem tratados como prova da importação completa.

O estado encontrado após o deploy guardava `next_import_at` e `next_sync_at`
em **20/10/2026 às 02:26:13 UTC**, ou **19/10 às 23:26:13 em São Paulo**.
Essa janela observada foi preservada, sem antecipar admissão por SQL nem
reiniciar operações terminais. `last_import_at` continuava nulo. A importação
financeira completa pelo Workflow publicado permanece pendente; a validação
real efetuada nesta correção foi a leitura restrita pelo adapter.

## Liberação pontual da nova tentativa

Após solicitação do dono, em **19/10/2026 às 02:47:59 UTC**, ou **18/10 às
23:47:59 em São Paulo**, foi antecipado somente `items.next_import_at` da conexão
cuja primeira importação terminou em erro. O update guardou a operação terminal,
o valor anterior do cooldown, `last_import_at` nulo e a ausência de operações
ativas e locks; alterou exatamente uma linha. A releitura confirmou a conexão
elegível para retry, zero operações ativas e zero locks.

A operação com falha e seu histórico foram preservados. A política diária e
`settings.next_sync_at` não foram alterados. Nenhum Workflow foi iniciado por
essa intervenção; a importação completa ainda depende de uma nova admissão pelo
botão **Sincronizar agora**.

## Recuperação da configuração após exclusão manual

Depois da liberação, o painel passou a responder `GET /api/account` com 500.
Os traces da versão publicada indicaram `INSTALLATION_INCOMPLETE` durante a
leitura da conta. A consulta direta confirmou `settings` sem linhas. O dono
informou ter apagado linhas manualmente para tentar liberar o retry e autorizou
o reparo direto no banco. A ausência de `settings.id=1` produz `SETTINGS_MISSING`;
antecipar somente `items.next_import_at` não remove essa configuração.

A inspeção encontrou uma conexão, duas operações terminais, um conjunto de
regras pronto, um registro de conexão e duas coberturas. Ainda não havia contas
nem transações importadas. As regras executáveis estavam vazias, como no conjunto
inicial; não foram detectadas violações de chave estrangeira.

Em **19/10/2026 às 02:56:45 UTC**, ou **18/10 às 23:56:45 em São Paulo**, foi
recriada somente a linha singleton de `settings`, com insert condicionado à sua
ausência, ao conjunto de regras esperado e à ausência de operações ativas e locks.
Foi reaproveitado o conjunto de regras existente. `sync_enabled=1`, a agenda
diária e a agenda de reconciliação vieram das leituras anteriores deste atendimento.
Como o valor antigo de `connected_at` não estava registrado, foi usada a data da
operação mais antiga preservada. A revisão de leitura recebeu um valor novo para
invalidar cursores anteriores; não se trata de restauração exata da linha apagada.

A intervenção alterou uma linha e não iniciou importação. Dados financeiros,
conexão, operações, checkpoints, sessões e secrets não foram alterados. A liberação
anterior de `items.next_import_at` não foi revertida pelo reparo. As consultas D1
usadas pelo painel passaram na releitura às 02:57:43 UTC; a confirmação dessas
leituras é separada da confirmação do HTTP autenticado.

Uma nova admissão ocorreu às **02:57:15 UTC**, após a recriação da configuração.
Às **02:58:01 UTC**, a operação `7d90374d-93b0-417e-a740-56a0c554472f` estava
em execução na fase de transações, com três contas e **204 transações gravadas
no D1**, além de consentimentos e metadados. O progresso tinha zero erros.
Essa consulta leu somente contagens e metadados operacionais. A nova admissão
reservou normalmente as próximas 24 horas. `last_import_at` ainda era nulo;
essa evidência intermediária não representa conclusão integral do Workflow.

Às **02:58:14 UTC**, o Workflow terminou em erro. As três tentativas da página
seguinte de transações falharam com `Worker exceeded CPU time limit.`. A releitura
do D1 às 02:58:51 UTC confirmou operação terminal, `progress.errors=1` e código
seguro `INTERNAL_ERROR`, preservando as 204 transações já publicadas. Uma das três
coberturas de transações permaneceu parcial. O problema de identidade dos
consentimentos foi ultrapassado; o limite de CPU constitui um bloqueio posterior,
que não é resolvido pela exclusão de linhas ou pela reconstrução de `settings`.
Não houve nova liberação de cooldown nem reinício desse Workflow terminal.

## Referências

- [Operação do produto: falhas e retenção](../cloudflare-product.md#falhas-upgrade-e-retenção).
- [Comportamento do botão Pausar](../usage.md).
- [Pluggy: lista de consentimentos](https://docs.pluggy.ai/en/reference/consent/consents-list).
- [Pluggy: Item original e proxy MeuPluggy](https://docs.pluggy.ai/en/docs/connections/item).
- [Cloudflare: retries e erros não recuperáveis em Workflows](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/).
- [PR da correção](https://github.com/DanielSuhett/caderninho/pull/3).
