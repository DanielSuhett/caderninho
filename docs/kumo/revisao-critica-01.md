# Revisão crítica 01 — composição e legibilidade

24/10/2026. Revisão visual independente por agente no papel de designer crítica.
As notas abaixo são julgamentos qualitativos da experiência visível. Não são
medições, pesquisa com usuários, aprovação humana ou conformidade de acessibilidade.
**Resultado da rodada: nenhuma página aprovada no critério de 8/10.**

## Evidência e limite

Foram abertas e inspecionadas as capturas `*-desktop.jpg` e `*-celular.jpg` de
Visão geral, Transações, Regras, Grupos, Sincronizações, Conexões, Auditoria MCP,
Referência visual, landing, acesso, consentimento e 404, em `docs/kumo/capturas/`.
Também foram inspecionados `conta-expandida-desktop.jpg`, `parcelas-desktop.jpg`,
`parcelas-celular.jpg`, `auditoria-atividade-desktop.jpg`, `filtros-celular.jpg` e
`grupo-editor-celular.jpg`. A imagem de Regras enviada pelo usuário foi aberta em
`/tmp/codex-clipboard-a44107b6-37bc-466d-8f72-b2c14f1e6189.png`.

As capturas são estados locais/sintéticos fornecidos pelo agente executor nesta
rodada. Esta revisão não controlou o navegador nem verificou comportamento,
teclado, semântica da árvore acessível, OAuth ou produção. O código foi consultado
para localizar causas; código em edição pode estar à frente dessas imagens.

**Captura rejeitada:** `sincronizacoes-celular.jpg` tem escala diferente das demais
e corta a borda direita do registro, incluindo status e chevron. Não permite
concluir se há overflow real. Exige recaptura; o executor confirmou o problema de
captura. Os outros arquivos aceitos representam apenas a área visível de sua
viewport, não a página inteira nem todos os estados.

Foram abertas as referências `docs/kumo/referencias/securo-dashboard-desktop.jpg`
e `securo-transacoes-desktop.jpg`. A organização mensal, resumo financeiro,
análises irmãs e tabela de transações são referências estruturais pertinentes.
Não é aprovação da paleta multicolorida, operações, cálculos ou projeções do Securo.

## Cinco problemas que impedem o polimento

1. **A tipografia achata informação de importância diferente.** Valor de saldo,
   nome de conta, categoria e metadado parecem ter importância próxima. Em
   `src/web/design.tsx:19`, body, small e time convergem para 14px; em
   `src/web/account.css:236` os valores das métricas também são 14px. A preferência
   atual do usuário por Inter e texto maior prevalece sobre a regra de 14px da
   skill. Aplicar Inter 16px ao conteúdo e controles, 14px aos metadados, h1 28px,
   h2 20px e métricas principais de 28–32px, mantendo peso máximo 600 e tracking
   original. Moeda e precisão continuam explícitas, com algarismos tabulares.
2. **Há alinhamento de caixas sem alinhamento óptico do conteúdo.** Na imagem de
   Regras, busca e Filtros parecem uma sequência improvisada, enquanto “Pessoal”
   se alinha mais baixo. No registro, título à esquerda, badge no topo direito e
   chevron abaixo formam eixos concorrentes. O `align-items:end` da toolbar não
   alinha a linha de texto do contexto ao centro dos controles. Definir grade de
   página e grade do resumo: título/badge/chevron na mesma linha; contexto e
   prioridade relacionados abaixo. Não resolver cada tela com uma margem avulsa.
3. **Transações móvel perde o minimalismo e a comparação financeira.** Cada
   registro ocupa seis a oito linhas; o valor aparece depois de nome, categoria,
   conta e data. A causa verificável é a regra de até 480px em
   `src/web/account.css:670`, que substitui a grade por uma coluna e joga
   `.money-cell` para baixo. Nome e valor devem ficar lado a lado; conta/data
   compactas abaixo; detalhes e referências no Dialog. Estados reais de pendente,
   futura e ignorada permanecem visíveis, sem repetir um badge por informação.
4. **Recolher virou uma arquitetura de esconder a página.** A Visão geral é uma
   lista de contas e um “Resumo da instalação” fechado. A Auditoria esconde sua
   atividade, e a Referência visual mostra quase só títulos recolhidos. Usar
   Collapsible para informação secundária; dados necessários à decisão devem
   aparecer na leitura inicial. Os componentes reais já existem, mas a composição
   ainda conserva o hábito de esconder quase tudo atrás de um texto e chevron.
5. **A cor semântica ocupa mais área que a hierarquia financeira.** Faixas âmbar e
   texto azul disputam atenção com os dados; o restante vira uma massa de texto
   cinza pequeno. Isso é uma inferência visual, não uma razão de contraste medida.
   Manter base monocromática com texto principal nítido, metadados legíveis e cor
   restrita a foco, ação deliberada e estado que precise ser distinguido. Não
   apagar alertas reais para obter monocromia. A segunda rodada deve registrar os
   pares de contraste efetivos; screenshots sozinhos não bastam para declarar AA.

## Revisão página por página

