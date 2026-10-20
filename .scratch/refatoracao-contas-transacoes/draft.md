# Divisão proposta: Caderninho para contas e transações

Status: aprovado para implementação em 19/10/2026.
Os tickets individuais estão publicados no diretório issues.

Fonte canônica: [spec da refatoração](../../docs/spec-refatoracao.md).
Vocabulário: [glossário](../../GLOSSARY.md).
Destino proposto: tracker Markdown local, seguindo a convenção já usada no projeto.
Após aprovação: um arquivo por ticket, numerado e com status `ready-for-agent`.

## Regras da execução

Banco sempre novo; nenhum upgrade, conversor, schema paralelo ou contrato legado.
Uma fatia só termina quando seu comportamento funciona pelas entradas reais e tem
verificação de comportamento. Cada fatia remove os trechos que substituiu, sem
deixar toda a limpeza para o fim. Não criar um prefactor genérico separado sem
ganho concreto para o primeiro caminho de instalação e conexão.

A troca do schema afeta o projeto inteiro. Se as fatias não puderem permanecer
globalmente verdes sem criar compatibilidade temporária, usar uma única branch
de integração: registrar os checks ainda pendentes, verificar cada fatia pelo seu
fluxo e exigir a suíte completa antes da integração final. Não desativar regras,
mascarar falhas nem publicar uma fatia incompleta como lançamento. Este plano não
autoriza criar deploy, merge, migração remota ou alterar dados reais.

## 01: Instalar do zero, autenticar e registrar uma conexão

**What to build:** O proprietário inicia uma instalação vazia, entra no painel
com sua senha, autoriza um assistente e registra uma conexão válida do Meu Pluggy.
Painel e status mostram que a conexão existe e ainda não tem dados importados.

**Blocked by:** None (can start immediately após aprovação da divisão).

- [ ] Instalação cria o schema novo de seis tabelas e a configuração inicial sem
  consultar bancos anteriores; repetir o preparo não apaga dados já gravados.
- [ ] Login, logout, CSRF, cookies e expiração de oito horas funcionam pelas rotas
  reais. Limitação nativa por IP substitui o contador D1 sem gravar IP em logs/banco.
- [ ] Consentimento OAuth permite chamar o novo status e revogar assistentes,
  sem permissões por conta ou conexão e sem expor secrets ou payloads privados.
- [ ] Registro valida a conexão na origem, aceita só Meu Pluggy, é idempotente
  para a mesma conexão e respeita o limite de dez. A interface distingue conexão
  de conta e não apresenta histórico ausente como saldo zero.
- [ ] Testes de jornada usam dados sintéticos e entradas reais. A fatia define o
  ponto de entrada do novo runtime sem restaurar rotas/features fora do escopo;
  evidência local é distinguida de provisionamento/OAuth externos.

## 02: Importar e consultar uma conta com uma página de transações

**What to build:** O proprietário inicia uma importação de uma conexão sintética
com uma conta e uma página. O Workflow grava os dados, conclui essa coleta e o
assistente consulta a conta, o saldo observado e as transações importadas.

**Blocked by:** 01: Instalar do zero, autenticar e registrar uma conexão.

- [ ] Pedido manual cria uma intenção persistida e um Workflow com o mesmo ID.
  Status e painel mostram o trabalho sem depender da aba aberta ou de Tasks
  customizadas. A janela da conexão não é reservada separadamente da intenção.
- [ ] Adapter lê somente conexão, contas e transações. Uma conta BANK ou CREDIT
  e seus registros mantêm identidade composta, moeda, datas e precisão financeira;
  não há entidade universal, catálogo de recursos ou motor de regras no caminho.
- [ ] Publicação grava página, marcador de coleta, sequence, commit/resultado
  limitado e revisão em um batch; condição inválida reverte todos os writes.
  Upstream inválido ou página vazia indisponível não vira coleta vazia válida.
- [ ] As tools de importação, status, contas e consulta simples retornam dados
  tipados, referência temporal e qualidade. Saldo não é calculado a partir do
  extrato, e payload bruto não é enviado ao assistente por padrão.
- [ ] Testes no runtime demonstram a jornada de uma página, vazio válido, perda
  de resposta após commit e rollback por falha no checkpoint. Uma próxima página
  existente permanece pendente; a fatia nunca declara completude falsa.

## 03: Percorrer contas e páginas e retomar a importação com segurança

**What to build:** Uma importação percorre várias contas e páginas sozinha,
sobrevive a interrupções e informa conclusão ou falha real. O proprietário não
coordena cursores nem confirma lotes pelo assistente.

**Blocked by:** 02: Importar e consultar uma conta com uma página de transações.

- [ ] O mesmo algoritmo percorre contas e transações disponíveis em sequência,
  mantendo apenas checkpoint e resultado do commit mais recente em tamanho limitado.
  Não há caminho incremental, seleção materializada ou histórico crescente de recibos.
- [ ] Retries e esperas têm orçamento no Workflow; página já confirmada devolve
  seu resultado antes de refazer a leitura. Concorrência da mesma sequence,
  página antiga e execução encerrada não publicam nem avançam progresso duas vezes.
