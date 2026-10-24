# Revisão crítica 05 — movimento e explicação MCP

24/10/2026. Revisão independente por agente no papel de designer crítica.
**Resultado: 8/10 para a explicação MCP e 8/10 para as entradas/estados do painel
amostrados, com os limites abaixo.** A análise combina código atual e somente
as imagens efetivamente abertas. Uma captura não comprova uma animação inteira.
Movimento reduzido do SO não foi emulado e não recebeu aprovação de runtime.
Esta rodada não reatribui nota às 14 páginas anteriores. É julgamento qualitativo
de agente, sem aprovação humana ou medida de satisfação.

## 1. Critério e fontes lidas

Foram lidos `DESIGN.md`, `src/web/landing-view.tsx`,
`src/web/styles/design.css`, `src/web/styles/landing.css`,
`src/web/account/disclosure-item.tsx`, `src/web/account.css`,
`src/web/landing-entry.ts`, `src/web/mcp-flow.tsx` e `src/web/mcp-steps.tsx`.

A skill kumo-design foi aplicada nos critérios de transição de cor imediata,
conteúdo estável no Collapsible e Dialog sempre montado. A preferência explícita
do usuário por conteúdo legível de 16px prevalece sobre o corpo de 14px da skill.

Flow foi confirmado nos exports, tipos e implementação do Kumo instalado
2.14.0. Há `Flow`, `Flow.Node`, orientação e `canvas`; a ausência na CLI não
autoriza concluir que inexiste no pacote. `canvas=false` evita o tratamento de
wheel do canvas nesta versão. Flow.Node depende de medição no cliente, portanto
a alternativa estática antes do JavaScript é uma condição real.

## 2. Plano avaliado

1. Explicar uma consulta ao histórico: pergunta no cliente, verificação de acesso
   no Worker, leitura da cópia sincronizada no D1 e retorno de dados ao cliente.
2. Mostrar OAuth/consentimento inicial e sincronização Pluggy como preparação;
   não sugerir consulta ao banco em tempo real por pergunta nem IA no Worker.
3. Manter todos os textos legíveis desde o início, com HTML estático antes do
   chunk opcional e em caso de falha; orientação vertical no celular, sem pan.
4. Reproduzir uma sequência finita ao entrar na região, com pausa/continuação,
   repetição e opção estática; pausar fora da área e em aba oculta.
5. Usar entradas curtas no conteúdo do painel e transições funcionais Kumo,
   sem count-up monetário, cascata de linhas ou shimmer decorativo.

O plano é adequado ao objetivo. A reprodução proposta de quatro etapas de
2,4s é aceitável como ilustração pausável, pois a leitura não depende da espera.
São parâmetros de implementação, não medidas de compreensão ou desempenho.

## 3. Evidência visual e temporal

Foi aberta com `view_image`:
`docs/kumo/capturas/rodada-05/mcp-desktop-pausado.jpg`.

A imagem mostra etapa 1/4, botão Continuar, opção Ver tudo, os quatro nós e a
preparação abaixo. É evidência de um estado pausado. A persistência dessa pausa
após cerca de nove segundos foi informada pelo executor; não foi observada por
esta revisão em reprodução contínua.

O último nó aparece mais alto por quebra do título, enquanto os demais alinham
pelo centro. Essa primeira captura é histórica desse problema.

Depois foram abertas `mcp-desktop-revisado.jpg`,
`mcp-desktop-reproduzindo.jpg`, `mcp-mobile-superior.jpg` e
`mcp-mobile-inferior.jpg`. O desktop revisado mostra quatro nós da mesma altura,
título Dados ao cliente e conteúdo de tamanho maior. As duas imagens móveis
mostram os quatro nós em orientação vertical e a preparação separada. Não há
necessidade visível de pan nem corte horizontal nesses recortes.

A região de título/exemplo dos dois novos desktops foi comparada em leitura
de pixels com a primeira imagem: AE=0 no recorte 1100×130 em x170/y275. Os
textos dessa região permanecem idênticos; a comparação não foi usada para
deduzir movimento ou comportamento interativo.

O executor informou amostras temporais: pausa manteve etapa 1/4, retomada
observou conector ativo e animação mcp-request de 700ms, avançou à etapa seguinte
e, fora da área, data-playing=false e paths sem animação. A etapa permaneceu ao
voltar. Isso sustenta propriedades delimitadas do runtime conforme a observação
do executor; não é vídeo contínuo de suavidade ou estudo de compreensão.

Depois foram abertas `mcp-1090.jpg`, `mcp-1100.jpg`, `mcp-fallback-503.jpg`,
`transacoes-entrada-desktop.jpg`, `filtros-desktop.jpg` e
`regra-expandida-desktop.jpg`. O primeiro limite mostra a sequência vertical;
o segundo, os quatro nós horizontais sem corte. A captura de falha do chunk
mostra os quatro textos estáticos legíveis, sem exigir reprodução para entender.
HTTP 503, fallback presente e Flow ausente no DOM foram informados pelo executor.

As imagens do painel mostram Transações estabilizada, Dialog de filtros inteiro
e regra expandida, preservando a composição. O executor informou wrapper com
content-arrive de 0,18s, Dialog com transform/opacity de 0,2s, fechamento por
Escape, foco em workspace-content ao navegar e painel/caret de 0,1s. Isso não
substitui uma gravação contínua de todas as interações.

