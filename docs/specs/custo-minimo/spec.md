# Caderninho: importação diária e processamento local sob demanda

**Status:** implementada localmente; métricas e limitações no [aceite](aceite.md). Deploy e migração remota não executados.
**Data:** 18/10/2026.
**Objetivo:** consumo recorrente compatível com as franquias gratuitas para uma
instalação pessoal; no plano pago, custo incremental de infraestrutura próximo de
zero. Plano contratado, Pluggy e outros bancos da conta entram separadamente na conta.

## Problem Statement

O dono da instalação quer manter os dados atualizados sem pagar por consultas,
limpezas, tentativas e processamento que se repetem enquanto ninguém usa o serviço.
A premissa fornecida é que importações Pluggy só devem acontecer uma vez ao dia,
por causa do timeout/cooldown da origem. A aplicação hoje tem sincronização diária,
mas isso não impede novas operações manuais, webhooks e reconciliações independentes.
O painel ainda permite antecipação com intervalo de quinze minutos; o MCP cria
operações diretamente. Reaplicações locais usam a mesma execução durável de importações.

A auditoria mediu 18.205 linhas examinadas por uma limpeza sem candidatos. A
correção atual para limpeza horária reduz essa parcela, mas ainda deixa cron por
minuto e trabalho proporcional ao histórico. Essa mitigação não é o desenho final.

## Solution

Um único ciclo de ingestão pode ser admitido por conexão (Item) a cada 24 horas,
independentemente do canal. A rotina automática acorda uma vez por dia. Webhooks
registram a necessidade de atualizar; não disparam importações adicionais.
Sincronização, pendências e eventual reconciliação pertencem ao mesmo ciclo.

Regras, configurações, correções, preview e reaplicação local executam somente
quando solicitados, com resposta síncrona. Seleções grandes usam lotes síncronos
explícitos e retomáveis, sem Workflow, timer, cron ou trabalho escondido após a
resposta. Leituras comuns nunca iniciam importação, reaplicação ou manutenção.

D1 continua canônico. Mantêm-se um pacote, um deploy e os módulos concretos
existentes. Workflows ficam disponíveis exclusivamente para ingestão demorada,
cuja paginação e tolerância a falhas justificam execução durável.

## User Stories

### Importação e frescor

1. Como dono, quero no máximo uma importação por conexão a cada 24 horas, para que
   painel, MCP e webhooks não multipliquem o acesso à Pluggy.
2. Como dono, quero ver quando a conexão poderá ser importada novamente, para
   distinguir cooldown, execução em andamento e falha.
3. Como dono, quero que o primeiro vínculo seja importado imediatamente quando
   ainda não existe ciclo anterior, para concluir o onboarding.
4. Como dono, quero que reconciliação e pendências aproveitem o ciclo diário, para
   corrigir o histórico sem iniciar uma segunda importação.
5. Como dono, quero que falhas preservem dados confirmados e cobertura parcial,
   para não confundir ausência de resposta com ausência de transações.

### Controle e recuperação

1. Como dono, quero pausar e retomar sem apagar o cooldown, para evitar importações
   repetidas por alternância de configuração.
2. Como dono, quero que avisos duplicados não gerem novas operações, para limitar
   custo e preservar idempotência.
3. Como dono, quero recuperar um despacho interrompido sem nova importação lógica,
   para sobreviver a falhas entre D1 e Workflow.
4. Como dono, quero cancelamento explícito e consulta ao progresso sem assinatura
   permanentemente aberta, para controlar a execução.
5. Como dono, quero que um Item novo não libere os já importados, para preservar
   a janela individual de cada conexão.

### Trabalho local

1. Como dono, quero salvar e ativar regras na própria solicitação, para ter
   confirmação imediata sem criar uma tarefa de background.
2. Como dono, quero que ativação não recategorize o passado implicitamente, para
   escolher quando e onde aplicar mudanças.
3. Como dono, quero reaplicar uma seleção pequena na mesma solicitação e uma
   seleção grande em lotes explícitos, para controlar trabalho e progresso.
