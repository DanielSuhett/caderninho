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

A composição liga as portas; disponibilidade de perfis pertence a `household`,
e a montagem do estado pertence a `installation`. A sincronização verifica a
configuração antes da admissão. `planningTools` mantém schemas por nome, e o
repository de planejamento recebe seleções internas tipadas de recursos.
`PlanningError` compartilha as recusas conhecidas entre transporte e diagnóstico.

## Persistência

`migrations/0001_initial.sql` inicializa o modelo completo em bancos novos: tabelas,
constraints, índices, triggers e dados iniciais. O projeto está em pré-produção;
não mantém upgrades de schemas experimentais. `src/worker/schema/index.ts`
descreve o mesmo modelo para os repositories Drizzle. A criação inclui pessoa
`self`, perfil `default`, espaço Pessoal e catálogo de categorias/grupos. O
histórico registra cada rodada desde a admissão, sem recuperação de versões antigas.

| Tabela | Dados |
| --- | --- |
| `connections` | Item, mapa de contas/saldos e importação corrente (nove colunas) |
| `transactions` | Projeção financeira da origem, atualizada somente pela importação |

Contas usam seus IDs Pluggy como chaves do mapa JSON `connections.accounts`.
Cada valor contém nome, tipo, moeda, saldo, horário de leitura e identidade financeira estruturada.
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
Os nove campos de connections concentram id, accounts, import_id, import_status,
import_admitted_at, import_sequence, import_checkpoint, import_error e last_success_at.
Admissão deriva cooldown, ID recupera despacho, sequência protege publicação/replay,
checkpoint contém só phase/accountId/cursor e erro/último sucesso informam qualidade.
Cada conta contém name, type, currency, balanceMinor, balanceObservedAt e identity opcional.

### Planejamento

Os conceitos de planejamento possuem tabelas tipadas com `id` e JSON pequeno por registro:
espaços, preferências de contas/cartões, sobreposições de transações, categorias,
tags, regras, recorrências, parcelas, metas, contribuições, investimentos,
empréstimos, cronogramas, marcações de faturas e preferências de notificação.
Faturas e metadados de contas/transações têm tabelas próprias. Revisão e recibos
completam o controle de concorrência e de repetição. Não há tabela universal de
recursos nem snapshot único com todo o histórico.

A coluna `transactions.identification` pertence à transação de origem e só a
importação a atualiza. A tabela de metadados de transações atende às projeções de
planejamento. Ausência de metadados mantém `identification=null`. O portal apresenta os campos disponíveis nos detalhes e
busca por descrição, estabelecimento, documento e referências. As consultas
financeiras e de planejamento/MCP também retornam essa identificação.

Quando uma transação reimportada perde seus metadados de cartão, a publicação
remove o registro auxiliar antigo no mesmo batch da transação e do checkpoint.
Os caminhos de publicação JSON e escalar seguem a mesma regra.

`transactions.classification` guarda decisões de classificação; os agrupadores
ficam em `planning_category_groups`. O catálogo contém 33 categorias fixas em cada espaço,
com ícone, cor e `groupId` em `planning_categories`; os agrupadores também têm
ícone/cor e pertencem a um espaço. Cada categoria tem zero ou um grupo, que pode
conter várias categorias. Remover um grupo desfaz o vínculo e preserva categorias,
regras e transações. Categorias personalizadas conservam suas referências;
as duas categorias genéricas de apoio ficam ocultas. Os nomes do catálogo fixo são
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

O [catálogo e decisões financeiras](mcp-finance.md) registra contratos e limites
das operações disponíveis.

## Importação

Pedido manual ou cron às 09:00 UTC admite conexões elegíveis. Uma atualização
condicional da conexão confirma o ID da importação e reserva 24 horas, inclusive
em falha. O estado corrente impede duas execuções ativas; a elegibilidade deriva
da admissão. Não há pausa global nem lock mantido durante HTTP. O histórico de rodadas é
separado do checkpoint corrente, como descrito abaixo.

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

Consultas individuais e compras agrupadas validam as mesmas referências de
seleção. O cursor das compras inclui o dia financeiro: a virada do dia exige
reiniciar a leitura. O codec compartilhado recusa cursores malformados como
entradas inválidas.

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

`people`, `pluggy_profiles` e `connection_owners` descrevem titularidade.
O adapter seleciona exatamente um perfil, valida a origem e aplica namespace aos
IDs dos perfis adicionais. O perfil `default` usa os IDs recebidos da origem. Credenciais adicionais ficam no KV;
metadados e hash da aplicação ficam no D1. Painel e consultas financeiras usam
a mesma atribuição de pessoa. Veja [decisões e operação](household.md).

## Histórico e páginas da instalação

`sync_history` guarda as rodadas sem substituir o checkpoint corrente. O trigger acompanha a mesma escrita atômica de progresso;
pessoa e perfil são fixados na admissão. O painel consulta catálogo de planejamento
e histórico por repositories específicos, e reutiliza o serviço de consultas MCP
para a visão financeira efetiva. Veja [o guia do workspace](frontend-workspace.md).

## Índices e publicação

Os índices de transações atendem status/data/conta/ID, categoria/data/conta/ID,
paginação por conta e agregações. O parcial transaction_posted_totals cobre
(direction,currency,date,account_id,amount_minor,category) para POSTED. Uma conta
usa igualdade e cursor (date,id); o cursor público mantém (date,account_id,id).
Predicados redundantes de data podem fazer o planner reler empates. Preserve os
filtros no escopo do cursor e na seleção de qualidade ao ajustar a consulta.

Igualdades precedem intervalos nos índices; colunas seguintes podem atender
ordenação/cobertura sem eliminar filtros residuais. Não criar um índice por campo.
Índices adicionais custam escrita/armazenamento; WITHOUT ROWID e cobertura maior
não são ganhos universais. Não há ANALYZE/manutenção automática por requisição.
Consulte o [planejador SQLite](https://sqlite.org/queryplanner.html) e meça planos
com a distribuição relevante antes de mudar os índices.

Publicação usa json_each com JSON transitório por página; acima de 500 mil
unidades UTF-16, usa parâmetros escalares para respeitar o limite de string D1.
Identificação/classificação são contratos tipados separados do payload bruto.
Registro idêntico não sofre UPDATE; correção ou mudança de identificação sofre.
IDs repetidos na mesma página usam hash para detectar duplicatas conflitantes,
sem deduplicar por similaridade. Projeções de controle leem só campos necessários;
isso reduz transferência/decodificação, não necessariamente rows_read.

A instalação usa Worker, D1, KV OAuth/credenciais, Workflow, assets e rate limit;
não exige bucket, webhook ou chave de cofre adicional. O botão provisiona D1/KV;
o schema inicial usa DB e o deploy declara FINANCE/LOGIN_LIMITER. Provisionamento
em conta nova exige prova real. Cookie usa HMAC SHA-256, HttpOnly, Secure,
SameSite=Lax e Path=/; sem ADMIN_PASSWORD válida (16–256 caracteres), acesso
privado é recusado. Comandos validam origem exata e CSRF. LOGIN_LIMITER admite
dez tentativas/minuto por IP da Cloudflare e localização, sem contador global
exato nem persistência de IP. Metadados/registro OAuth públicos não dão acesso;
bearer MCP não autentica painel/widget.
