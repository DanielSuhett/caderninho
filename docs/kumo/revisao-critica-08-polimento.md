# Revisão crítica 08 — calma, regras, grade e fluidez

## 1. Parecer e critérios

**Transações e Regras atingem 8,5/10 nos recortes revistos. As outras doze superfícies atingem 8/10 no recorte desta rodada.** As notas são julgamentos qualitativos de uma revisão por agente, não medições de usabilidade nem aprovação de uma designer humana. O escopo desta rodada é simplificação de Transações/Regras, alinhamento geral e evidência local de resposta da interface. A hierarquia financeira da Visão geral permanece fora desta avaliação.

Os critérios usados para considerar um recorte apto a 8/10 foram:

1. Descrição, valor e próxima ação reconhecíveis sem competição desnecessária; contexto disponível quando necessário.
2. Eixos externos coerentes entre título, controles e superfície; conteúdo interno com o recuo próprio do componente, sem exigir que cada glifo coincida com a grade.
3. Inter legível, conteúdo de 16 px, metadados de 14 px e diferenças reais entre títulos, números, unidades e contexto.
4. Valores exatos, moeda e exceções preservados; redução de repetição sem esconder pendência, futuro, ignorado, sinal divergente ou consequência de salvar.
5. Estados de consulta, expansão, edição e recuperação com apresentação compreensível; declarações de fluidez limitadas ao que a instrumentação realmente mostra.

Foram consultados o DESIGN.md atual, a skill kumo-design, a orientação de auditoria do Product Design e as fontes atuais. A preferência explícita do usuário por Inter e conteúdo maior prevalece sobre a recomendação de 14 px da skill. Esta revisora alterou somente este relatório.

## 2. Decisões e correções efetivamente verificadas

### Transações: há descanso visual sem perda de significado

A comparação entre `transacoes-antes-desktop.png` e `transacoes-depois-desktop.png` mostra a retirada de duas repetições fortes: a zebra e o rótulo de direção em cada valor convencional. A superfície uniforme, os separadores e a faixa de categoria/exceções permitem percorrer a lista sem alternar entre blocos concorrentes. A busca e Filtros conservam uma única barra principal.

`transacoes-1440.png`, `transacoes-390.png`, suas grades e `transacoes-1000-grid.png` mostram colunas coerentes no desktop e composição de registro na largura intermediária/móvel. Categoria e exceções podem quebrar linha; descrição e valor continuam sendo a primeira leitura. Não se tentou obter calma apagando a moeda ou as exceções.

Em `transacoes-depois-desktop.png`, `transacoes-extremos-320.png` e `transacoes-estados-320.png`, foram vistos o crédito positivo extremo, zero, nulo com BRL conhecido, débito com valor positivo, descrição longa, pendente e ignorada. O débito positivo permanece `123,45 BRL` com **Saída** visível. Nulo permanece **Valor indisponível · BRL**. O sinal de origem não foi fabricado para reduzir texto. Crédito positivo recebe `+`; essa formatação não o transforma em receita classificada.

As fontes sustentam essa distinção em [amountLabel/directionIsExplicit](/home/suhett/Work/caderninho/src/web/account/transaction-list.tsx:33). O sentido continua disponível no detalhe. [MoneyValue](/home/suhett/Work/caderninho/src/web/money-value.tsx:7) permite quebra entre grupos de milhares, mantendo dígitos, casas decimais e moeda; os valores não são truncados. A descrição longa continua podendo ocupar várias linhas: isso tem custo de altura, mas preserva identificação sem exigir abertura de cada lançamento.

A ausência de zebra é uma adaptação local restrita ao ledger: Table 2.14 não oferece uma propriedade para desligá-la. Separadores, hover e foco dentro da linha permanecem. Não se trata de uma propriedade inexistente atribuída à API Kumo.

### Regras: resumo curto, ação antes da explicação longa

