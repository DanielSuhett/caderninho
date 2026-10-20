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
