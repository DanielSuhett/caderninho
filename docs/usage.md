# Usar o Caderninho

Na instalação pelo botão Cloudflare, escolha sua senha de entrada no campo
`ADMIN_PASSWORD` (16 a 256 caracteres). Depois do deploy, abra o endereço do
Caderninho e entre com essa senha. Não é necessário procurar chaves nos logs.
Instalações anteriores com chave gerada continuam aceitando essa chave.
Em **Pessoas**, cadastre nome/foto,
configure o acesso Pluggy e autorize seus bancos. Conclua Pessoas para iniciar
a primeira importação. O painel acompanha as fases e as páginas publicadas.

Consulte [as páginas da instalação](frontend-workspace.md) para navegar por transações,
regras, grupos e histórico de sincronizações.

## Pessoas e perfis

O dashboard reúne as contas de titulares distintos e permite alternar entre uma
pessoa e “Todos”. Cadastre pessoas e credenciais em **Pessoas**; os próximos bancos
reutilizam o acesso da pessoa. O [guia de titularidade](household.md) explica
configuração, filtros MCP, correção de titular, pausa e limites da Pluggy.

## Importações

A tela de **Conexões** acompanha a importação real: espera na fila, fase corrente,
conta em processamento e horário da última observação do status. Esse horário não
indica atualização no banco. Contas identificadas ainda não significam transações
publicadas; **Ver transações disponíveis** aparece quando a primeira página está
salva. Você pode consultá-la enquanto o restante continua sendo importado.

Ao concluir, **Ver transações** também fica disponível para um resultado vazio.
Uma falha preserva os registros já publicados e oferece os detalhes para recuperação.
As atualizações automáticas do status param ao concluir, falhar ou ocultar a aba;
retornar à aba ou escolher **Atualizar status** consulta novamente. Uma indisponibilidade
na leitura do status mantém a última observação, sem declarar que a importação falhou.
Pedidos posteriores ficam em **Pessoas, perfis e outras conexões**.

O Caderninho relê contas, transações, investimentos, empréstimos e faturas disponíveis na origem. Uma coleta
concluída significa que essa enumeração terminou; a instituição pode disponibilizar
somente parte do histórico. Uma falha preserva páginas confirmadas e aparece como
coleta parcial. O painel e `caderninho_status` exibem a importação corrente de
cada conexão: estado, fase, conta, último sucesso e código de erro seguro. O último
sucesso é preservado quando uma tentativa posterior falha.

Cada conexão só admite uma importação a cada 24 horas, contadas do pedido aceito,
inclusive em falha. Pedido repetido reutiliza a execução ativa. A agenda diária
roda às 09:00 UTC. **Próxima elegibilidade** informa quando uma nova importação
pode ser admitida; não promete o horário exato da execução.

Use **Reautorizar conexão** quando a origem exigir uma nova autorização. Consultar status
não inicia trabalho. Despacho incerto recupera o mesmo ID de importação; falha ao
consultar o Workflow mantém a importação ativa até confirmar seu estado.

## Assistente

Copie a URL `https://SEU-WORKER/mcp` exibida no painel, configure seu conector MCP
e aprove o OAuth no Caderninho. Cada assistente recebe sua própria autorização.
As quatro ferramentas originais preservam a visão bancária:

| Tool | Uso |
| --- | --- |
| `caderninho_status` | Contas e saldos por conexão, configuração segura e importações |
| `caderninho_sync` | Pedir importação por conexões opcionais |
| `caderninho_transactions` | Página filtrada de transações |
| `caderninho_aggregate` | Totais exatos por moeda em toda a seleção |

Exemplo de agregado:

```json
{
  "metric": "debits",
  "filter": { "from": "2026-10-01", "to": "2026-10-31", "currency": "BRL" },
  "groupBy": "category"
}
```

`count` conta todos os registros da seleção. `debits`/`credits` são magnitudes
por direção da origem: débito não equivale a gasto e crédito não equivale a renda.
`cash_flow` é o fluxo assinado de contas BANK. Pendentes e futuros continuam
consultáveis, mas ficam fora dos totais monetários. Saldo de cartão não representa
patrimônio disponível.

