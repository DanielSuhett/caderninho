# Revisão crítica 03 — imagens atuais e acabamento

24/10/2026. Revisão independente por agente no papel de designer crítica.
As notas são julgamentos qualitativos das superfícies efetivamente vistas;
não são medição, pesquisa com usuários ou aprovação humana.

**Resultado: critério visual de 8/10 atingido nas 14 superfícies, limitado aos
estados efetivamente inspecionados abaixo. Não restam P1/P2 materiais nesses
estados. É julgamento de agente, não aprovação humana ou garantia de produção.**
A rodada 02 foi tratada como histórico, nunca como evidência da UI atual.

## Evidência aceita e rejeitada

Foram abertos com `view_image` os 28 arquivos iniciais de
`docs/kumo/capturas/rodada-03/`: versões `-desktop.jpg` e `-mobile.jpg` de
Visão geral, Transações, Regras, Grupos, Sincronizações, Conexões, Auditoria,
Referência, landing, acesso, consentimento, 404, demo e demo-transações.

Também foram abertos os estados móveis `demo-categorias-mobile.jpg`,
`demo-grafico-mobile.jpg`, `demo-valores-exatos-mobile.jpg`,
`demo-recentes-mobile.jpg` e `demo-conta-expandida-mobile.jpg`.

Na sequência foram abertos `auditoria-mobile-corrigida.jpg`,
`auditoria-metricas-mobile.jpg`, `auditoria-inferior-mobile.jpg`,
`auditoria-grant-mobile.jpg`, `auditoria-confirmacao-mobile.jpg` e
`consentimento-header-mobile.jpg`.

Depois foram abertos `regra-expandida-mobile.jpg`, `regra-editor-mobile.jpg`,
`regra-rascunho-mobile.jpg` e `auditoria-requisicoes-mobile.jpg`.

Também foram abertos `regra-rascunho-mobile-corrigido.jpg`,
`regra-exclusao-mobile.jpg`, `grupo-editor-mobile.jpg`,
`grupos-etiquetas-mobile.jpg`, `sincronizacao-expandida-mobile.jpg`,
`conexoes-gerenciar-mobile.jpg` e `conexoes-mcp-mobile.jpg`.

Foram inspecionadas ainda `conexoes-gerenciar-mobile-corrigido.jpg` e
`conexoes-mcp-mobile-corrigido.jpg`. O mapeamento atualizado de
`src/web/design-tokens.ts` foi conferido para a legenda de accent.

`auditoria-inferior-mobile-corrigida.jpg` foi aberta para conferir o alinhamento
dos valores nos registros responsivos de modelos e clientes.

Foram abertas e aceitas `auditoria-confirmacao-mobile-estavel.jpg` e
`conexoes-pessoas-mobile-completo.jpg`. A primeira mostra título, consequência e
ambas as ações de revogação. A segunda mostra campos e ações de pessoas em linhas
próprias, com texto íntegro e separação visível.

Foram abertos `transacoes-filtros-mobile.jpg`, `transacoes-parcelas-mobile.jpg`,
`visao-geral-calculo-mobile.jpg`, `visao-geral-contas-mobile.jpg`,
`referencia-tokens-mobile.jpg`, `referencia-controles-mobile.jpg`,
`referencia-feedback-mobile.jpg` e `transacoes-calendario-mobile.jpg`.

**Defeito real confirmado:** a primeira captura de calendário mostra a matriz de
dias sem CSS, com conteúdo comprimido. O executor identificou a ausência do CSS
de DatePicker no standalone e corrigiu o carregamento do CSS oficial. Essa
primeira imagem não conta como calendário final aprovado.

Depois foram abertas `transacoes-calendario-mobile-final.jpg` e
`transacoes-calendario-selecao-mobile.jpg`. O calendário tem a grade oficial,
cabe na largura e mostra o intervalo de 1 a 24 legivelmente. O P1 de CSS foi
fechado visualmente nessas duas imagens.

Foram abertas `acesso-erro-recuperacao-mobile.jpg`, `404-header-mobile.jpg`,
`conexoes-falha-mobile.jpg`, `conexoes-falha-detalhe-mobile.jpg`,
`demo-busca-mobile.jpg` e `demo-detalhe-mobile.jpg`. Acesso com erro/recuperação,
falha de importação com dados preservados e busca da demo mostram estados úteis
e legíveis. O detalhe da demo revelou IDs ainda expostos na leitura inicial.

