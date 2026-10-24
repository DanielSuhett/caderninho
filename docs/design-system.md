# Interface com Kumo

[DESIGN.md](../DESIGN.md) define os princípios e o tema escuro padrão do Kumo.
A versão instalada é `@cloudflare/kumo` 2.14.0; a API desta versão prevalece
sobre a documentação do site. [Inventário](kumo/inventario.md),
[plano](kumo/plano.md) e [execução](kumo/execucao.md) registram o escopo.

## Fundação

`Document` carrega `kumo.css` standalone e declara `data-mode="dark"`.
`DesignHead` carrega Inter local e `design.css`, com aliases de layout e regras de documento em `@layer base`:
as classes de componentes Kumo mantêm prioridade. Não definir a cor global de
`a`, fontes de controles ou seletores genéricos por `data-kumo-component`.
Não há Hanken nem wordmark especial. O nome é Caderninho.

Conteúdo e controles têm 16 px; metadados, `--text-xs` e `--text-sm` têm 14 px.
Inter local em `--font-sans` atende à preferência explícita do usuário, que
prevalece sobre a regra 14 px da skill. Métricas usam 32 px desktop/26 px móvel. Títulos usam `Text` ou headings sem alterar
tracking. Peso máximo 600. Componentes conservam foco, raios, sombras e estados.
Espaços do produto seguem 4, 8, 12, 16, 24 e 32 px. CSS próprio organiza conteúdo
e responsividade; não reconstrói Button, Select, Checkbox, Tooltip ou modal.

## Responsabilidades

| Responsabilidade | Implementação |
| --- | --- |
| Navegação autenticada | `workspace-shell.tsx`: Sidebar.Provider/Header/Content/Group/Menu/MenuButton/Footer/Trigger e useSidebar |
| Navegação pública | `PublicLayout` e landing estática, com seus links e âncoras próprios |
| Superfícies | LayerCard em listas irmãs; nunca LayerCard aninhado |
| Transações | Table, Badge e LayerDialog; descrição abre detalhes por botão com nome contextual |
| Contas, regras e histórico | Collapsible.DefaultTrigger/DefaultPanel com resumo financeiro; ações ficam no painel |
| Filtros | Toolbar e LayerDialog, GET e rascunho isolado |
| Campos | Input/Field/Label, Select pequeno, Combobox para conta/categoria, InputGroup na busca |
| Datas | Input date digitável + DatePicker range em Popover, carregado sob demanda e traduzido |
| Edição | LayerDialog sempre montado, proteção de rascunho, busy, Escape e retorno de foco |
| Feedback | Banner persistente, Empty, Loader e SkeletonLine; Toasty confirma salvamento concluído |
| Cópia | ClipboardText para URL MCP e InlineCopyText para IDs, com rótulos em português |
| Paginação | Pagination com total desconhecido; API só fornece cursor para avançar e URL de reinício |
| Medidas | Meter apenas com denominador declarado; escala relativa na atividade não representa cota |
| Explicação de consulta MCP | Flow real 2.14, quatro nós, horizontal/vertical; fallback HTML e carregamento sob demanda na landing |
| Composição de regras | Flow.Node/Parallel no detalhe e rascunho sob Collapsible; escopo → alternativas OU/condições E → categoria, vertical em espaço menor |

`UiButton` só mapeia `tone="danger"` para `destructive`. `UiField` usa o Field
integrado do Input. `UiCheckbox` acrescenta estado inicial de formulário à API
controlada do Checkbox 2.14, preservando o valor nativo `on`.

A Sidebar precisa de uma altura definida no shell. Seu Footer é uma linha
compacta; referência visual e saída pertencem ao Menu dentro de Content.
Não colocar uma lista vertical inteira no Footer nem sobrescrever sua aparência.
O menu móvel fecha após uma navegação aceita, preservando o bloqueio de rascunho.

## Contratos de interação

Busca de transações e regras fica visível com InputGroup; GET conserva os filtros
aplicados e reinicia sem cursor. Filtros editados são rascunho. Aplicar faz GET e remove o cursor anterior.
Cancelar/Escape não aplicam; reabrir lê os valores da URL. Limpar remove também
pessoa, grupo e cursor. Links de navegação preservam pessoa/grupo. Não simular
`ChangeEvent` para adaptar Select; usar `onValueChange`.

Calendário representa datas civis da origem. Não converter para UTC usando
`toISOString()`. Campos continuam aceitando um único limite inicial ou final.
DateRangePicker legado está deprecated; usar DatePicker com `mode="range"`.

