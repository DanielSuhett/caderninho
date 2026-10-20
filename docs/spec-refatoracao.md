# Spec: Caderninho simples para contas e transações

Status: escopo implementado, revisado e validado localmente, 19/10/2026.
O escopo financeiro e a premissa de banco novo foram confirmados pelo usuário.
A evidência está em [validação local](validation-refatoracao.md). Não há validação em produção nesta entrega.

## 1. Decisões de escopo

O Caderninho será um MCP financeiro pessoal que importa contas e transações da
Pluggy, guarda uma cópia privada e responde consultas com valores exatos. Uma
instalação pertence a uma pessoa; pode conter várias conexões e contas bancárias.

| Decisão | Resultado exigido |
| --- | --- |
| Instalação sempre nova nesta refatoração | Um schema inicial limpo, sem upgrade de bancos anteriores, conversores ou execução legada |
| Primeiro lançamento focado | Contas BANK/CREDIT e transações; faturas, investimentos, empréstimos e regras automáticas ficam fora |
| Persistência concreta | Seis tabelas D1; metadados pequenos em JSON, sem espelhar endpoints da API |
| Um fluxo de importação | Workflow servidor relê contas e transações disponíveis; sem lotes coordenados pelo assistente |
| Um pacote e um deploy | Worker, D1, KV do OAuth, Workflow e assets; nenhum R2, Queue ou Durable Object adicional |

Banco novo é a condição de instalação desta versão. Não significa apagar ou
recriar o banco em cada deploy posterior. Uma vez instalada, a cópia financeira
é persistente. Esta implementação não precisa carregar dados da versão atual;
também não está autorizada a apagar bancos remotos existentes.

Os contratos anteriores ainda não foram lançados e podem ser substituídos nesta
refatoração. Não criar aliases, adaptadores v1/v2 ou períodos de convivência.
Documentação e testes devem descrever somente o novo contrato ao final da entrega.

## 2. O que o proprietário consegue fazer

1. Instalar na própria Cloudflare, definir a senha e informar credenciais Pluggy.
2. Importar conexões pessoais do Meu Pluggy e acompanhar a primeira coleta.
3. Autorizar o assistente por OAuth e consultar contas, transações e totais.
4. Corrigir categoria, descrição e exclusão de uma transação dos totais locais.
5. Pausar próximas importações, reconectar o banco e revogar assistentes.

Uma conta CREDIT e suas transações continuam no escopo. Dados próprios de faturas,
vencimentos de fatura e posições de investimento não entram por consequência.
Não afirmar que o saldo do cartão é patrimônio disponível.

Ficam fora do primeiro lançamento:

| Grupo | Remover do runtime e da interface |
| --- | --- |
| Outros produtos | Faturas, investimentos, movimentos de investimento, empréstimos e extratos documentais |
| Automação de classificação | Motor de regras, catálogo próprio, aliases, preview, reaplicação e importadores de regras |
| Plataforma de execução | Tasks/subscriptions customizadas, continuação pública de lotes, seleção materializada e operações genéricas |
| Integrações adicionais | Webhooks, importação de snapshots/R2, conversão de versões e compatibilidade legada |
| Funcionalidades acessórias | Tags arbitrárias, detecção de recorrências e saldo live em ferramenta separada |

Não deixar esses recursos desativados por flags, arquivos sem consumidores ou
abstrações preparadas para o futuro. Uma adição posterior precisa de caso de uso.

## 3. Modelo de dados

São seis tabelas de aplicação. Índices, views e tabelas internas do Wrangler não
entram nessa contagem. A contagem é consequência do desenho, não critério para
recusar uma necessidade de integridade comprovada.

| Tabela | Responsabilidade |
| --- | --- |
| `settings` | Configuração única da instalação e revisão das leituras financeiras |
| `connections` | Item Pluggy, contexto necessário ao painel e agenda de admissão |
| `accounts` | Conta financeira, saldo observado e estado de coleta das transações |
| `transactions` | Registro da origem, campos consultáveis e correções locais |
| `sync_runs` | Intenção de importação, progresso e checkpoint sequencial |
| `portal_sessions` | Sessões autenticadas do painel, CSRF e revogação |

### 3.1. Configuração e conexão

`settings` tem uma linha com `id=1`, `sync_enabled` e `revision >= 0`.
Senha e credenciais Pluggy permanecem em secrets, nunca nessa tabela. O OAuth
continua no KV da biblioteca existente. Não criar usuários, tenants ou ACLs.

