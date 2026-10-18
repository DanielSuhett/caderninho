# 03: Aplicar regras e configurações somente na solicitação

**What to build:** regras, configurações, correções e reaplicações respondem
sincronamente usando dados locais. Trabalho grande avança só por lotes que o
cliente solicita, com progresso e repetição seguros.

**Blocked by:** None (can start immediately).

**Status:** rascunho histórico da divisão original; implementação e evidências no [aceite](../aceite.md). Não publicado em tracker.

## Critérios originalmente propostos

- [ ] Preservar os comandos que já são síncronos. Salvar/ativar conteúdo idêntico
  não gera nova revisão nem regrava catálogo financeiro; alterar regras nunca
  agenda importação ou reclassifica o passado implicitamente. Overrides e
  configurações mantêm seus efeitos de segurança e consistência.
- [ ] Uma reaplicação pequena confirma resultado na própria chamada. Seleção
  grande exige modo explícito de lotes; cada lote tem limite medido, versão e
  filtro fixos, ordem estável, progresso e recibo atômicos. Nenhum próximo lote
  executa por cron, Workflow, timer ou após a resposta.
- [ ] Repetir lote confirmado devolve o mesmo resultado. Mudança concorrente de
  dados/regras acusa conflito e não pula registros. A revisão avança com os
  próprios commits; abandonar a sequência preserva lotes anteriores e informa
  aplicação parcial. Precisão, moedas, overrides e proveniência são preservados.
- [ ] MCP mantém nomes e suporta resposta síncrona e Task terminal negociada sem
  criar Workflow. Chamada legada grande sem consentimento a parcialidade é
  recusada antes de escrever, com orientação de lotes. Novos parâmetros são
  aditivos; catálogo e notas de atualização descrevem a mudança. Workflows de
  reaplicação já iniciados podem terminar durante a transição.
- [ ] Com origem e scheduler indisponíveis, testar regras/configurações, seleção
  pequena, múltiplos lotes, replay, abandono e conflitos pela fronteira pública.
  Remover o despacho durável para novas reaplicações e seus consumidores obsoletos.
  Checks completos passam; testes de segurança e finanças continuam cobrindo o fluxo.

## Demonstração

Ativar uma regra, reaplicá-la numa seleção pequena e receber o resultado imediato
sem chamadas Pluggy. Para seleção grande, aplicar um lote e fechar o cliente:
o restante não muda. Repetir o lote e depois solicitar continuação sem duplicação.
