# 03: Consultar transações sem repetir dados da conexão ou da conta

**What to build:** O status apresenta contas e saldos, enquanto consultas e totais encontram as transações pelo ID da conta. O vínculo da conta com a conexão é guardado uma única vez, nos metadados da conexão. O lançamento usa uma aplicação Pluggy por instalação e não precisa de um namespace genérico para múltiplos provedores ou aplicações. As transações passam de vinte para nove colunas.

**Blocked by:** 02 — Consultar um histórico cumulativo alterado somente pela importação.

**Status:** resolved

- [x] Transações persistem somente id, account_id, date, amount_minor, currency, direction, status, description e category. A associação à conexão e o tipo BANK/CREDIT não são colunas da transação. Conta e transação usam os IDs dos recursos Pluggy, não número bancário ou ID da instituição. Não substituir connection_id por chave concatenada/hash, outro campo equivalente ou payload escondido. A validação da origem continua conferindo a conta do lançamento e o Item da conta.
- [x] Cada conexão guarda um mapa JSON tipado, indexado pelo ID Pluggy da conta. O valor contém somente name, type, currency, balance_minor e balance_observed_at; não repete id ou connection_id. O timestamp significa quando o saldo foi lido, sem prometer atualização na instituição. Contas ausentes conservam metadados e histórico; um saldo não relido não ganha data nova nem vira zero. Remover erros, estados, intervalos, documentos, payloads brutos e marcadores por conta; a parcialidade da importação é informada no nível da conexão.
- [x] Filtros por conexão resolvem as contas daquele Item; fluxo BANK usa as contas marcadas BANK nos metadados, sem repetir o tipo em cada lançamento. Paginação, filtros, agrupamento por conta e totais SQL usam os IDs necessários, retirando connection_id dos registros, seletores compostos e cursores onde redundante. Preservar currency por transação: uma compra pode ter moeda diferente da conta. Preservar direction e status: sinal do valor não substitui direção e pendente não equivale a confirmado.
- [x] Status passa a ser o único caminho MCP para contas e saldos, incluindo a seleção de conexões. Remover caderninho_accounts e seu código exclusivo. O conjunto final contém somente status, sync, transactions e aggregate. O painel continua conectando, reconectando e exibindo saldos BANK/CREDIT com referência temporal. Metadados e registros de uma página são confirmados atomicamente.
- [x] Remover accounts e suas queries/portas exclusivas; o schema inicial cria bancos novos, sem compatibilidade legada. Testes usam IDs válidos no contrato da Pluggy, contas distintas sob Itens distintos e contas com o mesmo número bancário mas IDs Pluggy diferentes. Exercitar filtros por conexão/conta, transações em moeda diferente da conta, direção com valor zero/desconhecido, pendentes, saldo preservado e totais BANK/CREDIT, sem assumir colisões de IDs de recurso para justificar campos extras. Medir a consulta com metadados pequenos e cem mil transações sintéticas antes de propor índices ou desnormalização adicionais.

Base da decisão de identidade: a [conta tem ID único](https://v2.docs.pluggy.ai/en/docs/products/accounts) e a API a [recupera apenas por esse ID](https://v2.docs.pluggy.ai/en/reference/account/accounts-retrieve). A [transação informa accountId, moeda, direção e status](https://v2.docs.pluggy.ai/en/reference/transaction/transactions-retrieve). A decisão vale para esta instalação com uma aplicação Pluggy, sem afirmar portabilidade de IDs entre provedores.

## Evidência de conclusão

D1 novo confirma duas tabelas de nove colunas. Transações não repetem conexão ou
tipo de conta; o JSON tipado guarda somente os cinco valores previstos por ID
Pluggy. Status concentra contas/saldos e o MCP anuncia quatro tools.

`accounts.test.ts`, `finance.test.ts` e o cenário integrado verificam filtros por
conexão/conta, moedas diferentes, direção, pendentes, zero/desconhecidos, saldo
preservado e identidade. A consulta foi medida previamente com 100 contas/100 mil
transações sintéticas em SQLite (26,94 ms); o harness D1/Workflow verifica 100 mil,
precisão exata, paginação e reinício. A medição local não representa produção.

Conta ausente preserva metadados/saldo/horário e encerra a tentativa como parcial.
A regressão do catálogo que omite e depois recupera uma conta confirma que o último
sucesso não avança, preservando páginas já confirmadas. Aceito na integração
`refactor/minimo-funcional`, código final `6635a75`.
