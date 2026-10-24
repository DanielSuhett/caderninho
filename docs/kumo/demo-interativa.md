# Demo interativa e fixtures compartilhadas

## Estrutura

As quatro rotas públicas `/demo`, `/demo/transactions`, `/demo/rules` e
`/demo/groups` usam os componentes reais do aplicativo. A demo reutiliza
OrganizationView, RuleEditor, GroupEditor, RulePreview, FinancialDashboard,
TransactionList e o shell com Sidebar Kumo. Composições opcionais continuam lazy.

`src/fixtures/finance.ts` concentra pessoas, contas, categorias e o ledger
sintético de maio a outubro de 2026, além de `transactionFixture`.
`src/fixtures/workspace.ts` concentra factories de conexão, portal e catálogo.
Os testes de UI compartilham as factories, com expectativas financeiras literais.

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

## Agregação financeira

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