`regras-1440.png` e `regras-390.png` mostram uma síntese útil: nome, estado, contagem absoluta de alternativas/condições, categoria e prioridade. **2 alternativas · 4 condições** comunica o tamanho da regra de forma mais direta que contagens relativas.

Em `regras-depois-desktop.png`, `regras-expandida-390.png` e `regras-pausada-1440.png`, **Editar** e **Mais ações** vêm antes do Flow. Uma regra extensa deixou de obrigar o usuário a percorrer o diagrama para chegar à edição. O grupo aparece no contexto da página/editor, sem repetir a mesma informação no escopo do diagrama. A política geral fica em **Como as regras são aplicadas**; a consequência de salvar permanece junto às ações do editor.

O diagrama preserva escopo obrigatório, E entre condições e OU entre alternativas. A regra pausada usa **Ao ativar, classificar como** e informa que não será aplicada. A prioridade continua na síntese. [OrganizationView](/home/suhett/Work/caderninho/src/web/account/organization-view.tsx:242), [RuleComposition](/home/suhett/Work/caderninho/src/web/account/rule-composition.tsx:17) e [RuleEditor](/home/suhett/Work/caderninho/src/web/account/rule-editor.tsx:318) sustentam essa organização.

`regras-max-320.png`, após recaptura estável, mostra o escopo desde o início do diagrama. `regras-max-condicoes-320.png` mostra um trecho com E/OU e o valor extremo quebrado entre grupos de milhares. O resumo declara 32 condições e a fonte aceita esse modelo; os dois recortes não mostram as 32 condições por inteiro. O caso máximo continua demandando muita rolagem vertical, uma limitação real do modelo detalhado.

`regras-editor-390.png` mostra o editor com campos, presets e ações fixas legíveis. O comportamento de invalidar/restaurar a condição, manter foco e impedir salvamento inválido foi relatado pelo executor e é compatível com a fonte; não foi observado por esta revisora em uma sequência temporal própria. A prévia informa correspondências, não garante que a regra vencerá outra de maior prioridade nem que o histórico será reclassificado.

### Grade e estados: defeitos encontrados e retorno à inspeção

| Achado nesta revisão | Impacto | Correção conferida |
| --- | --- | --- |
| `?grid=1` fazia aparecer **Limpar** em várias barras, alterando a própria composição inspecionada. | A comparação com/sem grade não era fiel. | [WorkspaceFilters](/home/suhett/Work/caderninho/src/web/account/workspace-ui.tsx:110) exclui `grid` da decisão de limpar. As 16 grades privadas foram reabertas; o botão espúrio desapareceu. |
| Valores de bytes e duração tinham pesos/tamanhos diferentes sem uma faixa comum suficientemente clara na Auditoria; em 1000 px as métricas viravam 3 + 1. | Ritmo irregular em uma comparação curta de quatro indicadores. | `auditoria-390.png`, `auditoria-390-grid.png` e `auditoria-1000.png` atuais mostram baseline coerente e 2 × 2 no intervalo intermediário. Unidades continuam menores. |
| O erro de Regras mostrava um parágrafo condicional extenso e quatro recuperações simultâneas. | O usuário precisava diagnosticar a causa antes de decidir a primeira ação. | `regras-erro-390.png` e `regras-recuperacao-390.png` mostram mensagem curta, **Tentar novamente** e alternativas em Collapsible. O aviso sobre dados antigos fica condicionado à existência de dados mantidos. |
| Bootstrap encostado em x0/y0. | O estado inicial parecia escapar ao sistema visual. | `transacoes-carregando-390.png` recapturado mostra recuo de 16 px e tipografia coerente. É o carregamento da instalação, não o skeleton da lista. |
| `regras-max-320.png` inicial mostrava espaço vazio antes dos nós; um arquivo intermediário de Transações tinha duas barras de rolagem. | Não serviam para aprovar o estado final. | O máximo foi recapturado após estabilizar o Flow; a suíte final de Transações tem uma área de rolagem. `transacoes-depois-mobile.png` permanece como evidência intermediária rejeitada. |

