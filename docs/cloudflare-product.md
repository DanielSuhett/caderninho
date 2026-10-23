# Referência técnica do Caderninho

Uma instalação pessoal usa Worker, D1, KV OAuth, Workflow, assets e o binding
nativo de rate limit. O painel fica em `/account`; o MCP com OAuth fica em `/mcp`.
A importação cobre contas BANK/CREDIT, transações, faturas, investimentos e empréstimos.
As 89 ferramentas adicionais estão no [catálogo financeiro](mcp-finance.md).

## Instalação

Os três secrets são ADMIN_PASSWORD (16–256 caracteres), PLUGGY_CLIENT_ID e
PLUGGY_CLIENT_SECRET. Eles não entram no D1 ou nos logs. O botão provisiona D1/KV;
o deploy aplica as migrações em `migrations/` pelo binding DB e declara FINANCE e
LOGIN_LIMITER. Não é preciso criar bucket, webhook, chave de cofre ou tabela de
usuários. O provisionamento completo em conta nova continua pendente de validação
real; build dry-run não o comprova.

Esta refatoração exige banco vazio. Não há conversão de schemas anteriores nem
reset automático em deploys posteriores. Não execute a migração em bancos antigos.

## Dados e execução

A origem conserva duas tabelas: connections (nove colunas) e transactions (nove).
A migração aditiva 0002 acrescenta 21 tabelas de planejamento, metadados e recibos.
Contas e saldos ficam no mapa JSON tipado da conexão; transações usam os IDs
globais dos recursos Pluggy e campos financeiros concretos em SQL. Não são
guardados payloads genéricos, documentos pessoais ou marcadores de
importação por transação. O histórico é alterado somente pela importação;
categoria e descrição são as da origem.

O ID, estado, admissão, sequência, checkpoint e erro da importação ficam na
conexão, junto do último sucesso completo e do mapa de contas. A admissão
condicional reserva 24 horas antes do despacho. Despacho incerto conserva o mesmo
ID; cron e pedido manual o recuperam. GET nunca despacha e falha não libera
cooldown. Não há settings, pausa global ou histórico de execuções. O cron roda
às 09:00 UTC.

Cada página confirma metadados, transações, checkpoint, sequência e estado no mesmo
batch D1. A guarda de ID/estado/sequence aborta o batch obsoleto. Replay reconstitui
a última página ou término pelo mesmo ID com sequência N+1, sem recibos ou
contagens persistidas. O Workflow limita retries; os clientes HTTP não repetem
operações por conta própria. Não há lock durante rede nem expiração de executor.

Uma releitura integral por admissão substitui caminhos incrementais, webhooks e
reconciliações separados. Importações atualizam o mesmo ID e acrescentam novos IDs.
Registros idênticos não executam UPDATE. A publicação usa um parâmetro JSON
transitório por página e `json_each` para inserir somente os nove campos, mantendo
o batch atômico com o checkpoint. Páginas cuja serialização excede 500 mil unidades
UTF-16 usam parâmetros escalares por registro para respeitar o limite de 2 MB
por string do D1. Não há nova coluna ou payload persistido.
A deduplicação compara hashes somente quando um ID se repete
na mesma página; correções da origem e duplicatas conflitantes continuam verificadas.
Ausência na origem preserva o histórico e sua elegibilidade nos totais objetivos.
Consultas e totais informam parcialidade por conexão e valores desconhecidos.
Contas ausentes e saldos não relidos preservam o valor e a referência antigos.
Conta conhecida ausente na releitura entre contas encerra a tentativa com erro
seguro e parcialidade, mesmo que reapareça depois, sem avançar o último sucesso.

## Scans e índices

Cada instalação cria um banco novo a partir de `0001_initial.sql`, que já define
os índices `(status,date,account_id,id)` e `(category,date,account_id,id)`.
Há cinco índices explícitos de transações. Não há migração incremental ou
reconstrução de índices na instalação. A criação inicial é aplicada uma vez;
não há reset dos dados durante a execução nem a cada deploy.

