# 05: Mostrar frescor e comprovar o orçamento do serviço completo

**What to build:** o dono entende quando houve importação, quando poderá repetir,
o que ficou parcial e o consumo esperado; a entrega demonstra o custo de toda
a rotina sem depender de cron frequente ou de cliente permanentemente conectado.

**Blocked by:** 03 — Aplicar regras e configurações somente na solicitação;
04 — Manter consumo ocioso constante e escrita proporcional à mudança.

**Status:** rascunho histórico da divisão original; implementação e evidências no [aceite](../aceite.md). Não publicado em tracker.

## Critérios originalmente propostos

- [ ] Painel e MCP mostram última importação, próxima elegibilidade, próxima
  tentativa automática, cooldown, pausa e continuidade local pendente. Polling
  termina quando não há operação de ingestão ativa; ocultar/fechar a interface
  não cria trabalho. Diagnóstico é pequeno e não expõe dados financeiros ou secrets.
- [ ] Testar o fluxo completo com relógio sintético: admissão concorrente, dia
  sem atividade, incremento, reconciliação, timeout, recuperação e reaplicação
  local. Nenhuma dependência indireta recria cron por minuto ou Workflow local.
  Contratos públicos e casos de upgrade funcionam com comportamento documentado.
- [ ] Relatório de aceite registra D1 lidas/escritas, crescimento de storage,
  chamadas de origem, Workflows/steps, CPU quando mensurável e uso de KV. Confrontar
  com Free e Paid vigentes, separando preço base, outras aplicações e Pluggy.
  Não declarar Free comprovado se CPU/steps ou validação externa estiverem pendentes.
- [ ] Demonstrar metas da spec com dados sintéticos. Se bootstrap, regras muito
  grandes ou volume além da fixture excederem limite, oferecer restrição/lotes
  explícitos e registrar o custo; não descartar dados nem contratar plano/produto
  automaticamente. Não ampliar arquitetura apenas para produzir telemetria.
- [ ] Remover documentação e caminhos substituídos conforme seus consumidores
  desaparecem; revisar ADR e instruções de operação. Checks completos passam.
  Entregar procedimento de migração/rollback e medição externa por sete dias;
  deploy, migração real e remoção remota dependem de instrução separada.

## Demonstração

Mostrar o diagnóstico após um dia normal e uma reaplicação parcial, repetir o
fluxo com a interface fechada e apresentar o consumo por cenário. Informar
explicitamente quais limites foram medidos localmente e quais ainda dependem da
instalação real.
