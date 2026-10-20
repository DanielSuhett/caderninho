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

São seis tabelas de aplicação: settings, connections, accounts, transactions,
sync_runs e portal_sessions. Contas/transações têm identidade composta e campos
financeiros concretos em SQL. Não são guardados payloads genéricos, documentos
pessoais ou marcadores de importação por transação. O histórico é alterado somente
pela importação; categoria e descrição são as da origem.

A intenção de importação e a reserva de 24 horas são confirmadas antes do despacho.
O índice único parcial de sync_runs impede duas execuções ativas por conexão.
Cada execução corresponde a um Workflow com o mesmo ID. Despacho incerto conserva
`pending`; cron e pedidos manuais recuperam esse ID. GET nunca despacha. Pausa
impede novas admissões; falha não libera cooldown. O cron roda às 09:00 UTC.

Cada página confirma registros, qualidade, revisão, checkpoint e último recibo no
mesmo batch D1. A guarda de estado/sequence aborta o batch inteiro quando obsoleto.
O Workflow limita retries e os clientes HTTP não repetem operações por conta
própria. Não há lock durante rede nem expiração artificial de executor.

Uma releitura integral por admissão substitui caminhos incrementais, webhooks e
reconciliações separados. Importações atualizam o mesmo ID e acrescentam novos IDs.
Ausência na origem preserva o histórico e sua elegibilidade nos totais objetivos.
Consultas e totais informam coleta parcial e valores desconhecidos. Execuções
encerradas são limpas após 30 dias, em lotes de até 200; sessões expiradas também
são limpas em lotes de 200.

## Segurança e diagnóstico

Sessões do painel duram oito horas, usam IDs hasheados, CSRF, cookies
HttpOnly/Secure/SameSite e versão do Worker. Comandos exigem origem exata. OAuth
usa a biblioteca oficial e guarda grants no KV da instalação. Não há ACL por conta.

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
