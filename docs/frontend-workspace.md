# Páginas da instalação

O painel usa os temas claro e escuro do Kumo 2.14.0, com preferência local, Inter local,
conteúdo/controles em 16 px e metadados em 14 px, ação primária e foco da biblioteca. A Sidebar real permanece
no desktop; até 760 px usa seu menu modal. A navegação pública tem seus próprios
links. [DESIGN.md](../DESIGN.md) e o [guia](design-system.md) governam a composição.

| Página | Conteúdo |
| --- | --- |
| `/account` | Resumo completo por período/moeda, categorias, série mensal, recentes e contas/cartões |
| `/account/transactions` | Table, filtros GET, Dialog de detalhes e parcelas |
| `/account/cards` | Gastos do mês, categorias, limites e parcelas de um cartão ou de todos |
| `/account/investments` | Carteira de ativos: posição bruta/líquida, resultado, resgate e composição por classe/instituição |
| `/account/rules` | Condições, categoria, prioridade, preview, edição e composição com Flow sob demanda |
| `/account/groups` | Grupos de planejamento, categorias e etiquetas |
| `/account/sync` | Rodadas, fases, estados, erros e referências históricas |
| `/account/audit` | Autorizações, requisições, ferramentas, modelos declarados e bytes |
| `/account/connections` | Pessoas/bancos, nome/foto, credenciais, importação após Pessoas e URL MCP |
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
exceções. Dialog detalha titular, datas, categoria, identificação financeira e parcelas recebidas. Não exibe IDs ou referências técnicas genéricas.

Transações mostra busca compacta com InputGroup/Button nativos e Filtros. O
catálogo completo do escopo determina escolhas, nunca só os registros da página:
menos de duas contas oculta o seletor; uma conta conhecida em todas as linhas
substitui a coluna repetida por contexto único. Pessoa/grupo de opção única também
saem do formulário visível. Hidden conserva filtros GET; seleções antigas
indisponíveis continuam no contexto, contador e Limpar. Entre duas e oito contas,
Select; acima disso, Combobox pesquisável. A lista mantém a moeda em cada valor,
sem seletor cambial ou total que misture moedas.

Transações tem as abas Todas e Sem categoria (`uncategorized=on`). O filtro usa
a categoria efetiva, antes da paginação; uma compra agrupada entra quando pelo
menos uma parcela recebida está sem categoria. As demais parcelas permanecem
visíveis no detalhe. Voltar, busca e filtros conservam a aba; Limpar mantém seu
recorte de classificação. GET da demo conserva também o mês.
Badge warning mostra a quantidade de compras/lançamentos que precisam de
classificação em todo o recorte recebido, antes do cursor e sem o filtro de
categoria que a própria aba remove. Não é contagem só da página nem quantidade
de parcelas; parcialidade da importação continua sinalizada.

A linha inteira abre o detalhe por ponteiro, delegando ao trigger nativo do Kumo
para devolver o foco à mesma transação. Seleção de texto e cliques em controles
internos são preservados. O botão da descrição continua acessível por teclado.
Avatares recebem contorno imediato de destaque sob o ponteiro.

O botão “Resolva com sua IA” abre um Dialog com ClipboardText para copiar um prompt contextual para o
agente do usuário. Ele inclui o escopo, categorias e até 20 grupos de evidências,
explica agrupamento/paginação e solicita revisão antes de escrever. Usa `status`,
`get_categories`, `get_rules`, `get_transaction_purchases`, `get_transactions`,
`preview_rule`, `batch_edit_transactions` e, se aprovado, `create_rule`.
Descrições são dados não confiáveis; não são instruções. Não há envio automático,
classificação automática ou promessa de execução. O prompt da demo declara seus
IDs fictícios. A apresentação de orçamento saiu de Grupos; dados e ferramentas
existentes de orçamento continuam preservados.

Categoria é editável diretamente pela caneta na linha e por Categorizar no
menu/detalhe. A gravação usa `batch_edit_transactions` restrito a IDs, categoria,
grupo, revisão esperada, confirmação e idempotência. Não permite alterar valor,
direção, data ou descrição por esse caminho. Compras agrupadas informam que a
escolha abrange suas parcelas recebidas; não criam edições de parcelas ausentes.
Uma revisão obsoleta exige atualizar antes de repetir. A edição sobrevive à
importação sem sobrescrever a observação bancária.

Criar regra abre o editor existente, com descrição literal, conta, movimento e
moeda preenchidos; a categoria ainda precisa ser escolhida se estiver ausente.
O rascunho e a prévia podem ser revisados antes de salvar. Não reaplica o histórico
automaticamente. Produto e demo usam os mesmos controles; a demo conserva as
alterações apenas na memória da aba.

