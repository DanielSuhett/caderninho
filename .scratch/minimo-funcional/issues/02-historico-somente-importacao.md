# 02: Consultar um histórico cumulativo alterado somente pela importação

**What to build:** O proprietário consulta contas, transações e totais da cópia importada. Uma nova importação atualiza registros pelo mesmo identificador e acrescenta os novos, preservando os que a origem deixou de retornar. O lançamento oferece dados da origem e métricas objetivas, sem editor ou classificação própria de consumo. O schema inicial pode mudar, pois cada instalação começa com D1 novo.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Remover a ferramenta de correção e seus contratos, casos de uso, overrides, valores efetivos, indicação de ignorado e data de correção. Descrição e categoria são as informadas pela origem; somente outra importação as atualiza. Remover implementações e testes substituídos, sem manter aliases ou caminhos de compatibilidade para o produto ainda não lançado.
- [ ] Os IDs financeiros da Pluggy identificam os registros. Importar A/B e depois B atualizado/C resulta em A/B atualizado/C, inclusive nos totais elegíveis. Ausência não exclui nem desqualifica um lançamento. Remover presença observada/não observada, filtros, contagens, joins e marcadores usados exclusivamente por essa reconciliação. Não guardar versões antigas nem deduplicar por semelhança quando a origem muda o ID. A retirada do escopo de conexão das transações fica no ticket 03.
- [ ] Retirar known_spending, o classificador interno e suas evidências. Não persistir payload bruto de transação, documentos pessoais, created_at, updated_at, source_updated_at, observed_at, import_id ou outro timestamp/marcador por lançamento: este produto não oferece auditoria de versões ou frescor individual. Manter a data financeira; frescor da coleta é informado por conexão e pela leitura do saldo. Parsers externos e contratos internos carregam somente os campos utilizados, sem payload genérico transportado entre camadas.
- [ ] Contagem, débitos, créditos e fluxo BANK funcionam sobre toda a seleção SQL, com dinheiro exato, moedas separadas e a mesma semântica de datas e status. Pendentes e futuros continuam consultáveis e ficam fora dos totais monetários elegíveis. Débito não é apresentado como gasto nem crédito como renda. Valor desconhecido não vira zero e falha parcial não vira coleta completa.
- [ ] Importações repetidas, redução da janela da origem, atualização de um mesmo ID e falha após uma página confirmada são verificadas por consulta e agregação MCP. Schemas, respostas, instruções, documentação e fixtures removem os recursos cortados. A ferramenta separada de contas permanece até o ticket 03, e a revisão de paginação existente permanece até o ticket 04.

## Implementação para revisão

- A branch `t3/cumulative-import-history` implementa esta fatia com cinco tools, mantendo `accounts`, `connection_id`, revisão e `sync_runs`. O checklist e a resolução ficam para a revisão do integrador.
- MCP verifica A/B → A/B atualizado/C, repetição, janela vazia, invalidação de cursor e falha após página confirmada. Totais passam de 3000 para 6500 e, na falha parcial com B atualizado/D, 10700. Dinheiro exato, moedas, status, datas, zero e valores desconhecidos continuam cobertos.
- O harness Workflow/D1 nativo repete esse cenário, valida replay/rollback e persistência após reinício, além de 10 mil/100 mil transações. Só usa dados sintéticos e recursos locais.
- A fronteira Pluggy rejeita cursor inválido, de outra conta, repetido imediatamente ou com continuação vazia. A detecção antiga de páginas inteiras já vistas foi retirada junto de `transactions.last_seen_run`; ciclos arbitrários entre cursores distintos não têm ledger nem marcador substituto. A enumeração de contas ainda usa seu marcador próprio até os tickets 03/04.
