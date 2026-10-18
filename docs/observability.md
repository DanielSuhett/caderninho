# Investigar processos

Comece pelo `X-Request-ID` da resposta ou pelo ID da operação mostrado pelo
painel/Task. O D1 continua sendo a fonte do estado e progresso financeiro.
Logs explicam falhas e recuperação; traces mostram o trabalho de cada etapa.

## Roteiro de investigação

1. Busque `correlation` pelo ID da resposta. Para trabalho durável, busque
   `operationId`; uma operação pode atravessar mais de uma invocação e trace.
2. Confira `event`, `action`, `outcome` e `failure`. HTTP 200 não comprova sucesso
   de uma tool MCP; o diagnóstico considera o resultado do protocolo.
3. Confira `phase` e `recovery`. `scheduled`, `retry` ou `resume` indicam a
   recuperação prevista; não confirmam que ela já ocorreu.
4. Compare o resultado com o estado persistido da operação. Contagens de erros,
   adiamento e cobertura parcial não devem ser interpretadas como sucesso pleno.
5. Abra o trace amostrado para separar origem, processamento e publicação. Se
   não existir trace, use o diagnóstico primário e o estado no D1.

## Campos e volume

| Campo | Uso |
| --- | --- |
| `event` | HTTP_REQUEST, MCP_REQUEST, MCP_STREAM, SYNC_OPERATION, SYNC_RECOVERY, SYNC_DISPATCH, SYNC_SCHEDULED ou MAINTENANCE |
| `correlation` | Requisição; gerado pelo servidor e devolvido em X-Request-ID |
| `runId` | Execução agendada ou invocação de trabalho; ajuda a separar retomadas |
| `operationId` | UUID interno persistido, compartilhado entre dispatch, execução e consulta da operação |
| `action`, `phase`, `operationKind`, `resource` | Categorias conhecidas; nomes de tools desconhecidas são normalizados |
| `outcome`, `failure`, `recovery` | Resultado, categoria segura de falha e recuperação prevista |
| `failed`, `processed`, `pages`, `batches`, `attempt` e contagens de recuperação | Resumos limitados; não são uma lista de registros financeiros |

`LOG_LEVEL` mantém padrão `warn`. Sucesso, polling, no-op, recusas esperadas e
cancelamento normal não emitem warnings/errors. Recuperações pendentes e
resultados parciais geram resumos em `warn`; falhas inesperadas geram `error`.
O encerramento de stream após os headers tem diagnóstico próprio se falhar.
Uma falha não é repetida em cada camada; ocorrências em invocações distintas
continuam sendo ocorrências distintas.

Os spans customizados usam nomes fixos. Eles cobrem ações e trabalho por lote,
sem criar um span por transação ou mensagem SSE. Receipts e replay preservam o
estado e não são contados como novo fetch/commit. Nenhum span manual fica aberto
durante pausas duráveis de uma operação inteira.

## Retenção e segurança