`connections.id` é o ID do Item. Guarda nome/status necessários à apresentação,
timestamps de observação/admissão, `next_import_at` e contexto pequeno em JSON.
Esse contexto contém somente dados necessários do conector e disponibilidade;
não é uma cópia de todas as respostas da Pluggy. Validação do Meu Pluggy e limite
atual de dez conexões continuam como políticas explícitas.

A execução ativa é encontrada em `sync_runs`: não duplicar um ponteiro de lock
em `settings` e outro em `connections`. A admissão mantém o mínimo de 24 horas por
conexão, contado da reserva, inclusive em falha. Pedido manual não contorna essa
janela. Uma conexão nova não desbloqueia as demais.

### 3.2. Contas

Chave de `accounts`: `(connection_id, id)`, com FK para a conexão. Campos centrais:
nome, tipo BANK/CREDIT, moeda, saldo em unidades menores quando conhecido e
referências temporais da origem e da leitura. Não calcular saldo atual somando
o histórico, que pode cobrir apenas parte da vida da conta.

O payload de origem necessário à normalização fica em JSON privado. Detalhes
sem consulta SQL frequente não viram colunas por antecipação. Não coletar o
endpoint de identidade pessoal para preencher uma entidade genérica.

Cada conta conserva o resumo da última tentativa e da última enumeração concluída
de transações: disponibilidade, erro seguro, horário e intervalo efetivamente
observado. Completude se refere ao conjunto oferecido pela origem naquela coleta,
nunca a todo o histórico bancário. Conta ausente/inacessível não causa remoção em
cascata de seu histórico.

`observedFrom`/`observedTo` descrevem a tentativa atual;
`lastCompletedFrom`/`lastCompletedTo`, a última enumeração concluída. Uma falha
não substitui o intervalo concluído. Finalizar uma enumeração vazia promove um
intervalo nulo, sem alegar que foram observadas datas ausentes na resposta.

Conservar também o marcador `last_completed_run_id`. A presença das transações
pode ser calculada comparando esse marcador com a execução que as observou.
Finalizar a conta troca o marcador no commit; não precisa regravar milhares de
linhas para marcar ausências. Durante uma tentativa parcial, a qualidade da conta
inteira indica essa condição, sem alegar um snapshot estável anterior.

### 3.3. Transações

Chave: `(connection_id, account_id, id)`, com FK composta para a conta.
Não assumir unicidade global dos IDs do provedor nem gerar outra identidade para
o mesmo registro a cada importação.

| Grupo | Campos necessários |
| --- | --- |
| Origem consultável | Data financeira, status, direção, moeda, valor exato, categoria e descrição originais |
| Semântica financeira | Classificação econômica determinística e sua evidência mínima; valores de fluxo/consumo conhecidos quando aplicáveis |
| Correção local | `category_override`, `description_override`, `ignored_override` e horário da correção |
| Observação | Referências temporais, última execução que observou o registro e estado de presença na origem |
| Detalhes | Payload da origem em JSON, limitado e privado; sem uma segunda cópia normalizada integral sem consumidor |

Colunas de correção são atualizadas apenas pelo caso de uso de correção. Importação
atualiza origem e projeção financeira, sem reenviar ou sobrescrever os campos
manuais. Omitir um campo na correção preserva seu valor; `null` remove aquela
correção. Descrição vazia e `ignored=false` são valores válidos.

Categoria é texto da origem ou texto manual. Não há catálogo próprio, IDs de
categoria do produto, grupos ou aliases. IDs externos podem ficar nos detalhes.
Categoria/descrição efetiva usam precedência manual sobre origem. Ignorado
efetivo usa o override, ou `false` quando ausente.

Uma view ou expressão SQL pode resolver essa precedência. Não recriar tabelas
`derived`, `overrides` ou um modelo EAV para três campos conhecidos. Criar índices
para os filtros reais: conta/data/ID, estado de presença, status e categoria
efetiva. Demais índices exigem consulta e medição que os justifiquem.

### 3.4. Execuções de importação

`sync_runs` contém `id`, `connection_id`, status, horários, resumo/erro seguro,
`sequence >= 0`, checkpoint corrente, `last_commit_id` e `last_result` limitado.
Checkpoint contém fase, conta e cursor da origem necessários à próxima página.
Resultado é dado da aplicação, não um envelope MCP serializado.

