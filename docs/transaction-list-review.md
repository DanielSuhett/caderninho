# Revisão da lista de transações — 22/10/2026

## Problema e mudança

A tabela antiga se transformava em fichas de duas colunas no compacto, repetindo
rótulos e deixando o disclosure restrito ao pequeno “Detalhes”. O novo
`TransactionList` é compartilhado entre Transações e Referência visual: lista
contínua com separadores e summary inteiro clicável, sem botões aninhados.

Descrição e valor lideram a leitura. Conta e titular ficam juntos; data, categoria
e movimento têm posição estável. Acima de 720 px de container, os metadados ocupam
uma coluna própria. Pendência e exclusão das análises permanecem visíveis. Conta
sem nome usa rótulo neutro; identificadores e origem ficam na expansão. Categorias
textuais da origem continuam preservadas quando não estão no catálogo.

Não houve alteração de consulta, persistência, valores monetários, filtros ou
cursores. A galeria usa o mesmo componente e inclui despesa, receita, descrição
longa, pendência, ignorada, USD, valor maior que o inteiro seguro e ausência de valor.

## Evidência local no navegador

Preview: `http://127.0.0.1:8793/account/transactions`, dados sintéticos.

- Desktop: viewport 1280 × 900, documento 1265 px sem overflow; item comum 76,5 px.
- Mobile: viewport solicitado 390 × 844, observado 391 px (arredondamento do
  navegador), documento 376 px sem overflow; item comum 106,2 px. Todos os cinco
  exemplos da galeria têm scrollWidth igual a clientWidth (280 px).
- Clique na descrição abre; clique no valor fecha; Enter e Espaço alternam o
  disclosure, mantendo foco com outline visível. Detalhes no mobile sem overflow.
- Próxima página: 17 registros no recorte sintético; retorno ao início: 50.
  Paginação mantém aviso de que a página não é um total financeiro.
- `9007199254740993` centavos renderizam exatamente `90.071.992.547.409,93 USD`.
  Ausência é “Valor indisponível”. Pendente e Ignorada nas análises visíveis fechados.

Capturas locais aceitas, em `work/transaction-review/` (diretório ignorado):
`before.jpg`, `desktop.jpg`, `mobile.jpg`, `expanded.jpg` e `gallery-mobile.jpg`.
A revisão da designer aprovou os estados finais capturados. Isso é revisão local
em um navegador; não é homologação de todos os browsers ou leitores de tela.

## Verificações

`mise run check`: 19 testes Node, 75 testes de integração em 14 arquivos, build e
runtime nativo Workflow/D1, incluindo 10 mil e 100 mil transações. Tipos, lint,
formatação e build também verificados após os ajustes finais de apresentação.

Sem push, merge, deploy ou alteração de dados remotos. O preview e as capturas não
comprovam integração real com Pluggy, OAuth ou host MCP.