Logs usam `head_sampling_rate: 1`; traces mantêm `0.1`. Invocation logs estão
desabilitados e query strings têm redação habilitada. Separar as taxas evita
descartar deliberadamente diagnósticos de erro por amostragem de traces.
A [configuração de tracing](https://developers.cloudflare.com/workers/observability/traces/#sampling)
aceita amostragem separada de logs. Limites da plataforma, saturação do buffer
Node ou nível `silent` ainda podem impedir a disponibilidade de eventos.

A allowlist da aplicação exclui secrets, dados bancários, corpos, URLs, cursores,
identidades financeiras, inputs/resultados de tools e texto de exceções. Erros
arbitrários viram categoria segura; a aplicação não passa objetos Error brutos a
`recordException` nem serializa mensagem/stack na saída customizada.

A instrumentação automática é outra superfície. A
[lista de atributos da plataforma](https://developers.cloudflare.com/workers/observability/traces/spans-and-attributes/)
inclui URLs, texto SQL e chaves de bindings. `redact_query_string` remove query
strings, conforme o schema do Wrangler instalado; não remove IDs de paths,
nomes de chaves ou qualquer texto arbitrário de SQL. As queries da aplicação
usam parâmetros. A coleta nativa permanece na conta Cloudflare da instalação,
sem novo exporter ou serviço de ingestão nesta mudança. A allowlist customizada
não representa garantia de sanitização de todos os metadados nativos.

Os nomes dos steps duráveis existentes também contêm identidades de Item e
parent. Eles permanecem iguais para preservar replay e não são copiados para
spans customizados. A inspeção da coleta nativa deve considerar esses nomes nos
eventos de Workflow, além de URLs, SQL e bindings.

As exceções originais continuam propagadas para preservar contratos e retries.
Eventos automáticos de falha do Worker/Workflow podem registrar detalhes dessas
exceções fora da instrumentação customizada. A configuração de redação de query
strings não sanitiza essa superfície.

O parentesco dos [spans nativos](https://developers.cloudflare.com/workers/observability/traces/custom-spans/)
segue o contexto assíncrono. A correlação entre invocações usa o ID da operação;
não há trace ID artificial ou nova persistência de telemetria. O probe local
confirmou as APIs de tracing na compatibility date 2026-10-06, incluindo execução
sem amostragem. Isso não comprova ingestão ou retenção em produção.

As [limitações documentadas](https://developers.cloudflare.com/workers/observability/traces/known-limitations/)
incluem ausência de propagação para serviços externos e duração zero em etapas
sem I/O. Não inferir custo zero nem continuação de trace dentro da Pluggy.

## Validar uma alteração

Os testes usam as entradas existentes de HTTP/MCP, cron, operação e persistência
com dados sintéticos. Verificam volume, correlação concorrente, erros convertidos,
streaming, recuperação, replay, rollback e ausência de marcadores privados.
Use `mise run check:quick` durante a edição e `mise run check` na entrega.

### Medição local de 18/10/2026

A comparação executou o diagnóstico HTTP do commit `042ad0b` e a fronteira nova
no mesmo Worker Miniflare, com Pino em `warn` e destino em memória. Cada request
do harness executou 1.000 diagnósticos sequenciais, com status, duração e ID
sintéticos fixos. Uma rodada aqueceu o runtime; a tabela apresenta a mediana de
cinco rodadas. O observador contou spans encerrados pelo wrapper, sem comprovar
ingestão nativa.

| Cenário | Eventos por 100, antes → depois | Bytes por 100, antes → depois | Spans por 100, antes → depois | Host/IPC por 1.000, antes → depois |
| --- | --- | --- | --- | --- |
| HTTP 200 | 0 → 0 | 0 → 0 | 0 → 100 | 1,42 → 12,02 ms |
| HTTP 401 esperado | 100 → 0 | 16.700 → 0 | 0 → 100 | 2,40 → 11,26 ms |
| HTTP 500 inesperado | 100 → 100 | 16.500 → 25.300 | 0 → 100 | 2,45 → 15,48 ms |

A instrumentação acrescentou custo local e campos aos erros. Eliminou os 100
warnings esperados e preservou os 100 diagnósticos de erro, agora com evento,
ação, fase, resultado e recuperação. Esses tempos incluem transporte local do
harness e não medem CPU faturada, latência de requests reais ou custo de ingestão.
O cenário não executa consultas D1 nem chamadas ao provedor.

Ambiente: Node 24.21.0, Wrangler 4.149.0, Miniflare 5.20261006.1-alpha,
workerd 1.20261006.1, esbuild 0.28.2 e compatibility date 2026-10-06.
O parser do Wrangler instalado aceitou as taxas separadas e a redação de query
strings. Não houve publicação ou leitura de dados privados.

O teste de volume de Workflow completou a mesma operação com uma página de
categorias contendo 1 ou 100 registros: ambas produziram 28 spans customizados e
zero warnings/errors. O número acompanha páginas e fases, sem crescer por
registro nesse lote. Falhas recuperáveis de origem e de leitura de status têm
casos separados com 100 ocorrências e um único resumo.

A [jornada integrada](../tests/integration/observability-journey.test.ts) parte
de uma chamada MCP com criação incerta de Workflow, recupera o mesmo ID pelo
cron e publica dados sintéticos no D1. Reexecutar o callback de página não repete
fetch nem publicação; uma operação concluída permanece consultável por Task e
pela consulta financeira. Requisição, cron e execução mantêm contextos distintos,
com correlação operacional segura e um único warning de dispatch.

Medições pontuais não entram na CI como limites de tempo. Registre ambiente,
tamanho dos lotes, bytes, eventos e spans. Tempo medido no Node ou IPC local não
equivale à latência ou CPU de produção. Retenção na Cloudflare, Pluggy/OAuth reais
e comportamento em um cliente MCP externo exigem validação separada.
