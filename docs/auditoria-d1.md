# Auditoria de consumo D1 — 18/10/2026

> Registro histórico da auditoria anterior à implementação. A mitigação horária
> foi substituída pelo [ciclo diário e retenção indexada](specs/custo-minimo/aceite.md).

## Conclusão

Existe consumo sem interação humana: cron, sincronização diária, reconciliação
semanal e webhooks continuam trabalhando. O problema comprovado foi a limpeza
operacional executada a cada minuto, inclusive quando não havia nada elegível
para remoção. Ela agora roda no minuto zero de cada hora. Recuperação de
despachos, verificação da agenda e expiração de sessões continuam por minuto.

Essa mudança reduz em 60 vezes as leituras da limpeza para o mesmo estado do
banco. Não reduz em 60 vezes o consumo total. A evidência justifica uma correção
de frequência; não justifica trocar D1, retirar a reconciliação ou acrescentar
índices indiscriminadamente.

Auditoria do checkout, migrações, consultas, agenda, ingestão, consultas sob
demanda e persistência. Medições em D1 local com Miniflare/workerd e dados
sintéticos; planos conferidos também com SQLite. Não foram consultados dados
financeiros, métricas, plano contratado ou fatura de produção. Os números abaixo
não são uma estimativa do consumo real desta instalação. Nenhum deploy ou
migração remota foi executado.

## Como a cobrança funciona

D1 conta linhas examinadas, não apenas registros retornados ou número de
requisições SQL. Índices reduzem leituras, mas sua manutenção acrescenta escritas.
`INSERT`, `UPDATE` e `DELETE` contam como escrita; batches não eliminam esse custo.

| Métrica | Free | Paid |
| --- | --- | --- |
| Linhas lidas | 5 milhões/dia | 25 bilhões/mês incluídos; US$ 0,001 por milhão excedente |
| Linhas escritas | 100 mil/dia | 50 milhões/mês incluídos; US$ 1 por milhão excedente |
| Armazenamento | 5 GB | 5 GB incluídos; US$ 0,75/GB-mês excedente |

No Free, exceder a franquia diária interrompe consultas; não gera automaticamente
uma cobrança de excedente. No Paid, outros bancos da conta também consomem a
franquia. Workers, Workflows, KV e Pluggy têm custos separados.

