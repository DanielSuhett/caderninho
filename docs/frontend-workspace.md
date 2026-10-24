# Páginas da instalação

O painel usa a identidade padrão escura do Kumo 2.14.0, com Inter local,
conteúdo/controles em 16 px e metadados em 14 px, ação primária e foco da biblioteca. A Sidebar real permanece
no desktop; até 760 px usa seu menu modal. A navegação pública tem seus próprios
links. [DESIGN.md](../DESIGN.md) e o [guia](design-system.md) governam a composição.

| Página | Conteúdo |
| --- | --- |
| `/account` | Resumo completo por período/moeda, categorias, série mensal, recentes e contas/cartões |
| `/account/transactions` | Table, filtros GET, Dialog de detalhes e parcelas |
| `/account/rules` | Condições, categoria, prioridade, preview, edição e composição com Flow sob demanda |
| `/account/groups` | Grupos de planejamento, orçamento, categorias e etiquetas |
| `/account/sync` | Rodadas, fases, estados, erros e referências históricas |
| `/account/audit` | Autorizações, requisições, ferramentas, modelos declarados e bytes |
| `/account/connections` | Pessoas, perfis Pluggy, conexão/importação e URL MCP |
| `/account/design-system` | Referência viva com os componentes reais e dados fictícios |

## Escopo e consulta

Pessoa identifica o titular declarado; perfil Pluggy identifica a aplicação de
coleta. Grupo organiza planejamento, sem mudar titularidade ou permissões.
A instalação é privada para o dono e seus filtros são apenas recortes de consulta.
Links conservam pessoa e grupo. Uma sincronização sempre abrange a conexão inteira.

Transações são ordenadas por data decrescente, com ID como desempate, em páginas
de até 50 registros. Valores conservam moeda e unidades menores exatas. A API
vincula o cursor aos filtros, à ordem e à revisão dos dados; se mudarem, reabrir a
lista. Não calcular um total apenas dos registros da página nem converter moedas.

Toolbar abre LayerDialog com rascunho dos filtros. Aplicar submete GET e reinicia
cursor; cancelar, X e Escape não alteram a URL. Limpar remove pessoa/grupo/cursor.
Datas aceitam digitação e calendário range em português, sem conversão de fuso.
A tabela muda sua composição no celular, mantendo valor, moeda, conta, sentido e
exceções. Dialog detalha origem, titular, datas, IDs e parcelas recebidas.

Transações mostra busca compacta com InputGroup/Button nativos e Filtros. O
catálogo completo do escopo determina escolhas, nunca só os registros da página:
menos de duas contas oculta o seletor; uma conta conhecida em todas as linhas
substitui a coluna repetida por contexto único. Pessoa/grupo de opção única também
saem do formulário visível. Hidden conserva filtros GET; seleções antigas
indisponíveis continuam no contexto, contador e Limpar. Entre duas e oito contas,
Select; acima disso, Combobox pesquisável. A lista mantém a moeda em cada valor,
sem seletor cambial ou total que misture moedas.

## Edição e operação

Regras e grupos usam Dialog. Alterações não salvas exigem descarte; busy bloqueia
fechamento e navegação. Salvar regra afeta próximas importações, sem reclassificar
histórico. Excluir exige confirmação e preserva os vínculos financeiros. Grupo
Pessoal não oferece exclusão. Nome de cliente/modelo MCP continua declarado.

Regras expandidas mostram escopo → alternativas OU/condições E → categoria com
Flow Kumo. No editor, “Visualizar composição” acompanha o rascunho; condições
incompletas exibem orientação textual. Em espaço estreito o fluxo é vertical.
O diagrama conserva a semântica do motor e não executa nem grava operações.
[Detalhes e limites](kumo/rule-flow.md).

Visão geral começa pelo resumo financeiro do período. Saldos importados são
estoques da última observação, separados dos movimentos mensais e da dívida do cartão. Conexões concentra configuração, primeira
importação, consulta parcial e recuperação. Fases e erros permanecem visíveis.
Autorizações precedem métricas na auditoria. Banner conserva erros/parcialidade;
Toasty confirma gravações concluídas. Importação usa Loader sem percentagem fictícia.