Valores em `amountMinor`/`totalMinor` são strings de unidades menores da moeda.
Nunca some moedas diferentes nem use uma página para calcular o total do período.
Valor desconhecido é `null`; `unknownAmountCount` informa quantos valores são
desconhecidos no agregado. Um subtotal sem valores conhecidos é `null`, não zero.
A resposta informa o dia de referência e a parcialidade da coleta.

Consultas e agregados incluem `oldestLastSuccessAt`: o sucesso completo mais antigo
das conexões selecionadas, ou `null` se alguma nunca concluiu. Para perguntas sobre
hoje ou movimentação recente, considere essa data; `caderninho_status` detalha cada
conexão. `referenceDay` é o dia
usado para excluir valores futuros, não a data da última coleta. `partial:false`
não garante atualização nem todo o histórico bancário. Sem nova importação,
um resultado vazio para hoje não comprova movimento zero no banco.

O histórico é cumulativo. Importar A/B e depois B atualizado/C resulta em
A/B atualizado/C. Uma janela menor ou vazia não remove registros nem os exclui
dos totais elegíveis. IDs diferentes são registros diferentes, mesmo que os dados
se pareçam. Categoria e descrição vêm da origem e só mudam por outra importação.
O frescor é informado pela conexão e pela leitura do saldo, sem auditoria individual
de transações.

Na visão original, o status informa contas e saldos; `connectionIds` seleciona
conexões. Cada conexão contém `accounts`, um mapa indexado pelo ID Pluggy da conta,
com `name`, `type`, `currency`, `balanceMinor` e `balanceObservedAt`. A referência
informa quando o saldo foi lido pelo Caderninho, sem prometer atualização bancária.
Conta ausente e saldo não relido conservam o valor e o horário anteriores; a
parcialidade acompanha a conexão, sem estados ou intervalos por conta.

## Planejamento e edição

As ferramentas de planejamento e seus contratos estão no [guia MCP](mcp-finance.md);
o [inventário gerado](mcp-tools.md) acompanha os nomes e a contagem atual.
`get_transactions` aplica edições locais; `caderninho_transactions` mantém a
projeção da origem. O mesmo vale para totais: as ferramentas de planejamento
separam despesas explicitamente classificadas de movimentos não classificados.
Não use o fluxo BANK como sinônimo de renda disponível.

Cada escrita precisa de `spaceId`, `confirmed: true` e `idempotency_key`.
Obtenha confirmação do proprietário antes de chamar. Reutilize a chave apenas
para repetir a mesma operação; outra solicitação exige outra chave.
`RESTART_REQUIRED` pede nova leitura; nunca repita automaticamente uma escrita
com dados alterados sem reavaliar a solicitação confirmada.

O espaço inicial é `personal`. Espaços são organização de uma instalação pessoal,
sem usuários adicionais nem isolamento de autorizações.

## Filtros

Filtros aceitos: `connectionIds`, `accountIds` (IDs de recurso Pluggy), período, moeda, direção, status,
categoria/descrição da origem e faixa de valor em unidades menores. Uma faixa
monetária exige moeda. Agrupamentos são conta, categoria ou mês. Campos desconhecidos
são recusados. A página tem até 200 registros; o padrão é 50.

Seleções explícitas de contas ou conexões inexistentes retornam `NOT_FOUND`,
inclusive quando misturadas com IDs válidos. Consulte status para redescobrir os
IDs antes de repetir. Erros `INVALID_FILTER` mantêm esse código e incluem `issues`
com campo e motivo seguros; os argumentos privados não são repetidos no erro.

Categoria e moeda usam correspondência exata. Descrição procura um trecho literal
e ignora caixa, inclusive nos acentos portugueses; não remove acentos e não aceita
curingas. Limites monetários comparam o valor assinado armazenado, não a magnitude
da direção: em BRL, `maxAmountMinor: "-10000"` seleciona valores de -R$100,00 para
baixo. Isso não classifica gasto. Dentro do mesmo dia, a ordem usa conta/ID,
sem uma ordem cronológica por horário.

Use o cursor retornado com os mesmos filtros. Se uma conexão selecionada publicar
uma página ou mudar seu estado/metadados, reinicie a paginação. Importações de
conexões fora da seleção não invalidam esse cursor.

## Manutenção do acesso

