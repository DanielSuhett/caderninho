# 07: Corrigir transações localmente sem perder edições na importação

**What to build:** O proprietário corrige categoria, descrição ou ignorado pelo
assistente, consulta o resultado e pode remover cada correção para voltar à origem.
Uma importação posterior ou concorrente preserva essas escolhas.

**Blocked by:** 05: Filtrar e paginar transações com um contrato financeiro concreto.

**Status:** done

- [x] A tool de correção aceita somente identidade composta e patch de campos
  conhecidos. Patch vazio, campo desconhecido e registro inexistente têm erro
  acionável; não existe alteração na instituição financeira.
- [x] Campo omitido permanece; null remove só aquele override. Descrição vazia e
  ignorado false são preservados. Categoria é texto, sem catálogo/aliases próprios.
- [x] Atualizar um campo não apaga outro campo nem a origem. Importação e correção
  concorrentes atualizam colunas distintas sem perda de edição manual.
- [x] Consulta e filtros passam a usar valores efetivos, preservando os originais;
  a revisão muda atomicamente quando houver mudança real. Repetir a mesma edição
  não duplica efeito, e um cursor anterior é invalidado corretamente.
- [x] Jornada pela tool cobre set/reset, valores falsy, replay da edição e disputa
  com importação. Integração final verifica também o efeito nos agregados; essa
  fatia não fica bloqueada pela implementação da tool de agregação.

**Evidência:** [validação local](../../../docs/validation-refatoracao.md); fixtures sintéticas e testes correspondentes em `tests/integration`. Provisionamento, Pluggy e host MCP reais não foram executados.
