# Conectar e acompanhar a primeira importação

23/10/2026 · branch `codex/onboarding-live-import` · base `main` `26de722`.

## Comportamento entregue

A confirmação do widget registra a conexão e solicita sua primeira importação.
A admissão é atômica: callbacks repetidos ou concorrentes não iniciam outra
primeira importação, inclusive depois de 24 horas. Importações posteriores
mantêm o intervalo e a ação manual existentes.

Conexões apresenta a fase e a conta do checkpoint persistido pelo Workflow,
o horário da observação e a parcialidade. Não estima porcentagem, duração ou
total de transações. Contas identificadas não liberam a consulta: o backend
confirma a existência de transações salvas. Um resultado vazio concluído também
é consultável. Falhas preservam os registros já publicados e orientam a
recuperação conforme o código seguro conhecido.

O acompanhamento consulta o status a cada dois segundos somente durante uma
importação ativa e com a aba visível. Falhas de leitura aumentam o intervalo até
30 segundos e interrompem novas tentativas após cinco erros. Retornar à aba ou
atualizar manualmente reconcilia o estado. Ler status não inicia importação.

## Evidência funcional

- `mise run check`: 32 testes Node, 107 de integração e o teste de runtime
  nativo com volumes de 10 mil/100 mil registros e persistência passaram.
- Navegador local + Worker, D1 e Workflow reais: uma confirmação do widget
  gerou um POST `/items`, nenhum POST `/sync` e a mesma execução publicou três
  transações antes de concluir com nove. A consulta parcial funcionou durante
  a execução. Leituras automáticas cessaram após a conclusão.
- Resultado vazio real: execução concluída com zero transações, sem reiniciar
  onboarding. A consulta exibiu o estado vazio existente.
- Timeout real no upstream sintético: após as tentativas do Workflow, estado
  `failed`/`UPSTREAM_TIMEOUT` com três transações preservadas e consulta disponível.
  Falha antes de publicar dados não ofereceu uma consulta inexistente.
- Indisponibilidade de status: primeira leitura oferece tentar novamente;
  leituras posteriores mantêm a observação e removem o aviso após recuperação.
  Não transformam indisponibilidade da consulta em falha da importação.

A consulta `EXISTS` que habilita a leitura usa o índice de cobertura existente
`transaction_account (account_id,date,id)`, conforme `EXPLAIN QUERY PLAN` no D1
local. Não foram adicionados índices, tabelas ou migrações para esta jornada.
Isso não constitui uma nova medição de CPU ou de cotas do ambiente remoto.

## Revisão visual

[QA independente](../design-qa.md): `passed`, após corrigir o alvo do histórico
para 44 px e a orientação de timeout. Desktop de referência 1487 × 1058 e
mobile de 360/390 px; fonte Hanken carregada, controles de 44 px, sem overflow
horizontal nos estados observados. Teclado abriu/fechou o widget sintético,
ativou a consulta e fechou o drawer por Escape, devolvendo foco ao gatilho.

Evidências em `outputs/onboarding-implementation-2026-10-23/`: capturas,
snapshots do D1, medições DOM e QA. O relatório identifica exportações rejeitadas
por corte/raster; não as usa para provar geometria.

## Limites da validação

O SDK e a origem Pluggy foram substituídos apenas na prévia ignorada pelo Git,
com dados fictícios. As requisições passaram pelo Worker, repositórios e Workflow
reais. O proxy HTTP local adaptou cookies de teste: essa prévia não comprova a
sessão HTTPS, OAuth ou uma nova autorização bancária real. O build de produção
usa o SDK normal e mantém a autenticação existente.

A pausa em aba oculta foi comprovada por testes do monitor; o IAB manteve as abas
como visíveis, então não há alegação dessa prova no navegador. Foi validado
reflow equivalente a 200% reduzindo o viewport para 744 × 529; zoom real e leitor
de tela não foram testados. Nenhuma alegação de conformidade completa decorre
das capturas.

## Publicação

Publicada somente em
`https://caderninho-onboarding-20261023.caderninho-web.workers.dev/account/connections`,
versão `079d1b04-5668-4260-b9a4-448841c39483`, depois do parecer `passed`.
CSS, entrada JavaScript e chunk da jornada publicados conferem byte a byte com o
build validado. O upload preservou bindings, secrets, flags, roteamento e agenda
existentes; não houve migração, troca de senha nem nova autorização Pluggy.

A publicação usou a sessão API Cloudflare conectada, pois a credencial do CLI não
tinha acesso ao upload do Worker. Artefatos transitórios ficaram em chaves novas
e isoladas do KV efêmero, com expiração automática, sem alterar chaves OAuth.
A landing `https://usecaderninho.com/` manteve o mesmo conteúdo SHA-256 antes e
depois. A branch `main` continua em `26de722`.

A entrada HTTPS foi conferida no Chrome. A sessão anterior pediu novo login;
esta rodada não comprova uma nova importação bancária ou a navegação autenticada
remota com as credenciais temporárias. A evidência de importação ponta a ponta
acima é local, com provedor sintético e runtime nativo.
