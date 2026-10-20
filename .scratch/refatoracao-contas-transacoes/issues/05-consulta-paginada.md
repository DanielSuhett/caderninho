# 05: Filtrar e paginar transações com um contrato financeiro concreto

**What to build:** O assistente encontra transações por conta, período e campos
conhecidos e percorre resultados consistentes. Mudança dos dados exige reiniciar
a paginação em vez de misturar versões silenciosamente.

**Blocked by:** 02: Importar e consultar uma conta com uma página de transações.

**Status:** done

- [x] Consulta suporta os filtros nomeados da spec, incluindo categoria/descrição
  efetiva, ignorado e presença. Referências compostas evitam colisões entre contas;
  não há paths livres, AST genérica, SQL de entrada ou recursos fora do escopo.
- [x] Ordem estável, cursor com posição/escopo/revisão e limites de 50 por padrão
  e 200 no máximo permitem paginação completa sem carregar o extrato inteiro.
- [x] Cursor de escopo diferente ou revisão alterada é recusado de forma acionável;
  registros, qualidade e revisão são lidos consistentemente. Filtros monetários
  exigem moeda e preservam exatidão.
- [x] Pendentes, futuros, ignorados e registros não observados continuam
  encontráveis explicitamente, com valores originais/efetivos e referência temporal.
  O contrato de qualidade é testado com fixtures independentemente da coleta longa.
- [x] Testes pela tool e pela persistência cobrem combinações de filtros, limites,
  páginas sem perdas/duplicação e invalidade de cursor após publicação. Não
  acrescentar uma tela de extrato que o produto não precisa para completar a fatia.

**Evidência:** [validação local](../../../docs/validation-refatoracao.md); fixtures sintéticas e testes correspondentes em `tests/integration`. Provisionamento, Pluggy e host MCP reais não foram executados.
