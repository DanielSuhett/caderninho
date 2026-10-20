# 02: Importar e consultar uma conta com uma página de transações

**What to build:** O proprietário inicia uma importação de uma conexão sintética
com uma conta e uma página. O Workflow grava os dados, conclui essa coleta e o
assistente consulta a conta, o saldo observado e as transações importadas.

**Blocked by:** 01: Instalar do zero, autenticar e registrar uma conexão.

**Status:** done

- [x] Pedido manual cria uma intenção persistida e um Workflow com o mesmo ID.
  Status e painel mostram o trabalho sem depender da aba aberta ou de Tasks
  customizadas. A janela da conexão não é reservada separadamente da intenção.
- [x] Adapter lê somente conexão, contas e transações. Uma conta BANK ou CREDIT
  e seus registros mantêm identidade composta, moeda, datas e precisão financeira;
  não há entidade universal, catálogo de recursos ou motor de regras no caminho.
- [x] Publicação grava página, marcador de coleta, sequence, commit/resultado
  limitado e revisão em um batch; condição inválida reverte todos os writes.
  Upstream inválido ou página vazia indisponível não vira coleta vazia válida.
- [x] As tools de importação, status, contas e consulta simples retornam dados
  tipados, referência temporal e qualidade. Saldo não é calculado a partir do
  extrato, e payload bruto não é enviado ao assistente por padrão.
- [x] Testes no runtime demonstram a jornada de uma página, vazio válido, perda
  de resposta após commit e rollback por falha no checkpoint. Uma próxima página
  existente permanece pendente; a fatia nunca declara completude falsa.

**Evidência:** [validação local](../../../docs/validation-refatoracao.md); fixtures sintéticas e testes correspondentes em `tests/integration`. Provisionamento, Pluggy e host MCP reais não foram executados.