Os estados são `pending`, `running`, `succeeded` e `failed`. Falha nunca é
`completed` com outra flag de erro. O checkpoint progride sequencialmente e
guarda só o necessário para retomar, não um array de todas as páginas ou IDs.

Um índice único parcial por `connection_id` para `pending/running` impede duas
importações ativas da mesma conexão. Uma execução corresponde a um Workflow com
o mesmo ID. Execuções encerradas ficam disponíveis por 30 dias e são removidas
em lotes limitados; execução ativa nunca é removida por retenção.

Se um campo de observação guardar ID de execução, ele é um marcador, não uma FK
que impeça essa retenção. Referências de contas e transações continuam íntegras.

### 3.5. Sessões e representação JSON

`portal_sessions` conserva ID hasheado, CSRF, expiração e versão de autenticação.
É a única tabela de acesso. Não criar `login_attempts`, histórico de IPs ou
cadastro de proprietários.

JSON no D1 é `TEXT` com validação e funções JSON, conforme a plataforma; esta
spec não depende de JSONB. Documentos têm tipo, dono e limite de tamanho.
Arrays de contas/transações, logs crescentes e recibos ilimitados não cabem nos
metadados de uma conexão. Contas e transações permanecem registros SQL.

## 4. Dinheiro e significado das consultas

Manter valores monetários em strings inteiras de unidades menores, com moeda
explícita, até a precisão já coberta pelo domínio atual. Preservar o lexema antes
de qualquer conversão numérica. Nunca usar `REAL`, `Number` ou centavos de duas
casas como aproximação universal. Moeda/precisão não suportada gera valor
desconhecido ou erro explícito, nunca arredondamento nem zero.

Totais são calculados sobre todo o universo filtrado no SQL. Reutilizar o cálculo
exato existente e sua cobertura com valores acima de int64/Number seguro. Uma
página de resultados não é entrada para calcular o total do período.

| Métrica | Significado |
| --- | --- |
| `count` | Quantidade de registros no universo definido, com contagens de estados desconhecidos separadas |
| `debits` / `credits` | Magnitudes por direção da origem; não equivalem automaticamente a gasto/renda |
| `cash_flow` | Fluxo assinado de contas BANK; não misturar o sinal de contas CREDIT |
| `known_spending` | Consumo com evidência determinística suficiente; informar também débitos de natureza econômica incerta |

Métricas financeiras excluem pendentes, datas futuras e registros ignorados por
padrão. Consulta de registros permite encontrá-los explicitamente. A elegibilidade
da data é calculada com um dia de referência `America/Sao_Paulo`; não precisa de
um job de maturação que regrave todas as transações futuras.

Preservar a distinção entre dia financeiro da origem e timestamp convertido para
horário local, com fixtures específicas. Transferência própria, pagamento de
cartão, estorno e débito incerto não viram consumo só por descrição, PIX ou sinal.
Essas regras financeiras puras permanecem; o motor configurável de regras sai.

Cada resposta de agregado informa moeda, métrica/definição, referência temporal,
registros conhecidos/desconhecidos e qualidade da seleção. Nunca somar moedas
diferentes nem completar um dado ausente com zero. Consultas cruzando contas
BANK/CREDIT não devem contar pagamento de fatura e compra como dois gastos.

## 5. Um fluxo de sincronização

### 5.1. Política de coleta

A cada admissão, reler a conexão, suas contas e todas as páginas de transações
disponíveis por conta. Este primeiro lançamento não implementa um caminho
incremental separado, `createdAtFrom`, reconciliação semanal ou webhooks.
Há mais I/O; em troca, existe um único algoritmo de coleta e retomada.

Usar somente métodos concretos do adapter Pluggy: ler conexão, listar contas e
listar transações. Não manter `resourceOrder`, normalização por 13 recursos ou
factory de provedores. SDK, HTTP, parsing lossless e validação permanecem na
fronteira. Não executar PATCH de Item nem escrever dados bancários.

Preservar a agenda atual às 09:00 UTC e a janela de 24 horas. O cron primeiro
recupera despachos pendentes, depois admite conexões elegíveis e limpa estados
expirados. Pedido manual próximo do cron pode fazer a próxima admissão ocorrer
apenas no cron seguinte; mostrar `nextEligibleAt`, sem prometer execução exata.
Pausar impede novas admissões, sem matar importações já iniciadas.