**Seis capturas de landing rejeitadas para o objetivo declarado:**
`landing-desempenho-mobile.jpg` e `landing-cpu-metodo-mobile.jpg` repetem o hero;
`landing-metodo-mobile.jpg`, `landing-cpu-mobile.jpg`,
`landing-cotas-mobile.jpg` e `landing-faq-mobile.jpg` aparecem quase pretas, com
apenas separador e fragmentos do hero. Não mostram as seções nomeadas. O padrão
exige corrigir scroll/captura e conferir o arquivo salvo; não foi atribuído a um
defeito do conteúdo dessas seções. Ao reabrir o arquivo exato
`404-header-mobile.jpg` após a confirmação do executor, o header ficou visível
com marca e link. Essa evidência foi aceita; não resta defeito visual de header
no estado móvel de 404.

**Rejeitada como estado estável:** a primeira versão de `demo-desktop.jpg`
mostra SkeletonLine no lugar da série mensal. Exige nova captura após o gráfico
pronto. Isso não reprova o componente de loading; impede usar aquela imagem como
evidência do gráfico concluído. Visão geral desktop tem dados e foi aceita.

`demo-desktop-estavel.jpg` foi aberta e mostra o gráfico concluído. Também foi
aberta `landing-desempenho-desktop-estavel.jpg`, que mostra a seção de comparação
com unidade, estimativa e próxima ação de abrir o método. A causa informada para
as capturas inválidas anteriores foi o recorte que ignorava o scroll; elas
continuam excluídas da evidência final dessas seções.

**Captura corrigida:** `consentimento-header-mobile.jpg` mostra marca e link
públicos corretamente. O achado anterior de header ausente era de captura; não
foi tratado como defeito de CSS. O header de 404 móvel também foi confirmado na
reabertura. `consentimento-header-desktop.jpg` foi aberto depois e confirma o
header completo no desktop.

**Confirmação recapturada:** a primeira `auditoria-confirmacao-mobile.jpg`
mostrava abertura incompleta. `auditoria-confirmacao-mobile-estavel.jpg` mostra
o Dialog inteiro com título, consequência e Cancelar/Confirmar revogação. O
estado visual foi aceito. Nenhuma revogação foi executada por esta revisão.

Foram abertas as 28 grades `grade-{pagina}-{desktop,mobile}.jpg`, para as
14 superfícies da tabela de notas. Eixos externos, bordas, toolbars, cabeçalhos e
colunas de dados estão coerentes nas áreas vistas. O executor mediu ausência de
overflow de documento nas 28 capturas; esta revisora inspecionou os pixels, sem
executar a medição DOM. Grades usam 12 colunas/24px no desktop, 4 colunas/16px no
móvel e linhas de conferência de 8px. O overlay é ferramenta temporária, não UI
permanente. Headers públicos das capturas antigas foram julgados nas recapturas
normais confirmadas, não extrapolados do overlay.

Foram abertos os seis arquivos móveis finais
`landing-{desempenho,metodo,cpu,cpu-metodo,cotas,faq}-mobile-final.jpg` e os quatro
desktop `landing-{cpu,cpu-metodo,cotas,faq}-desktop-final.jpg`. Agora as seções
corretas aparecem, com métodos abertos, escala, unidade, período e denominador.
Laranja representa consumo; CPU acima da referência mostra 103%, com a barra
saturada e a limitação declarada. Os dois links de cotas separados e sublinhados
foram conferidos na versão móvel final; os desktop de cotas/FAQ antecedem esse
ajuste de espaçamento e não foram usados para validar esse detalhe.

Foram abertos `demo-detalhe-mobile-final.jpg`,
`demo-detalhe-referencia-mobile-final.jpg` e
`referencia-controles-mobile-final.jpg`. IDs ficam recolhidos, mas consultáveis;
conta/titular/estado/origem continuam visíveis. O texto opcional duplicado foi
removido sem tornar o campo obrigatório.

Foram abertos `visao-geral-serie-erro-mobile.jpg`,
`visao-geral-grafico-fallback-mobile.jpg`,
`visao-geral-primeiro-banco-mobile.jpg`, `transacoes-erro-mobile.jpg`,
`transacoes-vazio-mobile.jpg` e `transacoes-carregamento-mobile.jpg`. Falha da
série preserva o restante do resumo; falha do gráfico mostra a tabela exata
imediatamente. Primeiro banco, recuperação, vazio e loading têm estado claro.
`visao-geral-serie-erro-mobile-final.jpg` foi aberta depois do último guard e não
promete mais uma tabela quando a série está ausente. A evidência foi aceita.

As 28 imagens de galeria `final-{pagina}-{desktop,mobile}.jpg` foram abertas.
Em cinco regiões cuja leitura inicial pareceu incompleta, foram comparados os
pixels com as capturas anteriores aceitas usando ImageMagick, sem modificar
arquivos. Headers de consentimento/404 e controles da demo estão presentes nos
arquivos finais atuais. As capturas finais são aceitas; os arquivos transitórios
e recortes inválidos anteriores permanecem excluídos de suas respectivas provas.

