# Revisão crítica 07 — composição de regras com Flow

24/10/2026. Revisão independente por agente no papel de designer crítica.

**Resultado: 8/10 para Regras nos recortes finais vistos desta rodada.** A nota
é um julgamento qualitativo de clareza e composição, não medição ou aprovação
humana. As primeiras versões do estado máximo foram reprovadas e corrigidas.
Não se estende a nota a páginas, trechos abaixo da dobra ou interações não vistos.

## 1. Semântica e uso do Kumo

Foram lidos a skill kumo-design, AGENTS.md, os contratos de regras, o avaliador
do domínio, a aplicação explícita, a prévia, o editor e a apresentação nova.
O conteúdo permanece em 16px conforme a preferência explícita do usuário e
DESIGN.md; essa decisão prevalece sobre a regra de 14px da skill.

A expressão representada é:

```text
grupo E restrições globais E moeda E
  ((condição A E condição B) OU (condição C E condição D))
→ categoria, se esta regra ativa vencer a precedência
```

Grupo delimita a consulta antes do avaliador; moeda, texto, conta e movimento
globais não podem ser contornados pelo OU. As alternativas usam `some`, e suas
condições usam `every`. Valor é absoluto, em unidades menores exatas, com moeda
obrigatória para comparar; ≥ e ≤ são inclusivos.

Estado ativa/pausada e prioridade são configuração da regra, não efeitos que
alteram o estado da transação. O efeito é categoria. A primeira regra ativa
correspondente vence por menor número de prioridade, com desempate por ID na
aplicação explícita. A prévia mostra correspondências; não garante que esta regra
vença outras, e salvar não reclassifica o histórico.

Referências de código verificadas:

| Fonte | Evidência |
| --- | --- |
| `src/domain/rules.entity.ts:28` e `:66` | Valor absoluto exato, globais em E e alternativas em OU |
| `src/contracts/rules.ts:56` | Até quatro alternativas, oito condições por alternativa e exigência de moeda |
| `src/worker/planning/mutations.service.ts:382` | Regras ativas do grupo, ordenação e primeiro resultado correspondente |
| `src/worker/planning/rule-preview.service.ts:39` | Prévia de correspondências com escopo, parcialidade e limite de varredura |
| `src/web/account/rule-presentation.ts:45` e `:82` | Literais preservados, referências desconhecidas explícitas, escopo e modelo de composição |

Flow é real do Kumo 2.14.0, confirmado no pacote instalado e no import granular.
`RuleFlow` usa `Flow.Node` e `Flow.Parallel`, com `canvas=false`. No celular e
no editor estreito, as alternativas ficam em um nó, com Ou/Se/E explícitos.
O fallback é textual, e o chunk só é solicitado quando a composição fica visível.
Não foi introduzida ação de backend ou canvas arrastável nesta apresentação.

## 2. Imagens efetivamente inspecionadas

Diretório: `docs/kumo/capturas/rodada-07/`.

| Captura | Estado e alcance |
| --- | --- |
| `regras-recolhidas-desktop.png` | Regra recolhida, resumo e ação principal; o diagrama não compete na lista inicial |
| `regras-composicao-desktop.png` | Regra com globais e duas alternativas, reaberta após o alinhamento final pelo topo |
| `regras-composicao-mobile.png` e `regras-composicao-mobile-resultado.png` | Escopo no primeiro recorte; alternativas, resultado e política no segundo; resultado final reaberto após corrigir a linha de valor |
| `regras-editor-preset-desktop.png` | Trecho do editor com preset, composição vertical, categoria, prévia e ações; não mostra todo o formulário superior |
| `regras-pausada-desktop.png` | Versão final com prioridade preservada, estado pausado e resultado condicional ao ativar |
| `regras-maximo-desktop-inicial.png` e `regras-maximo-mobile-320-inicial.png` | Versões iniciais rejeitadas; foram abertas antes de serem renomeadas para histórico |
| `regras-maximo-desktop.png` e `regras-maximo-mobile-320.png` | Recapturas corrigidas: orientação do escopo/resultado e quebra do valor somente entre milhares |
| `regras-fallback-503.png` | Regra legada simples com explicação completa estática, sem depender do chunk Flow |

Foram inspecionados 11 arquivos de imagem distintos, com reabertura dos estados
recapturados. As imagens do máximo mostram a primeira alternativa e o começo da
seguinte; não mostram visualmente todas as 32 condições. O executor informou
contagem de 32 condições, seis nós no desktop/três no celular e ausência de
overflow interno/documental. Essas medições complementam os recortes, sem serem
tratadas como inspeção visual de toda a rolagem.

## 3. Reprovações e correções verificadas