Cada nota avalia a composição visível nas capturas abertas, com desktop e celular
considerados juntos. “Para 8/10” é o critério de aceitação da próxima rodada, não
uma promessa de nota após mudar o CSS.

| Página | Nota atual | Evidência e problema principal | Para 8/10 |
| --- | --- | --- | --- |
| Visão geral | 4/10 | `visao-geral-desktop.jpg` e `visao-geral-celular.jpg`: saldos pouco salientes; contas e cabeçalho não criam uma leitura financeira; banner domina. A conta expandida introduz outra linha vertical e muitos vazios. | Escopo/período explícitos; resumo com métricas legíveis e distintas de saldo de cartão; análises úteis com contratos completos; contas compactas; desktop e móvel com eixos estáveis e detalhe secundário recolhido. |
| Transações | 4/10 | `transacoes-desktop.jpg` e `transacoes-celular.jpg`: desktop permite comparar, mas tem linhas muito altas para poucos dados; no móvel valor e moeda ficam enterrados. Dialog de parcelas mostra dados corretos, mas título e valor têm quase a mesma ênfase de metadados. | Nome+valor predominantes; conta/data/categoria subordinadas; resumo de estados curto; linhas densas sem apertar toque/foco; Dialog com valor principal e grade legível, sem IDs na leitura inicial. |
| Regras | 4/10 | `regras-desktop.jpg`, `regras-celular.jpg` e imagem do usuário: busca/contexto/ações sem base comum; badge e chevron desalinhados; prioridade como terceira linha adiciona volume sem ajudar comparação. | Toolbar única e alinhada; resumo em duas linhas com status/chevron no mesmo eixo; condição→categoria compreensível; prioridade em posição consistente; editor e confirmação também revisados. |
| Grupos | 5/10 | `grupos-desktop.jpg` e `grupos-celular.jpg`: BRL repete o orçamento; categorias/etiquetas ficam atrás de seções vazias visualmente; cabeçalho “Categorias e etiquetas: Pessoal” compete com o nome do registro. Editor tem selects de larguras arbitrárias. | Grupo selecionado inequívoco; orçamento com moeda uma vez no contexto adequado; categorias/etiquetas descobertas com Tabs se forem subvisões da mesma tarefa; formulário com rótulos e campos alinhados, sem inserir Tabs só para contar componente. |
| Sincronizações | 5/10 provisório | `sincronizacoes-desktop.jpg`: status e chevron separados verticalmente; data/pessoa/fase são texto uniforme. Captura móvel rejeitada. | Estado e fase legíveis na primeira linha; pessoa/início em segunda linha compacta; histórico expandido alinhado; captura móvel válida sem corte; nenhum percentual sem denominador real. |
| Conexões | 5/10 | `conexoes-desktop.jpg` e `conexoes-celular.jpg`: repete “importando”, “em andamento”, “importando transações” e “a importação continua”; status/pessoa/loader têm recuos divergentes. A ação principal perde aparência no móvel da captura. | Uma síntese de estado com fase, origem e próximo passo; aviso parcial persistente sem repetir o mesmo texto; alinhamento de ícone à primeira linha; gerenciamento e MCP descobertos; credenciais e confirmação visualmente revisadas. |
| Auditoria MCP | 5/10 | `auditoria-desktop.jpg` e `auditoria-celular.jpg`: o propósito “atividade” está recolhido; contagens parecem rodapé. Em `auditoria-atividade-desktop.jpg`, quatro métricas pequenas e uma barra longa não criam boa leitura temporal. | Atividade principal visível; números maiores com unidades; série diária e erros distinguíveis sem depender só de cor; tabela alternativa; modelos declarados/bytes/ferramentas sem ambiguidade; detalhes de grants continuam secundários. |
| Referência visual | 5/10 | `referencia-desktop.jpg` e `referencia-celular.jpg`: quase nenhum componente aparece sem clicar; separadores e blocos vazios substituem o conteúdo que deveria permitir comparar. | Fundação e exemplos essenciais abertos; navegação local/índice apenas se o comprimento justificar; tipografia e estados reais lado a lado; nenhum token de legado apresentado como padrão Kumo. |
| Landing | 6/10 | `landing-desktop.jpg` e `landing-celular.jpg`: mensagem clara, mas experiência não é demonstrada. Header móvel se divide em três blocos com vazios; CTAs perdem hierarquia na captura móvel. Só o topo e início da jornada foram vistos. | Demo pública acessível a partir do hero; resumo de benefício acompanhado de UI realista e fictícia identificada; header compacto; ação primária legível; restante de desempenho/free tier/FAQ capturado, inclusive métodos e consumo laranja. |
| Acesso | 6/10 | `acesso-desktop.jpg` e `acesso-celular.jpg`: formulário simples, mas URL e divisores ocupam quase tanto quanto a tarefa; fonte pequena; recuperação ainda usa triângulo de summary nativo. | Inter legível, um campo e ação evidentes, origem preservada como contexto, recuperação com apresentação coerente e funcional sem JS; erro e não configurado revisados; sem trocar semântica de senha por componente inadequado. |
| Consentimento | 7/10 | `consentimento-desktop.jpg` e `consentimento-celular.jpg`: consequência e botões claros, porém o texto legal compacto tem pouca hierarquia e o banner azul domina; metadado de cliente não verificado precisa continuar evidente. | Melhor medida de texto/entrelinha; identidade do cliente e destino destacados sem parecer verificados; consequências preservadas; Autorizar/Negar inequívocos; leitura confortável móvel sem reescrever o alcance legal. |
| 404 | 7/10 | `404-desktop.jpg` e `404-celular.jpg`: curto e compreensível; ação parece texto comum na captura móvel. | Tipografia da fundação; ação de retorno inequívoca; grade alinhada ao layout público. Conferir 404 estático e Worker separadamente, pois as imagens não provam equivalência de deploy. |

