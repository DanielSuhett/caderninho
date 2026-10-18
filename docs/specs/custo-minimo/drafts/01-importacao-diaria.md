# 01: Respeitar a janela diária em toda importação

**What to build:** o dono pode importar cada conexão no máximo uma vez a cada
24 horas e vê a próxima elegibilidade no painel e no MCP. Sync, reconcile,
onboarding, reconexão, agenda e pedidos de webhook compartilham a mesma admissão.

**Blocked by:** None (can start immediately).

**Status:** rascunho histórico da divisão original; implementação e evidências no [aceite](../aceite.md). Não publicado em tracker.

## Critérios originalmente propostos

- [ ] Pedidos concorrentes, inclusive com requestKeys diferentes, admitem no máximo
  um ciclo por Item; a janela persistida sobrevive a reinício, pausa e reconexão.
  Item novo tem primeira admissão; seleções mistas informam resultado por Item.
- [ ] Painel e MCP distinguem iniciado, em andamento, cooldown e pausado; mostram
  próxima elegibilidade. Reconcile em cooldown fica para o próximo ciclo, sem
  disparar segunda importação. O intervalo manual de quinze minutos deixa de
  autorizar novas importações. Datas de UTC e limite de 24 horas são testados.
- [ ] A reserva é atômica e ocorre antes do provedor. Falha de despacho recupera
  o mesmo ciclo; timeout/cooldown de origem não libera janela nem produz retries
  ilimitados. Paginação e pendências fazem parte do ciclo já admitido.
- [ ] Migração incremental preserva operações, dados e idempotência; inicializa
  Items existentes conservadoramente. Banco vazio e upgrade têm testes. Operações
  antigas ativas impedem concorrência indevida antes de completar a transição.
- [ ] Testes HTTP/MCP, D1 e origem sintética demonstram as corridas e falhas;
  contratos e documentação explicam o comportamento. Checks completos passam.

## Demonstração

Solicitar sync no painel, repetir pelo MCP e reconectar o Item: apenas um ciclo
consulta a origem. Às 23h59, mostrar cooldown; após 24h e conclusão do anterior,
aceitar um novo ciclo. Um Item recém-adicionado pode iniciar sem liberar os outros.
