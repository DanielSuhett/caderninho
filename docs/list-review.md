# Revisão das listas operacionais — 22/10/2026

## Escopo e resultado visual

1. **Contas:** linhas contínuas em `/account`, saldo/moeda e titular visíveis,
   data de observação e aviso de que saldo de cartão não é dinheiro disponível.
   A expansão mostra perfil, timestamp completo, ID e link para a conta filtrada.
2. **Regras:** condição, categoria, prioridade, movimento e alcance continuam
   no resumo. Pausada/Ativa fica visível. Expansão mostra a explicação e o link
   para lançamentos com a mesma condição.
3. **Grupos:** tipo, moeda, orçamento e início do mês visíveis; identificador e
   link para transações ficam na expansão. Categorias e etiquetas continuam
   listas simples, sem criar detalhes vazios.
4. **Sincronizações:** perfil, titular histórico, início e estado visíveis.
   Falha e registro recuperado continuam perceptíveis sem abrir. Etapas,
   encerramento, erro completo, recuperação e IDs ficam na expansão.

A designer aprovou desktop e mobile nos estados capturados. A orientação sobre
falhas foi ajustada: timeout não implica problema nas credenciais; a mensagem
agora pede consultar o estado da conexão antes de tentar uma nova importação.

`DisclosureItem` é a peça compartilhada também por Transações: `details/summary`
nativos, chevron decorativo, hover/foco consistentes e conteúdo do domínio. O
summary inteiro é o alvo; links e ações ficam depois dele. Não houve mudança de
contrato, armazenamento, precisão monetária ou operações no backend.

## Verificação no navegador local

- Preview sintético em `http://127.0.0.1:8793`. Desktop 1280 × 900 e mobile
  solicitado 390 × 844, observado 391 px (arredondamento do navegador), documento
  376 px sem overflow nas quatro páginas. Linhas comuns mobile: conta 126 px,
  regra 125,2 px e grupo 103,2 px; não há altura fixa.
- Clique no nome e Enter/Espaço abriram/fecharam os itens; foco visível. O resumo
  não contém links, botões ou inputs aninhados. Detalhe de sync sem overflow.
- Links das contas preservaram accountId; regras preservaram texto e direção;
  grupos abriram o space correto. Nenhuma mutação financeira foi executada.
- Histórico paginou 25 → 5 → 25 registros. Atualizar o histórico manteve a
  primeira rodada aberta e os registros anteriores durante a consulta.
- Regressão da galeria de transações: valor `90.071.992.547.409,93 USD` e
  “Valor indisponível” preservados, com 280 px de largura e sem overflow.
  A classe condicional usa o espaço fora da interpolação para sobreviver ao lint.

Capturas aceitas estão em `work/list-review/` (ignorado): `before-*.jpg`,
`*-desktop.jpg`, `*-mobile.jpg`, `accounts-open.jpg`, `sync-failed-open.jpg`,
`sync-mobile-open.jpg`, `transaction-regression-mobile.jpg` e
`gallery-disclosure.jpg`. Painéis longos de sync continuam abaixo do viewport;
a captura mobile aberta mostra a parte visível, e a estrutura completa foi
conferida no DOM. Não é homologação de todos os browsers/leitores de tela.

## Verificação técnica e limites

`mise run check` passou: tipos, lint, formatação, 19 testes Node, 75 testes de
integração em 14 arquivos, build dry-run e runtime Workflow/D1 local com 10 mil e
100 mil transações. Nenhuma dependência nova. A revisão posterior da navegação
usa medições próprias; esta aprovação das listas não comprova a grade do menu.

Sem push, merge, deploy, migração real ou alteração remota. Evidência local e
sintética não comprova comportamento real de Pluggy, OAuth ou host MCP.
