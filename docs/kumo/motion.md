# Movimento da interface

Política para o Kumo 2.14.0. Textos e alternativas estáticas permanecem
disponíveis quando o módulo opcional não carrega.

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