**Revogar todos os assistentes** remove seus grants OAuth. A sessão do painel
continua válida; novos acessos MCP precisam de consentimento. **Sair** apaga o
cookie deste navegador. Uma cópia desse cookie continua válida até completar oito
horas do login ou até trocar a chave/senha ou a versão do Worker. A expiração é
conferida no servidor. A autenticação do painel não grava sessões no D1 ou KV.

A senha escolhida no formulário de instalação é guardada como secret
`ADMIN_PASSWORD`. Deploys seguintes preservam o acesso existente e não exibem
credenciais nos logs. Instalações anteriores com `ADMIN_ACCESS_HASH` continuam
aceitando sua chave; o link do deploy antigo pode conter a chave no fragmento,
mas o painel não recupera a chave pelo hash. Para recuperar acesso perdido,
defina `ADMIN_PASSWORD` nos secrets com 16 a 256 caracteres; a senha passa a
prevalecer e os cookies anteriores
perdem a validade. Publicar outra versão do Worker também os invalida. Essas
mudanças e o logout preservam as autorizações dos assistentes; use **Revogar todos
os assistentes** para removê-las.

A instalação desta versão exige um D1 novo. Deploys posteriores preservam o banco.
A [arquitetura](adr-modular-monolith.md) descreve recursos, persistência e segurança;
[CONTRIBUTING.md](../CONTRIBUTING.md) explica a validação local.

## Vocabulário

Instalação é a cópia privada com configuração/histórico do proprietário. Conexão
é o Item Pluggy que pode fornecer várias contas; conta não é sinônimo de conexão
nem instalação. Pessoa é titular declarado, perfil é aplicação Pluggy e espaço
organiza planejamento, sem criar permissões. Conta importada fica no mapa da
conexão; conta manual pertence ao planejamento.

Transação é o registro identificado pela origem, pendente ou confirmado.
Importação enumera o que o provedor disponibiliza, sem prometer todo o histórico.
Referência temporal distingue dia financeiro, admissão/último sucesso e horário
da leitura do saldo. Checkpoint guarda a posição recuperável (fase/conta/cursor),
sem contar registros nem substituir o histórico de rodadas. Parcialidade sinaliza
coleta incompleta ou valores desconhecidos; não transforma ausência em zero.
Autorização do assistente é o grant OAuth independente do cookie do painel.

### Carteira do investidor

Abra **Investimentos** para consultar posições importadas e manuais, filtrar
pessoa, grupo, classe, instituição e moeda, consultar composição e abrir detalhes
do ativo. Parcelas e gastos de cartão ficam em **Cartões**.
A [demo de investimentos](/demo/investments/) usa os mesmos componentes e regras
de cálculo, com valores sintéticos.

No MCP, `get_investments` aceita `spaceId`, `personId`, `currency`, `type`,
`institutionId` e `status`. Retorna `records` e `totals` por moeda, com `gross`,
`net`, `original`, `withdrawal`, `byType` e `byInstitution`.
Cada medida informa `totalMinor`, `knownMinor` e `unknownCount`. Campos monetários
são strings inteiras em unidades menores. Zero é conhecido; ausência não é zero.
`amountMinor` representa a posição bruta.
`details` conserva valores, taxas e datas fornecidos pela Pluggy; `identity`
conserva instituição e logo validado. Reimportações preservam grupo e inclusão.

Resgatados (`TOTAL_WITHDRAWAL`) e registros com `included=false` continuam na
lista, mas não entram nos totais. Rentabilidade não é deduzida da diferença entre
bruto, líquido ou aportes. Não há série histórica inventada nem execução de
aplicações/resgates. Campos novos de registros antigos dependem da próxima
sincronização com a instituição.

### Foto da pessoa

Em **Conexões → Editar titulares e credenciais**, escolha **Adicionar foto** ou
**Trocar foto**, confira a prévia e clique em **Salvar pessoa**. **Remover foto**
volta às iniciais e também precisa ser salvo. JPEG, PNG e WebP de até 5 MB são
aceitos; o navegador recorta e reduz a foto para 160 × 160 px antes de enviar.
A imagem fica no banco privado da instalação, sem serviços externos de avatar.

A foto fica na coluna opcional `people.photo`, criada no schema inicial. Atualizar
nome ou foto não altera os vínculos financeiros da pessoa.
