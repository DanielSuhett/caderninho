# Navegação lateral, filtros e ícones

Revisão local em 22/10/2026, branch `codex/sidebar-filter-drawers`.

## Decisões implementadas

- Uma família de ícones: Phosphor regular de 20 px, já dependência do Kumo e do
  painel. A referência [Feather](https://www.shadcn.io/icons/feather) foi avaliada;
  não foi adicionada uma segunda família nem outra biblioteca de componentes.
- Navegação sempre à esquerda: 208 px no desktop; 56 px no compacto com destinos
  identificados por nomes acessíveis, tooltip nativa e drawer de expansão por
  toque. Sidebar e conteúdo mantêm rolagem vertical quando necessário.
- `FilterDrawer` substitui campos inline em todas as oito páginas do workspace.
  Resumos de grupo, pessoa, período e condições aplicadas continuam fora do drawer.
  Limpar filtros retorna à rota sem query, incluindo reset de grupo/pessoa/cursor.
- `WorkspaceDrawer` compartilha `<dialog>` nativo, controles Kumo, cabeçalho e
  rodapé persistentes, corpo rolável, Escape, X e Cancelar. Filtros abrem à direita;
  navegação abre à esquerda. Campos desmontam ao fechar para descartar rascunhos.
- Oito marcas bancárias locais derivadas de
  [bancos-brasil](https://github.com/eduardolecdt/bancos-brasil), revisão
  `f9ce11cd2944eda03030defb478193cd569bb138`. SVGs viraram JSX estático sem HTML
  injetado, dependência adicional, CDN ou requisição remota de imagem. A licença
  MIT está preservada em `third-party/bancos-brasil-LICENSE.txt`.

As marcas são exemplos na galeria. O contrato financeiro atual não entrega a
instituição da conta; por isso, contas reais usam `BankMark` neutro. Não há
inferência por nome livre de conta/perfil, nem marca bancária atribuída à pessoa.
Uma futura chave de instituição validada pode alimentar o mesmo componente.

## Jornadas verificadas no navegador

| Jornada | Resultado observado |
| --- | --- |
| Abrir filtros, editar busca e Cancelar | URL e resultados preservados; reabrir mostra busca original, sem rascunho |
| Fechar por Escape | Modal fecha, foco retorna a Filtros e bloqueio de rolagem é removido |
| Teclado no limite do diálogo | Browser pode levar Tab ao chrome; próximo Tab retorna ao modal. Nenhum controle do fundo recebeu foco no teste |
| Transações: Ana + Mercado | Seis registros de Ana, todos com descrição Mercado da semana; critérios visíveis |
| Regras: Pausadas → Limpar | Uma regra pausada; limpar retorna às quatro regras e remove toda a query |
| Sincronizações: Falhou | Cinco rodadas, todas com estado Falhou |
| Auditoria: 30 dias | URL `?days=30` e resumo Período: 30 dias |
| Visão geral: Ana | Duas contas, ambas identificadas como Ana |
| Grupos: Casa em comum | URL aponta para family; título de categorias e resumo mostram Casa em comum |
| Página seguinte → aplicar busca Mercado | Cursor presente antes; ausente após aplicar, com 13 resultados |
| Expandir navegação → Regras | Destinos legíveis por toque; navegação mantém pessoa/grupo na URL |
| Menu aberto no compacto → redimensionar para desktop | Painel continua visível (300 px) e Fechar menu remove o modal e o bloqueio de rolagem |

A aplicação usa GET apenas para navegar; consultas financeiras continuam nos
endpoints autenticados existentes. Abrir/aplicar filtros não modifica dados.
Nenhuma sincronização ou revogação foi disparada nesta revisão.

## Inspeção visual

A designer revisou os recortes de todas as oito páginas móveis e os estados de
sidebar desktop, navegação expandida, filtros abertos/aplicados e catálogo de
bancos. Não encontrou bloqueios nos estados finais apresentados. Um overflow
horizontal de 4 px no rodapé da sidebar foi corrigido com a coluna de grid
`minmax(0, 1fr)`; a largura interna e rolável passaram a ser iguais.
Também foi corrigido o diálogo invisível ao ampliar a janela com o menu aberto:
a regra responsiva agora esconde somente o gatilho, preservando o painel modal.

| Viewport observado | Documento | Sidebar | Evidência |
| --- | --- | --- | --- |
| 1280 px | 1265 px; sem overflow horizontal | 208 px | Desktop íntegro |
| 564 px | 551 px; sem overflow horizontal | 56 px, scrollWidth 56 | Layout compacto |
| Pedido 390 px, DOM arredondado a 391 px | 376 px; scrollWidth 376 em todas as oito páginas | 56 px, scrollWidth 56 | Capturas móveis íntegras |

Capturas em `work/navigation-review/`, ignoradas pelo Git. `report.html` reúne as
imagens aceitas. Antes: `01-before.jpg`. Finais: `06-sidebar-final.jpg`,
`07-sidebar-desktop.jpg`, `08-filter-desktop.jpg`, `10-filter-mobile.jpg`,
`11-bank-catalog-mobile.jpg` e `12`–`19` para as oito páginas. A captura inicial
`02` conserva o defeito da sidebar e não é evidência do resultado final.

A inspeção móvel cobre os recortes visíveis, não cada registro abaixo da dobra.
Não foi executada uma auditoria completa com leitor de tela nem teclado virtual.
O CSS respeita movimento reduzido; screenshots não comprovam animação. A limitação
de captura móvel registrada na revisão anterior foi superada nesta rodada, sem
alterar retroativamente aquela evidência.

## Verificação técnica

`mise run check` passou: 19 testes Node, 75 testes de integração e a suíte nativa
Workflow/D1 de 10 mil e 100 mil registros. O cenário de 100 mil terminou em
39.270 ms, pico workerd 423.756 KiB. Após o ajuste de CSS da sidebar, o build do
portal foi repetido. `check:quick` e `git diff --check` passaram após os ajustes
finais. Não foram adicionadas dependências ou migrações.

Preview com dados sintéticos em `http://127.0.0.1:8793`. O servidor original de
8787 e o checkout principal foram preservados. Nenhum push, deploy, merge ou
migração remota. Não há nova comprovação de Pluggy real ou host MCP externo.
