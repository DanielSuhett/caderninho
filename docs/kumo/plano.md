# Migração para os componentes padrão do Kumo

Autorização: 24/10/2026. Implementar no produto existente, abandonando a
identidade visual anterior. Fonte: [inventário](inventario.md), skill
`kumo-design` e API instalada `@cloudflare/kumo` 2.14.0.

## Preparação concluída

O trabalho anterior foi preservado em `6f1ebad`, integrado à `main` local
por `e6e9f09`, sem squash. Esta execução parte dessa main em
`codex/kumo-refactor`. Merge inicial sem conflitos e com conteúdo idêntico
à branch de origem. Publicação e deploy são operações separadas.

## Sequência de tarefas

Cada tarefa inclui remoção do código que substitui. A coluna de evidência
recebe o resultado real da execução, sem transformar planos em validação.

| ID | Tarefa e arquivos principais | Dependência | Aceite observável | Estado |
| --- | --- | --- | --- | --- |
| K01 | Versionar inventário e contrato visual em `DESIGN.md` | Preparação | Padrão Kumo explícito; candidatos condicionais não viram requisitos automáticos | Em execução |
| K02 | Tema, fonte, estilos standalone e controles em `design.tsx`, `design-tokens.ts`, `document.tsx`, `ui.tsx`, `portal-view.tsx` e Vite | K01 | Tema claro, fonte do sistema, corpo 14 px, estados nativos Kumo; sem overrides genéricos nem Hanken sem consumidor | Pendente |
| K03 | Sidebar real em `workspace-view.tsx` | K02 | Header/Menu/Group/Footer/Trigger da biblioteca; destinos e escopo preservados, menu móvel e teclado funcionando | Pendente |
| K04 | Filtros e formulários Kumo em workspace, regras, grupos e conexões | K02 | Input/Select/Combobox/Checkbox/Field conforme a tarefa; nomes, GET, rascunho, limpeza e cursor preservados | Pendente |
| K05 | Diálogos e detalhes em `workspace-drawer.tsx`, `backoffice-dialog.tsx`, editores e disclosures | K02 | Root sempre montado, Escape, foco, busy, descarte e retorno ao gatilho; nenhuma perda de rascunho por fechar overlay | Pendente |
| K06 | Visão geral com LayerCard/Table e estados reais em `dashboard-view.tsx` | K03–K05 | Contas antes dos metadados; saldos exatos por moeda, zero e indisponível distintos; parcialidade consultável | Pendente |
| K07 | Transações com Table/Collapsible/Badge e paginação em `transaction-list.tsx` e `transactions-view.tsx` | K03–K05 | Desktop e celular legíveis; compra agrupada, parcelas e datas de origem preservadas; total desconhecido sem páginas inventadas | Pendente |
| K08 | Regras, grupos, sincronizações, conexões e auditoria; Banner/Empty/Loader/SkeletonLine/cópia/Tooltip | K03–K07 | Todas as rotas e ações existentes cobertas; falhas descobertas; ferramentas, requisições, bytes e modelos distintos | Pendente |
| K09 | Landing, acesso, consentimento e 404 com Kumo; Meter com denominador conhecido | K02 | URLs/âncoras, campos e textos legais preservados; navegação pública própria; barras continuam consumo de cota | Pendente |
| K10 | Limpar CSS/galeria/docs e validar comportamento e aparência | K06–K09 | Check completo, revisão desktop/celular e estados expandidos; relatório `design-qa.md`, limites e bundle registrados | Pendente |

## Decisões de escopo

- Adotar componentes que substituem uma responsabilidade existente. Wrappers
  só para semântica comum do produto; nenhuma biblioteca paralela de estilos.
- Manter `@cloudflare/kumo` 2.14.0. A API instalada prevalece sobre imagens ou
  documentação mais recente. Blocos CLI são referências, sem instalação cega.
- Gráficos financeiros, Sankey, mapas, busca global e novos editores de tags
  não são exigências desta migração. Chart/Timeseries dependem de agregação
  completa, moeda, período, escopo, política financeira e avaliação de ECharts.
- Slider estilizado não existe no export instalado. Não usar para dinheiro
  exato. Meter só em faixa conhecida; Pluggy não fornece progresso global.
- Páginas e contratos existentes permanecem: esta é uma migração de interface,
  sem criar operações bancárias, permissões, tabelas ou contratos de consulta.

## Invariantes e testes relevantes

Dinheiro usa `amountMinor`, sem passagem por `Number`. Preservar BRL e outras
moedas, direção, zero, valor ausente, pendentes, futuras, ignoradas e parcelas
agrupadas. Nunca somar apenas a página atual ou converter moedas implicitamente.

Filtros conservam nomes e valores de query; aplicar reinicia cursor, cancelar
preserva a consulta, voltar/recarregar funciona e pessoa/grupo seguem nos links.
Escritas conservam CSRF, origem e ausência de retry após resultado incerto.

Diálogos preservam edição não salva, confirmação, foco inicial/retorno, Escape
e estado busy. Testar efeitos observáveis, sem snapshots da implementação Kumo.
Avisos críticos e parcialidade permanecem persistentes; toast serve para feedback
breve de copiar/salvar. A importação mostra fase real e continua consultável.

MCP distingue requisições, ferramentas, falhas, cancelamentos e bytes. Modelos
são declarados, não verificados; bytes não representam tokens ou custo de IA.
Free tier declara período, denominador e estimativa; preenchimento é consumo.

## Cobertura visual de entrega

| Jornada | Rotas | Estados mínimos |
| --- | --- | --- |
| Pública | `/`, `/account/login`, `/authorize`, 404 | Desktop/celular, formulário, erro, escopos e ações legais |
| Consulta | `/account`, `/account/transactions` | Carregamento, vazio, parcial, erro, conta e parcela expandidas, filtros e paginação |
| Organização | `/account/rules`, `/account/groups` | Lista, detalhe, criar/editar, preview, erro, descarte e exclusão |
| Operação | `/account/connections`, `/account/sync`, `/account/audit` | Importação ativa/falha/vazia, histórico, concessões e atividade expandida |
| Referência | `/account/design-system` | Componentes realmente usados, estados e layout responsivo |

Verificações: `mise run check:quick` por conjunto coerente; `mise run check`
na entrega. Capturas e comparações com os componentes oficiais no navegador.
Evidência local/sintética não comprova Pluggy, OAuth real, produção ou host MCP.

## Evidências da execução

Serão registradas aqui e em `design-qa.md` ao concluir cada conjunto.