### 5.2. Admissão e despacho

1. Em um batch D1, reservar a janela da conexão e inserir a execução `pending`.
   A condição é reavaliada no SQL e o índice único protege a disputa concorrente.
2. Se já existir execução ativa, devolver seu ID. Em cooldown/pausa, devolver
   estado e próxima elegibilidade, sem criar outra execução ou intenção futura.
3. Criar o Workflow com aquele mesmo ID. Se a chamada falhar, consultar o estado
   nativo; ID já existente não significa nova execução nem falha financeira.
4. Manter a intenção pendente em caso de despacho incerto. Próximo cron ou pedido
   manual recupera o despacho; GET/status nunca executam trabalho oculto.
5. Um erro terminal confirmado no Workflow encerra a execução D1 como `failed`.
   Erro de rede ao consultar status não comprova término. Não liberar por idade.

Ao começar, o Workflow muda `pending` para `running` condicionalmente. Após falha
terminal, uma retomada não executa aquele ID novamente; a próxima admissão cria
outro ID, respeitando a janela. Não usar `restart` para ressuscitar execução
encerrada que ainda pudesse competir com uma publicação antiga.

Não exigir `requestKey` público: a execução ativa e a janela de admissão já
definem a deduplicação do pedido de importação. Resposta perdida não cria um
segundo ciclo. Não expor start, claim, acquire ou markDispatched ao assistente.

### 5.3. Publicação de uma página

Cada página é uma unidade limitada de publicação. `step.do` resolve leitura,
validação e publicação idempotente; retorna somente resumo e próximo checkpoint,
não um payload bruto grande. Retries e esperas de rate limit pertencem ao
Workflow, com orçamento definido; não multiplicar retries em SDK, HTTP e service.

O ID do commit é determinístico para execução e sequência esperada. O protocolo:

1. Ler `sync_runs`. Se `last_commit_id` já for esse commit, devolver `last_result`
   antes de consultar novamente a origem, inclusive se a execução já terminou.
2. Validar estado/sequence, buscar uma página e validar identidade, paginação e
   duplicatas. Mesmo ID com conteúdo conflitante na mesma página recusa a página.
3. Em um único batch, proteger estado/sequence, gravar registros e resumo de
   coleta, avançar checkpoint/sequence e salvar commit/resultado. Incrementar a
   revisão financeira no mesmo batch. Nenhuma chamada HTTP fica dentro do batch.
4. A condição precisa abortar todo o batch se a execução não estiver vigente.
   Não basta um UPDATE final afetar zero linhas depois de publicar transações.
5. Se a resposta do batch se perder, reler o commit confirmado. Página velha que
   não corresponda ao último commit é rejeitada sem writes; não reproduzir um
   arquivo histórico de respostas por página.

A proteção SQL pode usar a linha singleton `settings` e seu CHECK de revisão
não negativa para abortar o batch quando não existir a execução/sequence esperada.
Isso é uma verificação curta no commit, não um lock mantido durante rede.
Repositories devem demonstrar esse comportamento no D1 real do harness, incluindo
execução inexistente, encerrada e concorrência de duas publicações da mesma página.

Após confirmar uma sequência, não voltar a publicá-la. Processamento é sequencial
por conexão; conexões diferentes podem progredir independentemente. Não criar
leases, renovação de lock, epoch por proprietário ou eleição de executor.

Limites reais de resposta, parâmetros SQL e batch devem ser respeitados sem
truncar dados. Pedir página menor se a API permitir. Se uma página válida não
couber, o problema bloqueia a entrega do adapter: não avançar cursor parcialmente
nem adicionar um segundo protocolo de chunks sem revisar esta spec.

### 5.4. Histórico, ausências e qualidade

Concluir a paginação significa ter enumerado o que o provedor disponibilizou.
Não prova histórico completo, snapshot imutável ou captura universal de deletes.
A documentação da Pluggy limita a disponibilidade histórica e admite troca do ID
de uma transação quando seus dados mudam significativamente.

Uma transação antes observada e ausente da próxima enumeração completa fica
`not_observed`, sem remoção física ou atribuição automática de exclusão. A mudança
de presença só ocorre após completar a coleta da conta, nunca por página ausente.
Se a coleta falhar, não promover o novo marcador de enumeração concluída.
Páginas já confirmadas permanecem; a conta fica parcial e conserva a referência
da última enumeração concluída. Não prometer rollback de toda a importação.

