# Caderninho

MCP financeiro pessoal para consultar contas e transações importadas.
Vocabulário do lançamento definido em [spec](docs/spec-refatoracao.md).

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
Pode ser pendente, confirmado ou deixar de ser observado em uma coleta posterior.

**Correção local**:
Categoria, descrição ou indicação de ignorado escolhida pelo proprietário,
com prioridade sobre o valor importado, sem modificar a instituição financeira.

**Importação**:
Coleta de contas e transações disponibilizadas pela origem para uma conexão.
Sua conclusão não implica disponibilidade de todo o histórico bancário.

**Referência temporal**:
Data ou horário que permite distinguir quando o dado foi informado pela origem
e quando foi observado pelo Caderninho.
