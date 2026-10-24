# Rodada 09 — fixtures e demo interativa

Escopo: quatro páginas públicas da demo no Worker local, com dados sintéticos;
reuso dos componentes reais de Regras/Grupos. Não reaudita as demais páginas do
produto. [Contrato técnico](../../demo-interativa.md) ·
[crítica independente](../../revisao-critica-09-demo.md).

## Páginas e geometria

| Página | Desktop | Celular | Grade |
| --- | --- | --- | --- |
| Visão geral | [imagem](visao-geral-desktop-final.png) | [imagem](visao-geral-mobile-final.png) | [desktop](grade-visao-geral-desktop.png) / [celular](grade-visao-geral-mobile.png) |
| Transações | [imagem](transacoes-desktop-final.png) | [imagem](transacoes-mobile-final.png) / [320](transacoes-320.png) | [desktop](grade-transacoes-desktop.png) / [celular](grade-transacoes-mobile.png) |
| Regras | [imagem](regras-desktop-final.png) | [imagem](regras-mobile-final.png) | [desktop](grade-regras-desktop.png) / [celular](grade-regras-mobile.png) |
| Grupos | [imagem](grupos-desktop-final.png) | [imagem](grupos-mobile-final.png) | [desktop](grade-grupos-desktop.png) / [celular](grade-grupos-mobile.png) |

O DOM foi inspecionado em 1440×1000, 390×843 e 320×843 CSS px. O browser usa
DPR próximo de 1,2; os PNGs são raster e não devem ser usados para inferir o
tamanho CSS da fonte. A leitura DOM confirma corpo 16px e h1 28px. Não houve
overflow horizontal do documento nas larguras conferidas.

`getScreenshot` e captura sem clip produziram inicialmente escala duplicada,
faixas pretas ou corte no IAB. As imagens finais acima foram recapturadas com
`tab.screenshot({clip})` usando os limites físicos do viewport, sem redimensionar
o PNG depois. A primeira leva foi rejeitada pela crítica. Arquivos intermediários
com `reaplicadas-*-final`, `salvar-preserva-historico-mobile` e
`regra-rascunho-descartado-mobile`, além de `grupo-isolado-mobile`, não sustentam geometria;
o relatório distingue as capturas usadas para aprovação.

## Percursos exercitados

1. Regras: expandir, editar categoria, conferir a prévia, salvar e navegar para
   Visão geral. A despesa continuou 4.393,81 BRL. Reaplicar informou 12 mudanças
   nos seis meses; Visão geral passou a 3.337,20 BRL, fluxo ficou 6.057,89 BRL.
   Busca `mercado` mostrou dois débitos reclassificados e o estorno preservado.
2. Rascunho móvel: digitar, Cancelar, Continuar editando, conferir o mesmo nome,
   Cancelar e Descartar. Foco voltou ao gatilho Nova regra. [Editor](regra-editor-mobile.png)
   e [proteção de descarte](regra-descarte-mobile.png).
3. Grupos: criar Casa de exemplo em EUR, início dia 15; expandir e editar;
   moeda permaneceu bloqueada com explicação. Filtro exibiu três categorias em
   português. [Grupo](grupo-criado-mobile.png) e [editor](grupo-editor-mobile.png).
4. Isolamento: Ver transações manteve o grupo e o mês em `/demo`, mostrou o
   grupo pelo nome e nenhum lançamento pessoal. Voltar ao Pessoal recuperou
   17 transações, incluindo as reclassificações. O DOM confirma o percurso;
   a captura intermediária do estado isolado tem a limitação de escala citada acima.
5. Reset e reload: Restaurar demo mostrou os indicadores iniciais; testes
   verificam também a remoção dos grupos criados. Reload da URL do grupo
   mostrou recuperação explícita, sem confundir um grupo
   ausente com um grupo válido vazio. [Restauração](demo-restaurada.png) e
   [grupo indisponível](grupo-indisponivel.png).

Reaplicação sem mudanças explica que as 12 correspondências já tinham a categoria.
Os testes complementam a UI com regra pausada, prioridade e empate, AND/OR,
idempotência, moeda/conta, ignorados, null, zero, cancelamento e reset isolado.

## Histórico e limites

As seis capturas iniciais de 900×617 — `regras-inicial`, `visao-geral-antes`,
`salvar-preserva-historico`, `regras-reaplicadas`, `visao-geral-reaplicada` e
`transacoes-reclassificadas` — documentam o primeiro percurso funcional. Regras
ainda exibia Limpar indevido e copy anterior. Não representam o acabamento final.

São dados e runtime locais. Nenhum OAuth, provider, host MCP, banco real,
publicação ou auditoria completa de acessibilidade foi validado por essas imagens.