Registros `not_observed` continuam consultáveis, com origem e correções. Não
transferir correções a outro ID por similaridade de descrição/valor. Fora da
janela oferecida pela origem, o histórico guardado tem referência temporal antiga,
nunca confirmação de que permaneceu ou foi excluído na instituição.

Agregados separam registros observados na coleta confirmada dos não confirmados.
Não somar um possível ID substituído junto do novo como se fossem dois gastos
confirmados. Se houver registros não confirmados no período, devolver subtotal
conhecido e indicação de parcialidade; se todos forem incertos, o total conhecido
é ausente, não zero. A resposta não pode chamar esse subtotal de total definitivo.

Durante coleta em andamento podem existir páginas já publicadas. Respostas devem
indicar atualização parcial/em andamento até a finalização. Última coleta válida
e tentativa atual são referências distintas; não sobrescrever sucesso anterior
com um timestamp de tentativa falha.

Esse é o custo funcional de não ter webhooks/CDC no primeiro lançamento. Antes
de afirmar completude maior, validar a semântica da API com fixtures de mudança
de ID, janela histórica e retirada de registros. Não inventar garantia da origem.

## 6. Contrato MCP

O contrato novo descreve intenções financeiras concretas. São tools comuns do
SDK, sem extensão Tasks própria, subscriptions persistidas ou envelopes internos
de operações. Importação retorna identificador e estado; o cliente consulta status.

| Tool | Entrada principal | Resultado |
| --- | --- | --- |
| `caderninho_status` | Conexões ou IDs de importação opcionais | Configuração segura, coleta, erros e estados das importações |
| `caderninho_sync` | Conexões selecionadas | Execução iniciada/existente ou pausa/cooldown por conexão |
| `caderninho_accounts` | Conexões opcionais | Contas e saldos com moeda, origem e referência temporal |
| `caderninho_transactions` | Filtros e cursor opcionais | Página de transações com valores originais/efetivos e qualidade |
| `caderninho_aggregate` | Métrica, filtros e agrupamento conhecido | Totais exatos por moeda e subtotalidade explícita |
| `caderninho_correct_transaction` | Identidade composta e patch conhecido | Transação após a correção, sem escrita no provedor |

Filtros são campos nomeados: conexão/conta, intervalo de datas, moeda, direção,
status, categoria efetiva, descrição, ignorado e estado de presença. Intervalos
monetários exigem moeda. Não aceitar paths livres, SQL, métricas por string aberta
ou AST genérica de regras. Agrupamentos: conta, categoria e mês, sempre por moeda.

Paginação usa ordem estável por dia/identidade, limite padrão 50 e máximo 200.
O cursor contém escopo, posição e revisão; é validado no servidor. Se a revisão
mudar, devolver `RESTART_REQUIRED`. Não juntar páginas de versões diferentes.
Ler registros, qualidade e revisão de modo consistente; não habilitar réplicas
D1 nesta entrega para criar outro problema de leitura após escrita.

Correção aceita somente categoria, descrição e ignorado. Campo desconhecido,
patch vazio ou referência inexistente são erros. `null` remove a correção, sem
apagar a origem. A mesma correção repetida é idempotente. Nunca expor senha,
secrets, cookies, CPF de terceiros ou payload completo da origem por padrão.

Erros precisam indicar ação: `NOT_CONFIGURED`, `INVALID_FILTER`, `NOT_FOUND`,
`RESTART_REQUIRED`, `UPSTREAM_UNAVAILABLE` ou `IMPORT_FAILED`. Informar pausa,
cooldown e execução existente como estados de produto, sem erro genérico 500.
Tool não suportada não recebe fallback para comportamento antigo.

## 7. Painel, autenticação e instalação

O painel mantém três tarefas: conectar bancos, conectar assistente e manutenção.
Mostra banco/contas, horário da última coleta válida, atualização em andamento,
parcialidade/erro e próxima elegibilidade. Progresso técnico de checkpoint, lote
ou SQL não vira instrução para o proprietário.

Login continua com uma senha pessoal, sessão de oito horas, cookies seguros,
CSRF e validação de origem. Logout revoga a sessão. Deploy invalida sessões pela
versão de autenticação. OAuth continua usando a biblioteca oficial e permite
revogar todos os assistentes, sem permissões por conta ou conexão.

