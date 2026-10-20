# 04: Consultar histórico sem confundir ausência com exclusão

**What to build:** Após uma nova coleta, o proprietário distingue transações
observadas, registros não confirmados e coleta parcial. Alteração de ID ou redução
da janela da origem não apaga histórico nem faz duas versões parecerem gastos
confirmados diferentes.

**Blocked by:** 03: Percorrer contas e páginas e retomar a importação com segurança.

**Status:** done

- [x] Presença é resolvida a partir da enumeração concluída da conta e do marcador
  de observação, sem regravar em massa todas as transações ausentes a cada coleta.
- [x] Registro ausente de enumeração completa vira `not_observed`, continua
  consultável e não é excluído fisicamente. Falha em uma página não promove o
  marcador de completude; tentativa em andamento/falha permanece parcial.
- [x] Troca de ID não transfere correção por similaridade. Histórico fora da
  janela da origem conserva referências temporais; conta inacessível não apaga
  transações nem comprova um saldo zero.
- [x] Consulta, status e painel expõem qualidade e última tentativa separadas da
  última enumeração válida. Não apresentam snapshot estável anterior quando
  páginas da tentativa nova já foram publicadas.
- [x] Jornadas sintéticas cobrem ID substituído, janela reduzida, conta ausente,
  vazio válido e falha no meio da coleta; a qualidade fica disponível aos casos
  de uso de agregação sem depender de outro serviço ou tabela de cobertura.

**Evidência:** [validação local](../../../docs/validation-refatoracao.md); fixtures sintéticas e testes correspondentes em `tests/integration`. Provisionamento, Pluggy e host MCP reais não foram executados.
