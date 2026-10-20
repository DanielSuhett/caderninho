# 08: Manter a cópia diária e recuperar despachos sem operações duplicadas

**What to build:** O dono pode deixar a cópia financeira atualizar diariamente,
pausar novas importações e pedir atualização manual. Despacho incerto é recuperado
sem criar outro ciclo, e o painel explica elegibilidade, andamento e falhas.

**Blocked by:** 03: Percorrer contas e páginas e retomar a importação com segurança.

**Status:** done

- [x] Agenda às 09:00 UTC e pedido manual usam a mesma admissão atômica de 24 horas
  por conexão. Pausa/cooldown retornam estados claros e não criam intenção futura;
  falha não devolve a janela de admissão.
- [x] Pedidos concorrentes devolvem a execução ativa. Índice/condição no banco
  impedem duas admissões; conexões distintas não disputam um lock global.
- [x] Intenção pendente é recuperada por cron/pedido manual com o mesmo ID de
  Workflow. Erro de rede não é confundido com estado terminal; execução encerrada
  não é ressuscitada por restart nem expirada por idade.
- [x] GET/status só leem; pausa não interrompe commits já iniciados. Painel
  apresenta próxima elegibilidade e resultados sem expor SQL/cursores como tarefas
  do usuário. Retenção remove só execuções encerradas após 30 dias, sem apagar
  marcadores financeiros nem deixar FK impeditiva.
- [x] Testes de cron, painel e runtime demonstram corrida manual/agenda,
  resposta perdida no despacho, pausa, recuperação e retenção limitada, usando
  dados sintéticos e sem depender de webhook ou acesso remoto.

**Evidência:** [validação local](../../../docs/validation-refatoracao.md); fixtures sintéticas e testes correspondentes em `tests/integration`. Provisionamento, Pluggy e host MCP reais não foram executados.