Fontes verificadas: [preços D1](https://developers.cloudflare.com/d1/platform/pricing/)
e [índices D1](https://developers.cloudflare.com/d1/best-practices/use-indexes/).

## Trabalho automático e evidências

### Cron e retenção: risco comprovado, corrigido

`wrangler.jsonc` agenda um cron por minuto. `src/worker/index.ts` chama a recuperação
de operações, a verificação da agenda, a limpeza operacional e a limpeza de acesso.
O repositório `src/worker/sync/repository/dispatch.repository.ts` mantém IDs de
operações e eventos indefinidamente para preservar Tasks e idempotência.

As buscas de outbox usam `operations_dispatch`; eventos não despachados usam
`inbox_dispatch`. Entretanto, a compactação procura eventos antigos por
`processed_at` e payload, sem índice correspondente. Mesmo payloads já esvaziados
continuam sendo examinados. As três limpezas com JOIN percorrem checkpoints,
recibos e alvos e consultam a operação correspondente. A consulta de operações
ativas dentro do batch também pode varrer o histórico: o índice de despacho
começa por `dispatched`, não por `status`.

`LIMIT 200` limita candidatos removidos, não linhas examinadas. Se nenhum
candidato puder ser removido, a consulta pode percorrer toda a tabela.

Foi executada a função real `compactOperations`, interceptando somente o retorno
do batch para somar `meta.rows_read` e `meta.rows_written`. Fixture: 1.000 operações
concluídas recentemente, 10.000 eventos antigos com payload já vazio, 3.000 recibos,
300 checkpoints e 300 alvos ligados a operação recente. Sem candidatos removíveis.

| Parte do batch | Linhas lidas | Linhas escritas |
| --- | ---: | ---: |
| Checkpoints | 601 | 0 |
| Consulta de operação ativa | 1.000 | 0 |
| Recibos de páginas | 6.001 | 0 |
| Alvos + payloads de eventos | 10.603 | 0 |
| **Total por limpeza** | **18.205** | **0** |

As três consultas de recuperação, na mesma fixture sem trabalho pendente, leram
0, 1 e 0 linhas, respectivamente. Isso separa a varredura histórica da recuperação
necessária a cada minuto.

| Projeção da limpeza com a fixture constante | Antes | Agora |
| --- | ---: | ---: |
| Execuções por dia | 1.440 | 24 |
| Linhas lidas/dia | 26.215.200 | 436.920 |
| Linhas lidas/30 dias | 786.456.000 | 13.107.600 |

O cenário anterior supera o limite diário Free só com limpeza. No Paid, ambos
ficam abaixo da franquia mensal de leitura, supondo que não haja outros consumos.
Se a franquia já estiver esgotada, essas parcelas equivalem aproximadamente a
US$ 0,786 e US$ 0,013 por 30 dias. Portanto, o achado demonstra desperdício e risco
de indisponibilidade no Free, não uma conta alta comprovada no Paid.

A redução altera a capacidade de drenagem: cada tabela pode limpar até 4.800
registros/dia, contra 288.000 anteriormente. A idade mínima continua em 30 dias;
filas maiores levam mais horas para esvaziar. Não há garantia de remoção imediata
ao completar 30 dias. Se uma instalação gerar mais de 4.800 registros elegíveis
por tabela/dia de forma sustentada, será necessário rever essa política com métricas.

### Sincronização e reconciliação

`SYNC_POLICY`, em `src/domain/operation.entity.ts`, define intervalo diário e
reconciliação a cada sete dias. O cron por minuto não importa todo o banco por
minuto. Uma operação em andamento bloqueia a criação de outra operação agendada.
Sem Items, não há importação; se a agenda estiver vencida, a tentativa de
agendamento continuará por minuto, mas a tabela de Items é limitada a dez entradas.

Em `src/worker/sync/execution.service.ts`, transações já inicializadas usam o
watermark de criação na sincronização diária. Pendentes são buscadas separadamente
por ID. A reconciliação lê o histórico completo para descobrir alterações e
remoções que não aparecem no watermark. Transações de investimentos são puladas
na sincronização incremental quando a assinatura do pai não mudou. Outros
recursos podem ser relidos integralmente; a importação não é inteiramente incremental.

Cada entidade recebida é consultada pela chave composta completa. Quando o hash
relevante não mudou, `entities.repository.ts` evita reclassificar e regravar
derivados/tags, mas ainda atualiza origem, observação e `seen_operation`.
Essa escrita é necessária ao protocolo atual de reconciliação e detecção de ausentes.
Retirá-la sem redesenhar esse protocolo poderia marcar registros presentes como removidos.

Medição adicional, com 10.000 transações POSTED já elegíveis e nenhuma PENDING,
usando os mesmos predicados dos repositórios:

| Operação isolada | Linhas lidas | Linhas escritas |
| --- | ---: | ---: |
| Buscar identidade completa | 1 | 0 |
| Observar entidade sem alteração relevante | 1 | 1 |
| Selecionar pendentes inexistentes | 0 | 0 |
| Maturação sem nenhuma alteração | 10.000 | 0 |
| Marcar ausente, com uma entidade não vista | 10.000 | 1 |

O índice parcial `entity_future` existe, mas nesta fixture o otimizador escolheu
`entity_account` para maturação e examinou as 10.000 entidades. A maturação roda
uma vez por operação, inclusive webhook. Índice existente não garante o plano
mais seletivo para toda distribuição de dados. Não se alterou essa query sem
evidência de que ela domine o consumo real.

Uma reconciliação de N entidades inalteradas faz pelo menos N escritas de
observação, além de checkpoints, cobertura, progresso, revisão, recibos e demais
recursos. Com 100.000 entidades, essas observações sozinhas já consomem a franquia
diária Free de escrita. Publicações novas/modificadas ainda mantêm múltiplos
índices, derivados e tags. Escritas merecem mais atenção financeira que leituras:
o preço por milhão excedente é mil vezes maior.

### Webhooks, repetição e crescimento

EventId e request_key únicos evitam operações duplicadas para o mesmo evento;
recibos impedem republicar páginas já confirmadas. Webhooks distintos podem
continuar gerando trabalho sem o usuário abrir o painel. O lock serializa
publicações, mas não é um limite de custo nem uma cota de webhooks.

Executores aguardando o lock consultam a operação e tentam aquisição a cada dez
segundos. Falhas de steps permitem até seis retries. Uma fila ou indisponibilidade
prolongada multiplica trabalho; o cron recupera despachos pendentes.

As verificações de cursor consultam recibos da operação e filtram campos JSON.
O prefixo da chave restringe à operação, mas o trabalho pode crescer
quadraticamente com a quantidade de páginas da operação. Páginas Pluggy usam até
100 registros; importações históricas muito grandes merecem medição específica.

Operações, eventos, entidades, regras e payloads de migração permanecem armazenados.
A limpeza não elimina todo o crescimento de armazenamento nem todo scan. O índice
`entity_account` repete as colunas da chave primária: é candidato a revisão futura,
mas não foi removido por esta auditoria sem avaliar o efeito nos planos existentes.

## Consultas sob demanda

Agregações, filtros JSON, busca textual, categorias efetivas e recorrências podem
examinar muitas linhas. `effective_entities` faz JOINs com derivados e overrides;
os vínculos por identidade têm índices. `queryEntities` usa OFFSET, portanto páginas
distantes podem reler resultados anteriores. `LIMIT` não torna essas buscas baratas
por si só. Preview conta o conjunto antes de amostrar; recorrências leem até 10.001
resultados. Essas operações exigem chamadas do cliente, não são disparadas pelo cron.

O painel consulta a cada cinco segundos quando o estado exige polling; subscriptions
MCP também consultam Tasks ativas a cada cinco segundos e expiram em cinco minutos.
Um cliente aberto pode gerar leituras sem cliques, mas isso não é a sincronização
autônoma de uma instalação sem clientes conectados. Sessões são buscadas por chave
e expiram com índice; o limitador de login utiliza uma única chave `admin`.

## Validação e acompanhamento

A alteração de produção está restrita ao guard horário em `src/worker/index.ts`.
O teste `tests/integration/scheduled.test.ts` exercita recuperação fora da hora
cheia, limpeza na hora cheia, preservação de recibos ativos e retenção das operações.
O teste existente de retenção verifica que dados financeiros, proveniência e
idempotência sobrevivem à limpeza.

Validação concluída: `mise run check:quick` e `mise run check` passaram, incluindo
73 testes unitários, 63 testes de integração, build dry-run, Workflow nativo local
e exportação/restauração sintética completa de D1. O build emitiu avisos de
diretivas `use client` do Kumo e tamanho de bundle; não houve falha de validação.

Para medir a instalação após um deploy autorizado, abra D1 → Metrics → Row Metrics
e compare leituras/escritas por dia em uma janela de pelo menos sete dias que inclua
reconciliação. Consulte também armazenamento e consumo agregado da conta. Não use
quantidade de queries ou duração como substitutos de `rows_read`/`rows_written`.

Não há coleta desses contadores por operação na aplicação atualmente. O dashboard
permite começar sem introduzir instrumentação permanente. Um relatório de fatura
real exige essas métricas, o plano e os demais bancos da conta; esta auditoria não
afirma custo zero nem um teto garantido para a instalação.
