# QA visual — migração e polimento Kumo

final result: blocked

## Estado em 24/10/2026

A migração de componentes passou tipos, lint, 40 testes Node, 107 testes de
integração, build/dry-run e runtime Workflow/D1 com 10 mil/100 mil registros.
A aprovação visual foi **reaberta** pelo usuário: alinhamento, hierarquia,
contraste, densidade e identidade monocromática ainda precisam de correção.
A aprovação técnica não é aprovação de design.

## Referências e comparação

Referências atuais: screenshot de Sidebar Kumo enviado pelo usuário,
`docs/kumo/referencias/collapsible-oficial.jpg`, e dashboard/transações da demo
Securo em `docs/kumo/referencias/`. As referências e os renders foram abertos
em uma mesma entrada de comparação; não há alegação de identidade pixel a pixel.
A Sidebar de referência tem empresa/busca/árvore que o produto não possui.
A estrutura Securo orienta composição; não autoriza misturar moedas ou inventar
indicadores, projeções, permissões ou operações.

## Rodada crítica independente

O usuário autorizou um agente no papel de designer crítica. Notas por página
são julgamentos qualitativos, não medição de UX nem auditoria humana.
[Rodada 1](docs/kumo/revisao-critica-01.md) registra problemas e critérios de 8/10.
A próxima rodada precisa de Inter, escala tipográfica e grade comum, dashboard
com dados completos, transações compactas e demo pública isolada.

## Cinco superfícies obrigatórias

| Superfície | Estado atual |
| --- | --- |
| Tipografia | Bloqueada: corpo/valores/metadados achatados em14; usuário prefere Inter e tamanho maior. |
| Espaço e alinhamento | Bloqueada: busca, ações, status e chevron em eixos concorrentes; falta revisão da grade de todas as páginas. |
| Cor e contraste | Bloqueada: medir pares efetivos e reforçar neutros; cor reservada a estado/ação relevante. |
| Imagens e ícones | Ícones reais Phosphor; assets bancários sem consumidor operacional removidos. Captura Sync móvel rejeitada por escala/crop. |
| Copy e conteúdo | Semântica financeira e textos legais preservados; revisar densidade e descoberta sem esconder parcialidade. |

## Evidência e limites

Capturas intermediárias em [índice](docs/kumo/capturas/README.md). Desktop e
celular foram exercitados, inclusive conta/parcelas/filtros/editores abertos,
rascunho, erro, busy, salvamento sintético e teclado do menu. Captura em estado
carregando ou com escala/crop incorreto não pode provar polimento.

Preview usa componentes compilados reais com APIs sintéticas. Os testes de
persistência são locais e separados. Nenhuma evidência aqui comprova Pluggy,
OAuth real, produção, host MCP ou acessibilidade completa. O produto publicado
permanece sem alteração: não houve push/deploy.