4. Como dono, quero que repetir uma solicitação confirmada não regrave os dados,
   para tolerar respostas perdidas sem custo ou resultado duplicado.
5. Como dono, quero preservar overrides, dinheiro exato e separação por moeda,
   para que redução de custo não altere o significado das finanças.

### Consumo e manutenção

1. Como dono, quero um dia sem atividade com custo constante em relação ao tamanho
   do histórico, para que envelhecer a instalação não encareça a ociosidade.
2. Como dono, quero limpeza limitada a dados elegíveis com consultas indexadas,
   para não examinar todo o histórico repetidamente.
3. Como dono, quero saber a última importação, próxima elegibilidade e necessidade
   de continuação local, para decidir a próxima ação sem polling inútil.
4. Como dono, quero limites e medições separados para bootstrap e uso recorrente,
   para não receber uma promessa incorreta de gratuidade.
5. Como dono, quero atualizar uma instalação existente preservando Tasks,
   idempotência e dados, para adotar a mudança sem recomeçar a base.

## Implementation Decisions

### 1. Semântica da janela diária

- A premissa de produto é **intervalo móvel mínimo de 24 horas por Item**, medido
  desde a admissão persistida do ciclo. Não é uma chamada HTTP por dia: páginas,
  recursos e IDs pertencentes ao mesmo ciclo exigem várias chamadas. Esta é uma
  interpretação conservadora do pedido, não uma afirmação sobre o contrato comercial da Pluggy.
- Uma admissão atômica e persistente decide entre iniciado, já em andamento,
  cooldown ou pausado. Uma requestKey diferente, outro canal, reconexão do mesmo
  Item, reinício de Worker ou mudança de regras não libera a janela.
- Reservar a janela antes do primeiro acesso de importação ao provedor. Falha
  depois da reserva não restaura automaticamente a disponibilidade. Falha de
  despacho sem acesso ao provedor pode recuperar o mesmo ID de ciclo, não criar outro.
- Novo Item sem histórico tem uma primeira admissão. Seleção com vários Items
  informa o resultado individual e só inclui os elegíveis. Uma operação atrasada
  ainda ativa impede novo ciclo, mesmo que tenham passado 24 horas.
- Reconciliação semanal ocupa o lugar do incremento no ciclo correspondente;
  solicitação de reconcile durante cooldown registra essa intenção para o próximo
  ciclo. Ela não promete cobertura completa antes da execução. Renormalização
  que dependa da origem também obedece à janela; cálculo com dados persistidos é local.

A interface expõe próxima elegibilidade e motivo de bloqueio. Repetir um pedido
em cooldown devolve o estado já existente, sem criar operação de espera por pedido.
O horário diário automático é fixo e documentado em UTC; proposta inicial: 09:00 UTC
(06:00 em São Paulo na data desta spec). Não herdar o horário de outras automações
pessoais. Uma admissão manual próxima do cron pode fazer o próximo cron pular um
dia; a interface deve distinguir elegibilidade de próxima tentativa automática.

### 2. Agenda, webhook e recuperação

Remover o cron por minuto e substituir por um cron diário. Despacho imediato
continua para uma solicitação explícita elegível. Se o despacho falhar, a outbox
preserva o mesmo ciclo; a próxima execução diária ou uma ação explícita de retomar
despacho o recupera. Aceita-se atraso de recuperação automática de até um ciclo
agendado. Consultar status continua sendo uma leitura, sem efeito colateral de despacho.

Webhooks autenticados passam a consolidar uma intenção limitada por Item, em vez
de criar Workflow por evento. Como a intenção é idempotente, um aviso repetido não
precisa acrescentar outra linha de histórico nem mudar um marcador já pendente.
Avisos de alteração/remoção fazem o próximo ciclo incluir reconciliação, a menos
que IDs limitados e íntegros permitam uma busca pontual equivalente. Para KISS,
preferir inicialmente o marcador de reconciliação por Item, sem armazenar listas
crescentes de IDs. Mantêm-se autenticação, validação e ACK somente após persistência.

