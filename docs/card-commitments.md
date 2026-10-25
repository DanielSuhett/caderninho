# Compromissos de cartão no MCP

A aba Compromissos foi removida. O contrato `get_card_commitments` permanece
disponível para consultas existentes; a tela Cartões usa `get_portal_cards`.
Investimentos representa exclusivamente a carteira de ativos.

## Consulta compartilhada

A consulta `get_card_commitments` continua na allowlist de leitura de
`POST /api/account/query`, com sessão, origem e CSRF. Agentes chamam a mesma
consulta pelo MCP autenticado. A ferramenta aceita espaço, pessoa, conta, moeda,
mês inicial e um horizonte de até 12 meses. A seleção completa alimenta os
agregados; os valores não são somas de uma página de transações.

Exemplo de chamada MCP:

```json
{
  "name": "get_card_commitments",
  "arguments": {
    "spaceId": "personal",
    "month": "2026-10",
    "months": 12
  }
}
```

Contas CREDIT participam da consulta. Contas BANK e posições de investimento
ficam fora. As edições e categorias locais seguem a visão efetiva usada pelos
demais resumos. Dinheiro usa strings inteiras de unidades menores e aritmética
exata; moedas permanecem separadas.

Parcelas movidas individualmente seguem o espaço efetivo da transação. A consulta
resolve os metadados e limites da conta de origem sem mover a própria conta.
Esses limites continuam sendo os valores da conta, sem divisão entre espaços.

## Gastos e parcelas

Gastos realizados exigem classificação efetiva de despesa, estado POSTED e data
até o dia de referência. Débitos acrescentam despesa; créditos classificados
como despesa a reduzem, preservando estornos. Pagamentos de fatura,
transferências, ignorados, pendentes e lançamentos futuros não entram nesse
total. Movimentos sem classificação têm subtotal e contagem próprios.

O cronograma distingue realizados, pendentes e futuros. As parcelas recebidas
conservam número, total e data da compra quando disponíveis. Não multiplica o
valor de uma parcela pelo total da compra, não fabrica ocorrências ausentes e
não considera parcelas anteriores pagas pela posição de uma parcela observada.
Meses vazios indicam ausência de compromissos observados, sem prever gasto zero
na instituição.

## Limites e categorias

Limite total e disponível vêm dos campos explícitos da origem ou da configuração
de uma conta manual. Ocupado é a diferença entre limite total e disponível
quando ambos são conhecidos e consistentes. Não usa o saldo devedor como
crédito disponível, nem soma parcelas ao limite ocupado. Ausência permanece
indisponível; zero informado continua zero. A referência indica a observação da
conta no Caderninho; a origem não fornece um horário específico para cada limite.

A pizza mostra a distribuição por categoria dos compromissos observados no
período e moeda selecionados. Seu denominador é esse conjunto de compromissos,
não o limite bancário. Valores exatos e nomes permanecem acessíveis em lista;
valores negativos exigem apresentação textual em vez de setores negativos.
Sem categoria, valores desconhecidos e importação parcial permanecem explícitos.

## Evidência e limites

As consultas incluem parcialidade, revisão, dia de referência e a data do último
sucesso completo mais antigo do escopo. Esses dados não prometem atualização em
tempo real, histórico bancário completo ou uma projeção completa das faturas.
Os testes e a demo usam dados sintéticos. Deploy, Pluggy real e consumo da nova
ferramenta em um host MCP externo exigem validações próprias.
