# Arquitetura do Caderninho

Um pacote npm e um deploy Cloudflare atendem painel, OAuth, MCP e importação.
A instalação tem um administrador e pode reunir várias pessoas e perfis Pluggy,
sem um limite local de dez conexões. Titularidade organiza dados e não cria contas
de login ou permissões por pessoa. A importação cobre contas BANK/CREDIT, transações, faturas, investimentos e
empréstimos disponibilizados pela Pluggy. As consultas e a importação estão descritas no [guia de uso](usage.md).

## Código

| Área | Responsabilidade |
| --- | --- |
| `src/domain` | Conexões, dinheiro exato, consultas e importação |
| `src/contracts` | Entradas externas Zod e contratos do painel/MCP |
| `src/worker` | Casos de uso, D1, OAuth, SDKs e transporte Cloudflare |
| `src/web` | Painel React e páginas públicas |
| `src/shared` | HTTP, resultados, hashing e logger |

| Módulo Worker | Responsabilidade |
| --- | --- |
| `installation` | Conexões e dados do painel |
| `household` | Pessoas, perfis, titularidade e referências de credenciais |
| `auth` | Senha, cookies assinados, OAuth oficial e revogação de assistentes |
| `finance` | Contas, transações, consultas e totais objetivos |
| `sync` | Admissão diária, despacho, páginas e commits duráveis |
| `planning` | Organização, lançamentos manuais e cálculos de planejamento |
| `mcp` | Ferramentas no SDK, mantendo as quatro originais |

Controllers validam transporte. Services coordenam casos de uso por portas em
`entity/index.ts`, sem SQL, HTTP ou Bindings. Repositories implementam essas portas
com Drizzle. A composição injeta implementações por requisição/importação.
Adapters Pluggy, OAuth e Workflow têm entradas explícitas. Não há repository
universal, container de DI nem camadas vazias.

## Persistência

| Tabela | Dados |
| --- | --- |
| `connections` | Item, mapa de contas/saldos e importação corrente (nove colunas) |
| `transactions` | Projeção financeira da origem, atualizada somente pela importação |

