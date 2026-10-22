# Usar o Caderninho

Abra `/account`, entre com sua senha e escolha **Conectar Meu Pluggy**. Use a mesma
aplicação Pluggy das suas conexões pessoais. Depois, escolha **Importar agora** e
acompanhe o estado das contas no painel.

## Importações

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

Use **Reconectar** quando a origem exigir uma nova autorização. Consultar status
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

As 89 ferramentas adicionais e seus contratos estão no [catálogo](mcp-finance.md).
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

Use o cursor retornado com os mesmos filtros. Se uma conexão selecionada publicar
uma página ou mudar seu estado/metadados, reinicie a paginação. Importações de
conexões fora da seleção não invalidam esse cursor.

## Manutenção do acesso

**Revogar todos os assistentes** remove seus grants OAuth. A sessão do painel
continua válida; novos acessos MCP precisam de consentimento. **Sair** apaga o
cookie deste navegador. Uma cópia desse cookie continua válida até completar oito
horas do login ou até trocar ADMIN_PASSWORD ou a versão do Worker. A expiração é
conferida no servidor. A autenticação do painel não grava sessões no D1 ou KV.

Altere ADMIN_PASSWORD nos secrets para trocar a senha: os cookies anteriores
perdem a validade. Publicar outra versão do Worker também os invalida. Essas
mudanças e o logout preservam as autorizações dos assistentes; use **Revogar todos
os assistentes** para removê-las.

A instalação desta versão exige um D1 novo. Deploys posteriores preservam o banco.
O [guia técnico](cloudflare-product.md) descreve os recursos e a validação local.
