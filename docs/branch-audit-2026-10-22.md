# Auditoria das branches em 22/10/2026

Repositório: `DanielSuhett/caderninho`. A consulta remota confirmou os três PRs
fechados e incorporados. Para cada branch, a árvore completa do último commit
coincide com a árvore do respectivo squash merge. Esses merges já são ancestrais
de `main` e da base `refactor/minimo-funcional` usada nesta entrega.

| Branch | PR | Squash merge | Conteúdo pendente nos commits da branch |
| --- | --- | --- | --- |
| `feat/custo-minimo` | [#1](https://github.com/DanielSuhett/caderninho/pull/1) | `042ad0b4` | Nenhum |
| `feat/observability` | [#2](https://github.com/DanielSuhett/caderninho/pull/2) | `328bb9ab` | Nenhum |
| `fix/meupluggy-consent-identity` | [#3](https://github.com/DanielSuhett/caderninho/pull/3) | `f1f68760` | Nenhum |

O contador ahead/behind do GitHub compara ancestralidade de commits. Um squash
gera um novo commit, por isso os commits originais continuam aparecendo como
ahead, mesmo com seu conteúdo integrado. Apenas `git cherry` também não resolve
esse caso, pois compara patches individuais com um patch agregado.

Antes desta integração, `main` estava em `65102b6` e continha 12 commits posteriores
à base `061cefb`: expansão do MCP, perfis de titularidade, planejamento,
workspace, auditoria, regras e melhorias de interface. Eles devem ser preservados
no merge. Nenhuma branch histórica foi apagada ou teve seu histórico reescrito.

Esta conclusão se refere aos commits remotos desses três PRs. Mudanças sem commit
em outros worktrees não fazem parte das branches remotas.
