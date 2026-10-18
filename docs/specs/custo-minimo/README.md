# Spec e proposta de tickets: custo mínimo

**Status:** implementada localmente, com documentação e testes; validação externa pendente.

[Spec completa](spec.md). Os critérios abaixo cobrem comportamento de ponta a
ponta; não são uma divisão por camada técnica.

1. [Importação diária](drafts/01-importacao-diaria.md) — entregue.
   Uma admissão por Item/24h em todos os canais, com cooldown visível e migração segura.
2. [Agenda diária e avisos consolidados](drafts/02-agenda-diaria.md) — entregue após 01.
   Remove cron por minuto e importação por webhook; recupera o mesmo ciclo.
3. [Operações locais síncronas](drafts/03-operacoes-locais.md) — entregue.
   Regras/configurações imediatas e reaplicação em lotes explícitos, sem Workflow novo.
4. [Consumo proporcional](drafts/04-consumo-proporcional.md) — entregue após 02.
   Elimina scans históricos ociosos, mede escritas e preserva invariantes financeiros.
5. [Validação de custo e frescor](drafts/05-validacao-custo.md) — evidências locais e limites no aceite.
   Mostra estado útil e comprova orçamento de D1, CPU, steps e armazenamento.

A sequência acima registra dependências de entrega; não descreve agentes em paralelo.

## Implementação

A implementação foi autorizada diretamente pelo usuário. Os arquivos em `drafts/`
preservam a divisão original; não foram publicados tickets no GitHub ou Linear.
Consulte o [aceite](aceite.md) para comportamento, reprodução das métricas,
limites de validação e procedimento de upgrade/rollback.