Conforme a procedência informada pelo executor, as páginas privadas em 8799 usam
fixture visual sintética. A demo em 8801 é servida pelo Worker local sem sessão,
com dados fictícios. Esta revisão não comandou o navegador nem demonstrou OAuth,
Pluggy, deploy, dados privados, acessibilidade completa ou comportamento MCP real.

## Melhorias confirmadas nas imagens

1. **Tipografia:** Inter maior, títulos diferenciados e métricas com moeda menor
   criam hierarquia real. Números principais permanecem inteiros nas capturas.
2. **Alinhamento:** cabeçalhos de Transações agora coincidem com nome, conta,
   data e alinhamento à direita do dinheiro. Badge e chevron dos resumos
   compartilham a primeira linha em desktop e móvel.
3. **Minimalismo:** Transações móvel passou de uma pilha de seis a oito linhas
   para nome/valor predominantes e conta/data subordinadas, preservando estado.
4. **Descoberta:** categorias/etiquetas e fundação visual aparecem abertas;
   Conexões mostra uma única fase, parcialidade, horário e próximo passo claros.
5. **Dashboard e demo:** resumo, categorias identificadas, série, valores exatos,
   registros recentes e contas/cartões compartilham uma composição coerente.
   Barras neutras preservam leitura monocromática. A demo se identifica como
   fictícia no topo e na navegação.

## Achados e correções conferidas

| Prioridade | Evidência | Correção concreta |
| --- | --- | --- |
| P1 corrigido | `transacoes-calendario-mobile-final.jpg` e `transacoes-calendario-selecao-mobile.jpg` mostram grade e intervalo legíveis, após carregar o CSS oficial. | Não reconstruir o componente em CSS local; conservar a largura contida no Popover. |
| P2 corrigido | `demo-detalhe-mobile-final.jpg` recolhe os dois IDs em Referência técnica; a versão de referência aberta confirma sua consulta. | Nome da conta, titular, estado e origem permanecem na leitura inicial; IDs e cópia foram preservados sob demanda. |
| P1 corrigido | `regra-rascunho-mobile-corrigido.jpg` substitui o estado anterior com pergunta estreita e botão cortado. Agora mensagem e ações ocupam linhas próprias; foco de Continuar é visível e ambas as ações estão completas. | Preservar a composição compartilhada. A confirmação de exclusão em `regra-exclusao-mobile.jpg` também mostra consequência e duas ações completas. |
| P2 corrigido | `conexoes-gerenciar-mobile-corrigido.jpg` mostra campo e Conectar em linhas separadas. `conexoes-pessoas-mobile-completo.jpg` mostra inputs/botões de pessoas completos e separados. URL/controles MCP também cabem na recaptura. | O resultado visual foi conferido, além das medidas DOM fornecidas pelo executor. Preservar a composição nas outras larguras. |
| P2 corrigido | `auditoria-mobile-corrigida.jpg` alinha os valores principais; `auditoria-inferior-mobile-corrigida.jpg` remove o deslocamento grande entre valores de modelos/clientes, reservando altura aos labels pareados. | Preservar o alinhamento nas demais larguras. Os registros continuam distinguindo chamadas, falhas e bytes. |
| Corrigido nas imagens | `auditoria-mobile-corrigida.jpg` e `auditoria-metricas-mobile.jpg`: bytes menores, unidades subordinadas, duração com unidade separada; o par cabe e deixa de dominar. | Preservar essa apresentação. Meter diário agora é neutro e continua explicitamente relativo, sem representar cota. |
| Corrigido no código e imagem | `colorTokens.accent` aponta a `var(--text-color-kumo-link)`, como a fundação; `referencia-tokens-mobile.jpg` mostra a legenda correta. | Não resta divergência no mapeamento consultado. |
| P3 corrigido | `referencia-controles-mobile-final.jpg` mostra somente “Apelido (opcional)”. | Campo continua opcional; não foi necessário esconder texto da biblioteca por CSS. |
| Captura corrigida | `demo-desktop-estavel.jpg` mostra o gráfico concluído. | A primeira imagem em skeleton não conta como estado final. |
| Captura corrigida | Headers de consentimento móvel/desktop e 404 móvel confirmados nas recapturas normais. | Não foi atribuído bug de CSS à captura incompleta. |
| Captura corrigida | `auditoria-confirmacao-mobile-estavel.jpg` mostra título, consequência e ações completas. | Estado visual aceito; não comprova revogação real ou OAuth. |

## Notas desta inspeção

