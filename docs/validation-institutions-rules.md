# Validação: instituições e reaplicação de regras

Revisão local em 27/10/2026. Escopo: identidade financeira compartilhada,
Pessoas → Identificar banco e Regras → Reaplicar regras. Não representa uma
revisão global do painel. Nenhum deploy ou migração remota foi realizado.

O navegador usou a demo em Vite e o produto autenticado em Wrangler local,
com D1 e transações sintéticas. As capturas ficam em
`outputs/reviews/institutions-rules/`, ignorado pelo Git; os links abaixo são
evidências deste workspace. Capturas móveis usam 320 × 800 CSS px, com escala
de imagem 2×; desktop usa 1280 × 800 CSS px. O tema foi conferido pelo
`data-mode` efetivo da aplicação.

| Página/estado | Resultado | Evidência e limites |
| --- | --- | --- |
| Pessoas, linha do banco e editor | Alterado e revisado | Demo em desktop [claro](../outputs/reviews/institutions-rules/bank-desktop-light.png)/[escuro](../outputs/reviews/institutions-rules/bank-desktop-dark.png) e móvel [claro](../outputs/reviews/institutions-rules/bank-mobile-light.png)/[escuro](../outputs/reviews/institutions-rules/bank-mobile-dark.png). Contas vinculadas e ações cabem sem overflow horizontal. |
| Pessoas, selecionar/remover banco | Alterado e revisado | Busca no Combobox, ArrowDown/Enter, salvar e remover na demo; [nome atualizado na linha](../outputs/reviews/institutions-rules/bank-saved.png). Escape devolve o foco ao botão Identificar banco. Integração HTTP verifica catálogo oficial simulado, autenticação e persistência após reimportação. |
| Pessoas, catálogo indisponível | Alterado e revisado | [Produto local](../outputs/reviews/institutions-rules/bank-product-error.png) sem credenciais Pluggy: erro visível, tentar novamente e cancelar. Não se declara sucesso no carregamento. |
| Regras, importar → revisar → confirmar → reaplicar | Alterado e revisado | JSON Brasil importado nos dois adaptadores pelo editor compartilhado. A conclusão abre a conferência do período; não aplica o histórico automaticamente. |
| Regras, prévia sem alterações | Alterado e revisado | Demo em desktop [claro](../outputs/reviews/institutions-rules/rules-demo-desktop-light.png)/[escuro](../outputs/reviews/institutions-rules/rules-demo-desktop-dark.png) e móvel [claro](../outputs/reviews/institutions-rules/rules-demo-mobile-light.png)/[escuro](../outputs/reviews/institutions-rules/rules-demo-mobile-dark.png). 18 analisadas, zero mudanças, confirmação desabilitada. |
| Regras, prévia com alterações | Alterado e revisado | Produto local em [desktop escuro](../outputs/reviews/institutions-rules/rules-product-desktop-dark.png) e móvel [claro](../outputs/reviews/institutions-rules/rules-product-mobile-light.png)/[escuro](../outputs/reviews/institutions-rules/rules-product-mobile-dark.png). 3 analisadas, Netflix/Spotify: Sem categoria → Assinaturas. Sem overflow horizontal. |
| Regras, confirmar e concluir | Alterado e revisado | [Sucesso no produto local, móvel claro](../outputs/reviews/institutions-rules/rules-product-success.png): 2 classificações alteradas. Shift+Tab/Enter confirma e conclui; sucesso mostra Concluir sem Cancelar. |
| Regras, revisão obsoleta, repetição, limite e proteção manual | Revisado por integração | Mesmo contrato no produto/demo: prévia sem escrita, conta/período, ignoradas, categoria manual nula, revisão concorrente, recibo idempotente, limite atômico de 500 e origem automática. Falhas de rede/concorrência não foram injetadas no navegador. |
| Cartões, transações, visão geral, gráficos e investimentos | Sem mudança visual necessária; contrato revisado | Testes de identidade verificam filtros antes da paginação/agregação, bandeira preservada, novas contas e precedência de instituição explícita do investimento. Sem revisão visual completa destas páginas. |
| Demais editores que usam BackofficeDialog | Sem mudança necessária | O novo showCancel mantém o padrão true; somente o sucesso da reaplicação o desativa. Tipos, lint, testes e build verificam os consumidores. Sem revisão visual individual de todos os editores. |
| Zoom nativo de 200% | Não validado | O atalho do navegador colaborativo não alterou o zoom. Reflow foi conferido a 320 CSS px; CSS zoom não foi tratado como evidência equivalente de zoom nativo. |
| Catálogo Pluggy real, associação BTG e produção publicada | Não validado | Catálogo e gravação testados com SDK/HTTP simulado e demo. O provedor não informa o banco original no Item Meu Pluggy; após publicação autorizada, cada conexão precisa da identificação inicial em Pessoas. |

## Verificações

`mise run check` passou com Node 24 e `VITEST_MAX_WORKERS=4`: tipos gerados,
TypeScript, formatação, lint, 124 testes de unidade, 184 testes de integração,
build do portal, dry-run do Worker e teste de runtime local de D1/Workflow.
As três migrações foram aplicadas somente em bancos locais sintéticos.
`ultracite doctor` passou sem avisos; `git diff --check` passou.

O build emite avisos preexistentes de diretivas `use client` do Kumo/Rolldown.
O preview de catálogo sem credenciais falha de forma esperada; isso não valida
OAuth ou acesso real à Pluggy. Classificações antigas sem origem conhecida
continuam protegidas como edições manuais, evitando reescrever o histórico.