A captura vazia do máximo foi confirmada também em pixels: o recorte de 230 × 250 px em x55/y560 era uma superfície uniforme. Foi rejeitada, em vez de receber uma interpretação favorável. A recaptura atual substitui essa evidência.

As capturas finais de erro e recuperação foram reabertas após o espaçamento adicional de 12 px. Mensagem, retry e disclosure agora têm separação legível; a abertura mantém as alternativas em uma lista própria. A grade desktop da Visão geral também foi reaberta com o gráfico mensal pronto; a captura intermediária com skeleton foi rejeitada para avaliar o gráfico final.

## 3. Parecer página por página

As notas se referem ao conteúdo efetivamente visível nos arquivos abaixo. Para cada prefixo da tabela foram abertos `-1440.png`, `-1440-grid.png`, `-390.png` e `-390-grid.png` em [rodada-08](/home/suhett/Work/caderninho/docs/kumo/capturas/rodada-08). Os arquivos `390` correspondem a aproximadamente 391 px CSS no registro de geometria. Não representam a página inteira quando há conteúdo abaixo da dobra.

| Superfície / prefixo | Nota qualitativa | Julgamento e limite do recorte |
| --- | --- | --- |
| Visão geral — `visao-geral` | **8/10** | Eixos do título, controles, resumo e superfícies coerentes; duas colunas móveis legíveis no trecho visto. Grade desktop final reaberta com gráfico pronto. Avaliação restrita a tipografia/grade; hierarquia financeira fora do escopo. |
| Transações — `transacoes` | **8,5/10** | Leitura mais calma, valores exatos e exceções preservadas. Vistos também extremos/estados em 320 px e composição intermediária em 1000 px. Lista completa de 50 registros não foi percorrida visualmente por inteiro. |
| Regras — `regras` | **8,5/10** | Síntese curta, prioridade/estado visíveis e ações antes do Flow; editor e recuperação com hierarquia clara. Diagramas máximos continuam longos e só os recortes declarados foram examinados. |
| Grupos — `grupos` | **8/10** | Orçamento, moeda, categorias e detalhes têm limites e recuos reconhecíveis; editor móvel legível. A repetição de **Sem limite definido** aumenta a densidade, mas preserva um estado explícito por categoria; não é um defeito impeditivo neste recorte. |
| Sincronizações — `sincronizacoes` | **8/10** | Estado, pessoa, início e fase identificáveis sem porcentagem inventada. Expandido móvel mantém etapas confirmadas e encerramento separados. Estado em andamento sintético; não comprova uma importação real. |
| Conexões — `conexoes` | **8/10** | Uma fase principal, loader discreto, parcialidade e data de consulta visíveis; ação para transações inequívoca. Gerenciamento móvel aberto mostra campo e ação em linhas próprias. Região inferior completa de pessoas/MCP não foi repetida nesta rodada. |
| Auditoria MCP — `auditoria` | **8/10** | Falhas, autorização, chamadas, bytes e duração distintos; métricas corrigidas e 2 × 2 intermediário. Expansão e confirmação móvel vistas. Os recortes não constituem uma auditoria completa de todos os registros/modelos. |
| Referência visual — `referencia` | **8/10** | Tokens e controles têm recuos consistentes; fonte e rótulos são legíveis. A paleta é deliberadamente densa e não deve servir como modelo de densidade para Transações. Controles inferiores não foram todos abertos nesta rodada. |
| Landing — `landing` | **8/10** | Hero, navegação, duas ações e entrada da explicação MCP com boa hierarquia; grade preserva o eixo da seção e o centro do hero. Parecer restrito à dobra inicial e ao recorte adicional de movimento reduzido; não renova aprovação de todas as seções inferiores. |
| Acesso — `acesso` | **8/10** | Instalação/endereço, senha e ação têm sequência clara; formulário e rodapé cabem no móvel. Recuperação estava recolhida nas imagens desta rodada. |
| Consentimento — `consentimento` | **8/10** | Cliente não verificado, destino, alcance e consequência continuam explícitos; ações separadas e texto sem corte. É uma apresentação sintética, não execução de OAuth. |
| 404 — `404` | **8/10** | Mensagem e retorno simples, com cabeçalho/rodapé nos mesmos eixos públicos; vazio adequado ao tamanho da tarefa. Não há base para alegar verificação de todos os hosts/roteadores de 404. |
| Demonstração / Visão geral — `demo` | **8/10** | Identificação de dados fictícios e controles de período/moeda claros; composição coerente com o produto. Nota de grade/legibilidade; hierarquia financeira fora do escopo. |
| Demonstração / Transações — `demo-transacoes` | **8,5/10** | Mesmo ledger calmo, mês em contexto, busca/Filtros e moedas explícitas por valor. Pendência/futuro e BRL/USD permanecem distinguíveis no recorte. Nenhum total foi inferido apenas da página visível. |