RuleEditor e GroupEditor mantêm o rascunho enquanto o diálogo está aberto.
Escape/fechar solicita descarte quando há edição. “Continuar editando” conserva
os campos. Busy bloqueia fechamento e navegação; cancelamento não interrompe uma
escrita de resultado incerto. Confirmação destrutiva começa em Cancelar.
Roots permanecem montados ao fechar, permitindo a animação de saída do Kumo.

Movimento: wrapper de página em 180 ms/6 px; hero em 400 ms e seções públicas
em 280 ms, uma vez. Nenhum valor financeiro é interpolado e não há cascata de
linhas. Sidebar/Dialog/Collapsible mantêm transições nativas. O Collapsible
recebe neutralização local de painel/caret em `prefers-reduced-motion: reduce`.
O Flow tem uma sequência finita e pausável; textos não dependem da reprodução.
Não usar `finish()` para cancelar animações infinitas ao mudar a preferência:
`cancel()` devolve os elementos ao estado base. Evidências e limites em
[motion](kumo/motion.md).

Fluidez: páginas privadas lazy ignoram renders do polling com props idênticas;
foco/hover da Sidebar antecipam módulos sem antecipar consultas. Conexões é
carregada sob demanda. Grupos/valores/options do Chart conservam referência até
os dados ou a moeda mudarem. A demo mantém o shell ao navegar por GET.
[Evidências locais de desempenho](kumo/performance.md).

O preview de regra consulta; salvar afeta as próximas importações, sem
reclassificar histórico. Grupo Pessoal não pode ser excluído. Acesso MCP sempre
informa consequências e exige confirmação antes de revogar.

O diagrama de regra acompanha os campos existentes; não é um segundo editor nem
uma simulação de execução. Prioridade/pausa ficam fora das condições, e filtros
globais antecedem todas as alternativas. Importação lazy visível e fallback
textual preservam a consulta. [Contratos e evidências](kumo/rule-flow.md).

## Dados financeiros e técnicos

Não usar Number para dinheiro. Preservar `amountMinor`, moeda, direção, zero,
indisponível, ignorados, pendentes e futuras. Saldo de cartão não significa
dinheiro disponível. Parcelas usam datas e metadados estruturados da origem;
“registrada” não comprova pagamento da fatura. Não criar total da página.

Importação mostra fase/conta reais e segue consultável quando parcial. Não há
progresso global com denominador conhecido no contrato Pluggy atual.
A visão geral usa os agregados existentes `get_overview` e `generate_chart`,
com período completo por moeda. Chart nativo Kumo com ECharts 6.1 carrega sob demanda;
tabela alternativa preserva valores exatos e continua disponível quando o chunk
falha. Categoria usa Meter relativo com texto explícito, sem sugerir cota.
[Contratos, políticas e custo dos chunks](kumo/dados-e-evidencias.md).

Auditoria distingue requisições, ferramentas, falhas, cancelamentos, bytes e
modelos declarados. Bytes não são tokens nem custo de IA. A escala diária de
Meter usa o máximo observado no período, declarado no texto, sem sugerir cota.
Free tier mantém laranja como consumo, período, cota e estimativa identificados.

## Referência e validação

`/account/design-system` demonstra os componentes realmente usados, com dados
fictícios. Não mantém uma biblioteca própria de botões, tooltips ou sombras.
Surface e Code simples também estão deprecated na API instalada; não adotá-los
em novas composições. LayerCard e trechos curtos de código atendem aos usos atuais;
realce extenso depende de um caso real e avaliação do carregamento sob demanda.

`mise run check:quick` verifica tipos, imports, formato e lint. `mise run check`
inclui testes, build e runtime local. A revisão visual cobre desktop/celular,
expansões, formulários e estados; resultados e limites ficam em `design-qa.md`.
Não interpretar um build, uma captura sintética ou HTTP 200 como OAuth, Pluggy,
produção ou acessibilidade completa validados.

## Estilos e QA

CSS de documento, páginas públicas e landing em `src/web/styles/`; nenhum estilo
JSX authored inline. O build combina o standalone 2.14 com o CSS oficial de
componentes do pacote, removendo somente o import do binding já presente. Isso
repõe o CSS de DatePicker ausente no standalone, sem reconstruir seu calendário.
Popover do calendário limita a largura à viewport; datas continuam civis/pt-BR.

[Galeria atual](kumo/capturas/README.md), [revisão 03](kumo/revisao-critica-03.md)
e [QA](../design-qa.md) registram telas, estados, grade e limites da aprovação.