- [ ] Cursor repetido, identidade inesperada ou ID com conteúdo conflitante
  recusam a publicação. Cada conta tem progresso próprio; falha preserva páginas
  confirmadas e deixa qualidade parcial, sem simular rollback de toda a importação.
- [ ] Finalizar a enumeração da conta promove seu marcador no commit. Resultado
  da execução é `succeeded` ou `failed`, nunca sucesso com uma flag de erro oculta.
  Status e painel apresentam o resultado real e a referência da última coleta válida.
- [ ] Runtime D1/Workflow com falhas injetadas verifica retomada entre páginas,
  resposta perdida, contas múltiplas e tamanho real de página. Limites do adapter
  são medidos sem truncamento nem avanço parcial de cursor.

## 04: Consultar histórico sem confundir ausência com exclusão

**What to build:** Após uma nova coleta, o proprietário distingue transações
observadas, registros não confirmados e coleta parcial. Alteração de ID ou redução
da janela da origem não apaga histórico nem faz duas versões parecerem gastos
confirmados diferentes.

**Blocked by:** 03: Percorrer contas e páginas e retomar a importação com segurança.

- [ ] Presença é resolvida a partir da enumeração concluída da conta e do marcador
  de observação, sem regravar em massa todas as transações ausentes a cada coleta.
- [ ] Registro ausente de enumeração completa vira `not_observed`, continua
  consultável e não é excluído fisicamente. Falha em uma página não promove o
  marcador de completude; tentativa em andamento/falha permanece parcial.
- [ ] Troca de ID não transfere correção por similaridade. Histórico fora da
  janela da origem conserva referências temporais; conta inacessível não apaga
  transações nem comprova um saldo zero.
- [ ] Consulta, status e painel expõem qualidade e última tentativa separadas da
  última enumeração válida. Não apresentam snapshot estável anterior quando
  páginas da tentativa nova já foram publicadas.
- [ ] Jornadas sintéticas cobrem ID substituído, janela reduzida, conta ausente,
  vazio válido e falha no meio da coleta; a qualidade fica disponível aos casos
  de uso de agregação sem depender de outro serviço ou tabela de cobertura.

## 05: Filtrar e paginar transações com um contrato financeiro concreto

**What to build:** O assistente encontra transações por conta, período e campos
conhecidos e percorre resultados consistentes. Mudança dos dados exige reiniciar
a paginação em vez de misturar versões silenciosamente.

**Blocked by:** 02: Importar e consultar uma conta com uma página de transações.

- [ ] Consulta suporta os filtros nomeados da spec, incluindo categoria/descrição
  efetiva, ignorado e presença. Referências compostas evitam colisões entre contas;
  não há paths livres, AST genérica, SQL de entrada ou recursos fora do escopo.
- [ ] Ordem estável, cursor com posição/escopo/revisão e limites de 50 por padrão
  e 200 no máximo permitem paginação completa sem carregar o extrato inteiro.
- [ ] Cursor de escopo diferente ou revisão alterada é recusado de forma acionável;
  registros, qualidade e revisão são lidos consistentemente. Filtros monetários
  exigem moeda e preservam exatidão.
- [ ] Pendentes, futuros, ignorados e registros não observados continuam
  encontráveis explicitamente, com valores originais/efetivos e referência temporal.
  O contrato de qualidade é testado com fixtures independentemente da coleta longa.
- [ ] Testes pela tool e pela persistência cobrem combinações de filtros, limites,
  páginas sem perdas/duplicação e invalidade de cursor após publicação. Não
  acrescentar uma tela de extrato que o produto não precisa para completar a fatia.

## 06: Responder totais financeiros exatos e honestos

**What to build:** O assistente responde contagens, débitos, créditos, fluxo e
consumo conhecido por moeda, conta, categoria ou mês, usando todo o universo
selecionado e explicando quando o resultado é apenas um subtotal.

**Blocked by:** 04: Consultar histórico sem confundir ausência com exclusão;
05: Filtrar e paginar transações com um contrato financeiro concreto.

- [ ] A tool de agregação reutiliza a seleção SQL das consultas e nunca calcula
  totais pela página retornada ao assistente. Métricas e agrupamentos são fechados.
- [ ] Strings monetárias e agregação exata preservam valores acima de int64/Number
  seguro; moedas não são somadas entre si. Nulo, medida desconhecida e zero são
  distintos, inclusive quando todos os registros do período forem incertos.
- [ ] BANK/CREDIT, pagamento de cartão, transferência própria, estorno e débito
  incerto mantêm sua semântica. Ignorados, pendentes e futuros seguem a política
  da métrica, com dia financeiro explícito e nenhuma reclassificação configurável.
- [ ] Resultado separa conhecido e não confirmado e informa referência temporal,
  definição e parcialidade. ID possivelmente substituído não soma duas vezes como
  consumo confirmado; subtotal não é descrito como total definitivo.
- [ ] Testes de tool e D1 demonstram os casos financeiros e usam um conjunto maior
  que o limite de página, incluindo categorias sem valor e contas com qualidade
  diferente. Não criar novas tabelas de totais, categorias ou derivados.

