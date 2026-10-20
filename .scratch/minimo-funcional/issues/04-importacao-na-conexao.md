# 04: Importar e retomar pelo estado corrente da conexão

**What to build:** O proprietário solicita a importação e acompanha o estado corrente por conexão. Cron e pedido manual compartilham a mesma execução, que retoma páginas confirmadas sem histórico de jobs nem configuração global no banco. Preservar a admissão de uma importação por conexão a cada 24 horas, inclusive em falha, e o agendamento atual. A conexão guarda somente nove colunas: id, accounts, import_id, import_status, import_admitted_at, import_sequence, import_checkpoint, import_error e last_success_at.

**Blocked by:** 02 — Consultar um histórico cumulativo alterado somente pela importação.

**Status:** resolved

- [x] Cada coluna tem um consumidor necessário: id identifica o Item/reconexão; accounts contém os metadados pequenos das contas; import_id identifica o Workflow recuperável; import_status controla admissão/recuperação; import_admitted_at é a única referência de admissão/cooldown; import_sequence impede publicação obsoleta; import_checkpoint localiza fase/conta/cursor; import_error guarda um código seguro; last_success_at informa o último término completo mesmo após nova tentativa com falha. Remover name fixo do conector, status bruto da origem, observed_at genérico, last_admitted_at duplicado, next_import_at, created_at/updated_at da execução, contagens persistidas e histórico por 30 dias. Exibir progresso por estado/fase/conta; totais de registros vêm de consulta quando necessários. Elegibilidade é derivada da admissão mais 24 horas, sem outra coluna.
- [x] Admissão concorrente aceita apenas uma execução por conexão. Despacho incerto recupera o mesmo ID. Leitura de status não inicia trabalho. Falha ao consultar o Workflow não significa término, e um Workflow antigo não publica depois que seu ID foi substituído. Não criar tabela de locks, leases ou expiração heurística para liberar uma importação.
- [x] Dados financeiros, metadados afetados, checkpoint, sequência e estado terminal da página permanecem no mesmo batch atômico. O resultado necessário ao replay é reconstruído desse estado, sem last_commit_id, last_result, outra cópia do checkpoint ou um contador persistido de registros. Para uma chamada com sequência N, o mesmo import_id com sequência N+1 identifica a última página já confirmada; sequência mais avançada ou import_id diferente recusa o executor obsoleto. Ler esse estado antes de consultar a origem. Remover records do resultado do step se seu único fim for alimentar a contagem de progresso eliminada. Preservar nomes dos steps, retentativas limitadas, Retry-After e resultados pequenos.
- [x] Remover pausa global, controles de pausa/retomada, flag global, revisão financeira independente e settings. A paginação detecta mudanças relevantes pelo estado das conexões selecionadas no mesmo batch da leitura: ID, sequência, estado e metadados que afetam a resposta. Usar somente o ID da importação é insuficiente enquanto páginas são publicadas. Cursor obsoleto exige reinício; cadastro/reconexão não podem criar uma mutação financeira sem refletir nesse estado. Não criar snapshot, updated_at artificial ou contador global para substituir settings.
- [x] Remover sync_runs, seus modelos, consultas e manutenção exclusivos. Painel e MCP apresentam estado/fase/conta corrente, último sucesso e erro seguro, sem registros processados persistidos ou timestamp de cada atualização. Testes e harness verificam o conteúdo financeiro gravado para provar progresso, em vez de depender do contador retirado. Exercitar admissão simultânea, cooldown derivado, despacho incerto, replay da última página e do término, rejeição de página antiga/Workflow substituído, rollback do batch, falha parcial e alteração durante paginação. A representação das contas usa o armazenamento disponível; este ticket não depende do 03, e até lá pode usar accounts no lugar do JSON final.

## Evidência de conclusão

A conexão concentra admissão, ID, estado, sequência, checkpoint, erro e último
sucesso; cooldown deriva da admissão. `settings`, pausa global, revisão financeira,
`sync_runs`, contagens/recibos persistidos e manutenção exclusiva foram removidos.

`sync.test.ts` e `finance.test.ts` verificam admissão concorrente, despacho incerto,
cooldown inclusive em falha, replay de página/término, executor substituído,
sequência antiga, rollback e invalidação de cursor pela seleção relevante. A guarda
CHECK e todas as escritas da página permanecem no mesmo batch D1. O harness nativo
prova replay sem refetch, falha parcial, paginação de 100 mil e persistência.

A revisão confirmou o tratamento conservador de contas temporariamente omitidas;
o roteiro de observabilidade obtém `importId` pela admissão ou pelo D1.
Aceito na integração `refactor/minimo-funcional`, código final `6635a75`.
