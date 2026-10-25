# Auditoria de arquitetura

Base inicial: `origin/main` em `6c2de5c`, após os merges recentes.
A integração posterior de `27869b9` preserva `get_subscriptions`, recebido
enquanto a validação desta auditoria estava em execução. O checkout principal
contém trabalho local em andamento; esta revisão usa um worktree isolado e não
inclui essas alterações ainda não publicadas.

Método: [improve-codebase-architecture](https://www.aihero.dev/skills-improve-codebase-architecture).
Priorizar módulos alterados recentemente e aplicar o teste de remoção: uma
extração só vale quando concentra conhecimento e reduz o que os consumidores
precisam saber. A implementação faz parte desta entrega, por solicitação do dono.

## Plano publicado antes da implementação

1. **Registrar a base e as evidências.** Executar os checks existentes, mapear
   dependências, revisar histórico, contratos, regras de lint e os caminhos de
   domínio, contratos, Worker e painel. Distinguir defeitos confirmados de
   oportunidades sem impacto demonstrado.
2. **Corrigir contratos e dependências.** Reunir políticas duplicadas, eliminar
   dependências concretas nos casos de uso e fechar lacunas nas restrições
   nativas do Biome. Preservar interfaces públicas do portal e MCP.
3. **Aprofundar os módulos com maior atrito.** Revisar planejamento, importação,
   consultas efetivas e consumo HTTP do painel. Concentrar validação externa,
   seleção, cursores e tratamento de falhas nas respectivas interfaces; remover
   código substituído. Não criar um framework, repository genérico ou container.
4. **Proteger os comportamentos.** Usar testes das interfaces existentes e
   acrescentar regressões para falhas demonstradas. Preservar dinheiro exato,
   moedas, paginação, revisão, idempotência, autenticação, isolamento de pessoas,
   publicação atômica, checkpoints e nomes dos steps duráveis.
5. **Concluir a revisão do diff.** Executar `mise run check:quick` durante as
   mudanças e `mise run check` na entrega, revisar o conjunto novamente e
   atualizar este documento e o draft com achados, correções e evidências.

## Critérios de conclusão

- Nenhum achado confirmado permanece sem correção ou justificativa verificável.
- Tipos, lint e formatação passam sem desativar regras ou adicionar supressões.
- Testes de domínio, integração Cloudflare, build e runtime sintético passam.
- O diff concentra responsabilidades e remove duplicações; tamanho de arquivo
  sozinho não justifica extração.
- O PR permanece draft. Publicação do produto, merge e migrações remotas são
  etapas separadas e não fazem parte desta auditoria.

## Achados e correções

### 1. Seleção e paginação financeira

| Achado confirmado | Correção | Evidência de comportamento |
| --- | --- | --- |
| Compras agrupadas aceitavam `currency` e devolviam outras moedas. | A moeda integra a seleção dos registros antes do agrupamento. | Seleção USD contém somente a transação USD. |
| IDs inexistentes de pessoa, espaço, conta ou categoria retornavam sucesso vazio nas compras. | `projection.validateSelection` é compartilhado pelas consultas individuais e agrupadas. | MCP retorna `NOT_FOUND`; HTTP retorna 404 nos dois caminhos. |
| `%` em cursor lançava `URIError`; JSON inválido virava falha interna no MCP. | `cursor.ts` concentra decode, validação e vínculo com revisão/seleção. | Cursores inválidos são recusados como entrada inválida por HTTP e MCP. |
| Compras continuavam um cursor depois da mudança do dia financeiro, omitindo registros que entravam na seleção. | O dia em São Paulo participa do contexto do cursor de compras. | Teste com relógio injetado exige `RESTART_REQUIRED` à meia-noite. |

### 2. Projeção dos dados da origem

A reimportação de uma transação com metadados de cartão retirados pela origem
atualizava `identification`, mas conservava o cartão, a parcela e a data antiga em
`planning_transactionDetails`. A lista continuava agrupando parcelas inexistentes.

A publicação remove o registro auxiliar desatualizado no mesmo batch da transação
e do checkpoint. Os caminhos JSON e escalar recebem a mesma regra. Os testes
reimportam duas parcelas e verificam sua apresentação independente depois da
retirada dos metadados, com descrições de 16 e 600.000 caracteres. Preferências
locais de cartões e planos mantêm sua persistência própria.

### 3. Contratos e módulos de planejamento

| Atrito | Mudança |
| --- | --- |
| Schemas ligados a posições de uma lista de 98 ferramentas. | `planningTools` oferece acesso por nome; catálogo, comandos e allowlists usam essas definições. |
| Leituras e escritas compartilhavam entrada ampla; resultados controlados eram `unknown`. | Comandos possuem tipos de leitura/escrita; casos de uso e recibos retornam objetos tipados. O MCP serializa o resultado sem revalidá-lo. |
| O repository interpretava nomes de ferramentas MCP para escolher tabelas. | `PlanningRead` descreve recursos internos; o caso de uso traduz o comando e preserva a leitura seletiva. |
| Mutações dependiam do arquivo de consultas para projetar cartões. | `cardCatalog` fica junto das projeções compartilhadas. A classificação perde uma decisão que devolvia o mesmo resultado nos dois caminhos. |

Uma comparação executável confirmou igualdade dos 98 schemas da base inicial.
Após integrar `27869b9`, a mesma comparação cobre os 99 schemas de entrada,
descrições e permissões de leitura, além das uniões de comandos e das allowlists
do portal. Os contratos públicos mantêm os mesmos campos e defaults.

### 4. Configuração, composição e falhas

O estado da instalação é montado pelo caso de uso de instalação, que recebe o
catálogo por uma porta. `household` concentra a disponibilidade de perfis e usa a
regra pura `profileConfigured`. A sincronização exige a verificação de configuração
antes de admitir uma rodada; a composição fornece essa dependência explicitamente.
Um teste comprova que uma recusa não despacha Workflow nem consome a reserva diária.

`PlanningError` reúne as recusas conhecidas do planejamento. HTTP, MCP e
observabilidade consomem o mesmo conjunto. Período invertido e categoria protegida
antes viravam HTTP 500; agora são recusas de entrada. Erros inesperados continuam
recebendo diagnóstico interno seguro. Conflitos de revisão/idempotência e recursos
ausentes conservam seus status específicos.

### 5. Painel e restrições nativas

| Achado confirmado | Correção |
| --- | --- |
| O import principal do Kumo carregava dependências de navegador no Worker e impedia a suíte completa de iniciar. | 35 arquivos usam entradas específicas exportadas pela versão instalada; o Biome recusa o barrel principal. |
| Telas conheciam os schemas HTTP e recebiam resultados `unknown`. | O cliente valida a resposta por ferramenta e devolve seu tipo; quatro leitores consomem dados tipados. A prévia usa o objeto validado do rascunho diretamente. |
| Uma leitura antiga podia sobrescrever uma atualização mais recente do mesmo filtro. | O cache identifica a requisição corrente por chave; mantém expiração, limite e invalidação por escrita. O teste demonstra a corrida e sua correção. |
| Faltavam proteções para dependências dos contratos em domínio/shared e para entradas de planning/household em entities/repositories. | Restrições nativas do Biome cobrem esses caminhos, sem plugins ou supressões. Probes temporários confirmaram os diagnósticos e foram removidos. |

## Validação da entrega

`mise run check:quick` passa após as mudanças e após integrar a ferramenta de
assinaturas. `mise run lint:fix` e `mise run format` convergem sem alterações.
A validação completa usa `mise run check`: tipos gerados, TypeScript, formatação,
lint, testes Node, integração Cloudflare, build e runtime nativo com 10 mil e
100 mil registros, replay e persistência após reinício. O resultado da revisão
atual está registrado no PR.

A evidência desta entrega é local e sintética. Provedor Pluggy, OAuth com serviço
externo, publicação Cloudflare e execução em um host MCP real exigem validações
próprias. Esta revisão preserva um pacote e um deploy, sem migrações de schema.
