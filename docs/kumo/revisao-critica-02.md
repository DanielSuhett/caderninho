# Revisão crítica 02 — código antes da captura

24/10/2026. Rodada em andamento. Revisão independente por agente no papel de
designer crítica, com edição restrita a este relatório.

**Estado: primeira inspeção desktop recebida. Nenhuma página aprovada nesta rodada.**
As notas da rodada 01 não foram reclassificadas a partir de código. Testes e
compilação não concedem aprovação visual. As notas futuras serão julgamentos
qualitativos de agente, sem equivalência a avaliação humana ou medição de UX.

## Evidência desta etapa

Foram relidos `revisao-critica-01.md` e os arquivos atuais
`src/web/styles/design.css`, `src/web/account.css`,
`src/web/account/financial-dashboard.tsx`, `overview-view.tsx`,
`financial-presentation.ts`, `monthly-spending-chart.tsx`, `period-picker.tsx`,
`workspace-ui.tsx`, `disclosure-item.tsx`, `src/web/ui.tsx` e
`src/contracts/dashboard.ts`. O serviço de agregação foi consultado para
entender a política dos números exibidos. A implementação ainda estava em edição.

Esta etapa não executou navegador, testes ou comandos Git e não modificou a UI.
As capturas antigas não foram reutilizadas para aprovar mudanças novas.

## Correções de direção que o código já expressa

1. Inter variável local, preload e escala 16/14/28/20/32 têm papéis explícitos.
   O usuário autorizou esse conteúdo maior, prevalecendo sobre a regra de 14px
   da skill. Sem tracking alterado; pesos principais limitados a 600.
2. A Visão geral passa a ter período, moeda, resumo financeiro, duas análises
   irmãs, transações recentes e contas/cartões. A estrutura do Securo foi
   adaptada a tarefas e contratos existentes, sem sua multiplicação de cores.
3. O código remove a regra que derrubava o valor financeiro para o fim da linha
   móvel e usa defaults reais de Collapsible, mantendo o conteúdo montado.
4. Métricas preservam valores em unidades menores exatas; a geometria de gráfico
   é separada da apresentação monetária. Cartão permanece distinto de saldo
   bancário, moeda é selecionada sem conversão, e a tabela mantém valores exatos.
5. Há grade de verificação temporária e pares de cards com padding comum. Isso
   permite verificar alinhamento, mas ainda não prova o resultado nas viewports.

## Condições concretas antes da pontuação

