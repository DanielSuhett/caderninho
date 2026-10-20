# Caderninho

MCP financeiro pessoal para consultar contas e transações importadas.
Vocabulário do lançamento descrito no [guia de uso](docs/usage.md).

## Linguagem

**Instalação**:
Cópia privada do Caderninho pertencente a uma pessoa, com configuração e histórico
próprios.

**Conexão**:
Vínculo de acesso à instituição financeira, representado por um Item da Pluggy.
Uma conexão pode disponibilizar várias contas.
_Evitar_: usar conta como sinônimo de conexão ou instalação.

**Conta**:
Conta financeira bancária ou de cartão de crédito pertencente a uma conexão.
Seu saldo tem moeda e referência temporal.

**Transação**:
Registro financeiro associado a uma conta e identificado pela origem.
Pode ser pendente ou confirmado. Uma nova importação atualiza o mesmo ID e
preserva os registros ausentes na janela atual da origem.

**Importação**:
Coleta de contas e transações disponibilizadas pela origem para uma conexão.
Sua conclusão não implica disponibilidade de todo o histórico bancário.

**Referência temporal**:
Dia financeiro da transação ou horário da coleta da conexão e da leitura do saldo.
Transações não têm marcadores individuais de frescor.