Substituir o contador D1 de login pela limitação nativa do Worker, inicialmente
dez tentativas por minuto por IP confiável na rota de login. Não registrar IP no
banco/log. Testes devem cobrir o limite e a política de origem; o binding é
permissivo e por localização, portanto não prometer dez tentativas globais exatas.
Um contador global que qualquer atacante possa consumir não é a política desejada.

Manter os três secrets atuais e o provisionamento de D1/KV/Workflow. Declarar o
binding de rate limit no projeto, sem exigir que o usuário crie infraestrutura
manualmente. Sem R2, chave adicional ou configuração de webhook. Frontend e
backend devem ter contratos tipados, sem duplicar decisões de admissão na UI.

Criar um único schema inicial para banco vazio, substituindo os arquivos de
migração desta versão ainda não lançada durante a implementação. Não criar
migração de dados, backup de transição, leitores antigos ou fallback de schema.
Um novo deploy normal nunca executa reset automático do D1.

## 8. Organização do código

Manter `src/domain`, `src/contracts`, `src/worker`, `src/web` e `src/shared`.
O domínio contém conceitos concretos de conexão, conta, transação, dinheiro,
consulta e importação. Remover a entidade financeira universal e os modelos
de recursos sem caso de uso no primeiro lançamento. Termos em [GLOSSARY.md](../GLOSSARY.md).

| Módulo Worker | Responsabilidade |
| --- | --- |
| `installation` | Configuração, conexões Meu Pluggy e dados do painel; substitui a ambiguidade do módulo `account` |
| `auth` | Login, sessões, OAuth e revogação |
| `finance` | Contas/transações, consultas, totais e correções |
| `sync` | Admissão, despacho, Workflow e publicação atômica da coleta |
| `mcp` | Declaração e tradução das seis tools; sem lógica de banco ou finanças |

Usar o padrão atual `entity/index.ts`, `controller/index.ts`, `service.ts` e
`repository/` nos módulos que tenham essas responsabilidades. Não criar camadas
vazias. Dentro de um módulo, reunir funções relacionadas; especializar arquivos
apenas quando uma responsabilidade concreta justificar.

Controllers validam transporte; services recebem dependências explícitas;
repositories concentram Drizzle e batches. `sync` pode publicar contas/transações
no seu repository para manter o commit atômico; não distribuir um batch entre
services que gravam separadamente. Portas são por caso de uso, não uma interface
genérica por tabela. A composição liga implementações diretamente.

Reutilizar normalização monetária, políticas financeiras e transporte HTTP que
continuem úteis. Eliminar branches `resource`, legado e regras dos fluxos novos;
não fazer wrappers para chamar toda a arquitetura antiga por baixo.
Zod valida entradas externas uma vez. Manter TypeScript estrito, imports relativos,
enums do produto e `tryCatch` nas recuperações assíncronas, conforme AGENTS.md.

## 9. Remoção completa do que foi substituído

| Área | O que precisa sair na implementação |
| --- | --- |
| Persistência antiga | As 23 declarações antigas, view correspondente e migrações anteriores; substituição pelo schema novo, não coexistência |
| Classificação configurável | `src/domain/rules`, importadores/conversores, endpoints/tools e dependências exclusivas do motor |
| Execução e protocolo | Reaplicação local, targets, receipts históricos, locks, inbox, migração R2, módulo Tasks e schema vendorizado exclusivo dessa extensão |
| Recursos sem escopo | Adapters, normalizadores, métricas, contratos e UI de faturas, investimentos, empréstimos, identidade e documentos |
| Superfície obsoleta | Testes/fixtures sem consumidor, exports, opções, secrets e documentação exclusivos dos recursos retirados |

Revisar dependências após retirar consumidores. `json-rules-engine`, `re2js` e
`@cfworker/json-schema` são candidatos claros à remoção. `big.js` e `lossless-json`
continuam necessários à precisão financeira. Manter React, Hono, Drizzle, SDK MCP
e transporte existente; esta spec não pede troca de framework nem monorepo.
Atualizar lockfile e setup quando necessário. Skills/hooks locais ficam fora do Git.

README, guia de uso, arquitetura, configuração e exemplos devem descrever somente
o lançamento de contas/transações. A proposta de consolidação anterior fica
substituída por esta spec; não manter duas decisões concorrentes como instrução.