| Prioridade | Condição identificada no código | Aceitação visual ou de conteúdo |
| --- | --- | --- |
| P1 | `.financial-metric dd` usa 32px e `overflow-wrap:anywhere`; no móvel são duas colunas com26px. Valores grandes e “Indisponível” podem quebrar no meio. Quatro colunas são decididas pela viewport, embora a Sidebar reduza a largura disponível. | Preservar o número inteiro, com moeda em papel menor ou quebra somente entre valor e moeda; decidir colunas pela largura útil. Capturar389/768/1280 e número longo. Não reduzir fonte silenciosamente para fazer caber. |
| P1 | `overview.unknownAmountCount` e `monthly.unknownAmountCount` são dados distintos, mas a mensagem atual só considera o resumo do mês. A série recebe valores conhecidos mesmo quando há registros sem valor. | Não apresentar gráfico parcial como total completo. Explicitar por série o que está recebido/desconhecido, período e moeda. A frase “os totais não estão disponíveis” precisa concordar com as barras/tabela ainda exibidas. |
| P1 | A política financeira está majoritariamente no serviço: ignora não POSTED/futuro, classifica explicitamente receitas/despesas e trata fluxo bancário separadamente. A UI menciona estornos, mas não torna clara toda a política. | Um resumo curto com detalhes sob demanda precisa explicar pendentes/futuros/ignorados/parcelas e transferências. Não esconder que fluxo bancário pode conter transferências quando apenas uma ponta pertence ao escopo. Não inventar exclusões que o serviço não aplica. |
| P2 | `ChartUnavailable` promete valores “abaixo”, mas “Ver valores exatos” começa recolhido. | Se o gráfico falhar ou exceder a escala segura, mostrar a tabela exata diretamente ou uma ação de abertura inequívoca junto ao erro. O dado útil não deve desaparecer atrás de duas etapas. |
| P2 | Cabeçalho/tooltip/eixos do gráfico têm estilos diretos independentes da fundação. Séries mensais sem despesas são omitidas pelo agrupamento. | Confirmar que as cores seguem a monocromia e que meses ausentes não são apresentados como continuidade falsa. Não preencher zero em cobertura desconhecida. Eixos/tooltip precisam conservar mês/ano/unidade; tabela permanece alternativa. |
| P2 | `Promise.all` associa resumo, série, catálogo e registros recentes. Uma falha da série impede mostrar qualquer resultado novo desta carga. | Verificar o estado de falha de análise sem tornar o resumo salvo indisponível; se o contrato deliberadamente falhar junto, oferecer recuperação clara e não declarar os dados ausentes. |
| P2 | `.analysis-body` impõe260px mesmo em vazio; `.financial-summary` usa padding24px igual em todos os lados. | Capturar vazio e poucos itens. Evitar grandes caixas vazias e alinhar rodapés das análises. A skill prefere padding vertical opticamente menor que o horizontal;20/24 pode ser suficiente se a imagem confirmar. |
| P2 | `.filter-context` centraliza em relação ao contêiner total da busca com rótulo, enquanto toolbar continua alinhada ao fim. | Conferir a linha dos controles e o texto de contexto com a grade. O contexto precisa alinhar ao controle, não ao centro entre rótulo e campo. |

### Tipografia dos controles: confirmação do pacote

Foi conferido o código instalado do Kumo2.14: Button e Input com tamanho `base`
usam `text-base`, que a nova fundação define em16px. Portanto isso **não é um
defeito confirmado** nesses componentes. Ainda é necessário conferir estilos
computados de Select, Sidebar, Dialog e controles específicos. Ter body16px
isoladamente não garante a escala inteira.

### Monocromia e contraste

A nova fundação torna os textos principais, secundários e links neutros. É uma
direção compatível com o pedido. O contraste deve ser verificado nos pares
efetivamente renderizados, incluindo links neutros com descoberta por sublinhado,
foco, campos, placeholder, estados inativos e os tons semânticos. Nenhuma razão
de contraste foi medida nesta revisão de código. Não aprovar apenas porque os
hexadecimais parecem claros.

## Capturas necessárias para julgar a rodada

| Grupo | Estados que precisam aparecer |
| --- | --- |
| Visão geral e demo | Topo completo com período/moeda; resumo, análises, recentes e contas; pelo menos um dado parcial e um vazio; nome+valor móvel; detalhe de conta; aviso inequívoco de dados fictícios na demo. |
| Transações e organização | Lista curta e longa; busca/filtros ativos; parcelas; regras recolhidas e expandidas; editor e confirmação; categorias/etiquetas; ausência e erro sem perder rascunho. |
| Conexões e Auditoria | Importação ativa/parcial/falha; gerenciamento aberto; credenciais e conexão MCP; atividade visível com unidades; grant expandido e revogação. |
| Referência e público | Exemplos visíveis; landing acima e abaixo da dobra, demo, free tier e métodos; acesso normal/erro/recuperação; consentimento completo;404. |
| Fundação transversal | Desktop e celular com a mesma versão; largura intermediária; grade temporária em Regras e dashboard; medidas dos eixos; Inter carregada; estilos computados e pares de contraste usados. |

## Primeira inspeção visual desta rodada — desktop

Foram abertas com `view_image` as imagens de `docs/kumo/capturas/rodada-02/`:
`regras-desktop.jpg`, `regras-expandida-desktop.jpg`,
`regra-editor-desktop.jpg`, `visao-geral-desktop.jpg`,
`transacoes-desktop.jpg`, `grupos-desktop.jpg`,
`sincronizacoes-desktop.jpg`, `conexoes-desktop.jpg`,
`auditoria-desktop.jpg` e `referencia-desktop.jpg`.