1. **P2 corrigido — corte no meio de um valor financeiro.** O máximo em 320px
   dividia um grupo de dígitos em `...547.4` / `09,93 BRL`. DOM exato e ausência
   de overflow não bastavam. A recaptura separa a linha de valor e quebra somente
   após grupos de milhares: `90.071.992.547.` / `409,93 BRL`. Grupo final,
   centavos e moeda permanecem juntos, com corpo de 16px. O código usa pontos
   explícitos de quebra e impede corte arbitrário dentro dos grupos.
2. **P2 corrigido — orientação perdida no máximo desktop.** O alinhamento pelo
   centro colocava escopo e categoria muito abaixo do início das quatro
   alternativas. A recaptura usa o `align="start"` nativo: os três topos começam
   juntos, e contexto e destino podem ser lidos antes da rolagem longa.
3. **Risco preventivo corrigido — fallback com geometria diferente.** O fallback
   começou como coluna única e depois usou gap de 64px entre alternativas, contra
   os 16px nativos do Parallel. Agora usa a mesma orientação pelo contêiner,
   alinhamento inicial e gap de 16px. A imagem 503 confirma conteúdo íntegro;
   não foi medido CLS durante a substituição.
4. **Semântica preservada no formatador.** Descrição permanece literal entre
   aspas, sem traduzir palavras iguais a enums. Conta/pessoa/grupo desconhecidos
   não viram Todas. Prioridade vazia é a definir, sem fabricar zero; a regra
   pausada conserva sua prioridade e não promete aplicação automática.
5. **Rascunho não é confirmação de gravação.** O estado de condições inválidas
   pede completá-las. O executor informou atualização por campos/preset reais,
   bloqueio de salvar no inválido, preservação ao continuar editando e retorno
   ao gatilho ao descartar. Não executei essas interações nesta revisão e não
   as converti em prova visual do formulário inteiro.

Referências da apresentação corrigida: `rule-flow.tsx:28` para alinhamento e
`:39` para Parallel; `rule-flow-content.tsx:7` para a linha de valor e `:60`
para o resultado; `rule-flow.css:56` para proteção dos grupos numéricos e `:81`
para o espaçamento do fallback; `rule-composition.tsx:81` para estado/prioridade.

## 4. Julgamento por estado

| Estado visto | Nota qualitativa | Leitura crítica |
| --- | --- | --- |
| Recolhida e composição usual desktop | 8/10 | Resumo discreto; diagrama sob demanda com escopo, OU/E e destino distintos |
| Composição usual móvel | 8/10 | Sequência vertical legível, com Ou explícito; não exige pan lateral |
| Editor no recorte de preset/prévia | 8/10 | Modelo acompanha o preset e a prévia distingue correspondência de aplicação; formulário superior não julgado por esse recorte |
| Regra pausada | 8/10 | Estado e prioridade claros, resultado condicional e conectores subordinados |
| Máximo corrigido, nos recortes desktop/320px | 8/10 | Escopo/resultado orientam o desktop e os grupos monetários ficam identificáveis; a rolagem continua longa e não foi visualmente coberta por inteiro |
| Fallback 503 | 8/10 | Definição completa e legível sem o diagrama nativo; erro do chunk não impede compreender a regra |

Não resta P1/P2 visual nos recortes finais vistos. O máximo continua denso:
32 condições não se tornam uma experiência curta por serem desenhadas. O Flow
ajuda na estrutura; não é evidência de facilidade de uso de qualquer regra
complexa. Não atribuo nota maior nem uso os testes para elevar a avaliação.

Variação visual: baixa e monocromática. Densidade: moderada na regra usual,
alta no máximo, contida na lista recolhida. Intensidade de movimento: baixa
por inferência de código; não há ciclo animado de aplicação da regra. Não foi
avaliada aqui a suavidade de todas as atualizações do rascunho. São inferências
qualitativas, não medições.

## 5. Limites e preservação

A avaliação usa ambiente local com dados sintéticos. HTTP 503 do chunk e
ausência de `.rule-flow` no fallback foram confirmados pelo executor; a revisão
abriu a imagem correspondente. O gate informado de 49 testes Node, 108 de
integração e runtime 10k/100k não determina a nota visual.

Esta rodada não comprova produção, aplicação real de regras, OAuth, acessibilidade
completa, todos os estados de erro ou movimento reduzido do SO. Não foi feita
gravação, exclusão ou nova operação de backend por esta revisão. Apenas este
relatório foi editado, sem alterações em UI ou Git.

Próxima ação humana, em até dois minutos: abrir uma regra com duas alternativas
e conferir se o escopo obrigatório permanece claro antes de ler o Ou.
