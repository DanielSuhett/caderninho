# 03: Percorrer contas e páginas e retomar a importação com segurança

**What to build:** Uma importação percorre várias contas e páginas sozinha,
sobrevive a interrupções e informa conclusão ou falha real. O proprietário não
coordena cursores nem confirma lotes pelo assistente.

**Blocked by:** 02: Importar e consultar uma conta com uma página de transações.

**Status:** done

- [x] O mesmo algoritmo percorre contas e transações disponíveis em sequência,
  mantendo apenas checkpoint e resultado do commit mais recente em tamanho limitado.
  Não há caminho incremental, seleção materializada ou histórico crescente de recibos.
- [x] Retries e esperas têm orçamento no Workflow; página já confirmada devolve
  seu resultado antes de refazer a leitura. Concorrência da mesma sequence,
  página antiga e execução encerrada não publicam nem avançam progresso duas vezes.
- [x] Cursor repetido, identidade inesperada ou ID com conteúdo conflitante
  recusam a publicação. Cada conta tem progresso próprio; falha preserva páginas
  confirmadas e deixa qualidade parcial, sem simular rollback de toda a importação.
- [x] Finalizar a enumeração da conta promove seu marcador no commit. Resultado
  da execução é `succeeded` ou `failed`, nunca sucesso com uma flag de erro oculta.
  Status e painel apresentam o resultado real e a referência da última coleta válida.
- [x] Runtime D1/Workflow com falhas injetadas verifica retomada entre páginas,
  resposta perdida, contas múltiplas e tamanho real de página. Limites do adapter
  são medidos sem truncamento nem avanço parcial de cursor.

**Evidência:** [validação local](../../../docs/validation-refatoracao.md); fixtures sintéticas e testes correspondentes em `tests/integration`. Provisionamento, Pluggy e host MCP reais não foram executados.
