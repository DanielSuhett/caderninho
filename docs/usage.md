# Usar o Caderninho

Abra `/account`, entre com sua senha e escolha **Conectar Meu Pluggy**. Use a mesma
aplicação Pluggy das suas conexões pessoais. Depois, escolha **Importar agora** e
acompanhe o estado das contas no painel.

## Importações

O Caderninho relê as contas e transações disponíveis na origem. Uma coleta
concluída significa que essa enumeração terminou; a instituição pode disponibilizar
somente parte do histórico. Uma falha preserva páginas confirmadas e aparece como
coleta parcial. Última coleta bem-sucedida e tentativa atual têm horários distintos.

Cada conexão só admite uma importação a cada 24 horas, contadas do pedido aceito,
inclusive em falha. Pedido repetido reutiliza a execução ativa. A agenda diária
roda às 09:00 UTC. **Próxima elegibilidade** informa quando uma nova importação
pode ser admitida; não promete o horário exato da execução.

Use **Reconectar** quando a origem exigir uma nova autorização. Pausar impede
novas importações; importações iniciadas continuam. Retomar habilita novos pedidos
e a agenda. Consultar status não inicia trabalho.

## Assistente

Copie a URL `https://SEU-WORKER/mcp` exibida no painel, configure seu conector MCP
e aprove o OAuth no Caderninho. Cada assistente recebe sua própria autorização.
Há seis ferramentas:

| Tool | Uso |
| --- | --- |
| `caderninho_status` | Configuração segura, contas e importações |
| `caderninho_sync` | Pedir importação por conexões opcionais |
| `caderninho_accounts` | Contas e saldos observados |
| `caderninho_transactions` | Página filtrada de transações |
| `caderninho_aggregate` | Totais exatos por moeda em toda a seleção |
| `caderninho_correct_transaction` | Correções locais de categoria, descrição e ignorado |

Exemplo de agregado:

```json
{
  "metric": "debits",
  "filter": { "from": "2026-10-01", "to": "2026-10-31", "currency": "BRL" },
  "groupBy": "category"
}
```

`count` conta registros. `debits`/`credits` são magnitudes por direção da origem.
`cash_flow` é o fluxo assinado de contas BANK. `known_spending` só inclui consumo
com evidência suficiente e informa também débitos de natureza incerta.
Pendentes, futuros e ignorados não entram nas métricas financeiras. Saldo de
cartão não representa patrimônio disponível.

Valores em `amountMinor`/`totalMinor` são strings de unidades menores da moeda.
Nunca some moedas diferentes nem use uma página para calcular o total do período.
A resposta informa referência temporal e parcialidade. Um subtotal conhecido pode
ser ausente quando não há registros confirmados; isso não equivale a zero.

A origem pode substituir IDs ou reduzir a janela histórica. Registros antigos
não encontrados ficam `not_observed`, sem remoção física. Eles continuam
consultáveis, mas não são somados como valores confirmados junto dos novos IDs.
Correções não são copiadas para outro ID por semelhança.

## Filtros e correções

Filtros aceitos: conexões, referências de contas, período, moeda, direção, status,
categoria/descrição efetivas, ignorado, presença e faixa de valor em unidades
menores. Uma faixa monetária exige moeda. Agrupamentos são conta, categoria ou mês.
Campos desconhecidos são recusados. A página tem até 200 registros; o padrão é 50.

Use o cursor retornado com os mesmos filtros. Se a revisão financeira mudar,
reinicie a paginação; não misture páginas de revisões distintas.

Uma correção identifica conexão, conta e transação:

```json
{
  "connectionId": "item-da-origem",
  "accountId": "conta-da-origem",
  "id": "transacao-da-origem",
  "patch": { "category": "Mercado", "description": "", "ignored": false }
}
```

Campos omitidos não mudam. `null` remove aquela correção e restaura o valor da
origem; `ignored=false` e descrição vazia são escolhas válidas. Importações futuras
atualizam a origem e preservam as correções locais. Nada é escrito no banco ou
cartão da instituição financeira.

## Manutenção do acesso

**Revogar todos os assistentes** remove seus grants OAuth. A sessão do painel
continua válida; novos acessos MCP precisam de consentimento. **Sair** revoga a
sessão atual. Ela também expira em oito horas ou quando um deploy muda a versão
do Worker. Altere ADMIN_PASSWORD nos secrets para trocar a senha e publique uma
nova versão para invalidar sessões existentes.

A instalação desta versão exige um D1 novo. Deploys posteriores preservam o banco.
O [guia técnico](cloudflare-product.md) descreve os recursos e a validação local.
