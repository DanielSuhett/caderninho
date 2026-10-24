# Rodada 10 — temas, comparadores e categorias

24/10/2026. Capturas reais do código compilado, com dados sintéticos locais.
[Contrato](../../temas-e-contraste.md). Demo no Worker 8801; Regras compostas,
acesso e landing também vistos na fixture privada 8806. Não são produção.

## Capturas finais

Correção posterior: “Despesas por mês” usa vermelho semântico Attention do
ChartPalette Kumo na linha, pontos e área discreta. Eixos/grade seguem neutros.
[Tema escuro](despesas-mensais-dark.png) / [tema claro](despesas-mensais-light.png),
1440×1000 CSS. Estas substituem a série neutra nas capturas anteriores abaixo;
os valores, política de cálculo e cores cadastradas de categorias não mudaram.

| Superfície e estado | Evidência |
| --- | --- |
| Visão geral com cores padrão cadastradas | [escuro](visao-geral-dark-categorias-desktop.png) / [claro](visao-geral-light-categorias-desktop.png) |
| Mercado editado para roxo, sem reaplicar | [resumo desktop](categoria-editada-visao-geral-dark.png) / [móvel escuro](categoria-editada-resumo-dark-mobile.png) / [móvel claro](categoria-editada-resumo-light-mobile.png) / [DOM](categoria-editada-evidencia.json) |
| Transações e detalhe com a mesma cor | [desktop escuro](categoria-editada-transacoes-dark.png) / [móvel claro](categoria-editada-transacoes-light-mobile.png) / [320 px escuro](categoria-editada-transacoes-dark-320.png) / [detalhe claro](categoria-editada-detalhe-light-mobile.png) |
| Regras: resumo, resultado e seletor | [desktop escuro](categoria-editada-regras-dark.png) / [móvel claro](categoria-editada-regras-light-mobile.png) / [resultado móvel](categoria-editada-regras-light-mobile-resultado.png) / [Select aberto](categoria-seletor-regra-dark.png) |
| Público, filtros e rascunho | [landing clara](landing-light-mobile.png) / [acesso claro](acesso-light-mobile.png) / [filtros claros](filtros-light-mobile.png) / rascunho [escuro](editor-dark-rascunho.png) e [claro](editor-light-rascunho.png) |

Desktop final 1440×1000 CSS. Móvel final 391×845 CSS e extremo 320×845;
screenshots móveis usam clip físico 390×844/320×844, sem montagem ou alteração
dos pixels. Regras privadas iniciais: 1728×1200 CSS. Sem overflow horizontal nas
larguras conferidas.

## Comparadores

A primeira fase mostra “Compras essenciais”: duas alternativas, quatro condições,
escopo obrigatório e ≥100,00 BRL. Campo discreto, Badge info no comparador e valor
com peso médio usam o mesmo renderer no Flow e no fallback:
[escuro desktop](regras-dark-desktop.png), [claro desktop](regras-light-desktop.png),
condições móveis [escuras](regras-dark-mobile-condicoes.png) e
[claras](regras-light-mobile-condicoes.png).

Arquivos de Visão geral sem “categorias” e de Transações sem “categoria-editada”
registram a fase anterior à propagação das cores. O gráfico da primeira captura
escura desktop antecede o fim do redimensionamento; a versão
`visao-geral-dark-categorias-desktop.png` é a evidência final aceita.

## Interações exercitadas

Troca de tema, recarga preservando claro, sincronização entre abas da mesma
origem sem perder o rascunho “Rascunho preservado entre temas”, descarte do
rascunho, abertura/cancelamento de filtros, detalhe e Select. Clique no botão
visível do cabeçalho móvel conservou o scroll do conteúdo.

Na demo, Mercado mudou de #d97706 para #7c3aed pelo editor. Sem recarregar,
rgb(124,58,237) apareceu na barra e nos ícones de transações, detalhe e regras.
Receitas 9.800,00 BRL, despesas 4.393,81 BRL, saldo 35.425,86 BRL e fluxo
6.057,89 BRL ficaram intactos, sem reaplicar. Recarregar restaura o catálogo
fictício. Screenshots roxos são o experimento local deliberado.

## Verificação e limites

`mise run check` passou: 68 testes Node, 118 de integração em 21 arquivos,
lint, tipos, formato, build/dry-run e runtime Workflow/D1 com 10k/100k registros,
replay, falha parcial e persistência. O teste de aparência conserva ledger,
agregados e fixtures. Avisos opcionais conhecidos de `@emotion/is-prop-valid`
e diretivas Kumo continuam no log.

Revisão independente das primeiras 17 capturas: Regras/Transações 8,5/10;
Visão geral/editores 8/10, avaliações qualitativas dos estados vistos.
Revisão complementar de 13 imagens da cor de categoria: 8,5/10, sem bloqueio
concreto nos estados inspecionados, incluindo detalhe e 320 px.
Sem declaração de acessibilidade completa, satisfação humana, zero flash,
OAuth/Pluggy real, produção ou compatibilidade com host MCP.

Alterações locais; o checkout também contém trabalho simultâneo de categorias
e identificação preservado. O gate verifica o estado compartilhado, não um
commit isolado. Sem dependências novas, commit, merge, push ou deploy da rodada.