## Histórico persistente

`0004_sync_history.sql` acrescenta uma tabela e um trigger. Cada admissão cria uma
linha; cada checkpoint atualiza a mesma rodada, na mesma operação D1 que confirma
seu progresso. Repetir um checkpoint não duplica o histórico. A pessoa e o perfil
ficam vinculados à rodada desde a admissão; corrigir titularidade depois não
reescreve essas referências. Nomes são resolvidos pelo cadastro atual.

A migração recupera apenas a última rodada que ainda está em `connections` e a
marca como anterior à versão. Rodadas sobrescritas antes da migração não podem ser
reconstruídas. Falhas antigas sem horário final ficam com fim “Não registrado”.
O contador mostra **etapas confirmadas**, nunca quantidade de transações. A lista
usa páginas de 25 rodadas, ordem de admissão decrescente, filtros de pessoa/estado
e atualização explícita. Consultar a página não inicia sincronização.

## Segurança e validação

O polimento 08 conserva contratos GET e mutações. Busca de Regras é compacta;
filtro não repete o campo e preserva `q` oculto. Contagem complexa é absoluta,
ações antecedem o Flow e grupo/prioridade não se repetem dentro dele. Draft usa
dependências estáveis e composição memoizada; resultado da prévia aparece uma vez.
Ledger adapta à largura do container e conserva direção visível em zero,
nulo e sinal divergente. [Registro técnico/visual](kumo/polimento-08.md).

Todas as páginas exigem sessão. Catálogo e histórico são leituras autenticadas;
a consulta financeira usa POST com origem, JSON e CSRF validados, permitindo
as leituras de contas/transações, `get_overview` e `generate_chart` restrito a
`groupBy=month`. A allowlist não admite mutações. Nenhuma credencial é devolvida.

`tests/integration/workspace.test.ts` cobre histórico, replay, falha, migração,
titularidade, autenticação, CSRF, bloqueio de mutações e paginação cronológica
com valores acima do limite inteiro seguro de JavaScript. A revisão de navegador
usa apenas dados fictícios locais; evidências da navegação e filtros ficam em [navigation-review.md](navigation-review.md).
Publicação, migração remota e validação com Pluggy/OAuth reais não foram executadas.

O [guia de componentes](design-system.md) define a composição das páginas. Cabeçalhos, filtros, métricas, atualização e skeleton são compartilhados. A [auditoria](mcp-audit.md) explica identidade, volume, retenção e limites.

## Demo pública

`/demo` e `/demo/transactions` são assets públicos sem sessão e sem consulta à
API financeira privada. Compartilham WorkspaceFrame, SidebarFrame,
FinancialDashboard e TransactionList. Ledger sintético de maio a outubro 2026,
BRL e USD separados nos agregados da visão geral, com mês/moeda por GET.
Transações reúne moedas com identificação em cada linha, sem soma/conversão, e
usa mês/conta/busca por GET e Dialog de detalhes. Mês aparece junto ao título;
Mês e Conta são editados em Filtros. As notas da consulta ficam sob demanda.
A busca filtra o conjunto sintético inteiro. A landing oferece Demo no header e CTA.
Nenhum botão de conexão, edição ou revogação existe nessa navegação.

Mês/moeda, páginas e formulários GET da demo navegam no cliente sem recarregar o
documento. Voltar/Avançar conserva a URL como fonte do recorte. A navegação não
intercepta a passagem entre demo pública e painel privado. Sidebar móvel fecha
ao navegar e transfere foco ao conteúdo. No painel, páginas lazy recebem memo
para ignorar polling sem novos dados; foco/hover antecipam somente o código da
próxima página. [Medições e limites](kumo/performance.md).

[Dados e evidências](kumo/dados-e-evidencias.md) registra agregações completas,
tratamento de dados ausentes, dependência ECharts e distinção local/publicado.
