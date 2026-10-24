# Demo interativa e fixtures compartilhadas — rodada 09

## Estrutura

As quatro rotas públicas `/demo`, `/demo/transactions`, `/demo/rules` e
`/demo/groups` usam os componentes reais do aplicativo. A demo reutiliza
OrganizationView, RuleEditor, GroupEditor, RulePreview, FinancialDashboard,
TransactionList e o shell com Sidebar Kumo. Composições opcionais continuam lazy.

`src/fixtures/finance.ts` concentra pessoas, contas, categorias e o ledger
sintético de maio a outubro de 2026, além de `transactionFixture`.
`src/fixtures/workspace.ts` concentra factories de conexão, portal e catálogo.
Três testes de UI passaram a usar essas factories: 62 linhas a menos nesses
arquivos. Isso não representa redução líquida do repositório: as novas jornadas
interativas, o adapter e sua cobertura acrescentam código.

`src/web/demo-data.ts` só consulta e agrega o conjunto recebido.
`src/web/demo-session.ts` mantém uma cópia por aba, com API tipada para os
editores reais. Não usa fetch, armazenamento persistente, D1 ou credenciais.
O adapter valida mutações no contrato, referências por grupo, cancelamento e
repetições idempotentes. Não oferece operações financeiras ou conexões reais.

## Salvar e reaplicar

Salvar uma regra preserva categorias do histórico. O produto salva critérios
para importações seguintes; a demo torna a experimentação retroativa explícita
com **Reaplicar regras**. O aviso informa que a ação abrange todos os meses do
grupo, exceto ignorados. Não é uma ação limitada à página ou ao mês visível.

O avaliador `ruleMatches` e a ordenação `activeRules` são compartilhados com o
domínio. Só regras habilitadas participam; a menor prioridade numérica vence,
com desempate pelo ID. Uma transação recebe a categoria da primeira regra
correspondente. Categorias sem correspondência são preservadas. Pausar ou
excluir a regra não desfaz classificações anteriores. Quantidade de mudanças
e quantidade de correspondências são informadas separadamente.

O botão não altera valores, direção do provedor, moeda, datas, parcelas ou
status. Pendentes e futuras podem receber categoria, mas seguem as políticas
financeiras já existentes nos agregados e na lista. Ignoradas não são
reclassificadas na demo, em coerência com a prévia do editor.

**Limite de paridade:** a mutação privada MCP `apply_rules` usa sua seleção
existente, que permite ignorados, limita a seleção a 500 registros e grava em
D1 com atomicidade. Este trabalho não muda essa seleção. A demo compartilha
correspondência e precedência; não simula persistência, paginação, importação,
concorrência ou atomicidade do backend.

## Evidência financeira independente

No teste de outubro em BRL, a regra de compras no mercado foi alterada para
Transferência entre contas. Salvar manteve a despesa em **439.381 unidades
menores**. Reaplicar mudou 12 transações nos seis meses e a despesa de outubro
passou a **333.720**. Entradas ficaram em **980.000**, o fluxo bancário em
**605.789** e despesas USD em **2.400**. O estorno de mercado de **1.250**,
direção CREDIT, conservou a categoria anterior. O agrupamento líquido de mercado
ficou em **−1.250**. Valores esperados são literais nos testes, sem cálculo a
partir da fixture que está sendo testada.

O mesmo ledger reclassificado alimenta visão geral, série mensal, categorias e
transações. Agregação abrange os dados completos do escopo. Moedas continuam
separadas; nenhuma conversão ou soma da página visível é introduzida. Ausência
de valor não vira zero: totais ficam indisponíveis e subtotais conhecidos
permanecem identificáveis. A factory conserva zero, null e direção divergente
do sinal, sem inferir a direção pelo valor.

## Estado local e grupos

Edições sobrevivem à navegação interna, busca GET e Voltar/Avançar. Recarregar a
aba ou acionar **Restaurar demo** restaura os dados iniciais. Abas independentes
não compartilham alterações. O aviso no topo comunica essa duração.

Grupos novos começam sem contas, transações ou regras, com categorias Receitas,
Despesas e Transferências. O seletor financeiro de Grupo aparece quando há
mais de uma escolha ou um escopo não pessoal; mudar de grupo mantém o mês,
escolhe sua moeda e limpa recortes de conta/texto/direção. Nome e moeda não
dependem de um ID invisível na URL. A conta pessoal permanece protegida.

## Verificações e limites

`demo-session.test.ts` verifica salvar versus reaplicar, todos os meses,
repetição sem novas alterações, prioridade/empate, regra pausada, AND/OR,
moeda/conta, valores acima do limite seguro de Number, ignoradas, pendentes,
futuras, grupos isolados, idempotência, reset, cancelamento, null e zero.
Os testes de UI continuam com expectativas independentes das factories.

O gate `mise run check` cobre tipos, lint, formatação, 57 testes Node,
108 testes de integração em 19 arquivos, build/dry-run e runtime local de
Workflow/D1 com 10 mil e 100 mil registros. Há um aviso já existente de resolução
opcional de `@emotion/is-prop-valid` no pacote Kumo durante Vitest; os testes
passam. Nenhuma dependência foi acrescentada.

As [capturas e percursos desta rodada](capturas/rodada-09/README.md) são locais e
sintéticos. Não comprovam produção, OAuth real, importação Pluggy, compatibilidade
de host MCP ou acessibilidade completa. O site publicado não foi atualizado.