Além das quatro imagens por página, foram abertos os cinco arquivos `*-1000-grid.png` de Transações, Regras, Sincronizações, Conexões e Auditoria. As versões anteriores à correção de `grid` foram usadas para identificar o defeito, não para alegar equivalência da composição.

### Leitura qualitativa transversal

**Variação visual:** baixa no aplicativo, com superfícies escuras, texto claro e cor concentrada em ação/estado; moderada na landing pelo hero e pela explicação em Flow. **Movimento:** discreto no painel e mais perceptível, porém localizado, na explicação MCP. **Densidade:** média em Transações, baixa em Regras recolhida e alta na composição máxima; Referência visual é mais densa por sua função. Essas leituras são inferências visuais, não medições de carga cognitiva, movimento ou produtividade.

## 4. Fluidez: o que os dados sustentam

Foram lidos os arquivos `performance-antes-inicial.json`, `performance-antes-interacoes.json`, `performance-depois-inicial.json`, `performance-depois-interacoes.json`, `performance-editor-antes.json`, `performance-editor-depois.json`, `performance-rede-lenta.json`, `motion-reduced.json` e `geometrias.json` da rodada 08. A instrumentação e a interação foram feitas pelo executor; esta revisora inspecionou seus resultados e as fontes.

| Exercício local | Evidência registrada | Conclusão permitida |
| --- | --- | --- |
| Três edições de nome com composição aberta | Antes: 3 renderizações estruturais adicionais do Flow. Depois: 0. Editor: 3 em ambos; commits: 7 em ambos. Contagem por Fiber alterado e flag PerformedWork, explicitamente uma aproximação, não React Profiler. | O isolamento evita recalcular essa subárvore para uma mudança sem efeito nas condições. É um ganho verificável de trabalho evitado. |
| Mesmas três edições | Próximo rAF antes: 21 / 37,3 / 11,9 ms. Depois: 33,9 / 11,6 / 20,7 ms. Sem novas long tasks ou layout shifts nessa janela de digitação. | As faixas se sobrepõem. Não sustentam percentual de aceleração nem melhoria perceptiva demonstrada. Tempo até rAF não é tempo até o pixel estar apresentado. |
| Quatro interações registradas em Transações | Event Timing antes: 48 / 40 / 40 / 40 ms. Depois: 48 / 32 / 40 / 40 ms. Próximo rAF depois: 14,8 / 8 / 19,2 / 13,9 ms. Sem novas long tasks ou layout shifts na janela depois. Os registros de foco identificam o gatilho do detalhe e Filtros. | Compatível com resposta breve na amostra local. Poucos eventos e uma máquina não comprovam 60 fps, INP de campo ou fluidez em todos os dispositivos. Janelas totais têm durações distintas; seus commits não devem ser comparados como benchmark. |
| Boot e rede artificialmente lenta | Boot depois registra um shift sem entrada recente de 0,04842. Fixture com atrasos de aproximadamente 700 ms por API registra 0,08529, sem long tasks. | Há mudança de layout no carregamento. Não declarar CLS zero. São observações de navegações locais isoladas, não uma medição padronizada de Core Web Vitals. |
| Movimento reduzido | A fixture substitui as consultas CSS de reduced motion e matchMedia; JSON registra a opção ativa e animação/transição `none`/0 s nos elementos amostrados. `mcp-reduced-simulado.png` mostra um trecho estático. | Exercita a ramificação controlada. Não equivale à preferência nativa do sistema operacional nem cobre todos os elementos de toda a aplicação. O print começa no meio do Flow e não prova a composição inteira. |

