# 02: Trabalhar uma vez por dia e consolidar avisos da origem

**What to build:** uma instalação sem clientes acorda uma vez por dia; webhooks
apenas deixam uma intenção para esse ciclo. Solicitações explícitas elegíveis
continuam com despacho imediato e recuperação manual quando necessário.

**Blocked by:** 01 — Respeitar a janela diária em toda importação.

**Status:** rascunho histórico da divisão original; implementação e evidências no [aceite](../aceite.md). Não publicado em tracker.

## Critérios originalmente propostos

- [ ] Substituir cron por minuto por cron diário. Agenda, recuperação e manutenção
  são limitadas ao ciclo diário ou a comandos explícitos. Status/GET não despacha
  trabalho. A interface distingue próxima elegibilidade e tentativa automática;
  documenta possível atraso de recuperação de até o próximo cron.
- [ ] Webhooks autenticados consolidam intenção por Item, sem Workflow por evento
  nem crescimento por payload repetido. Alterações/remoções exigem reconciliação
  no próximo ciclo; ela substitui o incremento. ACK só após persistência.
- [ ] Um aviso durante a importação não é apagado pelo encerramento do ciclo;
  testar geração consumida, repetição, pausa e evento atrasado. Deduplicação
  preservada durante upgrade da inbox antiga, sem transformar todo o histórico
  em importações imediatas ou remover eventos necessários a operações em andamento.
- [ ] Outbox recupera o mesmo ID por comando explícito ou cron diário. Não há
  fila de Workflows dormindo e disputando lock por polling a cada dez segundos.
  Progresso durável e cancelamento continuam consultáveis; recuperar falha local
  respeita os recibos e a janela diária.
- [ ] Sessões continuam expirando mesmo sem cron por minuto; origem indisponível
  não impede leitura de dados locais. Testes de runtime, contratos, upgrade e
  documentação passam, com zero importação adicional por webhook.

## Demonstração

Receber cem notificações iguais: nenhum executor de importação adicional. Executar
um cron elegível: consumir uma intenção; receber outro aviso durante o ciclo e
mostrar que ele permanece para o próximo. Simular despacho perdido e retomá-lo
explicitamente com o mesmo ID.