Os índices atendem ao filtro e à ordenação da paginação. Quando o cursor já impõe
um limite de data igual ou menor que `to`, a consulta omite apenas esse predicado
redundante: mantê-lo pode fazer o SQLite reler empates das páginas anteriores.
O filtro original continua no escopo do cursor e na seleção de qualidade.
Uma seleção de conta única usa igualdade, dispensando `json_each` e ordenação
temporária. Nesse caso, o cursor compara `(date,id)` quando a conta do cursor
coincide com a selecionada, aproveitando o sufixo do índice de conta. A ordem
pública `(date,account_id,id)` e o formato do cursor permanecem iguais.

O índice parcial `transaction_posted_totals` contém
`(direction,currency,date,account_id,amount_minor,category) WHERE status='POSTED'`.
Débitos/créditos usam igualdade na direção e percorrem moedas já ordenadas. Todos
os campos da agregação estão no índice, sem carregar descrições. A consulta omite
o `NULL` constante de `GROUP BY`/`ORDER BY` quando não há agrupamento opcional;
mantém `group: null` na resposta. Intervalos de data sem moeda ainda podem preferir
o índice de status/data. O índice parcial também permite selecionar direção,
moeda e intervalo de datas nessa ordem, sem pôr dinheiro em REAL.

A escolha segue as regras de [prefixo e intervalo do SQLite](https://sqlite.org/optoverview.html#where_clause_analysis),
[índices de cobertura e ordenação](https://sqlite.org/queryplanner.html) e
[índices do D1](https://developers.cloudflare.com/d1/best-practices/use-indexes/).
Igualdades precedem o intervalo; as colunas seguintes atendem ordenação/cobertura,
mas não tornam qualquer combinação de filtros uma busca direta. Não se deve criar
um índice para cada coluna nem retirar os índices de paginação porque outro atende
à agregação.

Comparação sintética local em workerd/D1 com 100 mil transações, 20 contas,
UUIDs, três moedas e descrições de 80 bytes; resultados públicos idênticos. As
leituras abaixo são da consulta financeira, sem as dez linhas do catálogo.
Tempo SQL é a média de duas execuções aquecidas, sem estatísticas prévias:

| Consulta | Leituras antes | Leituras depois | SQL antes → depois |
| --- | --- | --- | --- |
| Total de débitos | 161.290 | 64.516 | 202,5 → 154 ms |
| Total de créditos | 129.032 | 32.259 | 118 → 84 ms |
| Débitos BRL num intervalo mensal | 4.232 | 1.677 | 8 → 7,5 ms |
| Primeira página de 50 registros de uma conta | 106 | 51 | < 1 ms |

O arquivo passou de 66,7 para 75,7 MiB nesse conjunto. A carga inicial passou de
600.000 para 696.774 escritas: um novo registro POSTED custa sete escritas,
incluindo tabela, chave primária e índices, em vez de seis. Reimportação idêntica
continua sem escrever transações. Esses valores excluem atualizações do controle
de importação. Uma carga inicial de 100 mil registros excede as cem mil escritas
diárias do Free mesmo sem o novo índice; os testes não comprovam enquadramento
automático na cota.

Foram comparados índices de cobertura para status/conta/moeda, diferentes índices
parciais e tabelas `WITHOUT ROWID`. Ampliar o índice de status fez o planner ignorar
o melhor caminho para totais em banco sem estatísticas. `WITHOUT ROWID` reduziu
escritas, mas piorou agregações e não foi adotado; o SQLite também
[recomenda cautela com linhas largas](https://sqlite.org/withoutrowid.html#when_to_use_without_rowid).
Um índice adicional de moeda ajudou contagens e moeda rara, mas acrescentou outra
escrita por transação e não melhorou os totais principais. Não foi incluído.

Os planos e resultados também foram comparados após `ANALYZE`, sem depender dele
para os ganhos principais. Ele leu mais de um milhão de linhas no cenário de
100 mil registros. O D1 recomenda `PRAGMA optimize` após criar índices; não há
`ANALYZE` nem manutenção automática nas requisições ou em cada página de importação.
Estatísticas e consumo devem ser reavaliados com a distribuição real antes de
introduzir uma rotina de manutenção.

Leituras de controle da sincronização projetam somente os campos usados. A
publicação busca o par conexão/importação pela chave primária da conexão, sem
novo índice. Reduzir a projeção evita transferir e decodificar o catálogo de contas;
isso, isoladamente, não reduz as linhas contabilizadas pelo D1.

`tests/integration/hotpaths.test.ts` verifica scans e respostas de controle,
preservando cursores e replay. Os testes financeiros e de instalação cobrem
histórico, valores de 30 dígitos, moedas e parcialidade. Com 10 mil
transações sintéticas e empates de data/conta/ID, páginas de 25 registros nos
filtros cobertos leem no máximo 27 linhas de transações, além do catálogo. O teste
também limita o tamanho das respostas de controle com um catálogo grande e os
scans de totais por direção; verifica correções de status, direção, moeda e
categoria, mantendo exatidão e desconhecidos explícitos.

O orçamento do [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/)
inclui cinco milhões de leituras e cem mil escritas por dia, compartilhadas pelas
bases da conta. Índices também consomem escritas e armazenamento. Uma página curta
não limita o scan de filtros residuais por descrição ou valor; agregações integrais
continuam percorrendo a seleção. Valide o consumo real por `meta.rows_read`,
`meta.rows_written` e Row Metrics antes de afirmar que a instalação cabe na cota.

## MCP, CPU e contexto

O catálogo tem quatro tools, geradas e validadas uma vez por isolate em ordem
estável. As chamadas continuam sem sessão implícita e sem cache global de dados
financeiros. O SDK/server por requisição preserva o isolamento da autenticação.
Resultados continuam no bloco de texto JSON existente, sem uma segunda cópia
integral em `structuredContent`. A
[especificação MCP](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
define a saída estruturada e sua compatibilidade; adicioná-la não demonstra
economia de contexto no host.

O cursor usa ID/revisão/estado das conexões selecionadas e o dia de referência.
Mudanças de contas e transações publicam a revisão no mesmo batch D1; não é
necessário ordenar, serializar e hashear nomes e saldos para invalidar o cursor.
Consultas sem continuação nem cursor de entrada dispensam esse hash. Mudanças
somente nos metadados das contas continuam exigindo `RESTART_REQUIRED`.

Totais exatos usam cinco parcelas de seis dígitos, mantendo os 30 dígitos por
registro e reconstruindo a soma com BigInt. Cada termo SQL tem magnitude máxima
999999. Mesmo uma linha por byte no limite máximo de
[10 GB por banco D1](https://developers.cloudflare.com/d1/platform/limits/)
fica abaixo do limite de soma inteira de 64 bits. Não há conversão de dinheiro
para REAL ou Number. A mudança reduz o trabalho por linha, não os scans.

Uma comparação sintética local com 100 mil registros, moedas, valores de 30
dígitos, negativos e desconhecidos manteve os resultados idênticos: medianas SQL
de débitos passaram de 309 para 211 ms e de fluxo de 393 para 234 ms. Num catálogo
grande sintético, o material do hash caiu de 1.920.705 para 1.675 bytes; a mediana
Node passou de 10,06 para 0,19 ms. Esses números não medem CPU nem latência de um
Worker publicado.

Tempo SQL e CPU do Worker são métricas distintas: a espera pela consulta não
consome CPU do chamador. Parse, hashing e serialização executados no Worker
consomem esse orçamento. Consulte a
[definição de CPU time](https://developers.cloudflare.com/workers/platform/limits/#cpu-time)
e meça as invocações publicadas antes de afirmar que cabem no limite Free.

Para contexto do modelo, a principal diferença está no resultado, não nas quatro
descrições das tools. A amostra local retornou 2.690 bytes com 10 transações,
12.028 com 50 e 47.114 com 200. O schema sugere 5–20 registros para exemplos e
`aggregate` para totais; os defaults e o formato de resposta permanecem iguais.

Há dois limites ainda abertos no contrato atual: uma descrição individual grande
pode exceder o orçamento de contexto mesmo com `limit:1`, e `groupBy` pode produzir
muitos grupos sem paginação. O teste existente aceita uma descrição cujo JSON de
uma transação chega a 2,2 MB. Uma evolução explícita do contrato pode oferecer
projeção compacta/detalhes e paginação dos grupos ou resumo com restante exato.
Não se truncam descrições nem se descartam grupos silenciosamente. Totais sem
período continuam lendo o histórico solicitado; não há cache com frescor incerto.

## Segurança e diagnóstico

O painel usa cookies assinados HMAC SHA-256 pelo helper do Hono, sem acessar D1
ou KV para autenticação administrativa. O cookie contém CSRF e expiração de oito
horas, conferida no servidor, com HttpOnly, Secure, SameSite=Lax e Path=/.
A chave é derivada de ADMIN_PASSWORD e da versão do Worker, sem secret adicional;
alterar qualquer um invalida os cookies anteriores. Sem senha configurada, o
acesso privado é recusado. Comandos exigem origem exata e CSRF.

Sair limpa somente o cookie do navegador: uma cópia permanece válida até expirar
ou ocorrer rotação. OAuth usa a biblioteca oficial e guarda grants no KV da
instalação, com vida independente do cookie. Revogar assistentes remove esses
grants explicitamente; credenciais MCP não autenticam o painel nem o widget.
Metadados e registro de clientes OAuth permanecem públicos. Não há ACL por conta.

LOGIN_LIMITER admite inicialmente dez tentativas por minuto por IP fornecido pela
Cloudflare. O binding é permissivo e por localização; não é um contador global
exato. IPs não são persistidos nem registrados pela aplicação.

A [observabilidade](observability.md) usa allowlist, contexto por requisição e
spans fixos por operação/página. Logs têm sampling 1 e traces 0.1. Não há spans por
transação, dados bancários ou texto arbitrário de erros na instrumentação própria.

## Validar

Use Node 24 e `mise run setup`. Durante edição, rode `mise run check:quick`.
Antes da entrega, rode `mise run check`: tipos, lint, testes, build dry-run e
harness local D1/Workflow. O harness usa apenas dados sintéticos, importa páginas
de 500 registros, mede 10 mil/100 mil transações e verifica persistência após
reiniciar o Worker. Tempo/RSS locais não estimam limites de CPU em produção.

Acesso real Pluggy, consentimento em host MCP, instalação em conta nova, deploy
e migração remota são validações distintas e exigem execução explicitamente
separada. [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch),
[Workflows](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/)
e [rate limit](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
são as referências das garantias de plataforma.

## Contrato mínimo e consumidores

As dezoito colunas têm consumidores observáveis. D1 não autentica o proprietário;
a senha e a versão assinam o cookie, e grants OAuth continuam no KV existente.

| Coluna de `connections` | Uso |
| --- | --- |
| `id` | Item verificado, reconexão e seleção da importação |
| `accounts` | Status/saldos, filtro por conexão e fluxo BANK |
| `import_id` | Recuperar o mesmo Workflow após despacho incerto |
| `import_status` | Admissão concorrente, estado e parcialidade |
| `import_admitted_at` | Cooldown derivado de 24 horas, inclusive em falha |
| `import_sequence` | Guarda CHECK atômica, replay e invalidação de cursor |
| `import_checkpoint` | Retomada por `phase`, `accountId` e `cursor`, somente |
| `import_error` | Diagnóstico seguro da tentativa corrente |
| `last_success_at` | Último término completo preservado após falha |

| Coluna de `transactions` | Uso |
| --- | --- |
| `id` | Atualização idempotente pelo ID Pluggy e desempate de paginação |
| `account_id` | Seleção, agrupamento e vínculo ao mapa da conexão |
| `date` | Dia financeiro, filtro, ordenação e elegibilidade |
| `amount_minor` | Dinheiro exato; `null` conserva valor desconhecido |
| `currency` | Totais separados, inclusive moeda diferente da conta |
| `direction` | Débito/crédito da origem, mesmo com zero/desconhecido |
| `status` | Consulta de pendentes e elegibilidade de confirmados |
| `description` | Consulta e filtro pelo texto da origem |
| `category` | Filtro e agrupamento pela categoria da origem |

Cada chave de `accounts` é o ID Pluggy. Os únicos cinco valores são `name`
(rótulo do saldo), `type` (BANK/CREDIT e fluxo BANK), `currency` (moeda do saldo),
`balanceMinor` (saldo exato/desconhecido) e `balanceObservedAt` (quando foi lido).
Não há cópia de ID, vínculo, erros ou marcadores por conta. Metadados ausentes
conservam a referência anterior; a parcialidade pertence à conexão.

A prova vertical em `tests/integration/installation.test.ts` começa com D1 vazio,
usa login HTTP, a API do painel e o adapter real do widget com SDK visual sintético.
Ela conecta/reconecta, dispara a importação com o adapter HTTP Pluggy real sobre
respostas sintéticas, consulta páginas/totais via MCP e autoriza/revoga OAuth.
A/B → B atualizado/C conserva A e resulta em `900719925474099306` unidades BRL,
acima da precisão de Number. O binding de despacho executa o importador localmente;
os steps nativos, falhas/replay, 100 mil registros e reinício são uma prova separada
em `tests/integration/run-runtime.ts`. Nenhuma delas demonstra provedor ou host real.

A inspeção de D1 preserva o contrato das duas tabelas de origem,
nove colunas cada, cinco valores por conta e três no checkpoint. O comportamento
financeiro é verificado por HTTP/MCP, não pela leitura de fontes ou configurações.
Respostas/logs são conferidos com credenciais sintéticas, inclusive falha da origem;
o harness verifica também os assets construídos. Cookies expirados/adulterados,
visitantes e bearer MCP isolado não chegam aos endpoints owner da Pluggy/consentimento.

## Histórico: redução anterior ao planejamento

A comparação abaixo registra o modelo mínimo anterior à extensão de 93 tools;
não descreve o tamanho atual desta branch.

| Medida | Baseline `cc59a79` | Produto mínimo |
| --- | --- | --- |
| Tabelas de aplicação | 6 | 2 |
| Colunas por transação | 20 | 9 |
| Tools MCP | 6 | 4 |
| Arquivos TypeScript | 77 | 73 |
| Linhas TypeScript | 6.615 | 5.246 |

Método reproduzível: `git ls-tree -r --name-only REV src`; contar somente `.ts`
e `.tsx`, excluindo `src/worker/runtime.d.ts` e caminhos com `/__tests__/`.
Somar as linhas desses blobs com `git show REV:PATH`. Não é uma medida de assets
ou testes. A base integrada `d810f748` (mesma medição de `90b1113`, antes do 05)
tinha 76 arquivos e 5.442 linhas; agora são três arquivos e 196 linhas a menos.
Desde o baseline, são 1.369 linhas a menos (20,70%).

A auditoria retirou nome/status de Item sem consumidor, validadores/serializadores
JSON e comparadores sem uso, detalhes de erro genéricos, opções HTTP sustentadas
apenas pelos seus testes, aliases/exports e o botão de link sem consumidor. Índices
restantes atendem data/conta/status/categoria e totais confirmados; não há índice composto por conexão
nem join para tabelas removidas. A dependência direta `@cfworker/json-schema` saiu:
o SDK MCP já incorpora o validador. Os scripts npm `check`/`fix`, duplicados sem
consumidores, também saíram; as tasks mise e dependências restantes atendem o
produto e os checks. Relatórios obsoletos com migrações/overrides/recibos removidos
foram retirados junto dos links ativos.

## Perfis e titulares

A migração `0003_household.sql` adiciona três tabelas de titularidade e remove o
limite local antigo. O perfil legado usa os secrets existentes; perfis adicionais
são configurados no painel e armazenados no KV, sem novos bindings ou deploys.
Leia [o modelo e os limites](household.md) antes da migração real.

## Histórico de sincronizações

`0004_sync_history.sql` registra cada admissão e acompanha seus checkpoints por
trigger atômico. A migração é aditiva e recupera somente a última rodada ainda
presente em cada conexão. Consulte [as páginas e os limites do histórico](frontend-workspace.md).