## 10. Critérios de aceite

| Área | Evidência exigida |
| --- | --- |
| Instalação | Schema novo aplica em D1 vazio; novo deploy preserva registros; autenticação e OAuth funcionam com dados sintéticos |
| Finanças | Round-trip e totais acima de int64/Number seguro; moedas distintas; BANK/CREDIT; pendentes/futuros; transferência própria; pagamento de cartão; nulos e zero |
| Correções | Atualização por campo; descrição vazia/false preservados; null restaura origem; importação concorrente não perde edição manual |
| Coleta | Múltiplas contas/páginas, vazio válido, indisponível, página inválida, cursor repetido e ID conflitante; nenhuma falsa completude |
| Concorrência | Cron e manual criam no máximo uma execução; pausa/cooldown não são contornados; conexões distintas não usam lock global |
| Recuperação | Falha no recibo/checkpoint reverte a página; perda da resposta devolve commit salvo; página velha/execução encerrada não publica; despacho incerto recupera mesmo ID |
| Histórico | ID substituído, janela da origem reduzida e registro não observado não somam em duplicidade nem apagam correção/histórico; subtotal incerto é sinalizado |
| Contrato e UI | Apenas tools novas, paginação por revisão, filtros conhecidos, ausência de Tasks customizadas, painel acessível e erros acionáveis |
| Volume | Fixtures com 10 mil e 100 mil transações, múltiplas contas, páginas de tamanho real e memória limitada por página; totais não dependem de carregar o extrato inteiro |
| Limpeza | Sem código morto de regras/outros produtos/legado; imports, dependências, docs, configs e fixtures convergem para o modelo novo |

Verificações de protocolo devem rodar também no runtime local D1/Workflow, não
apenas em mocks ou SQLite. Medições de volume registram tempo, memória e resultado,
sem asserts frágeis de duração na CI. Se o batch ou limite de provedor inviabilizar
a releitura diária, revisar o algoritmo antes de declarar a implementação pronta;
não reintroduzir silenciosamente todos os mecanismos removidos.

`mise run check:quick` acompanha a implementação; `mise run check` é obrigatório
antes da entrega de código. Esses checks não comprovam provisionamento, OAuth em
cliente real ou acesso Pluggy: registrar essas validações separadamente.

## 11. Sequência de implementação

1. Publicar os novos modelos/contratos e schema inicial em uma mudança coerente.
   Criar fixtures de instalação vazia; nenhum banco anterior precisa abrir.
2. Implementar conexão, conta e transação no adapter, normalização, queries e
   correção. Cobrir dinheiro e preservar segurança antes de ligar a coleta.
3. Implementar o único Workflow com admissão, checkpoint/commit e recuperação.
   Passar testes de falha e concorrência antes de conectar painel e MCP.
4. Ligar as seis tools e o painel simplificado. Remover imediatamente seus
   substituídos, dependências e documentos antigos; não manter dois caminhos ativos.
5. Rodar os checks completos, verificar volume e instalação nova e registrar
   pendências externas. Deploy continua sendo ação separada explicitamente pedida.

A refatoração está concluída quando uma pessoa consegue seguir conexão → contas
→ transações → consulta e entender importação → página → commit sem atravessar
um catálogo genérico de operações. Menos tabelas sem menos estados/código não
atende esta especificação.

## Referências de plataforma

[D1: atomicidade de batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch),
[D1: JSON](https://developers.cloudflare.com/d1/sql-api/query-json/) e
[D1: índices](https://developers.cloudflare.com/d1/best-practices/use-indexes/)
fundamentam os mecanismos de persistência, não a contagem de tabelas.

[Workflows: idempotência](https://developers.cloudflare.com/workflows/build/rules-of-workflows/)
e [criação de instâncias](https://developers.cloudflare.com/workflows/build/workers-api/)
exigem tratar retries e IDs existentes. Conferir também
[limites D1](https://developers.cloudflare.com/d1/platform/limits/) e
[limites Workflows](https://developers.cloudflare.com/workflows/reference/limits/)
na validação da página real.

[Rate limit nativo](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
não equivale ao contador global atual.
[Transações Pluggy](https://docs.pluggy.ai/en/docs/products/transactions)
documenta janela histórica, paginação, sinais e possibilidade de mudança de ID;
a implementação deve confrontar esses contratos com o SDK efetivamente instalado.
