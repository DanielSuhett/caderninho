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
Seu saldo tem moeda e referência temporal. O status é o caminho MCP para consultá-lo.
No banco, a conta é a chave do mapa de cinco valores na conexão; não é uma tabela.

**Transação**:
Registro financeiro associado a uma conta e identificado pela origem.
Pode ser pendente ou confirmado. Uma nova importação atualiza o mesmo ID e
preserva os registros ausentes na janela atual da origem.

**Importação**:
Coleta de contas e transações disponibilizadas pela origem para uma conexão.
Sua conclusão não implica disponibilidade de todo o histórico bancário.

**Referência temporal**:
Dia financeiro da transação, admissão/último sucesso da conexão ou horário da
leitura do saldo.
Transações não têm marcadores individuais de frescor.

**Checkpoint**:
Posição recuperável da importação corrente: fase, conta e cursor da origem.
Não é histórico de jobs nem um contador de registros.

**Parcialidade**:
A conexão não tem uma coleta integral atual, ou o agregado tem valores desconhecidos.
Uma falha conserva as páginas confirmadas e o último sucesso anterior.

**Autorização do assistente**:
Grant OAuth independente do cookie de oito horas do painel. Sair limpa o cookie;
revogar assistentes remove explicitamente os grants.