Visão geral é captura válida com dados, não skeleton. O editor de regra mostra
desalinhamento entre Categoria e Prioridade; o executor informou que o CSS já
mudou e enviará recaptura. A imagem atual é evidência do defeito anterior, não
aprovação da correção. As capturas mostram a área visível da viewport; não provam
o conteúdo abaixo da dobra, comportamento ou estilos computados.

Inter maior e métricas com moeda subordinada melhoraram a hierarquia. O resumo
monocromático agora permite reconhecer números antes dos metadados. Nos registros
de Regras/Sincronizações, título/status/chevron já compartilham a primeira linha.
Essas correções são visíveis, mas não eliminam os problemas da tabela abaixo.

| Página | Nota desktop provisória | Evidência e condição restante |
| --- | --- | --- |
| Visão geral | 7/10 | `visao-geral-desktop.jpg`: boa hierarquia e moeda separada; todas as categorias visíveis dizem “Categoria não identificada”, retirando o significado da análise. Conferir IDs do contrato/fixture antes de recapturar. Exige parte inferior e móvel para nota de página. |
| Transações | 7/10 | `transacoes-desktop.jpg`: legível, mas cabeçalho Descrição começa cerca de12px antes dos nomes e “Valor e moeda” fica à esquerda enquanto os valores ficam à direita. Alinhar cabeçalhos com a coluna de dados. Revisar densidade sem esconder estados. |
| Regras | 7/10 | `regras-desktop.jpg` corrige eixos de badge/chevron. Na expandida, o registro ocupa quase500px, repete a condição e categoria e deixa muito espaço entre conteúdo e ações. Agrupar os detalhes com ritmo mais compacto. Editor aguarda recaptura após correção. |
| Grupos | 6/10 | `grupos-desktop.jpg`: categorias/etiquetas continuam ocultas como na rodada01; pouco conteúdo útil à vista e BRL repetido no resumo. A troca de fonte não resolve a arquitetura. Mostrar catálogo selecionado ou Tabs adequadas. |
| Sincronizações | 7/10 | `sincronizacoes-desktop.jpg`: eixos do resumo corrigidos; fase, pessoa e início podem se agrupar melhor. Falta estado expandido e nova captura móvel válida. |
| Conexões | 6/10 | `conexoes-desktop.jpg`: mantém “Importando seus dados”, “Em andamento”, “Importando transações” e “A importação continua”; recuos do loader/conteúdo divergentes. Uma síntese de estado e próximo passo basta, preservando parcialidade e recuperação. |
| Auditoria MCP | 7/10 | `auditoria-desktop.jpg`: atividade agora visível e valores maiores; bom avanço. Continua com faixa ampla de alerta e Meter azul dominante. Precisa parte inferior, móvel e detalhe das métricas/ações; a medida entrada/saída é comprida para colunas estreitas. |
| Referência visual | 5/10 | `referencia-desktop.jpg`: continua mostrando apenas títulos de seções recolhidas; não permite comparar os componentes da fundação. Abrir conteúdo essencial e revisar o comprimento com navegação local se necessário. |
| Landing | Sem nota | Aguardando captura nova incluindo abaixo da dobra. |
| Demo pública | Sem nota | Nova página; ainda não inspecionada. |
| Acesso | Sem nota | Aguardando captura nova. |
| Consentimento | Sem nota | Aguardando captura nova. |
|404 | Sem nota | Aguardando captura nova. |

As notas desktop são qualitativas e provisórias. Nenhuma nota vale como aprovação
da página inteira: faltam capturas móveis e estados críticos desta versão.

Critério permanece o da rodada01:8/10 requer ausência de defeitos materiais de
alinhamento, legibilidade, descoberta e semântica nos estados realmente vistos.
Movimento não será pontuado a partir de imagens estáticas; acessibilidade,
produção, OAuth e integrações reais continuam fora dessa evidência.
