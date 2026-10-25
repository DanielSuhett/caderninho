# Composição visual das regras

Regras expandidas e o rascunho do editor usam o `Flow` real do
Kumo 2.14.0. A lista recolhida mantém o resumo compacto. A visualização do
editor fica em Collapsible e acompanha os campos e presets existentes.

## Leitura e contratos

Escopo obrigatório → alternativas OU, com condições E → categoria. Conta,
movimento e descrição globais continuam obrigatórios em todas as alternativas;
moeda pertence ao escopo. Há até quatro alternativas e oito condições por
alternativa. A única aplicação disponível é atribuir categoria: o diagrama
não acrescenta efeitos, automações ou estados financeiros.

Valores absolutos usam unidades menores exatas e moeda declarada, sem conversão
para Number. Datas civis conservam limites inclusivos. Descrições são literais;
referências ausentes são identificadas, sem virar “Todas”. Regras legadas sem
filter continuam mostrando a condição de texto original.

Ativa/pausada e prioridade ficam na linha da regra, fora do Flow. Grupo fica no
contexto da consulta/editor. A primeira regra ativa que
corresponder vence: pessoais antes dos pacotes, depois da menor prioridade para a maior, com ID como desempate.
Pausada informa no diagrama que não será aplicada e conserva prioridade na linha. Salvar afeta as
próximas importações; não reclassifica o histórico. A prévia de correspondências
continua distinta de uma garantia de qual regra vencerá.

## Composição e fluidez

Com container de pelo menos 800 px: nós de escopo/categoria com 200 px e
alternativas paralelas com 260 px. O Flow calcula conexões e posições. Alinhamento
nativo pelo topo mantém escopo e resultado disponíveis desde a primeira
alternativa, inclusive no caso máximo. Em espaço menor, inclusive no Dialog,
a orientação é vertical e as alternativas ocupam um nó com OU explícito.
Valores extremos têm linha própria e quebras somente entre grupos de milhares;
último grupo, casas decimais e moeda permanecem juntos, em 16 px.

O adaptador Flow é importado quando a composição entra na área visível, com
IntersectionObserver; ResizeObserver muda somente o modo horizontal/vertical.
A falha desse módulo opcional conserva a leitura HTML completa. O fallback
acompanha as larguras e os gaps instalados: 64 px entre etapas, 16 px entre
alternativas paralelas. Isso reduz diferenças de geometria; CLS não foi medido.
Não foram adicionadas dependências nem animação de execução fictícia. O conteúdo
compartilhado não depende do adaptador lazy, evitando ciclo de módulos.

API conferida nos exports, tipos e implementação instalados e na
[documentação oficial de Flow](https://kumo-ui.com/components/flow/). O registro
da CLI instalada ainda responde “Component not found” para Flow; essa omissão
não foi tratada como ausência do export granular.

Campo, comparador e valor são partes estruturadas da apresentação, sem recorte de
strings para encontrar dinheiro. O comparador usa Badge info; campo em 14 px e
valor em 16 px/peso 500. Escopo, alternativas, rascunho e fallback compartilham o
renderer. A composição é memoizada por condições/categoria/ativação, sem
reprocessar o Flow ao renomear. Ações precedem o diagrama e contagens são absolutas.