Capturar uma geração do marcador ao iniciar o ciclo; limpar apenas a geração
consumida. Um evento que chegue durante a execução permanece pendente para o
próximo ciclo. Pausa conserva os avisos. Eventos antigos nunca provocam remoções
locais diretamente. O custo por requisição de webhook não desaparece: a meta é
trabalho constante e poucas escritas para repetições, não imunidade a volume ilimitado.

O executor continua usando recibos, checkpoints e batches atômicos. Limitar retries
transitórios por ciclo; timeout/cooldown da origem interrompe novas tentativas
naquele ciclo e define próxima elegibilidade conforme o maior prazo aplicável.
Não usar recuperação ou reentrada com nova requestKey para contornar essa condição.
Uma retomada de falha local só lê páginas ainda não confirmadas do mesmo ciclo.

Não manter múltiplos executores consultando o lock a cada dez segundos. Admitir
um executor financeiro por vez e deixar trabalho pendente persistido; operações
locais concorrentes recebem conflito retomável, sem espera ativa. Não liberar um
lock de executor potencialmente vivo por simples vencimento de relógio.

### 3. Regras, configurações e reaplicação síncronas

Salvar, validar, ativar regras e alterar configurações já é majoritariamente
síncrono. Preservar esse caminho e eliminar apenas gravações redundantes,
reagendamentos ou vínculos desnecessários com operações duráveis. Repetir conteúdo
ou valor efetivamente igual não cria revisão, catálogo, evento ou alteração financeira.
Trocar uma configuração de agenda não zera a janela Pluggy. Revogação e segurança
mantêm sua semântica, mesmo quando exigem escritas.

Reaplicação passa a ter dois caminhos explícitos: seleção que cabe num lote
executa e responde concluída; seleção maior exige modo de lotes e continuação
solicitada pelo cliente. Não varrer toda a seleção só para saber se cabe: buscar
até o limite mais uma identidade. O tamanho inicial do lote deve ser conservador
(até 20 registros), reduzido se as medições de CPU/subrequests exigirem.

Cada lote fixa versão de regras, filtro, escopo e data de referência; usa ordem
estável por identidade e uma condição de revisão para detectar alterações
concorrentes. Publicar derivados, progresso e recibo do lote atomicamente.
Repetição da mesma chave retorna o resultado confirmado. A revisão esperada
avança com os próprios commits; mudança externa interrompe com conflito, sem
aplicar silenciosamente outra versão ou saltar registros. Alterar a seleção
exige nova execução. Overrides continuam prevalecendo.

Nenhum lote seguinte é executado depois da resposta ou só porque a página ficou
aberta. O usuário pode continuar ou abandonar; lotes anteriores permanecem
confirmados e o estado mostra aplicação parcial. Não prometer atomicidade global
para várias requisições. Limpar estado técnico abandonado posteriormente não
reverte os dados já publicados nem permite replay duplicado de recibos retidos.

Compatibilidade: preservar nomes de ferramentas e respostas legadas quando o
trabalho cabe no modo síncrono; se o cliente negociou Tasks, retornar a Task
terminal correspondente sem criar Workflow. Acrescentar o modo explícito de lotes
sem exigir Tasks de novos clientes síncronos. Uma chamada antiga grande, que não
aceitou processamento parcial, recebe erro claro antes de qualquer publicação,
com instrução de usar lotes. Essa mudança de comportamento precisa constar no
catálogo, documentação e notas de atualização; não fingir sucesso nem deixar uma
Task working que não progride. Operações duráveis antigas em andamento podem
terminar pelo executor legado durante a transição, mas novas reaplicações não o usam.

`live_balance` continua sendo leitura pontual explicitamente solicitada, fora de
cron/polling e sem iniciar atualização/importação. Não substituir por saldo salvo
silenciosamente. Sua exceção ao ciclo deve ser visível: se a restrição da origem
abranger também essa leitura, responder indisponibilidade/cooldown, sem retry oculto.

