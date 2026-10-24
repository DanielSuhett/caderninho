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
| K01 | Versionar inventário e contrato visual em `DESIGN.md` | Preparação | Padrão Kumo explícito; candidatos condicionais não viram requisitos automáticos | Concluída |
| K02 | Tema, fonte, estilos standalone e controles em `design.tsx`, `design-tokens.ts`, `document.tsx`, `ui.tsx`, `portal-view.tsx` e Vite | K01 | Tema escuro, Inter local, conteúdo 16 px e metadados 14 px, estados nativos Kumo; sem overrides genéricos nem Hanken sem consumidor | Concluída |
| K03 | Sidebar real em `workspace-view.tsx` | K02 | Header/Menu/Group/Footer/Trigger da biblioteca; destinos e escopo preservados, menu móvel e teclado funcionando | Concluída |
| K04 | Filtros e formulários Kumo em workspace, regras, grupos e conexões | K02 | Input/Select/Combobox/Checkbox/Field conforme a tarefa; nomes, GET, rascunho, limpeza e cursor preservados | Concluída |
| K05 | Diálogos e detalhes em `workspace-drawer.tsx`, `backoffice-dialog.tsx`, editores e disclosures | K02 | Root sempre montado, Escape, foco, busy, descarte e retorno ao gatilho; nenhuma perda de rascunho por fechar overlay | Concluída |
| K06 | Visão geral com LayerCard/Table e estados reais em `dashboard-view.tsx` | K03–K05 | Contas antes dos metadados; saldos exatos por moeda, zero e indisponível distintos; parcialidade consultável | Concluída |
| K07 | Transações com Table/Collapsible/Badge e paginação em `transaction-list.tsx` e `transactions-view.tsx` | K03–K05 | Desktop e celular legíveis; compra agrupada, parcelas e datas de origem preservadas; total desconhecido sem páginas inventadas | Concluída |
| K08 | Regras, grupos, sincronizações, conexões e auditoria; Banner/Empty/Loader/SkeletonLine/cópia/Tooltip | K03–K07 | Todas as rotas e ações existentes cobertas; falhas descobertas; ferramentas, requisições, bytes e modelos distintos | Concluída |
| K09 | Landing, acesso, consentimento e 404 com Kumo; Meter com denominador conhecido | K02 | URLs/âncoras, campos e textos legais preservados; navegação pública própria; barras continuam consumo de cota | Concluída |
| K10 | Limpar CSS/galeria/docs e validar comportamento e aparência | K06–K09 | Check completo passou; revisão 03 registra 8/10 nas 14 páginas e estados vistos | Concluída |

## Decisões de escopo

- Adotar componentes que substituem uma responsabilidade existente. Wrappers
  só para semântica comum do produto; nenhuma biblioteca paralela de estilos.
- Manter `@cloudflare/kumo` 2.14.0. A API instalada prevalece sobre imagens ou
  documentação mais recente. Blocos CLI são referências, sem instalação cega.
- Na ampliação autorizada, Chart mensal foi integrado usando os agregados
  completos existentes e ECharts 6.1 sob demanda. Sankey, mapas, busca global e
  novos editores de tags continuam sem contrato/tarefa que justifique sua inclusão.
- Slider estilizado não existe no export instalado. Não usar para dinheiro
  exato. Meter só em faixa conhecida; Pluggy não fornece progresso global.
- Páginas e contratos existentes permanecem: esta é uma migração de interface,
  sem criar operações bancárias, permissões ou tabelas. Novos schemas de resposta
  validam os agregados já existentes expostos à consulta do portal.

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

Implementação e disposições de todos os componentes em [execucao.md](execucao.md).
Capturas e interações em [capturas/README.md](capturas/README.md) e [design-qa.md](../../design-qa.md).

## Ampliação autorizada: polimento e demonstração pública

| ID | Trabalho | Aceite | Estado |
| --- | --- | --- | --- |
| K11 | Inter local, escala semântica, contraste e grade comum | Conteúdo 16 px/metadado 14 px, eixos medidos e capturas com grade em todas as páginas; regra 14 da skill cede à preferência explícita | Concluída |
| K12 | Composição de dashboard e transações inspirada na demo Securo | Kumo real; métricas/agregados completos por moeda/período; transações compactas, sem imitar operações inexistentes | Concluída |
| K13 | Demo pública acessível pela landing | Dados fictícios isolados, período/contas interativos, sem autenticação/secrets nem escrita nas finanças reais | Concluída |
| K14 | Rodadas de crítica por página | Agente designer independente, notas qualitativas e evidência atual até 8/10 em cada página desktop/celular e estados essenciais | Concluída |

## Entrega da ampliação

K11–K14 concluídas com evidência em [QA](../../design-qa.md),
[dados/bundle](dados-e-evidencias.md), [revisão 03](revisao-critica-03.md) e
[galeria](capturas/README.md). As notas são qualitativas de um agente no papel
de designer crítica. Não equivalem à aprovação humana ou validação em produção.
