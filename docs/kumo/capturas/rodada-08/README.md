# Capturas da rodada 08

24/10/2026. Build local com dados sintéticos. As 14 primeiras dobras foram
inspecionadas em 1440×900 e aproximadamente 391×845 CSS, com e sem grade.
Não é cobertura de todos os estados ou de toda a altura de cada página.
[Relatório](../../polimento-08.md) · [revisão independente](../../revisao-critica-08-polimento.md).

## Páginas e grades

| Página / rota | Desktop | Celular | Grade desktop / celular |
| --- | --- | --- | --- |
| Visão geral · `/account` | [1440](visao-geral-1440.png) | [391](visao-geral-390.png) | [12 colunas](visao-geral-1440-grid.png) / [4 colunas](visao-geral-390-grid.png) |
| Transações · `/account/transactions` | [1440](transacoes-1440.png) | [391](transacoes-390.png) | [12 colunas](transacoes-1440-grid.png) / [4 colunas](transacoes-390-grid.png) |
| Regras · `/account/rules` | [1440](regras-1440.png) | [391](regras-390.png) | [12 colunas](regras-1440-grid.png) / [4 colunas](regras-390-grid.png) |
| Grupos · `/account/groups` | [1440](grupos-1440.png) | [391](grupos-390.png) | [12 colunas](grupos-1440-grid.png) / [4 colunas](grupos-390-grid.png) |
| Sincronizações · `/account/sync` | [1440](sincronizacoes-1440.png) | [391](sincronizacoes-390.png) | [12 colunas](sincronizacoes-1440-grid.png) / [4 colunas](sincronizacoes-390-grid.png) |
| Conexões · `/account/connections` | [1440](conexoes-1440.png) | [391](conexoes-390.png) | [12 colunas](conexoes-1440-grid.png) / [4 colunas](conexoes-390-grid.png) |
| Auditoria MCP · `/account/audit` | [1440](auditoria-1440.png) | [391](auditoria-390.png) | [12 colunas](auditoria-1440-grid.png) / [4 colunas](auditoria-390-grid.png) |
| Referência visual · `/account/design-system` | [1440](referencia-1440.png) | [391](referencia-390.png) | [12 colunas](referencia-1440-grid.png) / [4 colunas](referencia-390-grid.png) |
| Landing · `/` | [1440](landing-1440.png) | [391](landing-390.png) | [12 colunas](landing-1440-grid.png) / [4 colunas](landing-390-grid.png) |
| Acesso · `/account/login` | [1440](acesso-1440.png) | [391](acesso-390.png) | [12 colunas](acesso-1440-grid.png) / [4 colunas](acesso-390-grid.png) |
| Consentimento · `/authorize` | [1440](consentimento-1440.png) | [391](consentimento-390.png) | [12 colunas](consentimento-1440-grid.png) / [4 colunas](consentimento-390-grid.png) |
| 404 · `/nao-existe` | [1440](404-1440.png) | [391](404-390.png) | [12 colunas](404-1440-grid.png) / [4 colunas](404-390-grid.png) |
| Demo · `/demo/?month=2026-10` | [1440](demo-1440.png) | [391](demo-390.png) | [12 colunas](demo-1440-grid.png) / [4 colunas](demo-390-grid.png) |
| Demo Transações · `/demo/transactions?month=2026-10` | [1440](demo-transacoes-1440.png) | [391](demo-transacoes-390.png) | [12 colunas](demo-transacoes-1440-grid.png) / [4 colunas](demo-transacoes-390-grid.png) |

## Estados adicionais vistos

| Área | Evidência e limite |
| --- | --- |
| Ledger | [antes](transacoes-antes-desktop.png), [50 registros depois](transacoes-depois-desktop.png), [extremos 320](transacoes-extremos-320.png), [zero/nulo/divergente/pendente/ignorada](transacoes-estados-320.png), [1000](transacoes-1000-grid.png), [vazio](transacoes-vazio-390.png), [bootstrap](transacoes-carregando-390.png). Só o trecho enquadrado, não todas as 50 linhas. |
| Regras | [composição desktop](regras-depois-desktop.png), [expandida móvel](regras-expandida-390.png), [editor](regras-editor-390.png), [pausada](regras-pausada-1440.png), [máximo início](regras-max-320.png), [máximo condições](regras-max-condicoes-320.png), [reflow equivalente](regras-reflow-720x450.png), [erro](regras-erro-390.png), [recuperação](regras-recuperacao-390.png). Máximo exige rolagem longa; reflow não é zoom nativo. |
| Operação | [grupo](grupos-expandido-390-grid.png), [editor grupo](grupos-editor-390.png), [histórico](sincronizacoes-expandida-390-grid.png), [gestão](conexoes-gerenciar-390-grid.png). Nenhuma conexão ou gravação real. |
| Auditoria | [grant](auditoria-expandida-390-grid.png), [confirmação cancelada](auditoria-confirmacao-390.png), [dados](auditoria-dados-390-grid.png), [2×2 em 1000](auditoria-1000.png). Capturas de expansões precedem a correção óptica das métricas; as imagens gerais atuais mostram o resultado final. |
| Público/demo | [Worker local, 17 registros](demo-transacoes-worker.png), [ramo reduced motion simulado](mcp-reduced-simulado.png). Sem OAuth/Pluggy reais, preferência nativa do SO ou produção. |

## Instrumentação

[Editor antes](performance-editor-antes.json), [editor depois](performance-editor-depois.json),
[ledger inicial antes](performance-antes-inicial.json), [depois](performance-depois-inicial.json),
[interações antes](performance-antes-interacoes.json), [depois](performance-depois-interacoes.json),
[rede lenta](performance-rede-lenta.json), [movimento reduzido](motion-reduced.json) e
[geometrias](geometrias.json). Geometrias incluem recapturas/duplicatas; não são
estados únicos. rAF/Fiber local não equivale a paint, React Profiler, FPS ou INP.
A baseline de interações do ledger tem DPR/janela distintos e não é usada para
percentual de latência. Instrumentação temporária não integra o produto.

## Intermediários e rejeições

`transacoes-depois-mobile.png` é intermediário rejeitado: tinha segunda barra
vertical, corrigida por containing block do main. As imagens atuais `transacoes-390`
e `transacoes-extremos-320` têm uma área de rolagem. Contatos JPG são índices
intermediários, não provas do estado final; podem mostrar a grade que ativava
Limpar indevidamente ou skeleton mensal. Imagens individuais foram recapturadas.

A primeira captura do máximo estava anterior ao posicionamento do Flow e foi
substituída. As grades privadas atuais não ativam Limpar. Estados expandidos
anteriores à correção do modo grade servem para conteúdo interno, não para essa
comparação de toolbar. Acesso móvel com recorte incorreto também foi substituído.
