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

## Revalidação da integração

A carga mista foi repetida sobre o código integrado, com todas as migrações
locais e a auditoria MCP da main. Foram mantidos os volumes sintéticos e
as consultas do cenário anterior, com 112 chamadas MCP úteis ao todo,
seis renovações OAuth e uma sincronização sem novidades.

| Recurso | Dia | Projeção de 30 dias | Referência Free equivalente de 30 dias | Uso |
| --- | ---: | ---: | ---: | ---: |
| D1 leituras | 19.927 | 597.810 | 150.000.000 | 0,399% |
| D1 escritas | 501 | 15.030 | 3.000.000 | 0,501% |
| KV leituras | 124 | 3.720 | 3.000.000 | 0,124% |
| KV escritas | 12 | 360 | 30.000 | 1,2% |

A chamada de contagem e o preparo da fixture foram excluídos das cotas,
incluindo a escrita de auditoria dessa chamada de diagnóstico. A importação
registrou 1.809 leituras, 53 escritas e 43 statements. Os valores anteriores
de 19.243 leituras e 13 escritas por dia descreviam a branch mínima sem
auditoria MCP e histórico; não representam a main integrada.

As cotas Free de D1 e KV são diárias, sem saldo acumulável. A coluna mensal
multiplica ambos os lados por 30 para comparação. Faturas, investimentos,
empréstimos e chamadas de planejamento não participam desta carga. Medições
locais não certificam CPU ou comportamento da revisão implantada.

## Índices e CPU após a integração

A migração incremental `0007_query_budgets.sql` atende instalações que já
aplicaram `0001`; a migração inicial permanece intacta. Ela amplia os índices de
status e categoria das transações com data, conta e ID, acrescenta o índice
parcial de totais POSTED, acrescenta status/data/ID no histórico e substitui o
índice temporal da auditoria por tempo/ID. Esse último ajuste mantém a quantidade
de índices e escritas por chamada MCP. O índice adicional do histórico aumenta
as escritas da sincronização, já incluídas na simulação acima.

O teste D1 com 10 mil registros verifica que a migração preserva todos os dados
e resultados. Depois do ajuste, as consultas de status do histórico e de
recentes da auditoria leem no máximo 51 linhas; a consulta de status e pessoa
fica abaixo de 110. As páginas de transações seguem o orçamento de 27 leituras
para 25 registros. O cursor composto do histórico evita reler empates de data.
A titularidade integra a revisão do cursor por um JOIN na chave primária,
preservando invalidação quando o proprietário muda.

Não foram criados índices de baixa seletividade nos pequenos catálogos JSON
nem índices novos para cada agrupamento da auditoria: esses relatórios precisam
ler o período consultado, e índices extras aumentariam as escritas a cada MCP.

A publicação de 500 transações com detalhes de cartão e parcelas caiu de 1.501
statements preparados para quatro. A reconciliação mantém valores monetários
exatos, correções da origem e nomes/categorias/visibilidade alterados pelo dono;
metadados idênticos não geram UPDATE. Páginas acima do limite seguro de binding
continuam usando a alternativa escalar.

Nos ensaios Node 24 de 50 execuções, a página de 500 registros variou de 6,3 a
10,3 ms de CPU, e a de 347 chegou a 7,9 ms. A landing usa o maior resultado
observado; a página cheia ultrapassou a referência Free de 10 ms em um ensaio.
Esses resultados excluem execução D1 e rede e não certificam CPU faturada na
Cloudflare. Os testes locais não substituem validação do onboarding implantado.

A revalidação de 23/10 executou quatro cenários reais em cada cliente, Pi e
Codex, contra o servidor MCP local com o catálogo integrado de 94 ferramentas.
Os oito casos passaram: total exato e parcialidade (uma chamada), métricas por
mês (três), busca com acentos e paginação (sete) e status/sync com cooldown
(duas). Isso valida esses cenários nos dois hosts, sem afirmar cobertura
end-to-end de cada ferramenta ou OAuth com bancos reais. A autenticação do Pi
foi isolada durante o teste e a cópia temporária das credenciais foi removida.