`geometrias.json` reúne amostras das capturas e recapturas, com duplicatas, sem `scrollWidth > clientWidth` nos elementos `main` registrados na leitura final. Não corresponde a uma contagem de estados únicos perfeitamente instrumentados. A ausência de overflow do main não prova ausência de corte em cada descendente. A leitura visual complementar incluiu os valores extremos e os trechos de condições em 320 px.

## 5. Evidência, preservação e limites finais

| Evidência adicional aberta | Conteúdo efetivamente visto |
| --- | --- |
| `transacoes-antes-desktop.png`, `transacoes-depois-desktop.png`, `transacoes-extremos-320.png`, `transacoes-estados-320.png` | Comparação do ledger e casos de precisão, zero/nulo, sinal divergente, descrição longa, pendente e ignorada. |
| `transacoes-vazio-390.png`, `transacoes-carregando-390.png` atual | Empty sem contador repetido de zero; bootstrap com recuo corrigido. Skeleton específico de consulta não foi mostrado nesse bootstrap. |
| `regras-depois-desktop.png`, `regras-expandida-390.png`, `regras-pausada-1440.png`, `regras-editor-390.png` | Ações, composição usual, regra pausada e parte superior do editor com rodapé fixo. |
| `regras-max-320.png` atual, `regras-max-condicoes-320.png`, `regras-reflow-720x450.png`, `regras-erro-390.png`, `regras-recuperacao-390.png` | Início do caso máximo, trecho das condições, recorte de reflow e recuperação. A grade do reflow inicialmente continha o Limpar espúrio; não é prova de equivalência final desse controle. |
| `grupos-expandido-390-grid.png`, `grupos-editor-390.png`, `sincronizacoes-expandida-390-grid.png`, `conexoes-gerenciar-390-grid.png`, `auditoria-expandida-390-grid.png`, `auditoria-dados-390-grid.png`, `auditoria-confirmacao-390.png`, `auditoria-1000.png` | Conteúdo expandido, editores e confirmação visíveis nos recortes. Alguns foram capturados com a grade anterior; servem para examinar os conteúdos internos, não para validar ausência do botão Limpar na versão antiga. |

O contador paginado conserva **nesta página** quando há registros e não repete **0 transações** abaixo do Empty. Links de cursor/reinício continuam possíveis quando necessários: [CursorPagination](/home/suhett/Work/caderninho/src/web/account/cursor-pagination.tsx:28). Salvar regras conserva a consequência sobre próximas importações; grupo não altera titulares/permissões, e moeda existente não é convertida pelo editor. O diálogo de revogação conserva a exigência de nova autorização e a preservação dos dados financeiros.

As capturas e APIs de trabalho usam ambiente local com fixtures sintéticas. O conjunto público/demo segue a mesma implementação, com dados fictícios identificados. Capturas prontas, JSONs locais e testes automatizados não demonstram comportamento com banco real, OAuth real, validação em produção, acessibilidade completa ou aprovação humana. Não foi feito novo teste de teclado/leitor de tela por esta revisora.

**Resultado desta rodada:** o principal ganho está em reduzir repetição do ledger e da síntese de regras mantendo a informação que muda a interpretação. Grade e feedback receberam correções concretas. Não ficou um defeito visual impeditivo de 8/10 nos recortes finais aceitos; permanecem os limites de cobertura e de medição acima. A avaliação de encantamento do usuário e o uso com seu próprio volume de dados continuam sendo evidências diferentes desta revisão.