Contas usam seus IDs Pluggy como chaves do mapa JSON `connections.accounts`.
Cada valor contém somente nome, tipo, moeda, saldo e horário de leitura do saldo.
Contas ausentes preservam os metadados e o saldo com seu horário antigo.
Transações têm onze campos: id, account_id, date, amount_minor, currency,
direction, status, description, category, identification e classification. A coluna JSON
`identification` preserva um contrato tipado dos dados da Pluggy: descrição
original, categoria/códigos da origem, operação, estabelecimento e CNPJ/CNAE,
participantes/documentos/contas do pagamento, referências, dados de boleto e
cartão (MCC, tarifas, parcelas e datas), ordem e horários da origem. Os valores
monetários adicionais de boleto/cartão usam strings inteiras em unidades menores.
Valor na moeda da conta e saldo após o lançamento preservam unidades decimais
exatas, sem assumir que a moeda da transação seja a moeda da conta; esses campos
de identificação não participam dos totais financeiros.
Os últimos quatro dígitos identificam o cartão. O ID do recurso Pluggy identifica a
transação nesta instalação com uma aplicação Pluggy. A conexão e o tipo BANK
são resolvidos pelo mapa pequeno de contas, sem repetir esses dados no histórico.
Documentos de participantes são preservados como recebidos, inclusive máscaras.
O contrato descarta campos desconhecidos; não guarda o payload arbitrário do provedor.
A [referência técnica](cloudflare-product.md#contrato-mínimo-e-consumidores)
registra o consumidor de cada coluna e dos cinco valores por conta.

### Extensão de planejamento

`0002_planning.sql` acrescenta 21 tabelas, sem alterar as duas tabelas de origem.
Cada conceito possui uma tabela tipada com `id` e JSON pequeno por registro:
espaços, preferências de contas/cartões, sobreposições de transações, categorias,
tags, regras, recorrências, parcelas, metas, contribuições, investimentos,
empréstimos, cronogramas, marcações de faturas e preferências de notificação.
Faturas e metadados de contas/transações têm tabelas próprias. Revisão e recibos
completam o controle de concorrência e de repetição. Não há tabela universal de
recursos nem snapshot único com todo o histórico.

`0008_transaction_identification.sql` acrescenta a coluna de identificação sem
remover o histórico e copia os metadados de cartão já existentes. A tabela de
metadados de transações continua atendendo às projeções de planejamento; os
novos dados de identificação pertencem à transação de origem e só a importação
os atualiza. Registros antigos sem metadados mantêm `identification=null` até
uma nova importação. O portal apresenta os campos disponíveis nos detalhes e
busca por descrição, estabelecimento, documento e referências. As consultas
financeiras e de planejamento/MCP também retornam essa identificação.

`0009_fixed_categories.sql` acrescenta `transactions.classification` e
`planning_category_groups`. O catálogo contém 33 categorias fixas em cada espaço,
com ícone, cor e `groupId` em `planning_categories`; os agrupadores também têm
ícone/cor e pertencem a um espaço. Cada categoria tem zero ou um grupo, que pode
conter várias categorias. Remover um grupo desfaz o vínculo e preserva categorias,
regras e transações. Categorias legadas/personalizadas e referências são preservadas;
as duas categorias genéricas legadas ficam ocultas. Os nomes do catálogo fixo são
protegidos; sua aparência e agrupamento podem ser editados.

Prioridade efetiva: edição/regra local, Clef habilitado com decisão aceita,
conversão determinística Pluggy. Valores sem correspondência ficam sem categoria,
com o rótulo da origem preservado. Clef é opcional e desabilitado por padrão; usa
`clef-flash`, confiança mínima de 0,8 e opção `unknown`. A fase durável
`classification` roda depois da importação dos dados, em páginas limitadas, com
publicação atômica junto do checkpoint. Um hash da evidência evita repetir decisões
aceitas sem mudanças. Falhas/quota/respostas inválidas não impedem a importação.
Veja [categorias e classificação](categories.md) para configuração e contratos.

A leitura do planejamento captura a revisão junto das tabelas. As consultas efetivas filtram contas e período no SQL e leem as origens editadas
separadamente para preservar mudanças locais de data/conta. A lista usa paginação
ordenada e para após obter a página e sua continuação; uma mudança concorrente invalida o
resultado/cursor. Escritas calculam mudanças em memória e confirmam apenas os
registros alterados, a revisão e o recibo no mesmo batch. O CHECK da revisão
aborta commits obsoletos; a chave única impede duplicação. Triggers de publicação
invalidam cursores e aplicam regras a transações novas. As quatro ferramentas
originais conservam seus contratos e sua paginação seletiva.

O [catálogo e decisões financeiras](mcp-finance.md) registra limites e diferenças
da referência Visor. O schema inicial ainda não migra instalações históricas
anteriores ao modelo mínimo.

## Importação

Pedido manual ou cron às 09:00 UTC admite conexões elegíveis. Uma atualização
condicional da conexão confirma o ID da importação e reserva 24 horas, inclusive
em falha. O estado corrente impede duas execuções ativas; a elegibilidade deriva
da admissão. Não há pausa global, histórico de jobs ou lock mantido durante HTTP.

O Workflow usa o ID da execução. Despacho incerto conserva a intenção; o próximo
cron ou pedido manual recupera o mesmo ID. GET/status nunca despacham trabalho.
Falha terminal nativa encerra a execução D1; falha ao consultar status não prova
que ela terminou. Não há expiração de lock nem restart de execução encerrada.

Um único algoritmo relê contas e todas as páginas disponíveis de transações.
Cada `step.do` lê, valida e publica uma página; devolve só resumo/checkpoint.
O adapter Workflow limita retentativas a três e respeita Retry-After. Falhas
conhecidas viram resultados pequenos do step; a espera durável ocorre fora de
step.do. Não depender de propriedades de Error após o RPC. HTTP, SDK e retries
nativos adicionais não multiplicam as tentativas.

`sync/repository/publication.repository.ts` prepara os writes da página.
`sync/repository/index.ts` confirma metadados, transações, checkpoint, sequência e
estado no mesmo batch D1. A guarda de ID/estado/sequence usa o CHECK da sequência
para abortar todo o batch obsoleto. Mesmo ID e sequência N+1 reconstroem a última
página e o término; sequências mais avançadas recusam o executor. Não há recibos
persistidos, contadores de registros nem cópia adicional do checkpoint.

A travessia relê o catálogo pequeno no limite entre contas. Contas preservadas no
mapa não são marcadores de presença. Conta conhecida ausente nessa releitura
interrompe a importação com erro seguro, mesmo que reapareça depois. Os dados já
publicados são preservados, a conexão informa parcialidade e o último sucesso
completo não avança. Saldo não relido mantém seu horário anterior.

A origem pode mudar de ID ou reduzir a janela histórica. A importação atualiza
IDs existentes e acrescenta os novos. Ausência não remove nem desqualifica registros:
A/B seguido de B atualizado/C resulta em A/B atualizado/C nos totais elegíveis.
A projeção da origem não sofre edição local nem deduplicação por similaridade;
o planejamento mantém suas classificações e sobreposições em separado.
Coleta parcial preserva páginas confirmadas e continua sinalizada como parcial.

O adapter rejeita cursores inválidos, de outra conta, repetidos imediatamente ou
com continuação sem registros. Não há marcador por transação nem ledger de cursores
para detectar ciclos arbitrários entre páginas distintas.

## Consultas e dinheiro

D1 é a fonte das leituras. A paginação por data/conta/ID detecta mudanças no
ID, sequência, estado e metadados das conexões selecionadas no batch da leitura.
Alteração relevante exige reiniciar a consulta; importação não selecionada não
invalida o cursor. Totais
consideram toda a seleção SQL, não uma página. Moedas permanecem separadas.

Valores monetários são inteiros em strings, com até 30 dígitos por registro. A
soma SQL usa cinco parcelas inteiras de seis dígitos, reconstruídas com BigInt.
Não usa REAL nem converte valores financeiros para Number. Precisão/moeda não suportada
fica desconhecida, sem arredondar para zero.

Dia financeiro da origem é preservado. Elegibilidade usa o dia corrente em
America/Sao_Paulo. Pendentes e futuros ficam fora dos totais monetários e
continuam consultáveis. Contagem inclui todos os registros da seleção; débitos e
créditos são magnitudes da direção da origem e cash_flow é o fluxo assinado BANK.
Débito não equivale a gasto e crédito não equivale a renda. Valores desconhecidos
permanecem null e a parcialidade da coleta acompanha consultas e agregações.

## Acesso e operação

Os três secrets são ADMIN_PASSWORD, PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.
O painel usa cookie assinado, com expiração de oito horas conferida no servidor;
o MCP usa OAuth oficial. Autenticação administrativa não usa D1/KV. A chave deriva da
senha e da versão do Worker; trocar qualquer um invalida os cookies. Sair apenas
limpa o cookie local; a cópia continua válida até expirar ou ocorrer rotação.
Grants OAuth têm vida independente e revogação explícita. Não há usuários,
tenants, permissões por conta ou credenciais no D1. Login usa rate limit nativo
por IP confiável e por localização; não há tabela de tentativas.

A observabilidade preserva contexto isolado, erros seguros e spans por ação/página,
sem registrar payloads ou identidades financeiras. Consulte o
[roteiro](observability.md). A configuração atual mantém logs integrais e traces
amostrados em 10%; isso não comprova ingestão em produção.

Esta refatoração começa com um D1 vazio e um schema inicial. Não inclui atualização
de bancos antigos nem reset a cada deploy. O estado financeiro persiste após a
instalação. Deploy, migração remota e validação com provedor/host reais são etapas
separadas da validação local.

## Titularidade e múltiplas aplicações

`0003_household.sql` acrescenta `people`, `pluggy_profiles` e `connection_owners`.
O adapter seleciona exatamente um perfil, valida a origem e aplica namespace aos
IDs novos. A origem legada mantém os IDs. Credenciais adicionais ficam no KV;
metadados e hash da aplicação ficam no D1. Painel e consultas financeiras usam
a mesma atribuição de pessoa. Veja [decisões e operação](household.md).

## Histórico e páginas da instalação

`0004_sync_history.sql` adiciona o registro durável das rodadas sem substituir o
checkpoint corrente. O trigger acompanha a mesma escrita atômica de progresso;
pessoa e perfil são fixados na admissão. O painel consulta catálogo de planejamento
e histórico por repositories específicos, e reutiliza o serviço de consultas MCP
para a visão financeira efetiva. Veja [o guia do workspace](frontend-workspace.md).