## Grade e escala propostas para a segunda rodada

Usar uma grade comum de conteúdo, não forçar todos os elementos a uma tabela.
No desktop: gutter de 32px, grupos de 24px, duas análises irmãs com alturas e
cabeçalhos alinhados. No móvel: gutter de 16px, grupos de 16–24px e dados que se
reorganizam antes de encolher a fonte. Nos pares relacionados: 4–8px; rótulo/campo
8px. Ícones se alinham à primeira linha e conservam tamanho óptico consistente.

A próxima rodada precisa de capturas com grade temporária de conferência e
medidas DOM dos eixos de cabeçalho, toolbar, início dos registros e bordas de
cards. O overlay não deve ser parte permanente do produto. Verificar estados
expandidos, textos longos, ausência, erro e pelo menos uma largura intermediária.

Escala aceita para implementar e voltar a julgar: Inter 16px/24px conteúdo e
controle; 14px/20px metadado; h1 28px, h2 20px, métricas de 28–32px; pesos
400/500/600. Não aplicar `font-bold`, tracking alterado ou valores monetários
animados. A hierarquia depende também de composição, não apenas de tamanho.

## Componentes Kumo e hábitos de legado

| Padrão visível ou localizado | Opção adequada | Condição de uso |
| --- | --- | --- |
| DisclosureItem com resumo livre e chevron que muda de eixo | `Collapsible.DefaultTrigger` / `DefaultPanel` | A API atual em edição já passou para os defaults. Reavaliar a imagem nova: um componente correto continua exigindo grade coerente no conteúdo. A [documentação oficial](https://kumo-ui.com/components/collapsible/) distingue defaults de primitivas sem aparência. |
| `details/summary` em recuperação de senha e métodos/FAQ da landing | Collapsible ou equivalente coerente na superfície pública | Preservar SSR e operação sem JavaScript; não trocar o mecanismo nativo por um botão inerte. |
| Tipografia financeira sem papéis claros | `Text` com os papéis disponíveis e tokens de tipo do produto | Inter/16 autorizado; usar sem alterar tracking; `Text` não compensa valores/metadados todos no mesmo tamanho. |
| Resumo de dashboards, hoje só lista de contas | `LayerCard`, `Grid`, `Table`, `Chart`/Timeseries | Cards irmãos; agregado completo por moeda/período. Demo pode ter fixtures claramente fictícias; conta real não pode receber totais fabricados. |
| Categorias/etiquetas com dois blocos fechados | `Tabs` | Somente se forem duas subvisões da mesma tarefa; não duplicar Sidebar nem esconder erro ou contagem relevante. |
| Auditoria só com Meter relativo | Timeseries/Chart e Table | Agregação real já disponível precisa ser confirmada; unidade, UTC/fuso, erro e alternativa textual visíveis; medir custo do bundle. Meter não substitui uma curva de tempo. |
| Header de cada página composto manualmente | Padrão do bloco Page Header, usando partes necessárias | Verificar disponibilidade na versão instalada; não adicionar breadcrumbs a hierarquia plana. |
| Campos sensíveis | `SensitiveInput`, quando a API servir à senha/credencial | Não acrescentar cópia/revelação involuntária; manter autocomplete, name, SSR e semântica de autenticação. |

Não recomendar componentes só porque existem. CommandPalette, mapas, Sankey,
editor JSON e TagInput continuam dependentes de tarefas ou dados concretos.

## Leitura qualitativa

Variação visual atual: baixa entre páginas, mas também baixa entre níveis de
informação; os mesmos blocos de texto recolhidos se repetem. Densidade: desktop
esparso com vazios amplos e móvel de Transações paradoxalmente longo. Movimento:
as imagens estáticas não permitem avaliar intensidade ou estabilidade da animação;
a regra desejada é movimento funcional discreto, sem transição de cor. Todas
essas leituras são inferências, não medições.

## Próxima revisão

Receber capturas atuais de cada página desktop/móvel, incluindo demo e os estados
citados, com Inter, grade e contrastes ajustados. Comparar com as imagens desta
rodada antes de atribuir nota. Uma página só chega a 8/10 quando sua composição
principal e seus estados críticos vistos estiverem sem defeitos materiais de
alinhamento, legibilidade, descoberta ou semântica financeira.
