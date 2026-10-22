# Revisão geométrica da navegação — 22/10/2026

## Correção

O menu anterior tinha quatro centros horizontais diferentes: 36,84 / 41,26 / 40 / 30,84 px no viewport de 564 px. A borda estrutural do item ativo, o padding herdado do Kumo e as margens globais de button causavam deslocamentos. A revisão visual anterior não havia medido essas diferenças.

Agora sidebar-control compartilha CSS Grid entre links e botão Sair. Menu usa a mesma geometria. O estado ativo usa sombra interna sem deslocar conteúdo. As regras de navegação foram concentradas em um bloco; o breakpoint redundante de 1000 px foi removido. O wrapper do drawer continua no DOM quando seu gatilho desaparece no desktop.

## Evidência local

| Viewport solicitado / observado | Rail | Alvo | Centro dos ícones | Desvio entre centros | Overflow |
| --- | --- | --- | --- | --- | --- |
| 390 / 391 | 56 | 44×44 | 40 | 0 | 0 |
| 564 / 564 | 56 | 44×44 | 40 | 0 | 0 |
| 760 / 760 | 208 | 196×44 | 60 | 0 | 0 |
| 761 / 761 | 208 | 196×44 | 60 | 0 | 0 |
| 1000 / 1000 | 208 | 196×44 | 60 | 0 | 0 |
| 1001 / 1001 | 208 | 196×44 | 60 | 0 | 0 |
| 1280 / 1280 | 208 | 196×44 | 60 | 0 | 0 |

Valores em CSS px, obtidos por getBoundingClientRect. O navegador arredonda innerWidth: solicitado 759 também informou 760, mas matchMedia(max-width:760px) foi verdadeiro e o rail mediu 56. Portanto a linha solicitada 760 não prova uma largura fracionária exata de 760. Ambos os lados da mudança foram observados.

Em todos os cenários, o topo do primeiro controle coincide com o conteúdo, ícones medem 20×20, intervalos entre destinos e entre Referência/Sair medem 4 px (erro flutuante inferior a 0,001 px). Toggle→primeiro destino 12 px. Rodapé: 16 px até o divisor, borda nominal 1 px (rasterizada 0,84 px neste navegador) e 12 px até Referência. Assertions sobre o JSON verificaram dimensões, centros, topo, intervalos e ausência de overflow nos sete cenários.

No drawer mobile, os nove controles mediram 44 px de altura, centro do ícone 38 px, texto começando em 60 px e distância ícone→texto 12 px. Escape fechou, restaurou foco no gatilho e liberou a rolagem. Redimensionar com drawer aberto para 1280 manteve o diálogo visível e Escape continuou funcionando. Foco de teclado foi capturado no rail, sem corte; o CSS define outline de 2 px / offset de 3 px.

Capturas e JSON locais em work/list-review/navigation-{desktop,mobile,drawer}.jpg e navigation-measurements.json. A captura mobile inclui o foco de teclado. Evidência sintética local, sem alteração em dados reais ou teste de provedores/hosts MCP. Nenhum push ou deploy.

## Parecer e validação técnica

A designer conferiu o JSON e as três capturas finais e aprovou a geometria nos estados apresentados. Não encontrou outro defeito concreto nessas capturas. As interações de teclado e resize foram executadas pelo agente implementador; não houve segunda execução independente pela designer.

`mise run check` terminou com código 0: tipos, lint, formatação, 19 testes Node, 75 testes de integração, build dry-run e runtime nativo Workflow/D1 com 10 mil e 100 mil transações. A checagem de formatação foi repetida após finalizar a documentação. As listas de contas, regras, grupos e sincronizações preservam o disclosure pelo item inteiro da revisão anterior.
