# Composição visual das regras

24/10/2026. Regras expandidas e o rascunho do editor usam o `Flow` real do
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

## Evidência e limites

[Capturas da rodada 07](capturas/README.md) e
[revisão crítica](revisao-critica-07-rule-flow.md). Inspeção local do código
compilado com fixture privada sintética em 8799: lista recolhida, duas
alternativas expandidas, celular 391 px, regra máxima em 320 px e desktop
1440 px, pausada, preset no editor e falha deliberada do módulo opcional.

No máximo 4×8, o DOM contém 32 condições. A composição máxima exige rolagem
vertical longa; uma captura não mostra todos os nós. A geometria móvel foi salva
em JSON. O editor exerceu preset, condição incompleta, continuidade de rascunho
e descarte com retorno ao gatilho; nenhuma gravação foi executada nessa inspeção.

Quatro testes de apresentação verificam legado, OU/E, escopo obrigatório,
precisão monetária, datas, literais e referências ausentes. O gate completo
inclui os testes existentes de regras e runtime local. A fixture não executa o
motor real de prioridade: sua prévia sintética não é prova do resultado da regra.
Sem produção, Pluggy/OAuth reais, avaliação completa de acessibilidade ou
medição de FPS/INP/CLS.

Rodada 08: ações antes do Flow, resumo com contagens absolutas, política global
uma vez na página e resultado da prévia uma vez. Composição do editor memoizada
por condições/categoria/ativação, sem reprocessar o Flow ao renomear. A quinta
verificação de apresentação cobre contagens; [polimento e evidências](polimento-08.md).

Rodada 09: `/demo/rules` reutiliza esta composição e o editor real, com fixtures
compartilhadas e mutações em memória. Salvar e reaplicar são ações separadas;
reaplicação local usa `ruleMatches` e a ordenação `activeRules` do domínio.
Ela não executa importações ou mutações privadas. [Contrato da demo](demo-interativa.md).

Rodada 10: campo, comparador e valor são partes estruturadas da apresentação;
não há recorte de strings para encontrar o dinheiro. O comparador usa Badge info
do Kumo, o campo usa metadado de 14 px e o valor permanece em 16 px/peso 500.
Escopo, alternativas, rascunho e fallback compartilham o mesmo renderer.
Os temas claro/escuro conservam essa hierarquia com os tokens nativos. Comparações
continuam inclusivas e valores monetários exatos; cor não altera a avaliação.