**Rejeitada pelo executor:** a primeira `mcp-320.jpg` tinha 15px do Flow cortados,
apesar de não haver overflow do documento. Esta revisão não abriu nem usou essa
imagem como prova final. O executor corrigiu a largura para descontar a scrollbar
e reservou altura/arranjo de controles na largura estreita.

Foi aberta `mcp-320-corrigido.jpg`. O topo, os controles em coluna e os dois
primeiros nós aparecem íntegros e legíveis; o terceiro começa abaixo da dobra.
Essa imagem não mostra o final da sequência em 320px. O executor informou
clientWidth de 305px para viewport CSS de 320px, Flow entre x20 e x284,84 e os
quatro nós entre x24,42 e x280,42, sem extrapolar a área. As alturas variam para
preservar texto de 16px; a geometria complementa a captura, sem ser confundida
com inspeção visual dos nós inferiores nessa largura. Em 391px, o conjunto
superior/inferior já havia mostrado os quatro nós e a preparação.

Total: 12 imagens abertas nesta rodada, incluindo a primeira versão histórica.

O executor informou que a API de browser disponível não permite emular a
preferência de movimento reduzido do SO. Esse estado continuará com validação
de código/CSS, sem inventar uma simulação equivalente a partir do botão manual.

## 4. Achados e correções solicitadas

**P2 — explicação principal em fonte de metadado.** A regra
`.mcp-flow-node p` usa `--type-meta`, 14px. Esse texto explica cada ação do
diagrama, portanto deve seguir o conteúdo de 16px do DESIGN e a preferência do
usuário. **Resolvido:** o CSS agora usa `--type-body`; o executor confirmou
16px no DOM e as capturas revisadas mostram o texto maior, com altura comum
de 144px no desktop. Caption e preparação permanecem subordinados.

**P2 — rótulo que promete revelar conteúdo já visível.** Ver tudo executa
`showAll`, que encerra ciclo/destaque e troca a legenda, mas não revela nós
escondidos. **Resolvido:** o rótulo agora é Sem animação, visível nas capturas
novas. Descreve o estado de reprodução sem prometer conteúdo adicional.

**P2 preventivo — salto na troca do fallback.** O primeiro código estático
usava viewport de 1100px, enquanto o Flow escolhia horizontal pelo contêiner
de 1008px. Na faixa de viewport 1072–1099px, isso podia trocar uma lista vertical
por uma faixa horizontal após hidratar, com grande alteração de altura.
**Resolvido no código e nas amostras vistas:** foi unificado via matchMedia
de 1100px, e as capturas de 1090/1100 usam a orientação correspondente.
Não foi medido CLS no carregamento; o risco inicial não foi apresentado como
bug já visto em imagem.

**Estado que deve permanecer:** o Collapsible usa painel montado e transição
nativa. O pacote instalado aplica height/opacity e caret em 100ms sem redução
explícita nessas classes. O CSS local agora neutraliza painel/caret sob movimento
reduzido; o runtime ainda precisa confirmar o resultado, assim como Dialog e
Sidebar usados no painel. A implementação instalada de Sidebar tem matchMedia
e motion-reduce:transition-none; LayerDialog usa a mesma redução em backdrop,
popup e condensação. Isso confirma a política no código nativo, sem alegar
execução com a preferência do SO. No tratamento JS de troca de preferência,
`animation.finish()` foi substituído por `cancel()`, evitando a hipótese de
InvalidStateError ao tentar finalizar uma animação infinita.

## 5. Julgamento final e limites

| Recorte | Julgamento | Evidência e limite |
| --- | --- | --- |
| Explicação MCP desktop | 8/10 | Quatro nós alinhados, corpo maior, estados pausado/reproduzindo/completo e fallback; não é vídeo contínuo |
| Explicação MCP móvel | 8/10 | Quatro nós e preparação em 391px; topo corrigido em 320px, com geometria dos quatro nós informada pelo executor |
| Entradas e superfícies do painel amostradas | 8/10 | Transações, Dialog de filtros e regra expandida estáveis; duração, Escape e foco observados pelo executor |
| Movimento reduzido do SO | Sem aprovação de runtime | Política verificada em código/CSS; não foi emulada nesta sessão e botão manual não equivale à preferência do SO |

Não resta P1/P2 visual nos estados efetivamente vistos. A consulta ilustrativa
se mantém compreensível sem acompanhar o ciclo, e o movimento tem uma função
explicativa delimitada. Não atribuo nota maior nem afirmo suavidade universal:
as amostras temporais não equivalem a reprodução contínua em todos os dispositivos.

O código limita a sequência às quatro etapas, termina e oferece repetição;
pausa/retomada e interrupção fora da área têm amostras temporais relatadas. Não
foi cronometrado por esta revisão um ciclo completo nem executada aqui a troca
da preferência do SO ou o comportamento de aba oculta. Esses limites permanecem
explícitos, sem converter inspeção de código em teste realizado.

Variação visual: baixa, com destaque de etapa localizado. Movimento: localizado
ao nó/conector, conforme código e amostras relatadas; suavidade ainda não
pontuada. Densidade: moderada no desktop, sequencial e longa no celular. Todos
os textos móveis ficam disponíveis sem esperar o ciclo. Essas leituras são
inferências qualitativas. Nada nesta revisão comprova produção, OAuth real,
host MCP, acessibilidade completa ou consulta real executada pelo exemplo da
landing. Os gates automáticos informados pelo executor não determinaram a nota.

Próxima ação de revisão humana, em até dois minutos: abrir a seção MCP da
landing e acionar Sem animação para julgar a clareza da explicação estática.