A History API preserva shell, sessão e cliente API. Links continuam anchors;
login, destinos externos, fragmentos, downloads, cliques modificados e POST
mantêm navegação nativa. GET participa da navegação interna; popstate restaura
Voltar/Avançar. A mudança fecha o menu móvel e transfere foco ao conteúdo.
O cache de leitura usa a chave completa, 20 entradas e dez segundos na memória;
atualização manual ignora cache. Escritas invalidam antes e depois da requisição,
e leituras anteriores não repovoam o cache. Uma leitura antiga também não pode
sobrescrever uma atualização mais recente da mesma chave. Falhas não são armazenadas.
Skeleton
aparece após 150 ms. Não persistir esse cache financeiro no navegador.

A confirmação do widget registra o banco com `deferImport: true`. Ao concluir
Pessoas, o loading pede somente as primeiras importações ainda não admitidas.
O contrato antigo de registro sem essa opção preserva a importação imediata.
O cron atualiza apenas bancos cuja primeira importação já foi admitida. Durante a execução e com a aba visível, o
monitor consulta a cada dois segundos; falhas aumentam o intervalo até 30 segundos
e suspendem após cinco erros. Retorno à aba ou atualização manual reconcilia o
estado. Ler status não inicia importação.

## Edição e operação

Regras e grupos usam Dialog. Alterações não salvas exigem descarte; busy bloqueia
fechamento e navegação. Salvar regra afeta próximas importações, sem reclassificar
histórico. Excluir exige confirmação e preserva os vínculos financeiros. Grupo
Pessoal não oferece exclusão. Nome de cliente/modelo MCP continua declarado.