## 07: Corrigir transações localmente sem perder edições na importação

**What to build:** O proprietário corrige categoria, descrição ou ignorado pelo
assistente, consulta o resultado e pode remover cada correção para voltar à origem.
Uma importação posterior ou concorrente preserva essas escolhas.

**Blocked by:** 05: Filtrar e paginar transações com um contrato financeiro concreto.

- [ ] A tool de correção aceita somente identidade composta e patch de campos
  conhecidos. Patch vazio, campo desconhecido e registro inexistente têm erro
  acionável; não existe alteração na instituição financeira.
- [ ] Campo omitido permanece; null remove só aquele override. Descrição vazia e
  ignorado false são preservados. Categoria é texto, sem catálogo/aliases próprios.
- [ ] Atualizar um campo não apaga outro campo nem a origem. Importação e correção
  concorrentes atualizam colunas distintas sem perda de edição manual.
- [ ] Consulta e filtros passam a usar valores efetivos, preservando os originais;
  a revisão muda atomicamente quando houver mudança real. Repetir a mesma edição
  não duplica efeito, e um cursor anterior é invalidado corretamente.
- [ ] Jornada pela tool cobre set/reset, valores falsy, replay da edição e disputa
  com importação. Integração final verifica também o efeito nos agregados; essa
  fatia não fica bloqueada pela implementação da tool de agregação.

## 08: Manter a cópia diária e recuperar despachos sem operações duplicadas

**What to build:** O dono pode deixar a cópia financeira atualizar diariamente,
pausar novas importações e pedir atualização manual. Despacho incerto é recuperado
sem criar outro ciclo, e o painel explica elegibilidade, andamento e falhas.

**Blocked by:** 03: Percorrer contas e páginas e retomar a importação com segurança.

- [ ] Agenda às 09:00 UTC e pedido manual usam a mesma admissão atômica de 24 horas
  por conexão. Pausa/cooldown retornam estados claros e não criam intenção futura;
  falha não devolve a janela de admissão.
- [ ] Pedidos concorrentes devolvem a execução ativa. Índice/condição no banco
  impedem duas admissões; conexões distintas não disputam um lock global.
- [ ] Intenção pendente é recuperada por cron/pedido manual com o mesmo ID de
  Workflow. Erro de rede não é confundido com estado terminal; execução encerrada
  não é ressuscitada por restart nem expirada por idade.
- [ ] GET/status só leem; pausa não interrompe commits já iniciados. Painel
  apresenta próxima elegibilidade e resultados sem expor SQL/cursores como tarefas
  do usuário. Retenção remove só execuções encerradas após 30 dias, sem apagar
  marcadores financeiros nem deixar FK impeditiva.
- [ ] Testes de cron, painel e runtime demonstram corrida manual/agenda,
  resposta perdida no despacho, pausa, recuperação e retenção limitada, usando
  dados sintéticos e sem depender de webhook ou acesso remoto.

## 09: Integrar e verificar o lançamento enxuto em instalação nova

**What to build:** Uma instalação vazia executa a jornada completa: conectar,
autorizar, importar, consultar, agregar, corrigir e continuar após outro deploy.
Só existem os conceitos, ferramentas e dependências do lançamento simplificado.

**Blocked by:** 06: Responder totais financeiros exatos e honestos;
07: Corrigir transações localmente sem perder edições na importação;
08: Manter a cópia diária e recuperar despachos sem operações duplicadas.

- [ ] Jornada completa usa as seis tools novas e o painel com autenticação/OAuth;
  correção afeta agregados e um novo deploy preserva registros financeiros. Não
  existem aliases/rotas funcionais para regras, outros produtos ou execução legada.
- [ ] Verificação final remove apenas remanescentes: tabelas/views antigas,
  normalização universal, Tasks customizadas, webhooks, R2/migração, dependências,
  exports, configurações e fixtures sem consumidores. Não desligar lint/checks
  nem apagar cobertura financeira/security relevante para obter verde.
- [ ] Medição com 10 mil e 100 mil transações, múltiplas contas e páginas reais
  registra correção de resultados, tempo, memória e limites; memória não cresce
  com todo o extrato. Inviabilidade da releitura diária exige revisar a spec,
  não truncar registros ou reintroduzir complexidade silenciosamente.
- [ ] README, instalação, uso, arquitetura, exemplos e glossário concordam com
  banco novo, seis tabelas e escopo de contas/transações. Não há instruções de
  upgrade, schema paralelo ou credenciais adicionais desnecessárias.
- [ ] Checks completos e runtime local passam na branch de integração. Evidências
  distinguem testes sintéticos/build de provisionamento, Pluggy e host MCP reais;
  não executar deploy, merge ou mudança remota como parte deste ticket.

## Dependências e frontier

01 → 02 → 03 → 04 → 06 → 09.
02 → 05 → 06; 05 → 07 → 09; 03 → 08 → 09.

Após 02, podem avançar 03 e 05. Após 03, podem avançar 04 e 08 sem esperar 05.
07 depende apenas da consulta 05; não precisa esperar agregação 06.
Somente 01 está na frontier inicial. Divisão aprovada pelo pedido de implementação do usuário.