### 4. D1: trabalho proporcional ao que mudou

Otimizar com medições de `rows_read`/`rows_written`, não só duração ou quantidade
SQL. Usar índices seletivos para admissões, trabalho pendente e limpeza vencida.
Sem tarefas ativas ou limpeza elegível, probes devem ter custo independente do
histórico acumulado. A consulta de status ativo não pode depender de varredura
de todas as operações concluídas.

Executar manutenção no máximo no ciclo diário, com lote limitado, ou por comando
explícito. Vencimento de sessão é verificado na leitura; remover cron de expiração
não estende validade de sessão. Limpeza não deve revisitar payloads já esvaziados.
Preservar IDs e resumos necessários a idempotência/Tasks; não remover dados
financeiros ou regras referenciadas. Índices novos ou removidos exigem medição do
saldo entre leituras, escritas e armazenamento. Avaliar o índice redundante da
identidade, sem removê-lo por intuição.

No incremental, observações inalteradas só podem deixar de escrever por entidade
se cobertura/frescor e semântica de replay continuarem verdadeiros. Na reconciliação,
`seen_operation` ou mecanismo equivalente continua necessário para detectar ausentes;
não o remover sem prova de equivalência e economia total, incluindo tabelas auxiliares.
Preferir manter essa escrita semanal a criar outra estrutura que custe mais.

Maturação deve selecionar somente candidatos e só incrementar revisão quando algo
mudar. Campos financeiros que dependem da data precisam continuar corretos mesmo
com a importação pausada: tornar a elegibilidade temporal correta na consulta ou
promover candidatos dentro de ação explícita, sem escrita escondida em GET e sem
outro polling. Testar virada de dia, data futura e pendência.

Revisão financeira não deve mudar só por heartbeat/progresso de ingestão. Separar
mudança observável financeira de progresso técnico sem invalidar os contratos de
cursores que protegem consistência. Remover checks quadráticos de cursor apenas
quando medição de paginação grande justificar uma alternativa mais barata.

### 5. Orçamentos e limites de aceitação

Metas propostas para a implementação; não são custos já medidos. Fixture de
referência: até 10 Items, 10.000 entidades financeiras no total, 100.000 operações
terminais e 100.000 eventos antigos. Dia incremental: até 100 entidades novas,
100 alteradas e 50 pendentes; até três tags derivadas por transação. Testar também
reconciliação integral com origem inalterada. Manutenção com backlog é cenário
separado; ampliar o histórico em dez vezes não pode ampliar o custo do dia ocioso.

| Cenário em 24 horas | Meta D1 | Atividade de origem/background |
| --- | --- | --- |
| Pausado, sem cliente, evento ou limpeza elegível | ≤100 linhas lidas; ≤10 escritas | 0 chamadas Pluggy, 0 Workflows; no máximo 1 cron |
| Dia incremental da fixture | ≤250 mil lidas; ≤25 mil escritas | 1 ciclo por Item elegível; nenhum ciclo de regras |
| Dia de reconciliação da fixture | ≤1 milhão lidas; ≤50 mil escritas | Reconciliação substitui incremento |
| Repetição local sem mudança | 0 escritas financeiras após confirmar equivalência | 0 Pluggy, 0 Workflow |
| Trabalho local confirmado | Medido por lote e proporcional à seleção | 0 continuação autônoma após resposta |

Os tetos dão margem em relação às franquias D1 atuais, mas não garantem Free:
medir CPU Workers/Workflows, steps, subrequests, KV e armazenamento. Preferir usar
franquias existentes, sem contratar produto novo para economizar microcusto de D1.
No Paid, a meta secundária é ≤US$ 0,10/mês de consumo incremental da fixture,
separando mensalidade base, Pluggy e consumo de outras aplicações. O relatório de
aceite deve declarar as premissas e a projeção, nunca assumir franquia inteira livre.