As notas são limitadas às capturas listadas. Uma nota de 8 não significa
aprovação irrestrita de todos os fluxos da página. O guard final foi conferido
na recaptura; nenhuma correção foi aceita apenas pelo relato do executor.

| Página | Composição vista | Condição antes de encerrar a revisão |
| --- | --- | --- |
| Visão geral | 8/10 nos estados vistos | Topos, cálculo, contas, grade, primeiro banco e falhas vistos. Política declara pendentes/futuros/ignorados, transferências, parcelas e observação dos saldos. Guard final recapturado e aceito. |
| Transações | 8/10 nos estados vistos | Lista, filtros, parcelas, calendário e intervalo final legíveis. IDs recolhidos; erro/vazio/loading vistos. |
| Regras | 8/10 nos estados vistos | Resumo, expandida, editor normal, rascunho corrigido e exclusão estão coerentes. O P1 foi corrigido e a recaptura inspecionada. |
| Grupos | 8/10 nos estados vistos | Catálogo, etiquetas e editor foram abertos; rótulos/campos legíveis e consequência do grupo clara. |
| Sincronizações | 8/10 nos estados vistos | Resumo e detalhe móvel válidos, com etapa/encerramento explícitos e sem porcentagem inventada. |
| Conexões | 8/10 nos estados vistos | Estado ativo, Select/Conectar, pessoas/perfis, MCP e falha/detalhe vistos. Os dados recebidos continuam acessíveis durante a falha; próxima elegibilidade desconhecida é declarada. |
| Auditoria MCP | 8/10 nos estados vistos | Métricas, modelos/clientes, bytes e Meter corrigidos; grant, parte inferior e confirmação estável vistos. |
| Referência visual | 8/10 nos estados vistos | Tokens, controles e feedback vistos, com legenda accent e texto opcional corrigidos. |
| Landing | 8/10 nos estados vistos | Topo, jornada, desempenho, CPU, cotas, métodos e FAQ vistos em capturas finais válidas; consumo laranja e estimativas identificados. |
| Demo pública | 8/10 nos estados vistos | Desktop estável e móvel, categoria, gráfico com tooltip/tabela, recentes e contas vistos; cartão continua distinto de saldo. |
| Demo de Transações | 8/10 nos estados vistos | Lista, busca aplicada e detalhe final com referência técnica recolhida/aberta vistos; nome/valor e conta/data legíveis. |
| Acesso | 8/10 nos estados vistos | Normal, erro e recuperação abertos; origem, ação e instruções claras. Permanece SSR nativo, sem JS obrigatório. |
| Consentimento | 8/10 nos estados vistos | Texto, decisões e headers móvel/desktop confirmados. Não é prova de OAuth. |
| 404 | 8/10 nos estados vistos | Retorno evidente; header móvel confirmado na reabertura. Evidência visual não prova comportamento publicado da página estática/Worker. |

## Leitura qualitativa

Variação visual agora é moderada entre papéis de informação e baixa entre páginas,
o que favorece consistência. Densidade de Transações móvel está substancialmente
melhor; o dashboard assume uma leitura mais longa por conter análises úteis.
Contrastes parecem mais nítidos nas imagens; quatro pares foram conferidos pela
aritmética descrita abaixo. Movimento não pode ser avaliado a partir de
screenshots estáticos. As leituras de variação e densidade são inferências.

### Amostra de contraste e escala

O executor forneceu estilos DOM: Inter; corpo e controles de 16px, h1 de 28px e
metadados de 14px; canvas/base/input neutros em OKLCH L 0,10/L 0,17/L 0,205; texto
`#f4f4f5` e metadado `#b3b3b8`. Esta revisora reproduziu a aritmética de
luminância, usando conversão neutra para RGB linear L³ e a função de
transferência sRGB dos textos. Os resultados coincidem com os relatados:

| Par amostrado | Razão |
| --- | --- |
| Texto/canvas | 18,73:1 |
| Texto/base | 17,40:1 |
| Metadado/base | 9,16:1 |
| Texto/input | 16,30:1 |

São quatro pares, não uma auditoria de todos os estados, foco, controles,
gráficos, cores semânticas ou acessibilidade completa.

## Encerramento da revisão

Revisão visual encerrada nos estados listados, após inspeção das correções e
recapturas. Comportamentos, teclado, rede, integração real e testes automatizados
continuam sendo evidências separadas do trabalho do executor. A amostra de
contraste não cobre todos os estados; screenshots não demonstram movimento,
acessibilidade completa, OAuth ou validação em produção.

Próximo passo para o usuário: abrir Visão geral e Transações da galeria final e
comparar a hierarquia, a densidade e a leitura dos valores por um minuto.
