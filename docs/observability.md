# Investigar uma importação

Use o `X-Request-ID` da resposta para uma requisição. Para o trabalho durável,
obtenha `importId` na admissão devolvida por `caderninho_sync` ou pelo comando
`POST /api/account/sync`; no D1, consulte `connections.import_id` pelo ID da conexão.
O painel/status expõe o ID da conexão. D1 é a fonte do estado financeiro;
HTTP 200 ou Workflow nativo terminado não comprovam sucesso financeiro.

1. Confira estado/fase/conta da importação corrente e erro seguro pelo painel/status.
2. Compare último sucesso, próxima elegibilidade e horário de leitura do saldo.
   `partial` não representa uma enumeração concluída.
3. Busque a correlação em logs e abra o trace amostrado, quando disponível.
4. Em despacho incerto, repita o pedido de importação ou aguarde o cron. Não apague
   dados nem altere a janela de admissão para forçar uma tentativa.

## Instrumentação

`worker/observability` preserva o contexto assíncrono por requisição/execução,
classifica erros por allowlist e evita repetir o diagnóstico primário entre
camadas. `shared/logger` mantém Pino, com nível padrão warn. Services não recebem
logger ou SDK de tracing; a composição envolve portas e recebe resumos estreitos
para recuperações incertas.

Spans têm nomes fixos: requisição HTTP, autenticação, ação MCP/financeira,
leitura Pluggy, admissão, despacho, publicação, execução e recuperação. Cada página
produz um resumo; não há span por transação. O encerramento do stream MCP tem
tratamento próprio de falha, cancelamento e liberação do handler.

Erros de tool são classificados pelo resultado, mesmo em HTTP 200. Recusas
esperadas e sucesso usam debug; recuperações incertas usam warn; falhas inesperadas
usam error. Uma publicação já confirmada é replay e não implica nova leitura ou
novo commit. O mesmo ID de importação com sequência N+1 no D1 comprova a última
página confirmada; sequências mais avançadas recusam o executor obsoleto.

A instrumentação própria exclui secrets, URLs, corpos, cursores, argumentos,
resultados de tools, identidades financeiras e texto arbitrário de exceções.
Os identificadores de correlação e execução são gerados pela aplicação.
`operationId` nos diagnósticos corresponde ao ID da importação; não representa
uma entidade genérica ou tabela adicional.

## Plataforma e limites

Wrangler mantém logs com sampling 1, traces com 0.1, invocation logs desabilitados
e redação de query strings. Ausência de trace pode ser amostragem. Isso não
comprova ingestão/retencão em produção nem remove metadados nativos de SQL, URLs,
keys de bindings ou exceções automáticas. Não há exporter adicional.

O helper de tracing é best effort: falha no logger, observador ou tracing não
muda o resultado da aplicação e não executa novamente a operação observada.
O contexto capturado no stream preserva a correlação depois do retorno HTTP.
O buffer do logger Node continua limitado a 64 KiB; o Worker usa o logger nativo.

## Validação

Os testes sintéticos exercitam OAuth/MCP HTTP 200 com erro, correlação isolada,
redação, streams, replay, rollback, recuperação, precisão financeira e Workflow
nativo. `mise run check` inclui o harness local e volume de 10 mil/100 mil registros.
Isso não valida automaticamente Pluggy, OAuth em host MCP, provisionamento ou
telemetria remota.

Referências: [spans Cloudflare](https://developers.cloudflare.com/workers/observability/traces/custom-spans/),
[amostragem](https://developers.cloudflare.com/workers/observability/traces/#sampling)
e [limitações conhecidas](https://developers.cloudflare.com/workers/observability/traces/known-limitations/).

## Medir consumo

Use D1 meta.rows_read, meta.rows_written e Row Metrics, não só quantidade de
consultas ou registros retornados. Filtros residuais de texto/valor e agregações
integrais podem varrer muito além da página. Índices também consomem escritas e
armazenamento; uma carga inicial grande pode exceder a cota diária mesmo que
as consultas sejam pequenas. Consulte [preços D1](https://developers.cloudflare.com/d1/platform/pricing/)
e [limites](https://developers.cloudflare.com/d1/platform/limits/) atuais antes de
concluir que a instalação cabe no Free.

hotpaths.test.ts e index-budget.test.ts verificam scans, cursores e páginas com
empates; planning-feedback.test.ts mede o recorte efetivo de planejamento.
Compare respostas exatas além dos planos. Ensaios locais com SQLite/workerd não
medem p95, rede ou CPU de produção. Tempo de espera SQL é distinto de
[CPU do Worker](https://developers.cloudflare.com/workers/platform/limits/#cpu-time):
parse, hash e serialização consomem CPU; a espera pela consulta não.

LOG_LEVEL aceita fatal/error/warn/info/debug/trace/silent e usa warn por padrão
ou valor inválido. Pino filtra antes de serializar. No Node, escrita assíncrona
limita buffer a 64 KiB e descarta excedente; no Worker, usa o build browser e o
logger nativo, sem transporte Node. O filtro reduz volume, não elimina custo de CPU.
