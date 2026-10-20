# Arquitetura do Caderninho

Um pacote npm e um deploy Cloudflare atendem painel, OAuth, MCP e importação.
O produto é pessoal: uma instalação pertence a uma pessoa e pode ter até dez
conexões Meu Pluggy. O primeiro lançamento importa somente contas BANK/CREDIT e
transações. As consultas e a importação estão descritas no [guia de uso](usage.md).

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
| `installation` | Conexões e configuração da instalação; dados do painel |
| `auth` | Senha, cookies assinados, OAuth oficial e revogação de assistentes |
| `finance` | Contas, transações, consultas e totais objetivos |
| `sync` | Admissão diária, despacho, páginas e commits duráveis |
| `mcp` | Cinco tools comuns do SDK |

Controllers validam transporte. Services coordenam casos de uso por portas em
`entity/index.ts`, sem SQL, HTTP ou Bindings. Repositories implementam essas portas
com Drizzle. A composição injeta implementações por requisição/importação.
Adapters Pluggy, OAuth e Workflow têm entradas explícitas. Não há repository
universal, container de DI nem camadas vazias.

## Persistência

| Tabela | Dados |
| --- | --- |
| `settings` | Singleton: importação habilitada e revisão financeira |
| `connections` | Item, apresentação e janela da próxima admissão |
| `accounts` | Conta, saldo observado e qualidade da coleta |
| `transactions` | Projeção financeira da origem, atualizada somente pela importação |
| `sync_runs` | Intenção, estado, checkpoint e último commit confirmado |

Contas usam `(connection_id,id)`; transações usam
`(connection_id,account_id,id)`. Não assumir unicidade global dos IDs externos.
Contas e transações são linhas SQL com campos concretos, sem payload genérico,
documentos pessoais ou versões antigas. Transações guardam a data financeira;
horários de coleta e referência do saldo ficam nas contas/conexões.

## Importação

Pedido manual ou cron às 09:00 UTC admite conexões elegíveis. Um batch insere a
intenção `pending` e reserva 24 horas por conexão, inclusive em falha. Um índice
único parcial impede duas execuções ativas da mesma conexão. A pausa impede novas
admissões; não cancela trabalho iniciado. Não há lock mantido durante HTTP.

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
`sync/repository/index.ts` confirma dados, qualidade, revisão, checkpoint e último
recibo no mesmo batch D1. Uma guarda de estado/sequence usa o CHECK da revisão
para abortar todo o batch se o executor estiver obsoleto. Resposta perdida relê o
recibo; página antiga não publica. Não há histórico ilimitado de recibos.

A origem pode mudar de ID ou reduzir a janela histórica. A importação atualiza
IDs existentes e acrescenta os novos. Ausência não remove nem desqualifica registros:
A/B seguido de B atualizado/C resulta em A/B atualizado/C nos totais elegíveis.
Não há classificação de consumo, edição local ou deduplicação por similaridade.
Coleta parcial preserva páginas confirmadas e continua sinalizada como parcial.
Execuções encerradas são retidas por 30 dias.

O adapter rejeita cursores inválidos, de outra conta, repetidos imediatamente ou
com continuação sem registros. Não há marcador por transação nem ledger de cursores
para detectar ciclos arbitrários entre páginas distintas.

## Consultas e dinheiro

D1 é a fonte das leituras. Filtros fechados e paginação por tupla composta usam a
revisão financeira: alteração entre páginas exige reiniciar a consulta. Totais
consideram toda a seleção SQL, não uma página. Moedas permanecem separadas.

Valores monetários são inteiros em strings, com até 30 dígitos por registro. A
soma SQL usa parcelas inteiras de três dígitos, reconstruídas com BigInt. Não usa
REAL nem converte valores financeiros para Number. Precisão/moeda não suportada
fica desconhecida, sem arredondar para zero.

Dia financeiro da origem é preservado. Elegibilidade usa o dia corrente em
America/Sao_Paulo. Pendentes e futuros ficam fora dos totais monetários e
continuam consultáveis. Contagem inclui todos os registros da seleção; débitos e
créditos são magnitudes da direção da origem e cash_flow é o fluxo assinado BANK.
Débito não equivale a gasto e crédito não equivale a renda. Valores desconhecidos
permanecem null e a qualidade da coleta acompanha consultas e agregações.

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
