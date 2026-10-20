# Referência técnica do Caderninho

Uma instalação pessoal usa Worker, D1, KV OAuth, Workflow, assets e o binding
nativo de rate limit. O painel fica em `/account`; o MCP com OAuth fica em `/mcp`.
O lançamento cobre contas BANK/CREDIT e transações.

## Instalação

Os três secrets são ADMIN_PASSWORD (16–256 caracteres), PLUGGY_CLIENT_ID e
PLUGGY_CLIENT_SECRET. Eles não entram no D1 ou nos logs. O botão provisiona D1/KV;
o deploy aplica `migrations/0001_initial.sql` pelo binding DB e declara FINANCE e
LOGIN_LIMITER. Não é preciso criar bucket, webhook, chave de cofre ou tabela de
usuários. O provisionamento completo em conta nova continua pendente de validação
real; build dry-run não o comprova.

Esta refatoração exige banco vazio. Não há conversão de schemas anteriores nem
reset automático em deploys posteriores. Não execute a migração em bancos antigos.

## Dados e execução

São duas tabelas de aplicação: connections (nove colunas) e transactions (nove).
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
Ausência na origem preserva o histórico e sua elegibilidade nos totais objetivos.
Consultas e totais informam parcialidade por conexão e valores desconhecidos.
Contas ausentes e saldos não relidos preservam o valor e a referência antigos.
Conta conhecida ausente na releitura entre contas encerra a tentativa com erro
seguro e parcialidade, mesmo que reapareça depois, sem avançar o último sucesso.

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

A inspeção de D1 verifica exclusivamente o contrato de persistência: duas tabelas,
nove colunas cada, cinco valores por conta e três no checkpoint. O comportamento
financeiro é verificado por HTTP/MCP, não pela leitura de fontes ou configurações.
Respostas/logs são conferidos com credenciais sintéticas, inclusive falha da origem;
o harness verifica também os assets construídos. Cookies expirados/adulterados,
visitantes e bearer MCP isolado não chegam aos endpoints owner da Pluggy/consentimento.

## Redução de código e modelo

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
restantes atendem data/conta/status/categoria; não há índice composto por conexão
nem join para tabelas removidas. A dependência direta `@cfworker/json-schema` saiu:
o SDK MCP já incorpora o validador. Os scripts npm `check`/`fix`, duplicados sem
consumidores, também saíram; as tasks mise e dependências restantes atendem o
produto e os checks. Relatórios obsoletos com migrações/overrides/recibos removidos
foram retirados junto dos links ativos.