Bootstrap, importação legada, reclassificação ampla e grande backlog precisam de
medição própria e limites explícitos. Não prometer carga ilimitada grátis. Se um
cenário exceder CPU/steps/cotas do Free, reduzir lote ou distribuir continuação
explicitamente; se isso não bastar, registrar que o Free não foi comprovado e
apresentar custo mínimo real, sem upgrade automático nem descartar registros.

### 6. Compatibilidade e rollout

Adicionar migrações incrementais; preservar a base existente. Derivar a primeira
janela conservadoramente da última importação conhecida; na falta de evidência,
usar o instante da migração para Items existentes, evitando disparar carga em massa.
Itens realmente novos permanecem elegíveis. Preservar operações em andamento e
recibos antes de retirar caminhos legados. Testar upgrade e banco vazio.

Remover campos, rotas internas, temporizadores, testes e documentação substituídos
na entrega que os torna obsoletos, mantendo testes financeiros e contratuais.
Não criar repositories genéricos ou um segundo scheduler. Cada ticket entrega
comportamento demonstrável e passa pelos checks; nenhuma migração real, deploy,
merge ou limpeza remota faz parte da escrita desta spec.

## Testing Decisions

Fronteira principal: HTTP/MCP e evento agendado reais, D1 local e adapter de origem
sintético com relógio controlado. Reutilizar a suíte de persistência, runtime
Workflow e contratos já existente. Testes unitários só para política temporal e
cálculo puro que não fiquem claros nessa fronteira; não criar metatestes de código/config.

1. Disparar painel, MCP, cron e webhook simultaneamente: uma admissão por Item;
   testar 23h59, 24h, virada de dia, pausa, reconexão e requestKeys diferentes.
2. Interromper antes/depois do despacho e entre páginas: recuperar mesmo ciclo,
   sem repetir commits; timeout da origem não inicia novo ciclo nem retries ilimitados.
3. Receber eventos duplicados e durante importação: poucas escritas, nenhum
   Workflow por evento, aviso posterior preservado e reconciliação no próximo ciclo.
4. Executar regras/configurações/reaplicação com origem indisponível: resultado
   síncrono, replay seguro, conflito concorrente explícito, zero tarefa de background;
   preservação de overrides, precisão, datas, moedas e contratos MCP.
5. Medir um dia ocioso, um incremental, uma reconciliação e um upgrade usando
   contadores D1 e CPU/steps quando disponíveis; escalar histórico, exercitar
   bootstrap e publicar consumo por cenário com limites da simulação local.

O teste de custo roda contra statements reais. Medição local não prova cobrança,
CPU ou autenticação de produção. Depois de deploy autorizado, comparar uma janela
de sete dias com reconciliação; esta observação externa não bloqueia a entrega da spec.

## Out of Scope

Trocar D1, mover para homelab, criar multiusuário, novos serviços de fila/cache,
remover OAuth, mudar semântica monetária, descartar histórico para caber na franquia,
reclassificar tudo ao ativar regras e prometer gratuidade para volume ilimitado.
A implementação foi autorizada diretamente pelo usuário; os rascunhos registram a divisão original.

## Further Notes

A premissa diária veio do usuário. Confirmar durante a implementação os sinais de
timeout/cooldown efetivamente retornados pela Pluggy, sem inventar códigos ou
assumir que timeout de leitura autoriza repetir um comando de atualização.

A auditoria anterior comprovou um problema de scans; ela não mediu a fatura de
produção. Regras/configurações já síncronas devem ser preservadas, e não reescritas
por simetria. Não foi identificada necessidade de ticket separado de prefactoring:
as portas existentes permitem introduzir as políticas nas entregas verticais.

Referências de preço consultadas em 18/10/2026:
[Workers](https://developers.cloudflare.com/workers/platform/pricing/),
[Workflows](https://developers.cloudflare.com/workflows/reference/pricing/) e
[D1](https://developers.cloudflare.com/d1/platform/pricing/).
Workflows possui dimensões próprias de steps e armazenamento; diminuir somente
leituras D1 não demonstra gratuidade total. Uma mensalidade Paid existente também
não desaparece com a redução do consumo.