Regras expandidas mostram escopo → alternativas OU/condições E → categoria com
Flow Kumo. No editor, “Visualizar composição” acompanha o rascunho; condições
incompletas exibem orientação textual. Em espaço estreito o fluxo é vertical.
O diagrama conserva a semântica do motor e não executa nem grava operações.
A composição visual segue o [guia de componentes](design-system.md#composição-de-regras).

Visão geral começa pelo resumo financeiro do período. Saldos importados são
estoques da última observação, separados dos movimentos mensais e da dívida do cartão. Pessoas concentra configuração, bancos, primeira
importação, consulta parcial e recuperação. Fases e erros permanecem visíveis.
Autorizações precedem métricas na auditoria. Banner conserva erros/parcialidade;
Toasty confirma gravações concluídas. Importação usa Loader sem percentagem fictícia.

## Histórico persistente

`sync_history` e seu trigger fazem parte do schema inicial. Cada admissão cria uma
linha; cada checkpoint atualiza a mesma rodada, na mesma operação D1 que confirma
seu progresso. Repetir um checkpoint não duplica o histórico. A pessoa e o perfil
ficam vinculados à rodada desde a admissão; corrigir titularidade depois não
reescreve essas referências. Nomes são resolvidos pelo cadastro atual.

O contador mostra **etapas confirmadas**, nunca quantidade de transações. A lista
usa páginas de 25 rodadas, ordem de admissão decrescente, filtros de pessoa/estado/conexão
e atualização explícita. Consultar a página não inicia sincronização.

## Segurança e validação

O cliente HTTP valida as respostas por ferramenta e fornece resultados tipados às
telas. Entradas URL e rascunhos continuam sendo validados nas respectivas fronteiras.
Imports Kumo usam as entradas específicas de cada componente, incluindo as páginas
renderizadas no Worker; o lint impede o carregamento do barrel completo.

A interface conserva contratos GET e mutações. Busca de Regras é compacta;
filtro não repete o campo e preserva `q` oculto. Contagem complexa é absoluta,
ações antecedem o Flow e grupo/prioridade não se repetem dentro dele. Draft usa
dependências estáveis e composição memoizada; resultado da prévia aparece uma vez.
Ledger adapta à largura do container e conserva direção visível em zero,
nulo e sinal divergente.

Todas as páginas exigem sessão. Catálogo e histórico são leituras autenticadas;
a consulta financeira usa POST com origem, JSON e CSRF validados, permitindo
as leituras de contas, ocorrências, compras agrupadas, `get_overview`,
`get_portal_cards`, `get_investments`, `get_card_commitments`,
`generate_chart` restrito a `groupBy=month` e `preview_rule_import`. Essa allowlist
é somente de leitura; escritas têm schema próprio. Nenhuma credencial é devolvida.

`tests/integration/workspace.test.ts` cobre histórico, replay, falha,
titularidade, autenticação, CSRF, bloqueio de mutações e paginação cronológica
com valores acima do limite inteiro seguro de JavaScript. A revisão de navegador
usa apenas dados fictícios locais. `navigation.test.ts` cobre destinos e
Voltar/Avançar; `api.test.ts` cobre cache, invalidação e falhas.
Publicação, migração remota e validação com Pluggy/OAuth reais não foram executadas.

O [guia de componentes](design-system.md) define a composição das páginas. Cabeçalhos, filtros, métricas, atualização e skeleton são compartilhados. A [auditoria](mcp-audit.md) explica identidade, volume, retenção e limites.

## Demo pública

`/demo` monta o mesmo `AccountView` do painel privado, com o mesmo shell,
roteador, páginas, filtros, editores e carregamento por rota. `demo-entry.ts`
inicializa a validação e injeta `createDemoFetch` em `createAccountApi` antes
de chamar `mountAccount`. Não há uma segunda árvore de telas para a demo.

`demo-api.ts` responde em memória aos mesmos endpoints HTTP consumidos pelo
produto. O cliente real mantém validação de contratos, cancelamento, cache e
invalidação após escritas. A navegação compartilhada troca apenas o prefixo
`/account` por `/demo`, incluindo links, formulários GET, cursores e subpáginas.
Visão geral, Transações, Cartões, Investimentos, Regras, Grupos, Pessoas,
Sincronizações, Auditoria e Referência visual usam suas telas reais.

As respostas vêm de fixtures sintéticas de `src/fixtures` e da sessão isolada
por aba em `demo-session.ts`. `demo-data.ts`, `demo-cards.ts` e
`demo-transaction-detail.ts` preparam os resultados simulados, sem componentes
de interface. BRL e USD permanecem separados, e parcelas conservam as ocorrências
recebidas. Consultas vazias e filtros usam o mesmo contrato do painel.
`demo-api.test.ts` exercita o cliente real, leituras, paginação, escritas,
invalidação e isolamento entre sessões.

Edições de categorias, regras, grupos e limites duram até recarregar a aba.
Restaurar demonstração recarrega os dados iniciais. O transporte nunca recorre
a fetch de rede: origem externa, endpoints desconhecidos e operações bancárias
indisponíveis são recusados localmente. Abrir uma conexão bancária na demo
informa que é necessário instalar uma cópia. Não consulta D1, credenciais,
autorizações ou contas reais. As simulações não comprovam persistência,
concorrência ou atomicidade do backend.

## Agregação e apresentação

A aba [Cartões](cards.md), em `/account/cards`, tem um recorte próprio de contas
`CREDIT`: inclui compras sem categoria e separa limite atual, gastos confirmados,
pendências e parcelas futuras. A rosca divide as compras antes dos estornos;
não atribui categorias à ocupação do limite. A demo equivalente é `/demo/cards`.

Resumo/categorias usam `get_overview`; a série usa `generate_chart` com
`groupBy=month` e seis meses. O portal valida ambos pelos schemas de resposta.
Agregados percorrem a seleção completa; a lista recente de até seis registros
é independente do cálculo. No painel, recentes declaram todas as moedas;
na demo, usam a moeda escolhida. Não há conversão cambial.

Somente POSTED até `referenceDay` entra nos realizados. Ignorados, pendentes e
futuros ficam fora; transferências/pagamentos de fatura não são receitas/despesas.
Fluxo BANK inclui movimentos de transferência; estornos reduzem a despesa da
categoria. Parcelas entram pela data de cada ocorrência, sem antecipar a compra.
Saldo BANK soma exatamente as últimas observações visíveis por moeda e fica
indisponível se faltar valor; não é fechamento mensal. Cartões ficam separados.

Dinheiro usa strings inteiras/BigInt. Ausência não vira zero e grupos conhecidos
permanecem identificados. Meter declara a escala relativa ao maior volume absoluto;
o sinal é preservado no texto, sem sugerir cota. O gráfico só converte inteiros
seguros para geometria; valores maiores conservam a tabela exata. Falha da série
não derruba o resumo; falha do chunk gráfico mostra tabela imediatamente. Sem
grupos não se oferece controle vazio nem percentuais ou indicadores inventados.

## Editor de regras e grupos

Nova regra separa nome, categoria, prioridade e estado das condições. Presets
editáveis em BRL substituem só filtros: não escolhem categoria nem inferem
transferência entre contas próprias. Até quatro alternativas OU, com oito
condições E cada; campos globais continuam obrigatórios. Texto ignora caixa
ASCII A–Z, mantendo acentos literais. Dinheiro exige moeda e magnitude exata;
datas têm limites inclusivos. Referência ausente não significa Todas.

Prévia espera 500 ms após mudar filtros, cancela a anterior e ignora respostas
antigas; nome/categoria/prioridade não disparam nova consulta. Exibe até cinco
amostras e contagem parcial acima de 10 mil registros. Correspondência não prova
alteração, precedência ou categoria diferente. Regras pessoais precedem defaults,
depois menor prioridade e ID. Salvar afeta novas importações; reaplicar histórico
é ação explícita. Excluir conserva classificações anteriores.

Grupo é espaço de planejamento: nome, tipo, moeda e início do mês; editar preserva
moeda. Não concede acesso nem muda titularidade. O pessoal é protegido; remover
outro exige ausência de contas, regras, categorias próprias e demais vínculos,
sem exclusão em cascata. Edição falha preserva rascunho; envio duplicado é impedido.
Cancelar, Escape ou Voltar com edição solicita decisão; descartar fecha na página
atual. Sair/recarregar usa a proteção nativa do navegador.

`POST /api/account/planning` permite CRUD de regras, espaços, categorias e
agrupadores, além de `import_rules`, com sessão, origem, CSRF, revisão atômica e
recibo idempotente;
chave reutilizada com outro comando retorna 409. `rule-preview` é leitura
validada, limitada e consistente, sem invalidar cache. Query e planning aceitam
corpos até 80 KiB; rule-preview até 64 KiB e o JSON importado até 64 KiB. Debounce
não é rate limit global. Filtros legados combinam por E com o
filtro composto. Comparações SQL de magnitude usam comprimento/ordem lexical,
sem ponto flutuante. Importação JSON segue [o contrato próprio](rule-packs.md).

## Compras parceladas

A consulta agrupa no servidor antes de paginar, preservando compras completas.
A âncora é `purchaseDate`; sem ela, usa a primeira data observada e informa
Primeira parcela conhecida, sem inventar datas ausentes. A página conta compras
e lançamentos avulsos. O padrão mostra âncoras até hoje; Ver lançamentos futuros
abre o recorte futuro. Parcelas futuras de compra passada continuam no detalhe.

A linha mostra quantidade e valor da parcela conhecida com esse rótulo. Valores
variáveis não viram parcela fixa nem total multiplicado. O detalhe ordena números
de parcela, datas e valores exatos, distingue Pendente/Registrada na origem de
Futura e informa parcelas não recebidas sem gerar registros. POSTED não prova
pagamento da fatura. Valor e descrição lideram; metadados ficam secundários, sem
rolagem horizontal; o botão de detalhes tem nome contextual e foco visível.

Conta/cartão, moeda, comerciante, valor, número/total e data original ou mês
inferido permitem associar parcelas; `billId` não identifica compra. Colisões ou
evidência insuficiente ficam avulsas com indicador como 2/12. Sem `purchaseDate`,
a associação é probabilística e pode mudar após nova coleta. Filtro de data usa a
âncora; estado seleciona compras com ao menos uma parcela correspondente e
preserva as demais no detalhe. `get_transactions` continua retornando ocorrências;
`get_transaction_purchases` compartilha a lista do painel. Agrupamento não muda
classificação, fluxo de caixa ou situação da fatura.

`workspace.test.ts` verifica agrupamento, futuro, pendentes, ambiguidades,
lacunas e paginação. A [documentação da Pluggy](https://docs.pluggy.ai/en/docs/products/credit-card-installments)
explica a ausência de uma chave única de compra e o envio de parcelas em momentos
diferentes. Dados sintéticos e capturas não comprovam identidade de compras reais,
situação de faturas ou uso com leitor de tela.


## Fluidez e sincronização visível

O relógio compartilhado expõe a última importação concluída por Popover, em
mobile e desktop. Importações pending/running mostram Loader e a conclusão real
recebe verde por três minutos. Falha e indisponibilidade não viram sucesso.
`AccountView` invalida leituras quando o snapshot muda; `ResourceVersion` atualiza
recursos montados sem depender de um botão de recarga. Não há polling ocioso.
Ações de sincronizar bancos e de recuperar falhas conservam seus contratos.

A demo usa `OrganizationView` e `RuleImporter` do produto, sem um modal próprio.
O Worker e a sessão sintética chamam o mesmo `prepareRuleImport` em
`domain/rule-import.entity.ts`: resolução de categorias, identidade do pacote,
duplicatas e preservação de edições têm uma única implementação. O plano é puro;
os adaptadores validam referências de contas/pessoas e só então gravam no seu
armazenamento. Não existe uma implementação `demo-rule-import.ts` separada.
JSON é conferido antes da escrita; revisão bloqueia a prévia antiga e recibos
tornam tentativas idempotentes. Escritas sintéticas são serializadas por aba;
D1 conserva a transação e os recibos duráveis do produto. A importação não
reclassifica o histórico. A paridade de prévia/importação/repetição é exercitada
pelas duas APIs no mesmo teste de integração.

Painel e demo usam os mesmos loaders de página em `WorkspaceView`. As
rotas aquecem código no foco/hover, sem buscar dados. `ChartViewport` mantém o
espaço e monta o canvas perto da área visível; tooltips HTML usam tokens do tema.
A landing mantém HTML estático e entradas distintas para cada ilha interativa.
