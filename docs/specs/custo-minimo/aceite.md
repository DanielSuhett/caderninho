# Aceite: custo mínimo

Implementação de 18/10/2026, branch `feat/custo-minimo`. A entrega é local: não
houve deploy, migração remota, acesso Pluggy real nem consulta à fatura.

## Comportamento entregue

- D1 admite uma ingestão por Item/24 horas; pausa, reconexão e novas requestKeys
  preservam a janela. Onboarding admite Item novo imediatamente. Agenda, MCP e
  painel usam o mesmo caminho. Uma operação ativa continua bloqueando outra.
- Cron único às 09:00 UTC. Webhooks autenticados consolidam uma intenção por Item,
  preservando uma nova geração durante a execução; não criam Workflows. Outbox
  conserva identidade e recuperação explícita; status é leitura. Despacho reserva
  o executor antes de criar Workflow, sem polling de lock.
- Reaplicação local síncrona de até 5 transações; seleções maiores só avançam com
  `batches:true` e continuação solicitada. Recibos permanentes, revisão, seleção e
  versão fixa protegem replay e concorrência. MCP admite resposta síncrona ou Task
  terminal por lote. Executores duráveis legados continuam disponíveis na transição.
- Retenção indexada diária, maturação seletiva e elegibilidade temporal nas
  consultas, inclusive com sync pausado. Conteúdo/regras/correções equivalentes
  evitam escritas financeiras. Observações inalteradas continuam gravando frescor
  e `seen_operation`: preservar duplicação, cobertura e remoção segura tem prioridade.
- Painel apresenta última importação, próxima elegibilidade, tentativa automática,
  bloqueio e aplicações locais parciais. Polling exige ingestão despachada ativa.

## Reprodução e métricas

Execute `mise exec -- npm run test:product -- tests/integration/cost-budget.test.ts --silent=false`.
A fixture usa dez Items, dez contas e 10.000 transações, com 50 pendentes no
bootstrap e três tags derivadas por transação. O ciclo seguinte acrescenta 100 transações e altera 100 valores e 50
estados. Uma reconciliação relê a origem inalterada. Os logs `cost-budget` imprimem
linhas lidas/escritas, statements, chamadas de origem, steps e duração de parede.
As medições interceptam apenas os resultados D1 dos statements reais, sem segunda
execução de queries. Seeds, migrações e geração do histórico ficam fora dos totais.

A simulação usa Steps e origem sintéticos, sem chamadas externas nem instâncias
reais de Workflow. Duração de parede não equivale à CPU faturada. Contadores de
KV e CPU de produção não são produzidos por esse teste. O runtime separado prova
Workflow nativo local e contratos, sem provar o desempenho no host de produção.

A ociosidade executa o handler agendado completo, com sync pausado e sem sessões,
eventos pendentes ou limpeza elegível, sobre 100.000 e 1.000.000 operações terminais
e eventos esvaziados. O teste exige ≤100 linhas lidas e ≤10 escritas em ambos.
O índice ativo evita scans terminais; a retenção consulta apenas candidatos
não compactados e payloads ainda preenchidos.

A prova de incremento exige ≤250 mil leituras e ≤25 mil escritas. A reconciliação
exige ≤1 milhão e ≤50 mil. Bootstrap é medido separadamente e não recebe promessa
de caber no Free. Sem medição de CPU real, **Free integral e a meta de US$ 0,10/mês
do serviço completo permanecem não comprovados**.

## Preços e limites

Fontes verificadas em 18/10/2026: [D1](https://developers.cloudflare.com/d1/platform/pricing/),
[Workers](https://developers.cloudflare.com/workers/platform/pricing/) e
[Workflows](https://developers.cloudflare.com/workflows/reference/pricing/).

D1 Free inclui 5 milhões de leituras e 100 mil escritas/dia; Paid inclui 25 bilhões
de leituras e 50 milhões de escritas/mês. Excedentes: US$ 0,001/milhão de leituras,
US$ 1/milhão de escritas e US$ 0,75/GB-mês acima de 5 GB compartilhados. Workflows
Free inclui 3.000 steps/dia e 1 GB-mês; CPU Free tem limite de 10 ms por invocação.
Paid inclui 500 mil steps/mês, depois US$ 0,80/100 mil steps. A base Paid
do Workers custa US$ 5/mês, separada do consumo incremental. CPU, requests,
estado retido de Workflow, logs e KV precisam entrar na medição completa.

Os [limites D1](https://developers.cloudflare.com/d1/platform/limits/) incluem
50 queries por invocação Free e 1.000 Paid; storage por banco é 500 MB Free e
10 GB Paid. O lote local foi reduzido de 20 para 5 registros para caber no orçamento
de queries com três tags. Isso não mede a CPU real de regras arbitrárias. A escala
de um milhão de operações/eventos ultrapassa 500 MB: a prova de custo ocioso
constante não comprova que esse volume caiba no Free.

A janela de 24 horas é política do produto. A [Pluggy documenta](https://v2.docs.pluggy.ai/en/reference/rate-limits)
429 por limite de endpoint/IP/minuto e `Retry-After`; isso não comprova uma regra
comercial de uma leitura/dia. O código para o ciclo em 429/timeout e preserva a
reserva, estendendo-a quando o Retry-After é maior. Não executa PATCH de Item.

## Upgrade, rollback e observação externa

1. Após autorização específica, faça backup/Time Travel e registre a versão atual.
   Aplique `0003_daily_cycles.sql` antes do novo Worker. O ponteiro de ciclo do
   Item é controlado pela aplicação, sem FK para tabela criada depois; isso mantém
   a ordem de exportação/restauração D1 compatível. Items antigos recebem
   janela pela última admissão conhecida ou pelo instante da migração; Items
   realmente novos mantêm primeira admissão. Tasks, recibos e inbox legada ficam.
2. Para rollback de código sem restaurar dados antigos, mantenha o cron diário e
   pause a sincronização antes de restaurar o Worker anterior. A coluna legada
   `manual_sync_after` permanece fisicamente durante a transição, sem consumidor
   novo. Dados e recibos permanecem no schema expandido. Não autorize importações
   pelo binário antigo: ele não aplica a janela nova. Restauração de backup exige
   aceitar explicitamente a perda dos commits posteriores ao backup.
3. Depois de deploy autorizado, observe sete dias incluindo reconciliação. Registre
   D1 Row Metrics e storage; CPU, requests, steps e storage Workflows; leituras e
   escritas KV; logs, Pluggy e consumo dos demais serviços da conta. Compare
   separadamente mensalidade Paid, franquia disponível e consumo incremental.

Retenção drena uma operação terminal e até 200 registros por tabela/dia, mais
200 payloads legados/dia. Backlog maior leva vários ciclos; compactação explícita
pode ser chamada por manutenção autorizada. Recibos locais, IDs idempotentes e
histórico financeiro/regras permanecem, portanto armazenamento cresce com o uso.
O índice redundante `entity_account` foi mantido: removê-lo exige medir também
as consultas financeiras. Não há promessa de volume ilimitado gratuito.
