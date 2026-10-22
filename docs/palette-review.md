# Paleta e revisão transversal do produto

Revisão local em 22/10/2026, branch `codex/palette-product-review`.

## Resultado

A identidade mantém Hanken Grotesk, preto e laranja. Cores auxiliares agora têm
papel explícito: sucesso, atenção, erro, informação e séries de dados. Cada
estado continua identificado por texto. Valores financeiros não recebem cores
de sucesso ou erro automaticamente.

`src/web/design-tokens.ts` é a fonte única de cores e sombras para páginas SSR,
workspace e galeria. O [sistema visual](design-system.md) documenta os valores,
espaçamentos, tipografia, composição e estados. A referência executável fica
em `/account/design-system`, com amostras, valores HEX, níveis de profundidade,
controles e campos normais, inválidos e desabilitados.

As superfícies usam quatro níveis de sombra: base sem sombra, baixa em filtros
e grupos, elevada em dicas e pública em landing/login. A luminosidade continua
separando as camadas. O painel mantém a densidade compacta; a conversa financeira
permanece no assistente MCP.

## Problemas corrigidos

1. Falha e pendência compartilhavam a mesma cor. Agora erro usa vermelho suave,
   pendência usa âmbar e execução usa azul, sempre com rótulo.
2. Bordas decorativas também delimitavam campos e controles. `--control-border`
   dá contraste aos controles; `--line` preserva divisórias discretas.
3. A variante secundária do Kumo impunha texto e opacidade, anulando os estados
   destrutivo e desabilitado. Os adaptadores mapeiam `primary` e `secondary` para
   `outline`; os estados visuais vêm da base do produto.
4. Seleções, mensagens, sombras e gráficos usavam definições locais. Agora usam
   tokens compartilhados. Titulares e valores financeiros permanecem neutros.
5. O consentimento descrevia somente consulta/importação. O texto agora informa
   o acesso à instalação inteira e as operações de organização disponíveis,
   incluindo alterações/exclusões. Contratos e permissões não foram alterados.

## Cobertura por página

Todas as páginas abaixo foram abertas com dados sintéticos. As capturas finais
compactas usam o viewport padrão estável observado: `innerWidth=564`, largura
do documento de 551 px. Nas oito páginas do workspace, `scrollWidth=551` também:
não houve rolagem horizontal da página. Tabelas extensas mantêm rolagem interna.

| Página | Revisão e estado observado | Captura compacta final |
| --- | --- | --- |
| Landing `/` | Hierarquia, CTAs, exemplo fictício, passos, FAQ, sombras | `29-landing-compact.jpg` |
| Login `/account/login` | Origem da instalação, campo e CTA; erro visto também em desktop | `40-login-compact.jpg` |
| Consentimento `/authorize` | Escopo, destino, aviso informativo, autorizar/negar | `39-consent-compact.jpg` |
| Visão geral `/account` | Pessoas, titulares, contas e navegação selecionada | `31-overview-compact.jpg` |
| Transações `/account/transactions` | Filtros, cobertura, legibilidade e valores neutros | `32-transactions-compact.jpg` |
| Regras `/account/rules` | Estado ativo neutro, prioridade e detalhes | `33-rules-compact.jpg` |
| Grupos `/account/groups` | Hierarquia, agrupamento e profundidade baixa | `34-groups-compact.jpg` |
| Sincronizações `/account/sync` | Estados distintos e detalhes das rodadas | `35-sync-compact.jpg` |
| Conexões `/account/connections` | Perfis, titulares, avisos e controles indisponíveis | `36-connections-compact.jpg` |
| Auditoria `/account/audit` | Autorizações, volume, modelo declarado, falhas e revogação | `37-audit-compact.jpg`, `30-revoke-confirm-final.jpg` |
| Referência `/account/design-system` | Tokens, tipografia, sombras, controles e séries | `38-gallery-compact.jpg`, `41-palette-final.jpg` |

Capturas e relatório HTML ficam em `work/palette-review/`, ignorado pelo Git.
`report.html` reúne as evidências aceitas, incluindo capturas desktop e estados
específicos. A designer revisou a landing final, a confirmação de revogação e as
oito páginas compactas; não encontrou novos bloqueios visuais nesses estados.
Na lista longa de transações, a inspeção cobre composição e estrutura, não cada
registro individual.

## Contraste e interação

Cálculo sRGB dos tokens, sem arredondamento intermediário:

| Par | Razão de contraste |
| --- | --- |
| Sucesso: texto/fundo | 8,89:1 |
| Atenção: texto/fundo | 9,21:1 |
| Erro: texto/fundo | 8,12:1 |
| Informação: texto/fundo | 8,80:1 |
| Borda de controle sobre superfície pressionada | 3,18:1 |
| Texto primário: normal / hover / pressionado | 7,29:1 / 9,13:1 / 5,77:1 |
| Texto destrutivo: normal / hover / pressionado | 8,12:1 / 6,84:1 / 5,92:1 |

Os estilos computados de 12 exemplos reais de botão foram confrontados com os
tokens: primário, secundário e destrutivo, em estados normal, hover, pressionado
e desabilitado. Os pares de texto/fundo dos quatro avisos também foram conferidos
no DOM. O Tab moveu o foco para uma ação secundária com `:focus-visible` e contorno
laranja. Isso não constitui auditoria WCAG completa nem teste com leitor de tela.

A confirmação de revogação foi aberta e cancelada, sem revogar a autorização de
exemplo. Login, saída e retorno ao painel foram executados. O consentimento foi
aberto com cliente OAuth sintético local; nenhuma autorização nova foi aprovada.
Motion reduzido foi conferido no CSS; as imagens não comprovam animações.

## Verificação técnica e limites

`mise run check` passou: 19 testes Node, 75 testes de integração em 14 arquivos e
suíte nativa Workflow/D1 com 10 mil e 100 mil transações. O cenário de 100 mil
terminou em 37.953 ms, com pico workerd de 418.552 KiB. Após o ajuste final de
variante Kumo, `check:quick` e `build:portal` passaram novamente. `git diff --check`
passou. A alteração não adiciona dependências, migrações ou mudanças no cálculo
financeiro.

A checagem anterior do DOM em 390 px não indicou transbordamento, mas o override
do navegador produziu capturas cortadas. Essas imagens foram rejeitadas e não
sustentam aprovação visual nessa largura. O override foi removido; as capturas
finais íntegras comprovam o layout compacto de 564 px. A homologação visual em
390 px continua pendente em um navegador sem esse defeito de captura.

O preview usa somente dados e credenciais sintéticos em `127.0.0.1:8793`.
O servidor original de `localhost:8787` e as alterações do checkout principal
foram preservados. Nenhum push, deploy, merge ou migração remota foi realizado.
Pluggy real, novo deploy e autorização em host MCP externo não foram revalidados
nesta revisão visual.
