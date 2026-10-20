# 06: Responder totais financeiros exatos e honestos

**What to build:** O assistente responde contagens, débitos, créditos, fluxo e
consumo conhecido por moeda, conta, categoria ou mês, usando todo o universo
selecionado e explicando quando o resultado é apenas um subtotal.

**Blocked by:** 04: Consultar histórico sem confundir ausência com exclusão;
05: Filtrar e paginar transações com um contrato financeiro concreto.

**Status:** done

- [x] A tool de agregação reutiliza a seleção SQL das consultas e nunca calcula
  totais pela página retornada ao assistente. Métricas e agrupamentos são fechados.
- [x] Strings monetárias e agregação exata preservam valores acima de int64/Number
  seguro; moedas não são somadas entre si. Nulo, medida desconhecida e zero são
  distintos, inclusive quando todos os registros do período forem incertos.
- [x] BANK/CREDIT, pagamento de cartão, transferência própria, estorno e débito
  incerto mantêm sua semântica. Ignorados, pendentes e futuros seguem a política
  da métrica, com dia financeiro explícito e nenhuma reclassificação configurável.
- [x] Resultado separa conhecido e não confirmado e informa referência temporal,
  definição e parcialidade. ID possivelmente substituído não soma duas vezes como
  consumo confirmado; subtotal não é descrito como total definitivo.
- [x] Testes de tool e D1 demonstram os casos financeiros e usam um conjunto maior
  que o limite de página, incluindo categorias sem valor e contas com qualidade
  diferente. Não criar novas tabelas de totais, categorias ou derivados.

**Evidência:** [validação local](../../../docs/validation-refatoracao.md); fixtures sintéticas e testes correspondentes em `tests/integration`. Provisionamento, Pluggy e host MCP reais não foram executados.
