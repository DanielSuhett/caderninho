# Polimento de listas, regras e estados — rodada 08

24/10/2026. Itens 2–5 da revisão de qualidade. Partida em `38ade74`, branch
`codex/kumo-refactor`, checkout limpo. A hierarquia financeira do dashboard ficou
fora deste escopo. Sem dependências novas, push, deploy ou merge.

## 1. Transações calmas

Table real do Kumo 2.14.0 com colunas fixas e reflow pela largura do container do
ledger, inclusive com Sidebar. Superfície uniforme, separadores sutis e hover/foco
preservados. A API instalada não oferece variante sem zebra: a adaptação fica
restrita a `.transaction-row`, com tokens nativos, sem override genérico.

Categoria e exceções compartilham uma faixa. Parcelas, pendentes, futuras e
ignoradas continuam visíveis. Direção repetida fica visualmente oculta apenas
quando o sinal da origem é inequívoco: DEBIT negativo ou CREDIT positivo. Ela
segue acessível e no detalhe. Zero, indisponível e sinal divergente conservam
direção visível. Crédito positivo recebe `+`; sinal de débito não é fabricado.

Moeda permanece até no valor indisponível. `MoneyValue` organiza o texto exato:
quebra entre milhares, conservando decimais e moeda juntos. Valor extremo usa
faixa própria em 320 px. Sem soma da página, conversão ou dinheiro em Number.
Vazio não repete “0 transações”; cursor continua disponível quando aplicável.

## 2. Regras com menos repetição

Resumo complexo usa contagens absolutas: “2 alternativas · 4 condições”, depois
categoria. Grupo fica no contexto da consulta/editor; prioridade e situação na
linha da regra. Flow mantém escopo obrigatório, OU/E, categoria e consequência
da pausa. Editar/Mais ações vêm antes do diagrama, inclusive no máximo 4×8.
Política de prioridade/reclassificação aparece uma vez na página e consequência
de salvar junto do editor. Prévia não repete resultado nem alimenta estado pai.

Busca compacta GET preserva filtros e remove cursor; Dialog não repete busca.
Grupo único dispensa seletor, preservando campo oculto. `parseRuleDraft` depende
dos campos de condição e a composição memoizada ignora nome/prioridade.
Categoria/ativação/condições continuam atualizando o diagrama. Rascunho inválido
mostra mensagem, sem apresentar um diagrama antigo como atual.

## 3. Composição e estados

`.workspace-main` agora contém os elementos acessíveis ocultos. Antes, lista
longa podia expandir o documento e criar segunda barra vertical. Com 50 registros
em 320×845 CSS, documento ficou 320×845; lista rola dentro do main.

Auditoria usa subgrid para rótulo/valor, baseline comum para bytes de 20 px e
duração de 28 px e 2×2 até 1100 px. `?grid=1` não conta como filtro nem acrescenta
Limpar. Busca/Filtros com gap de 12 px cabem também em 320 px.

Erro oferece retry primeiro; três recuperações alternativas ficam em Collapsible
Kumo. Aviso de dado antigo aparece somente quando há dado mantido. Reabrir remove
cursor e grantCursor. Bootstrap tem margem 32/16 px; não é skeleton da lista.
Inputs dentro de Field/InputGroup conservam nome acessível explícito.

## 4. Evidência de fluidez

Fixture temporária: antes em 8804 com assets congelados de `38ade74`, depois em
8805 com build atual. Instrumentação fora do produto: fetch sem corpos/segredos,
PerformanceObserver e hook de Fiber. O contador exige PerformedWork e identidade
diferente do Fiber no commit anterior, excluindo subárvores reutilizadas.
É aproximação estrutural, não React Profiler nem duração de render.

| Exercício | Resultado observado | Limite |
| --- | --- | --- |
| Três edições do nome com editor/Flow abertos | Editor: 3 atualizações em ambos; Flow: 3 antes, 0 depois; 7 commits em ambos | Evita trabalho específico, sem provar aceleração percebida |
| Digitação até próximo rAF | Antes 11,9–37,3 ms; depois 11,6–33,9 ms | Intervalos se sobrepõem; rAF não é paint/INP |
| 50 registros: detalhe, Escape, Filtros, Escape | Depois: quatro EventTiming de 32–48 ms, sem novas longtasks ≥50 ms ou shifts na amostra | Amostra única; DPR/janelas diferentes da baseline, sem percentual comparável |
| Atraso sintético de 700 ms por API | Bootstrap seguido de 50 registros, sem longtasks nessa navegação | Shift inicial 0,0853; sem CWV de campo ou throttling de CPU |
| Teclado/rascunho | Tab nome→categoria; Escape retorna a Editar; cancelar/continuar mantém nome; descarte fecha; detalhe/filtros retornam ao gatilho | Não é auditoria completa de teclado/leitor de tela |

[JSONs e imagens](capturas/rodada-08/README.md). Movimento reduzido foi simulado:
fixture substitui consultas CSS/matchMedia; MCP mostra “Fluxo completo” sem
autoplay, com durações zero na amostra. A preferência nativa do SO não foi alterada.
Reflow 720×450 representa área CSS equivalente a 1440×900 a 200%; não é zoom nativo.

Sem virtualização: limite atual de 50 registros e exercício sem longtask que
justificasse custo/risco ao foco. Referência React consultada na skill oficial
da Vercel [React Best Practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices):
memo/stable props e remoção de estado derivado por effect. Não houve instalação
da skill/dependências nem aplicação automática de todas as sugestões.

## 5. Cobertura e validação

14 primeiras dobras em 1440×900 e 391×845 CSS, com/sem grade: visão geral,
transações, regras, grupos, sincronizações, conexões, auditoria, referência,
landing, acesso, consentimento, 404 e duas páginas demo. Largura adicional de
1000 px em cinco páginas operacionais, 320 px nos extremos e reflow 720×450.
Estados vistos: regras expandida/editor/pausa/máximo; grupo/editor; histórico;
gestão de conexões; grant/confirmação cancelada/métricas; vazio/espera/erro
identificados na galeria. Não significa todos os estados de cada página.

Grade confere eixos externos; recuos internos pertencem ao Kumo. Caso 4×8 exige
rolagem vertical: recorte não comprova todas as condições vistas. Capturas antes
do layout lazy, com segundo scroll ou gráfico em skeleton foram substituídas.
Variação visual baixa entre listas, densidade moderada/maior em conteúdo técnico
expandido e movimento de baixa intensidade são inferências qualitativas.

`mise run check` passou: tipos/formato/lint, 51 Node, 108 integração/19 arquivos,
build/dry-run e runtime Workflow/D1 10 mil/100 mil, desconexão, falha parcial,
replay e persistência após reinício. Aviso opcional conhecido de
`@emotion/is-prop-valid` no runner Kumo permanece. Sem produção, OAuth/Pluggy
reais, dispositivo físico, leitor de tela completo, FPS/INP de campo, escrita
financeira ou revogação real. A versão publicada não foi alterada/validada.

[Revisão independente](revisao-critica-08-polimento.md), limitada aos recortes;
nota qualitativa não equivale a aprovação humana automática.
