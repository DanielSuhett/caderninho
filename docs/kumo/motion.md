# Movimento — rodada 05

24/10/2026. Implementação local na branch `codex/kumo-refactor`, Kumo 2.14.0.
[Revisão independente](revisao-critica-05-motion.md) e
[capturas](capturas/README.md). Nenhuma dependência foi adicionada nesta rodada.

## Política e implementação

| Superfície | Movimento | Condição |
| --- | --- | --- |
| Hero público | Entrada de 400ms/6px, atrasos de 0/40/80/120ms | Somente sem preferência de movimento reduzido |
| Seções públicas | Revelação única de 280ms/8px, opacidade 0,75 → 1 | Conteúdo visível por padrão; IntersectionObserver não bloqueia leitura |
| Conteúdo do painel/demo | Entrada de 180ms/6px | Wrapper da página; sem cascata de linhas nem interpolação monetária |
| Sidebar, Dialog e Collapsible | Transições funcionais nativas | Painéis permanecem montados; CSS local neutraliza painel/caret sob redução |
| Consulta MCP | Quatro etapas de 2,4s; conector ativo de 700ms | Reprodução finita de 9,6s de tempo ativo, pausável e repetível |

O wrapper privado reinicia quando a rota, inclusive sua query, muda. A demo usa
a mesma entrada no carregamento. Não há transição autoral de cores, shimmer
decorativo, count-up monetário ou números intermediários inventados.

O Flow real desenha nós e conectores; não há grafo SVG artesanal. São usados
`Flow.Node`, orientação horizontal/vertical e `canvas={false}`, preservando a
rolagem normal da página. A página explica pergunta → verificação de acesso →
cópia no D1 → dados ao cliente. Consentimento inicial e sincronização Pluggy
ficam explicitamente separados da consulta. Quem prepara a resposta de IA é o
cliente escolhido pelo usuário. O exemplo não executa uma chamada real.

Todos os textos ficam disponíveis desde o início. O HTML estático permanece
legível sem JavaScript e se o chunk opcional falhar. A melhoria carrega perto da
seção; a sequência inicia uma vez ao entrar na área. Pausar, Continuar, Repetir
e Sem animação controlam o mesmo diagrama, sem ocultar explicações. Sair da área
ou ocultar a aba suspende o temporizador; ao voltar, a duração da etapa recomeça.
Não é um indicador de progresso de serviço.

O breakpoint de 1100px é compartilhado pelo fallback e pelo Flow. Em 320px,
os nós descontam também o espaço da scrollbar; alturas podem crescer para
acomodar o corpo de 16px. Controles ficam em coluna até 360px.

## API instalada e custo

A [documentação oficial do Flow](https://kumo-ui.com/components/flow/) foi
consultada. `kumo doc Flow` não encontra o componente no registro da CLI 2.14.0;
os exports, tipos e implementação instalados confirmam a API usada em
`@cloudflare/kumo/components/flow`. Não foi instalada outra versão para contornar
essa diferença. O CSS do conector depende do `data-index` emitido por essa versão,
sempre sob `.mcp-flow`; revisar essa adaptação ao atualizar o pacote.

No build local, `landing.js` tem 1,35kB bruto/0,79kB gzip. O chunk específico do
Flow tem 155,32kB bruto/50,61kB gzip, além dos chunks compartilhados. Esses números
são tamanhos do build, não bytes totais de rede nem medição de desempenho. Flow
e sua dependência de motion ficam no import dinâmico, fora do entry inicial.
Os arquivos são copiados tanto para os assets do Worker quanto para o site.

## Verificações realizadas

| Recorte | Evidência observada |
| --- | --- |
| Reprodução finita e controles | Sequência chegou a Repetir; pausa permaneceu na mesma etapa entre leituras; retomada avançou à etapa seguinte |
| Conectores | CSS computado `mcp-request`, 0,7s e offsets distintos; somente o conector de entrada da etapa ativo |
| Fora da área | Em `#free-tier`, `data-playing=false`, paths sem animação e etapa preservada entre leituras; voltar não reiniciou o fluxo |
| Versão estática | Sem animação definiu etapa -1; HTTP 503 sintético no chunk preservou quatro explicações HTML, sem Flow montado |
| Layout | Desktop 1440×900; móvel 391×845 e 320×845; limites 1090px e 1101px. Sem extrapolação horizontal nos estados finais |

Em 320px houve um defeito real: o Flow cortava aproximadamente 15px dos nós,
apesar de o documento não ter overflow. A captura inicial foi rejeitada.
Após a correção, viewport CSS 320px/clientWidth 305px; Flow entre x20 e x284,84;
os quatro nós entre x24,42 e x280,42, com 256px de largura. As alturas foram
112/112/128/112px. A imagem corrigida mostra topo e dois nós; a geometria dos
quatro foi lida no DOM. Em 391px, as imagens superior/inferior mostram o conjunto.

Também foram vistos Transações privadas, Dialog de filtros e uma regra
expandida com dados sintéticos. Entrada computada de 180ms; Dialog com
transform/opacity de 200ms; Collapsible/caret de 100ms. Escape fechou o Dialog.
Ao navegar a Regras, o foco chegou a `workspace-content`. Não foi confirmada
nesta rodada a restauração imediata do foco ao gatilho após Escape.

As capturas são screenshots, não vídeo. A API de captura redimensiona a imagem:
1440×900 CSS gerou 1425×891 pixels; 391×845 gerou 376×814; 320×845 gerou 305×804.
Geometria e tamanhos de fonte vieram do DOM, não de contagem de pixels na imagem.

## Limites e julgamento

`prefers-reduced-motion` foi tratado em código/CSS, incluindo mudança ao vivo:
sem autoplay, explicação completa e cancelamento de animações via `cancel()`.
A preferência do SO **não foi emulada nesta sessão**. O botão Sem animação não
equivale a essa emulação. O caminho `document.hidden` foi revisado no código,
sem teste direto de ocultação da aba. Não declarar esses dois caminhos aprovados
em runtime. Sidebar/Dialog incluem redução nativa na versão instalada; o
Collapsible recebeu a neutralização local necessária.

A designer crítica abriu 12 imagens e atribuiu 8/10 qualitativo à explicação MCP
e às amostras do painel, sem P1/P2 visual restante nesses estados. Não reavaliou
as 14 páginas nesta rodada. Variação visual baixa, movimento localizado e
densidade moderada no desktop/longa e sequencial no celular são inferências.

`mise run check` final passou: tipos, formato, lint, 44 testes Node, 108 de
integração em 19 arquivos, build/dry-run e runtime local Workflow/D1 com
10 mil/100 mil registros. Permanece o aviso conhecido da dependência opcional
`@emotion/is-prop-valid` do Kumo no runner, sem falha de testes.
Logs locais: `/tmp/kumo-motion-final-check.log`.

Não houve push ou deploy. Evidência local/sintética não comprova produção,
OAuth/Pluggy reais, host MCP, acessibilidade completa ou suavidade em todos os
dispositivos. Código principal: `src/web/mcp-flow.tsx`, `mcp-steps.tsx`,
`landing-entry.ts` e estilos de landing/painel.
